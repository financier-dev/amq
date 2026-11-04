/*
 * Sets `added` and `lastUpdated` on the songs of the song database
 * (`local/lib/songDb.ts`) from exports of the Discord approvals channel.
 *
 *   npm run approval-dates               # read new exports, set the dates
 *   npm run approval-dates -- --full     # read every export again
 *   npm run approval-dates -- --dry-run  # report, do not write
 *
 * The exports are `local/.cache/discord/approvals-<UTC time>.json`, one JSON
 * object with the raw Discord messages in `messages`. The time in the name is
 * when the export was made, so the export has every message up to it. The
 * newest time read is saved in `amq.meta` (`_id: 'approvalsScannedThrough'`),
 * and the next run reads only the exports made after it. Each approval
 * message read is kept in `amq.approvals`, so a run never needs the older
 * exports: the dates of every song are computed again from that collection.
 *
 * Each approval message is an embed by the approvals bot:
 *
 *   A new song has been approved!
 *   **Anime:** …  **Song:** …  **Artist:** …  **Song Type:** …  **Link:** <…>
 *
 * - `added` is the earliest "A new song has been approved!" message.
 * - `lastUpdated` is the latest "A replacement has been approved!" message.
 * - Either is null when no message matches.
 *
 * A message finds its songs in three steps. Each step is used only when the
 * one before it found no song:
 *
 * 1. File: the file name at the end of the link is in the song's `files`.
 * 2. Linked message: the link's file is no longer in any song, usually
 *    because the video was replaced. Another approval message with the same
 *    anime, name, artist and type has a file that is. The anime name is the
 *    English title on every message, so it is compared between messages.
 * 3. Name: exactly one song has the same name, artist, type and number. When
 *    several do, the anime name or an alt answer must pick one.
 * 4. Anime: songs with the same anime name (or alt answer), name, type and
 *    number, whatever the artist. Old messages often credit the voice actors
 *    where the database now has the group's name. It finds a song only when
 *    the message's English title is also the database's title or alt answer.
 *    All songs that fit get the date, but a match on the song's own anime
 *    name wins over one on an alt answer.
 *
 * In steps 1 and 2, name, artist and type must mostly agree (see `MIN_SCORE`),
 * because AMQ can give an old file name to a different song. Several anime
 * entries can share a file. When there is a message for each, each entry gets
 * its own message (see `matchSameFile`). Otherwise all the songs with the
 * best score get the date. Steps 2 to 4 give `added` only to songs that step 1 gave none.
 */

import fs from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'
import type { AnyBulkWriteOperation } from 'mongodb'
import { repo } from '@shared/node/env'
import { type ApprovalDoc, type SongDoc, openSongDb } from './lib/songDb'

const EXPORT_DIR = path.join(repo, 'local', '.cache', 'discord')
const EXPORT_FILE =
  /^approvals-(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})Z\.json$/
const META_ID = 'approvalsScannedThrough'
const NEW_SONG = 'A new song has been approved!'
const REPLACEMENT = 'A replacement has been approved!'
/**
 * The lowest score of a match, out of 3: name similarity + artist similarity
 * + type (1 for the same type and number, 0.5 for the same type only).
 * Messages keep the names of the day they were posted and the database has
 * today's, so an exact match is not required.
 */
const MIN_SCORE = 1.5
/** In step 3, the lowest anime similarity that picks one of several songs. */
const MIN_ANIME_SIMILARITY = 0.8

