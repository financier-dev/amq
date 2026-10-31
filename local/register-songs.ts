/*
 * Makes the song database match the video cache.
 *
 *   npm run register-songs              # update the database
 *   npm run register-songs -- --dry-run # only report what it would change
 *
 * 1. It merges each old document, which has no `annSongId`, into the
 *    document of its library song: found by its file first, else by anime,
 *    name, type and number. Library names can differ from the old ones, such
 *    as a new artist romanization. The old difficulty, alt answers and file
 *    are kept where the library document has none.
 * 2. It sets `webmPath` of every song to its cached file. The 720p file wins,
 *    then the 480p file, then any other cached file of the song.
 * 3. It queues a download for each song that has a file outside the cache and
 *    a 720p or 480p video on AMQ. The cache server sets `webmPath` when the
 *    download completes. Other songs keep their file.
 * 4. It removes the old `owned` field.
 *
 * Run `npm run scan-library` first, so that every song has its files. It
 * does not log in to AMQ. Queuing needs `npm run video-cache`.
 */

import { readdir } from 'node:fs/promises'
import path from 'node:path'
import { parseArgs } from 'node:util'
import type { AnyBulkWriteOperation } from 'mongodb'
import {
  CACHED_RESOLUTIONS,
  VIDEO_HOSTS,
  cachedFile,
  isCacheableFileId,
} from '@shared/videoCache'
import { queueDownloads } from './lib/cacheServer'
import { type SongDoc, fileMap, openSongDb } from './lib/songDb'
import { videoCacheDir } from './lib/videoCacheDir'

const { values: flags } = parseArgs({
  options: {
    'dry-run': { type: 'boolean', default: false },
    host: { type: 'string', default: 'NA2' },
    help: { type: 'boolean', short: 'h', default: false },
  },
})

if (flags.help) {
  console.log(`Usage: npm run register-songs [-- options]

Sets the cached file of every song in the song database, and queues the
videos of songs whose file is not cached.

  --dry-run      change nothing, only report
  --host <name>  the AMQ host to download from: EU, NA1 or NA2 (default NA2)`)
  process.exit(0)
}
if (!(flags.host in VIDEO_HOSTS)) {
  console.error(`Unknown host "${flags.host}". Use EU, NA1 or NA2.`)
  process.exit(1)
}
const dryRun = flags['dry-run']

const dir = videoCacheDir()
const cached = new Set((await readdir(dir)).filter(isCacheableFileId))
const cachePath = (fileId: string) => path.join(dir, fileId)
const fileOf = (doc: SongDoc) =>
  doc.webmPath === null ? null : path.basename(doc.webmPath)

/** The cached file of a song: 720p, then 480p, then any other. */
function bestCachedFile(doc: SongDoc): string | null {
  const files = fileMap(doc.files)
  for (const resolution of CACHED_RESOLUTIONS) {
    const fileId = files[resolution]
    if (fileId && cached.has(fileId)) return fileId
  }
  const any = doc.files?.find((file) => cached.has(file.fileId))?.fileId
  if (any) return any
  const own = fileOf(doc)
  return own && cached.has(own) ? own : null
}

const nameKey = (doc: SongDoc) =>
  JSON.stringify([doc.anime, doc.name, doc.type, doc.typeNumber])

/** How well a library song matches an old document. */
function score(old: SongDoc, song: SongDoc): number {
  return (
    Number(old.name === song.name) * 8 +
    Number(old.anime === song.anime) * 4 +
    Number(old.type === song.type && old.typeNumber === song.typeNumber) * 2 +
    Number(old.artist === song.artist)
  )
}

const { client, songs } = await openSongDb()

