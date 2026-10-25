/*
 * Finds cached videos that AMQ no longer serves, and deletes them with
 * `--delete`.
 *
 *   npm run clean-video-cache               # report only
 *   npm run clean-video-cache -- --delete   # delete them
 *
 * It sends a `HEAD` request for each cached file to an AMQ video host. A 404
 * means AMQ deleted the file, usually because the song got a new video. Any
 * other failure (timeout, server error) keeps the file.
 *
 * It does not find a file that AMQ replaced but still serves. It does not log
 * in to AMQ.
 */

import { readdir, rm, stat } from 'node:fs/promises'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { VIDEO_HOSTS } from '@shared/videoCache'
import { videoCacheDir } from './lib/videoCacheDir'

const CONCURRENCY = 4
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

Checks every video in ${videoCacheDir()} against AMQ's video host and lists
the ones AMQ no longer serves.

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
const files = (await readdir(dir)).filter((name) => /\.(webm|mp3)$/i.test(name))

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

const goneBytes = gone.reduce((sum, file) => sum + file.size, 0)
const gb = (goneBytes / 1e9).toFixed(1)

for (const { name } of gone.sort((a, b) => a.name.localeCompare(b.name))) {
  console.log(name)
}
console.error(
  `${gone.length} of ${files.length} files are no longer on AMQ (${gb} GB).`
)
if (unknown.length) {
  console.error(
    `${unknown.length} files could not be checked and were kept. Run again later.`
  )
}

if (flags.delete) {
  for (const { name } of gone) await rm(path.join(dir, name))
  console.error(`Deleted ${gone.length} files (${gb} GB).`)
} else if (gone.length) {
  console.error('Nothing was deleted. Add `-- --delete` to delete them.')
}
