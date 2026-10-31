/*
 * Finds cached videos that no song uses or that AMQ no longer serves, and
 * deletes them with `--delete`.
 *
 *   npm run clean-video-cache               # report only
 *   npm run clean-video-cache -- --delete   # delete them
 *
 * A file is in no song when no document of the song database has it as its
 * `webmPath` or in its `files`. This happens when `npm run scan-library`
 * deleted the song, or when AMQ gave the song a new file. It is checked only
 * when the song database is complete: a library check finished and every
 * song has its files.
 *
 * It sends a `HEAD` request for each other cached file to an AMQ video host,
 * `CONCURRENCY` at a time. A 404 means AMQ deleted the file, usually because
 * the song got a new video. Any other failure (timeout, server error) keeps
 * the file.
 *
 * Deleting a file sets `webmPath` to null in the song database, for the songs
 * that used it. The new video downloads when the song plays in a game.
 *
 * It does not find a file that AMQ replaced but still serves. It does not log
 * in to AMQ.
 */

import { readdir, rm, stat } from 'node:fs/promises'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { VIDEO_HOSTS } from '@shared/videoCache'
import { openSongDb, savedMasterListId } from './lib/songDb'
import { videoCacheDir } from './lib/videoCacheDir'

/** Never send more requests than this to AMQ at the same time. */
const CONCURRENCY = 2
const TIMEOUT_MS = 15_000

const { values: flags } = parseArgs({
  options: {
    delete: { type: 'boolean', default: false },
    host: { type: 'string', default: 'NA2' },
    help: { type: 'boolean', short: 'h', default: false },
  },
})

if (flags.help) {
  console.log(`Usage: npm run clean-video-cache [-- --delete] [-- --host EU|NA1|NA2]

Lists the videos in ${videoCacheDir()} that no song in the song database
uses, and the ones AMQ's video host no longer serves.

  --delete       delete those files
  --host <name>  the AMQ host to check against (default NA2)`)
  process.exit(0)
}

const endpoint = VIDEO_HOSTS[flags.host]
if (!endpoint) {
  console.error(`Unknown host "${flags.host}". Use EU, NA1 or NA2.`)
  process.exit(1)
}

const dir = videoCacheDir()
const cachedFiles = (await readdir(dir)).filter((name) =>
  /\.(webm|mp3)$/i.test(name)
)
const { client, songs, meta } = await openSongDb()

/** The cached files that no song uses, or null when the database is not complete. */
async function unusedFiles(): Promise<string[] | null> {
  const unscanned = await songs.countDocuments({
    annSongId: { $exists: true },
    files: { $exists: false },
  })
  if (!(await savedMasterListId(meta)) || unscanned) return null
  const used = new Set<string>()
  for await (const doc of songs
    .find()
    .project<{ webmPath: string | null; files?: { fileId: string }[] }>({
      webmPath: 1,
      files: 1,
    })) {
    if (doc.webmPath?.startsWith(dir + path.sep)) {
      used.add(path.basename(doc.webmPath))
    }
    for (const { fileId } of doc.files ?? []) used.add(fileId)
  }
  return cachedFiles.filter((name) => !used.has(name))
}

const unused = await unusedFiles()
const unusedSet = new Set(unused)
const files = cachedFiles.filter((name) => !unusedSet.has(name))

type Status = 'kept' | 'gone' | 'unknown'

async function check(name: string): Promise<Status> {
  try {
    const res = await fetch(endpoint + name, {
      method: 'HEAD',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (res.ok) return 'kept'
    if (res.status === 404) return 'gone'
    return 'unknown'
  } catch {
    return 'unknown'
  }
}

const gone: { name: string; size: number }[] = []
const unknown: string[] = []
let done = 0
let next = 0

async function worker() {
  while (next < files.length) {
    const name = files[next++]
    const status = await check(name)
    if (status === 'gone') {
      gone.push({ name, size: (await stat(path.join(dir, name))).size })
    } else if (status === 'unknown') {
      unknown.push(name)
    }
    done++
    if (process.stderr.isTTY) {
      process.stderr.write(`\rchecked ${done}/${files.length}`)
    }
  }
}

console.error(`Checking ${files.length} files in ${dir} against ${endpoint}`)
await Promise.all(Array.from({ length: CONCURRENCY }, worker))
if (process.stderr.isTTY) process.stderr.write('\n')

const unusedSizes = await Promise.all(
  (unused ?? []).map(async (name) => ({
    name,
    size: (await stat(path.join(dir, name))).size,
  }))
)
const toDelete = [...unusedSizes, ...gone].sort((a, b) =>
  a.name.localeCompare(b.name)
)
const gb = (toDelete.reduce((sum, file) => sum + file.size, 0) / 1e9).toFixed(1)

for (const { name } of toDelete) console.log(name)
if (unused) {
  console.error(`${unused.length} files are in no song in the song database.`)
} else {
  console.error(
    'The song database is not complete, so files in no song were not looked ' +
      'for. Run `npm run scan-library` first.'
  )
}
console.error(`${gone.length} of ${files.length} files are no longer on AMQ.`)
if (unknown.length) {
  console.error(
    `${unknown.length} files could not be checked and were kept. Run again later.`
  )
}

if (flags.delete) {
  const paths = toDelete.map(({ name }) => path.join(dir, name))
  for (const file of paths) await rm(file)
  const result = await songs.updateMany(
    { webmPath: { $in: paths } },
    { $set: { webmPath: null } }
  )
  console.error(
    `Deleted ${toDelete.length} files (${gb} GB). ${result.modifiedCount} ` +
      'songs in the song database have no cached file now.'
  )
} else if (toDelete.length) {
  console.error(
    `Nothing was deleted (${gb} GB). Add \`-- --delete\` to delete them.`
  )
}
await client.close()