try {
  const docs = await songs.find().toArray()
  const library = docs.filter((doc) => doc.files)
  const old = docs.filter((doc) => doc.annSongId === undefined)
  console.error(
    `${docs.length} songs in the database: ${library.length} with their ` +
      `files, ${old.length} old. ${cached.size} files in the cache.`
  )

  const byFile = new Map<string, SongDoc[]>()
  const byName = new Map<string, SongDoc[]>()
  for (const doc of library) {
    for (const { fileId } of doc.files!) {
      byFile.set(fileId, [...(byFile.get(fileId) ?? []), doc])
    }
    byName.set(nameKey(doc), [...(byName.get(nameKey(doc)) ?? []), doc])
  }

  function libraryDocOf(doc: SongDoc): SongDoc | null {
    const candidates = byFile.get(fileOf(doc) ?? '')
    if (candidates) {
      return candidates.reduce((best, song) =>
        score(doc, song) > score(doc, best) ? song : best
      )
    }
    const named = byName.get(nameKey(doc)) ?? []
    if (named.length === 1) return named[0]
    return named.find((song) => song.artist === doc.artist) ?? null
  }

  const ops: AnyBulkWriteOperation<SongDoc>[] = []

  // 1. Merge old documents into their library song.
  const merged = new Set<SongDoc>()
  const unlinked: SongDoc[] = []
  for (const doc of old) {
    const target = libraryDocOf(doc)
    if (!target || merged.has(target)) {
      unlinked.push(doc)
      continue
    }
    merged.add(target)
    if (target.difficulty === null) target.difficulty = doc.difficulty
    if (!target.altAnswers?.length) target.altAnswers = doc.altAnswers ?? []
    if (target.webmPath === null) target.webmPath = doc.webmPath
    ops.push({ deleteOne: { filter: { _id: doc._id } } })
    ops.push({
      updateOne: {
        filter: { _id: target._id },
        update: {
          $set: {
            difficulty: target.difficulty,
            altAnswers: target.altAnswers,
            webmPath: target.webmPath,
          },
        },
      },
    })
  }
  console.error(
    `1. merged ${merged.size} old songs into their library song, ` +
      `${unlinked.length} not found in the library`
  )

  // 2. Set the cached file of every song.
  const linked = docs.filter((doc) => doc.annSongId !== undefined)
  const live = [...linked, ...unlinked]
  let pointed = 0
  for (const doc of live) {
    const fileId = bestCachedFile(doc)
    if (!fileId || doc.webmPath === cachePath(fileId)) continue
    doc.webmPath = cachePath(fileId)
    pointed++
    ops.push({
      updateOne: {
        filter: { _id: doc._id },
        update: { $set: { webmPath: doc.webmPath } },
      },
    })
  }
  console.error(`2. set the cached file of ${pointed} songs`)

  // 3. Queue the songs whose file is outside the cache.
  const outside = live.filter(
    (doc) => doc.webmPath !== null && !doc.webmPath.startsWith(dir + path.sep)
  )
  const toQueue = new Set<string>()
  const kept: SongDoc[] = []
  for (const doc of outside) {
    const fileId = cachedFile(fileMap(doc.files))?.fileId
    if (fileId) toQueue.add(fileId)
    else kept.push(doc)
  }

  if (!dryRun) {
    if (ops.length) await songs.bulkWrite(ops, { ordered: true })
    // 4. Remove `owned`, and fill in `altAnswers` where it is missing.
    await songs.updateMany(
      { owned: { $exists: true } } as any,
      { $unset: { owned: '' } } as any
    )
    await songs.updateMany(
      { altAnswers: { $exists: false } },
      { $set: { altAnswers: [] } }
    )
    try {
      const added = await queueDownloads([...toQueue], flags.host)
      console.error(`3. queued ${added} of ${toQueue.size} downloads`)
    } catch (error) {
      console.error(
        `3. could not queue ${toQueue.size} downloads: the cache server did ` +
          `not answer (${(error as Error).message}). Start ` +
          '`npm run video-cache` and run this again.'
      )
      process.exitCode = 1
    }
  } else {
    console.error(`3. would queue ${toQueue.size} downloads`)
  }
  if (kept.length) {
    console.error(
      `   ${kept.length} songs keep their file outside the cache: not in ` +
        'the library, or no 720p or 480p video'
    )
    for (const doc of kept) {
      console.error(`     ${doc.anime} - ${doc.name}: ${doc.webmPath}`)
    }
  }

  const used = new Set(live.map((doc) => doc.webmPath))
  const unregistered = [...cached].filter((id) => !used.has(cachePath(id)))
  console.error(
    `${unregistered.length} cached files are in no song` +
      (unregistered.length
        ? `, such as ${unregistered.slice(0, 5).join(', ')}. ` +
          'Run `npm run scan-library -- --refresh` to update the files.'
        : '.')
  )
  if (dryRun) console.error('Dry run: nothing changed.')
} finally {
  await client.close()
}