const { values: flags } = parseArgs({
  options: {
    full: { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
    verbose: { type: 'boolean', short: 'v', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
})

if (flags.help) {
  console.log(`Usage: npm run approval-dates [-- options]

Reads new exports of the Discord approvals channel from local/.cache/discord/,
then sets when each song was approved (added) and last replaced (lastUpdated).

  --full     read every export again, not only the new ones
  --dry-run  print what would change, and write nothing
  --verbose  print each match not found by file`)
  process.exit(0)
}

interface ExportFile {
  file: string
  exportedAt: Date
}

function exportFiles(): ExportFile[] {
  if (!fs.existsSync(EXPORT_DIR)) return []
  return fs
    .readdirSync(EXPORT_DIR)
    .flatMap((name) => {
      const m = name.match(EXPORT_FILE)
      if (!m) return []
      const exportedAt = new Date(`${m[1]}T${m[2]}:${m[3]}:${m[4]}Z`)
      return [{ file: path.join(EXPORT_DIR, name), exportedAt }]
    })
    .sort((a, b) => a.exportedAt.getTime() - b.exportedAt.getTime())
}

function field(text: string, label: string): string {
  return (
    text.match(new RegExp(`\\*\\*${label}:\\*\\* ?(.*)`))?.[1]?.trim() ?? ''
  )
}

/** Any approval message with a link. Other messages give null. */
function parseApproval(message: any): ApprovalDoc | null {
  const text: unknown = message?.embeds?.[0]?.description
  if (typeof text !== 'string') return null
  const link = field(text, 'Link').replace(/^<|>$/g, '')
  const fileId = link.split('/').pop()
  if (!fileId) return null
  return {
    _id: message.id,
    kind: text.split('\n')[0].trim(),
    postedAt: new Date(message.timestamp),
    anime: field(text, 'Anime'),
    name: field(text, 'Song'),
    artist: field(text, 'Artist'),
    songType: field(text, 'Song Type'),
    fileId,
  }
}

function readExport(file: string): ApprovalDoc[] {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'))
  return (data.messages ?? []).flatMap((message: any) => {
    const approval = parseApproval(message)
    return approval ? [approval] : []
  })
}

/** "Opening 1" → "OP1", "Ending2" → "ED2", "Insert Song" → "IN". */
function typeKey(songType: string): string {
  const m = songType.match(/^(Opening|Ending)\s*(\d+)/i)
  if (m) return (m[1].toLowerCase() === 'opening' ? 'OP' : 'ED') + m[2]
  return /^insert/i.test(songType) ? 'IN' : songType.toLowerCase()
}

function songTypeKey(song: Pick<SongDoc, 'type' | 'typeNumber'>): string {
  return song.type === 'IN' ? 'IN' : `${song.type}${song.typeNumber ?? ''}`
}

/**
 * Lowercase letters and digits only, without accents. Long vowels become one
 * vowel, because romanization changed over time: older entries write "ū" and
 * "ō", newer ones "uu" and "ou", and some "oo" ("Kakyūsei" is "Kakyuusei").
 */
function normalize(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '')
    .replace(/ou|oo/g, 'o')
    .replace(/uu/g, 'u')
    .replace(/aa/g, 'a')
    .replace(/ii/g, 'i')
    .replace(/ee/g, 'e')
}

function bigrams(text: string): Map<string, number> {
  const counts = new Map<string, number>()
  for (let i = 0; i < text.length - 1; i++) {
    const pair = text.slice(i, i + 2)
    counts.set(pair, (counts.get(pair) ?? 0) + 1)
  }
  return counts
}

/** Dice coefficient of the character pairs: 0 (nothing alike) to 1 (equal). */
function similarity(a: string, b: string): number {
  const x = normalize(a)
  const y = normalize(b)
  if (x === y) return 1
  if (x.length < 2 || y.length < 2) return 0
  const pairsX = bigrams(x)
  const pairsY = bigrams(y)
  let shared = 0
  for (const [pair, count] of pairsX) {
    shared += Math.min(count, pairsY.get(pair) ?? 0)
  }
  return (2 * shared) / (x.length - 1 + y.length - 1)
}

type Song = Pick<
  SongDoc,
  | 'anime'
  | 'name'
  | 'artist'
  | 'type'
  | 'typeNumber'
  | 'files'
  | 'altAnswers'
  | 'added'
  | 'lastUpdated'
> & { id: string; _id: NonNullable<SongDoc['_id']> }

function score(approval: ApprovalDoc, song: Song): number {
  const posted = typeKey(approval.songType)
  const typeScore =
    posted === songTypeKey(song)
      ? 1
      : posted.slice(0, 2) === song.type
        ? 0.5
        : 0
  return (
    similarity(approval.name, song.name) +
    similarity(approval.artist, song.artist) +
    typeScore
  )
}

/** The best matches among `candidates`, or none. */
function bestMatches(approval: ApprovalDoc, candidates: Song[]): Song[] {
  let best: Song[] = []
  let bestScore = MIN_SCORE
  for (const song of new Set(candidates)) {
    const s = Math.round(score(approval, song) * 100) / 100
    if (s > bestScore) {
      best = [song]
      bestScore = s
    } else if (s === bestScore) {
      best.push(song)
    }
  }
  return best
}

/** How well the message's anime name fits the song's name or alt answers. */
function animeScore(approval: ApprovalDoc, song: Song): number {
  return Math.max(
    similarity(approval.anime, song.anime),
    ...(song.altAnswers ?? []).map((alt) => similarity(approval.anime, alt))
  )
}

/**
 * The songs of each message about one file. Several anime entries can share
 * a file, and each entry usually has its own message. So messages and songs
 * are first paired one to one, best pair first: score, then anime name, then
 * the earlier message. Then a song left without a message gets every message
 * for which it is one of the best matches, and a message left without a song,
 * such as a second approval of the same file, goes to its best matches.
 */
function matchSameFile(
  approvals: ApprovalDoc[],
  candidates: Song[]
): Map<string, Song[]> {
  const pairs = approvals.flatMap((approval) =>
    [...new Set(candidates)].flatMap((song) => {
      const s = Math.round(score(approval, song) * 100) / 100
      if (s < MIN_SCORE) return []
      return [{ approval, song, s, anime: animeScore(approval, song) }]
    })
  )
  pairs.sort(
    (a, b) =>
      b.s - a.s ||
      b.anime - a.anime ||
      a.approval.postedAt.getTime() - b.approval.postedAt.getTime()
  )
  const result = new Map<string, Song[]>()
  const usedSongs = new Set<string>()
  for (const { approval, song } of pairs) {
    if (result.has(approval._id) || usedSongs.has(song.id)) continue
    result.set(approval._id, [song])
    usedSongs.add(song.id)
  }
  for (const approval of approvals) {
    const paired = result.has(approval._id)
    for (const song of bestMatches(approval, candidates)) {
      if (paired && usedSongs.has(song.id)) continue
      if (result.get(approval._id)?.includes(song)) continue
      result.set(approval._id, [...(result.get(approval._id) ?? []), song])
    }
  }
  return result
}

const db = await openSongDb()
try {
  // Read the new exports.
  const meta = await db.meta.findOne({ _id: META_ID })
  const kept = await db.approvals.estimatedDocumentCount()
  const scannedThrough =
    !flags.full && kept > 0 && meta?.value instanceof Date ? meta.value : null
  const files = exportFiles().filter(
    (f) => !scannedThrough || f.exportedAt > scannedThrough
  )
  console.error(
    scannedThrough
      ? `Exports read through ${scannedThrough.toISOString()}.`
      : 'Reading every export.'
  )
  const read = new Map<string, ApprovalDoc>()
  for (const f of files) {
    console.error(`Reading ${path.basename(f.file)}`)
    for (const approval of readExport(f.file)) read.set(approval._id, approval)
  }
  console.error(`${read.size} approval messages in the new exports.`)

  const approvalsById = new Map<string, ApprovalDoc>()
  for await (const approval of db.approvals.find()) {
    approvalsById.set(approval._id, approval)
  }
  for (const approval of read.values())
    approvalsById.set(approval._id, approval)
  const approvals = [...approvalsById.values()].sort(
    (a, b) => a.postedAt.getTime() - b.postedAt.getTime()
  )

  // Index the songs.
  const songs: Song[] = []
  const songsByFile = new Map<string, Song[]>()
  const songsByName = new Map<string, Song[]>()
  const songsByAnime = new Map<string, Song[]>()
  const animeSongKey = (anime: string, name: string, type: string) =>
    [normalize(anime), normalize(name), type].join('|')
  const cursor = db.songs.find(
    {},
    {
      projection: {
        anime: 1,
        name: 1,
        artist: 1,
        type: 1,
        typeNumber: 1,
        files: 1,
        altAnswers: 1,
        added: 1,
        lastUpdated: 1,
      },
    }
  )
  for await (const doc of cursor) {
    const song = { ...doc, id: doc._id!.toHexString() } as Song
    songs.push(song)
    for (const { fileId } of song.files ?? []) {
      songsByFile.set(fileId, [...(songsByFile.get(fileId) ?? []), song])
    }
    const key = [
      normalize(song.name),
      normalize(song.artist),
      songTypeKey(song),
    ]
    const nameKey = key.join('|')
    songsByName.set(nameKey, [...(songsByName.get(nameKey) ?? []), song])
    for (const anime of new Set([song.anime, ...(song.altAnswers ?? [])])) {
      const animeKey = animeSongKey(anime, song.name, songTypeKey(song))
      songsByAnime.set(animeKey, [...(songsByAnime.get(animeKey) ?? []), song])
    }
  }

  const messageKey = (a: ApprovalDoc) =>
    [
      normalize(a.anime),
      normalize(a.name),
      normalize(a.artist),
      typeKey(a.songType),
    ].join('|')
  const sameSong = new Map<string, ApprovalDoc[]>()
  for (const approval of approvals) {
    const key = messageKey(approval)
    sameSong.set(key, [...(sameSong.get(key) ?? []), approval])
  }

  // Step 1 for every message.
  const fileMatches = new Map<string, Song[]>()
  const sameFile = new Map<string, ApprovalDoc[]>()
  for (const approval of approvals) {
    const key = `${approval.kind}|${approval.fileId}`
    sameFile.set(key, [...(sameFile.get(key) ?? []), approval])
  }
  for (const group of sameFile.values()) {
    const candidates = songsByFile.get(group[0].fileId) ?? []
    if (candidates.length === 0) continue
    for (const [id, songs] of matchSameFile(group, candidates)) {
      fileMatches.set(id, songs)
    }
  }
  const byFile = (approval: ApprovalDoc) => fileMatches.get(approval._id) ?? []

  const byLinkedMessage = (approval: ApprovalDoc) =>
    bestMatches(
      approval,
      (sameSong.get(messageKey(approval)) ?? [])
        .filter((other) => other._id !== approval._id)
        .flatMap(byFile)
    )

  function byName(approval: ApprovalDoc): Song[] {
    const key = [
      normalize(approval.name),
      normalize(approval.artist),
      typeKey(approval.songType),
    ].join('|')
    const candidates = songsByName.get(key) ?? []
    if (candidates.length <= 1) return candidates
    const ranked = candidates
      .map((song) => ({ song, s: animeScore(approval, song) }))
      .sort((a, b) => b.s - a.s)
    const [first, second] = ranked
    return first.s >= MIN_ANIME_SIMILARITY && first.s > second.s
      ? [first.song]
      : []
  }

  /** Songs whose own anime name matches win over alt answer matches. */
  function byAnime(approval: ApprovalDoc): Song[] {
    const candidates = new Set(
      songsByAnime.get(
        animeSongKey(approval.anime, approval.name, typeKey(approval.songType))
      ) ?? []
    )
    const own = [...candidates].filter(
      (song) => normalize(song.anime) === normalize(approval.anime)
    )
    return own.length ? own : [...candidates]
  }

  // Match the messages to songs.
  const added = new Map<string, Date>()
  const lastUpdated = new Map<string, Date>()
  const setDate = (dates: Map<string, Date>, song: Song, date: Date) => {
    const prev = dates.get(song.id)
    const earlier = dates === added
    if (!prev || (earlier ? date < prev : date > prev)) dates.set(song.id, date)
  }
  type Step = 'file' | 'linked message' | 'name' | 'anime' | 'none'
  const noCounts = (): Record<Step, number> => ({
    file: 0,
    'linked message': 0,
    name: 0,
    anime: 0,
    none: 0,
  })
  const counts: Record<string, Record<Step, number>> = {
    [NEW_SONG]: noCounts(),
    [REPLACEMENT]: noCounts(),
  }

  const dated = approvals.filter(
    (a) => a.kind === NEW_SONG || a.kind === REPLACEMENT
  )
  const unmatched: ApprovalDoc[] = []
  for (const approval of dated) {
    const dates = approval.kind === NEW_SONG ? added : lastUpdated
    const matches = byFile(approval)
    for (const song of matches) setDate(dates, song, approval.postedAt)
    if (matches.length) counts[approval.kind].file++
    else if (!songsByFile.has(approval.fileId)) unmatched.push(approval)
    else counts[approval.kind].none++
  }
  // Steps 2 to 4 run after step 1 has seen every message, so that they only
  // fill the dates that step 1 left empty.
  const hasFileDate = new Set(added.keys())
  for (const approval of unmatched) {
    const isNew = approval.kind === NEW_SONG
    const dates = isNew ? added : lastUpdated
    const keep = (song: Song) => !isNew || !hasFileDate.has(song.id)
    let step: Step = 'none'
    let matches = byLinkedMessage(approval).filter(keep)
    if (matches.length) step = 'linked message'
    else {
      matches = byName(approval).filter(keep)
      if (matches.length) step = 'name'
      else {
        matches = byAnime(approval).filter(keep)
        if (matches.length) step = 'anime'
      }
    }
    for (const song of matches) setDate(dates, song, approval.postedAt)
    counts[approval.kind][step]++
    if (flags.verbose && matches.length) {
      const date = approval.postedAt.toISOString().slice(0, 10)
      console.log(
        `[${step}] ${date} ${approval.anime} / ${approval.name} / ` +
          `${approval.artist} / ${approval.songType}`
      )
      for (const song of matches) {
        console.log(
          `    → ${song.anime} / ${song.name} / ${song.artist} / ` +
            songTypeKey(song)
        )
      }
    }
  }

  for (const kind of [NEW_SONG, REPLACEMENT]) {
    const c = counts[kind]
    console.log(
      `${kind} by file ${c.file}, by linked message ${c['linked message']}, ` +
        `by name ${c.name}, by anime ${c.anime}, no song ${c.none}`
    )
  }
  console.log(
    `Songs with a date: added ${added.size}, lastUpdated ${lastUpdated.size}, ` +
      `of ${songs.length}.`
  )

  const ops: AnyBulkWriteOperation<SongDoc>[] = []
  const same = (a: Date | null | undefined, b: Date | null) =>
    a === undefined ? false : (a?.getTime() ?? null) === (b?.getTime() ?? null)
  for (const song of songs) {
    const newAdded = added.get(song.id) ?? null
    const newUpdated = lastUpdated.get(song.id) ?? null
    if (same(song.added, newAdded) && same(song.lastUpdated, newUpdated)) {
      continue
    }
    ops.push({
      updateOne: {
        filter: { _id: song._id },
        update: { $set: { added: newAdded, lastUpdated: newUpdated } },
      },
    })
  }
  console.log(`${ops.length} songs to change.`)

  if (flags['dry-run']) {
    console.log('Dry run: nothing written.')
  } else {
    if (read.size) {
      await db.approvals.bulkWrite(
        [...read.values()].map((approval) => ({
          replaceOne: {
            filter: { _id: approval._id },
            replacement: approval,
            upsert: true,
          },
        }))
      )
    }
    if (ops.length) await db.songs.bulkWrite(ops)
    const newest = files.at(-1)?.exportedAt
    if (newest && (!scannedThrough || newest > scannedThrough)) {
      await db.meta.updateOne(
        { _id: META_ID },
        { $set: { value: newest } },
        { upsert: true }
      )
    }
    console.log('Saved.')
  }
} finally {
  await db.client.close()
}
