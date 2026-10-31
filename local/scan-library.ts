/*
 * Keeps the song database (`local/lib/songDb.ts`) in step with AMQ's song
 * library.
 *
 *   npm run scan-library                    # changes since the last run
 *   npm run scan-library -- --refresh       # also ask for every song's files
 *   npm run scan-library -- --limit 20      # ask about 20 songs at most
 *
 * The library has a master list ID, which changes when AMQ changes the
 * library. When the ID is not the one saved by the last run, the script
 * compares each library song with its document, by `annSongId`:
 *
 * - a new song is added,
 * - a song whose names, type, number or upload state changed is updated,
 * - a song that is no longer in the library is deleted. Its cached video is
 *   then in no song, and `npm run clean-video-cache -- --delete` deletes it.
 *
 * Then it asks AMQ for the files of each uploaded song that has none, which
 * includes the new songs. Each answer is saved at once, so a run that stops
 * can go on later. A song whose file is already cached gets it as its
 * `webmPath`. The library does not show when AMQ replaces a video, so a
 * replaced file shows only with `--refresh`.
 *
 * It logs in with `AMQ_TEST_ACCOUNT_*` and only reads. It disconnects
 * `npm run watch-rooms`, which uses the same account.
 */

import { parseArgs } from 'node:util'
import type { AnyBulkWriteOperation } from 'mongodb'
import { guardSession, openSession } from '@shared/node/session'
import { type LibrarySong, askAll, readLibrary } from './lib/library'
import {
  type SongDoc,
  openSongDb,
  saveMasterListId,
  saveSong,
  savedMasterListId,
} from './lib/songDb'

/** Never send more requests than this to AMQ at the same time. */
const MAX_CONCURRENCY = 2
const REPORT_EVERY = 500
/** The fields that the library gives and the comparison checks. */
const COMPARED = [
  'annId',
  'anime',
  'artist',
  'name',
  'type',
  'typeNumber',
  'uploaded',
] as const
/**
 * Do not delete songs when the library has fewer songs than this share of
 * the database. A library that did not load completely must not empty it.
 */
const MIN_LIBRARY_SHARE = 0.9

const { values: flags } = parseArgs({
  options: {
    refresh: { type: 'boolean', default: false },
    limit: { type: 'string' },
    concurrency: { type: 'string', default: '2' },
    headed: { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
})

if (flags.help) {
  console.log(`Usage: npm run scan-library [-- options]

Updates the song database from AMQ's song library, and asks for the files of
new songs.

  --refresh          compare every song, and ask for the files of every
                     uploaded song again
  --limit <n>        ask about the files of n songs at most
  --concurrency <n>  requests at the same time: 1 or 2 (default 2)
  --headed           show the browser`)
  process.exit(0)
}

const limit = flags.limit === undefined ? Infinity : Number(flags.limit)
const concurrency = Number(flags.concurrency)
if (!(limit > 0)) {
  console.error('--limit must be a positive number.')
  process.exit(1)
}
if (concurrency !== 1 && concurrency !== MAX_CONCURRENCY) {
  console.error(`--concurrency must be 1 or ${MAX_CONCURRENCY}.`)
  process.exit(1)
}

const label = (song: Pick<SongDoc, 'anime' | 'name' | 'type' | 'typeNumber'>) =>
  `${song.anime} ${song.type}${song.typeNumber ? ` ${song.typeNumber}` : ''} "${song.name}"`

/** Adds, updates and deletes songs to match the library. */
async function applyLibrary(
  songs: Awaited<ReturnType<typeof openSongDb>>['songs'],
  library: LibrarySong[]
) {
  const projection = Object.fromEntries(
    ['annSongId', ...COMPARED].map((key) => [key, 1])
  )
  const docs = await songs
    .find({ annSongId: { $exists: true } })
    .project<SongDoc>(projection)
    .toArray()
  const byId = new Map(docs.map((doc) => [doc.annSongId!, doc]))
  const inLibrary = new Set(library.map((song) => song.annSongId))

  const ops: AnyBulkWriteOperation<SongDoc>[] = []
  const changes: string[] = []
  const added: LibrarySong[] = []
  for (const song of library) {
    const doc = byId.get(song.annSongId)
    if (!doc) {
      added.push(song)
      continue
    }
    const set: Partial<SongDoc> = {}
    const unset: Record<string, ''> = {}
    const changed: string[] = []
    for (const key of COMPARED) {
      if (doc[key] === song[key]) continue
      ;(set as any)[key] = song[key]
      // Documents from before `uploaded` existed get it without a report.
      if (doc[key] !== undefined) {
        changed.push(
          `${key} ${JSON.stringify(doc[key])} → ${JSON.stringify(song[key])}`
        )
      }
    }
    if (!Object.keys(set).length) continue
    if (doc.uploaded === false && song.uploaded) unset.files = ''
    if (doc.uploaded !== false && !song.uploaded) set.files = []
    if (changed.length) changes.push(`${label(song)}: ${changed.join(', ')}`)
    ops.push({
      updateOne: {
        filter: { annSongId: song.annSongId },
        update: Object.keys(unset).length
          ? { $set: set, $unset: unset }
          : { $set: set },
      },
    })
  }

  const gone = docs.filter((doc) => !inLibrary.has(doc.annSongId!))
  if (gone.length && library.length < docs.length * MIN_LIBRARY_SHARE) {
    throw new Error(
      `The library has ${library.length} songs and the database ` +
        `${docs.length}. It did not load completely, so no song is deleted. ` +
        'Run this again later.'
    )
  }
  for (const doc of gone) {
    ops.push({ deleteOne: { filter: { annSongId: doc.annSongId } } })
  }
  if (ops.length) await songs.bulkWrite(ops, { ordered: false })

  for (const [index, song] of added.entries()) {
    // A song with no upload has no files to ask about.
    await saveSong(songs, song.uploaded ? song : { ...song, files: [] })
    if ((index + 1) % 5000 === 0) {
      console.error(`added ${index + 1}/${added.length} songs`)
    }
  }

  for (const change of changes) console.log(`changed: ${change}`)
  for (const doc of gone) console.log(`deleted: ${label(doc)}`)
  console.error(
    `${added.length} songs added, ${changes.length} changed, ` +
      `${gone.length} deleted`
  )
}

const { client, songs, meta } = await openSongDb()
const { browser, page } = await openSession({
  headed: flags.headed,
  accounts: ['AMQ_TEST_ACCOUNT'],
})

try {
  const check = await guardSession(page)
  const library = await readLibrary(page)
  const savedId = await savedMasterListId(meta)
  console.error(
    `${library.songs.length} songs in the library (master list ` +
      `${library.masterListId}, last run: ${savedId ?? 'none'})`
  )
  if (flags.refresh || savedId !== library.masterListId) {
    await applyLibrary(songs, library.songs)
    await saveMasterListId(meta, library.masterListId)
  } else {
    console.error('The library did not change.')
  }

  const asked = new Set(
    flags.refresh
      ? []
      : (
          await songs
            .find({ files: { $exists: true } })
            .project<SongDoc>({ annSongId: 1 })
            .toArray()
        ).map((doc) => doc.annSongId)
  )
  const todo = library.songs
    .filter((song) => song.uploaded && !asked.has(song.annSongId))
    .slice(0, limit)
  console.error(`asking for the files of ${todo.length} songs`)

  const started = Date.now()
  await askAll(page, todo, {
    concurrency,
    check,
    async onAnswer(song, done) {
      await saveSong(songs, song)
      if (done % REPORT_EVERY === 0) {
        const perSong = (Date.now() - started) / done
        const left = Math.ceil(((todo.length - done) * perSong) / 60_000)
        console.error(`asked ${done}/${todo.length}, about ${left} min left`)
      }
    },
  })
  console.error('Done.')
} finally {
  await browser.close()
  await client.close()
}
