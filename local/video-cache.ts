/*
 * Serves cached song videos to the game, and downloads the ones it does not
 * have yet.
 *
 *   npm run video-cache
 *   npm run video-cache -- --limit-kbps 0     # no download speed limit
 *   npm run video-cache -- --host NA1         # download everything from NA1
 *
 * The userscript `scripts/videoCache.ts` asks for each song's file (720p,
 * else 480p):
 *
 *   HEAD /video/<fileId>               200 if cached, else 404
 *   HEAD /video/<fileId>?download=NA1  the same, and on a miss queue a
 *                                      download from that AMQ host
 *   GET  /video/<fileId>               the file, with range support
 *
 * `npm run queue-list-videos` adds many files at once:
 *
 *   POST /queue  { files: [{ fileId, host }] }  →  { added, waiting }
 *
 * Those go to a bulk queue, saved in `.bulk-queue.json` in the cache folder
 * so a restart keeps it. Songs missed during a game download first.
 *
 * Every cached file must be in the song database (`local/lib/songDb.ts`), so
 * the server does not start without it. When a download completes, the
 * server sets the file as the `webmPath` of the songs that use it. It finds
 * them by their files (`npm run scan-library`) and in the reveals the
 * userscript sends:
 *
 *   POST /song  { fileId, song }  the song a game revealed, with its
 *                                 difficulty and alt answers
 *
 * A revealed song whose file is cached is registered at once. When neither
 * source knows a file, the server logs it. `npm run scan-library` registers
 * it when it saves the files of a song that uses it.
 *
 * Downloads run one at a time, at most `--limit-kbps`, so they do not take
 * the bandwidth the game needs for the current song. A file is written under
 * `.partial/` and moved into the cache only when it is complete, so the game
 * never gets part of a file.
 *
 * Files live in `AMQ_VIDEO_CACHE_DIR` (default `~/amq-cache`). It does not
 * log in to AMQ.
 */

import fs from 'node:fs'
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http'
import path from 'node:path'
import { Readable } from 'node:stream'
import { parseArgs } from 'node:util'
import {
  type RevealedSong,
  type SongInfo,
  VIDEO_CACHE_PORT,
  VIDEO_HOSTS,
  isCacheableFileId,
} from '@shared/videoCache'
import { type SongDb, openSongDb, saveSong } from './lib/songDb'
import { videoCacheDir } from './lib/videoCacheDir'

const ALLOWED_ORIGIN = 'https://animemusicquiz.com'

const { values: flags } = parseArgs({
  options: {
    'limit-kbps': { type: 'string', default: '500' },
    host: { type: 'string' },
    help: { type: 'boolean', short: 'h', default: false },
  },
})

if (flags.help) {
  console.log(`Usage: npm run video-cache [-- options]

Serves ${videoCacheDir()} at http://127.0.0.1:${VIDEO_CACHE_PORT}.

  --limit-kbps <n>  download speed limit in KB/s (default 500, 0 = none)
  --host <name>     download every file from this AMQ host: EU, NA1 or NA2
                    (default: the host each request names)`)
  process.exit(0)
}

const limitKbps = Number(flags['limit-kbps'])
if (!Number.isFinite(limitKbps) || limitKbps < 0) {
  console.error('--limit-kbps must be a number, 0 or more.')
  process.exit(1)
}

if (flags.host !== undefined && !(flags.host in VIDEO_HOSTS)) {
  console.error(`Unknown host "${flags.host}". Use EU, NA1 or NA2.`)
  process.exit(1)
}

let db: SongDb
try {
  db = await openSongDb()
} catch (error) {
  console.error((error as Error).message)
  process.exit(1)
}

const dir = videoCacheDir()
const partialDir = path.join(dir, '.partial')
// A download cut off by a restart starts again from the queue.
await rm(partialDir, { recursive: true, force: true })
await mkdir(partialDir, { recursive: true })

interface QueuedFile {
  fileId: string
  host: string
}

/** Songs missed during a game. They download before the bulk queue. */
const missQueue: QueuedFile[] = []
/** Files from `POST /queue`. Saved to disk, so a restart keeps them. */
const bulkQueue: QueuedFile[] = await readBulkQueue()
const bulkQueueFile = path.join(dir, '.bulk-queue.json')
const pending = new Set<string>(bulkQueue.map((file) => file.fileId))
let downloading = false

async function readBulkQueue(): Promise<QueuedFile[]> {
  try {
    const saved = JSON.parse(
      await readFile(path.join(dir, '.bulk-queue.json'), 'utf8')
    ) as QueuedFile[]
    return saved.filter(
      (file) => isCacheableFileId(file.fileId) && file.host in VIDEO_HOSTS
    )
  } catch {
    return []
  }
}

async function saveBulkQueue() {
  const temp = `${bulkQueueFile}.tmp`
  await writeFile(temp, JSON.stringify(bulkQueue))
  await rename(temp, bulkQueueFile)
}

function enqueueMiss(fileId: string, host: string) {
  if (pending.has(fileId)) {
    // Already in the bulk queue: move it to the front.
    const index = bulkQueue.findIndex((file) => file.fileId === fileId)
    if (index === -1) return
    bulkQueue.splice(index, 1)
    void saveBulkQueue()
  }
  pending.add(fileId)
  missQueue.push({ fileId, host })
  console.log(`queued ${fileId} from a game (${missQueue.length} waiting)`)
  void drain()
}

async function enqueueBulk(files: QueuedFile[]): Promise<number> {
  let added = 0
  for (const file of files) {
    if (pending.has(file.fileId)) continue
    if (await exists(path.join(dir, file.fileId))) continue
    pending.add(file.fileId)
    bulkQueue.push(file)
    added++
  }
  await saveBulkQueue()
  console.log(`queued ${added} files in bulk (${bulkQueue.length} waiting)`)
  void drain()
  return added
}

async function drain() {
  if (downloading) return
  downloading = true
  while (missQueue.length || bulkQueue.length) {
    const fromBulk = !missQueue.length
    const { fileId, host } = fromBulk ? bulkQueue[0] : missQueue.shift()!
    try {
      await download(fileId, VIDEO_HOSTS[flags.host ?? host] + fileId)
    } catch (error) {
      console.error(`download failed: ${fileId}:`, (error as Error).message)
      revealedSongs.delete(fileId)
    } finally {
      pending.delete(fileId)
      if (fromBulk && bulkQueue[0]?.fileId === fileId) {
        bulkQueue.shift()
        await saveBulkQueue()
      }
    }
  }
  downloading = false
}

async function readBody(req: IncomingMessage): Promise<string> {
  let body = ''
  for await (const chunk of req) {
    body += chunk
    if (body.length > 10_000_000) throw new Error('body too large')
  }
  return body
}

async function handleQueue(req: IncomingMessage, res: ServerResponse) {
  // A JSON body makes a browser send a preflight first, which only AMQ's
  // origin passes, so other sites cannot fill the queue.
  if (!req.headers['content-type']?.startsWith('application/json')) {
    return send(res, 415)
  }
  let files: QueuedFile[]
  try {
    const body = JSON.parse(await readBody(req)) as { files?: QueuedFile[] }
    files = (body.files ?? []).filter(
      (file) =>
        typeof file?.fileId === 'string' &&
        isCacheableFileId(file.fileId) &&
        file.host in VIDEO_HOSTS
    )
  } catch {
    return send(res, 400)
  }
  const added = await enqueueBulk(files)
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ added, waiting: bulkQueue.length }))
}

async function download(fileId: string, url: string) {
  const target = path.join(dir, fileId)
  if (await exists(target)) return

  const started = Date.now()
  const res = await fetch(url)
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)
  const expected = Number(res.headers.get('content-length'))

  const partial = path.join(partialDir, fileId)
  const out = fs.createWriteStream(partial)
  let written = 0
  try {
    for await (const chunk of Readable.fromWeb(res.body as any)) {
      if (!out.write(chunk)) {
        await new Promise<void>((resolve) => out.once('drain', () => resolve()))
      }
      written += chunk.length
      await throttle(written, started)
    }
    await new Promise<void>((resolve, reject) =>
      out.end((error?: Error | null) => (error ? reject(error) : resolve()))
    )
    if (expected && written !== expected) {
      throw new Error(`got ${written} of ${expected} bytes`)
    }
    await rename(partial, target)
  } catch (error) {
    out.destroy()
    await rm(partial, { force: true })
    throw error
  }

  const seconds = (Date.now() - started) / 1000
  console.log(
    `cached ${fileId}: ${(written / 1e6).toFixed(1)} MB in ${seconds.toFixed(0)}s`
  )
  await registerFile(fileId)
}

/** Songs that a game revealed while their file was downloading. */
const revealedSongs = new Map<string, SongInfo[]>()

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Sets `webmPath` on the songs that use a cached file. A song that already
 * has another cached file keeps it.
 */
async function registerFile(fileId: string) {
  const webmPath = path.join(dir, fileId)
  let count = 0
  try {
    const result = await db.songs.updateMany(
      {
        'files.fileId': fileId,
        webmPath: { $not: new RegExp(`^${escapeRegExp(dir + path.sep)}`) },
      },
      { $set: { webmPath } }
    )
    count = result.matchedCount
    count += await saveRevealed(revealedSongs.get(fileId) ?? [], fileId)
  } catch (error) {
    console.error(`could not register ${fileId}:`, (error as Error).message)
    return
  } finally {
    revealedSongs.delete(fileId)
  }
  const using = await db.songs.countDocuments({ webmPath })
  if (!count && !using) {
    console.error(
      `not in the song database: ${fileId}. No song has this file. ` +
        'Run `npm run scan-library` to register it.'
    )
  }
}

/** Saves revealed songs with their cached file. Returns how many. */
async function saveRevealed(songs: SongInfo[], fileId: string) {
  for (const song of songs) {
    const result = await saveSong(db.songs, song, path.join(dir, fileId))
    if (result !== 'unchanged') {
      console.log(`${result} in the song database: ${songLabel(song)}`)
    }
  }
  return songs.length
}

function songLabel(song: SongInfo): string {
  const number = song.typeNumber ? ` ${song.typeNumber}` : ''
  return `${song.anime} ${song.type}${number} "${song.name}"`
}

function parseRevealedSong(body: any): RevealedSong | null {
  const song = body?.song
  const valid =
    typeof body?.fileId === 'string' &&
    isCacheableFileId(body.fileId) &&
    Number.isInteger(song?.annSongId) &&
    Number.isInteger(song?.annId) &&
    ['anime', 'artist', 'name'].every((key) => typeof song[key] === 'string') &&
    ['OP', 'ED', 'IN'].includes(song.type) &&
    (song.typeNumber === null || Number.isInteger(song.typeNumber)) &&
    (song.difficulty === null || typeof song.difficulty === 'number') &&
    Array.isArray(song.altAnswers) &&
    song.altAnswers.every((answer: unknown) => typeof answer === 'string')
  if (!valid) return null
  const { annSongId, annId, anime, artist, name, type, typeNumber } = song
  return {
    fileId: body.fileId,
    song: {
      annSongId,
      annId,
      anime,
      artist,
      name,
      type,
      typeNumber,
      difficulty: song.difficulty,
      altAnswers: song.altAnswers,
    },
  }
}

async function handleSong(req: IncomingMessage, res: ServerResponse) {
  if (!req.headers['content-type']?.startsWith('application/json')) {
    return send(res, 415)
  }
  let revealed: RevealedSong | null
  try {
    revealed = parseRevealedSong(JSON.parse(await readBody(req)))
  } catch {
    revealed = null
  }
  if (!revealed) return send(res, 400)
  send(res, 204)

  const { fileId, song } = revealed
  if (await exists(path.join(dir, fileId))) {
    await saveRevealed([song], fileId).catch((error) =>
      console.error(
        `could not save ${songLabel(song)}:`,
        (error as Error).message
      )
    )
  } else if (pending.has(fileId)) {
    const songs = revealedSongs.get(fileId) ?? []
    revealedSongs.set(fileId, [...songs, song])
  }
}

/** Sleeps until `bytes` is within the speed limit for the time elapsed. */
async function throttle(bytes: number, started: number) {
  if (!limitKbps) return
  const due = started + (bytes / (limitKbps * 1024)) * 1000
  const wait = due - Date.now()
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
}

async function exists(file: string): Promise<boolean> {
  try {
    return (await stat(file)).isFile()
  } catch {
    return false
  }
}

function send(res: ServerResponse, status: number) {
  res.writeHead(status).end()
}

async function serveFile(
  res: ServerResponse,
  file: string,
  size: number,
  range: string | undefined,
  headOnly: boolean
) {
  const headers = {
    'Content-Type': 'video/webm',
    'Accept-Ranges': 'bytes',
  }
  const match = /^bytes=(\d*)-(\d*)$/.exec(range ?? '')
  if (!match || (!match[1] && !match[2])) {
    res.writeHead(200, { ...headers, 'Content-Length': size })
    if (headOnly) return res.end()
    return fs.createReadStream(file).pipe(res)
  }

  const start = match[1]
    ? Number(match[1])
    : Math.max(0, size - Number(match[2]))
  const end =
    match[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1
  if (start > end || start >= size) {
    res.writeHead(416, { 'Content-Range': `bytes */${size}` })
    return res.end()
  }
  res.writeHead(206, {
    ...headers,
    'Content-Length': end - start + 1,
    'Content-Range': `bytes ${start}-${end}/${size}`,
  })
  if (headOnly) return res.end()
  fs.createReadStream(file, { start, end }).pipe(res)
}

const server = createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN)
  res.setHeader('Access-Control-Allow-Private-Network', 'true')
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    return send(res, 204)
  }

  const url = new URL(req.url ?? '/', 'http://localhost')
  if (url.pathname === '/queue') {
    if (req.method !== 'POST') return send(res, 405)
    return handleQueue(req, res)
  }
  if (url.pathname === '/song') {
    if (req.method !== 'POST') return send(res, 405)
    return handleSong(req, res)
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405)

  const match = /^\/video\/([^/]+)$/.exec(url.pathname)
  if (!match || !isCacheableFileId(match[1])) return send(res, 404)
  const fileId = match[1]
  const file = path.join(dir, fileId)

  let size: number
  try {
    const info = await stat(file)
    if (!info.isFile()) return send(res, 404)
    size = info.size
  } catch {
    const host = url.searchParams.get('download')
    if (host && host in VIDEO_HOSTS) enqueueMiss(fileId, host)
    return send(res, 404)
  }

  try {
    await serveFile(res, file, size, req.headers.range, req.method === 'HEAD')
  } catch (error) {
    console.error(`serving ${fileId} failed:`, (error as Error).message)
    if (!res.headersSent) send(res, 500)
    else res.destroy()
  }
})

server.on('error', (error) => {
  console.error(`Cannot start the server: ${error.message}`)
  process.exit(1)
})

server.listen(VIDEO_CACHE_PORT, '127.0.0.1', () => {
  const limit = limitKbps ? `${limitKbps} KB/s` : 'no limit'
  const from = flags.host ? `, all from ${flags.host}` : ''
  console.log(
    `Serving ${dir} at http://127.0.0.1:${VIDEO_CACHE_PORT} ` +
      `(downloads: ${limit}${from})`
  )
  if (bulkQueue.length) {
    console.log(`${bulkQueue.length} files waiting in the bulk queue`)
    void drain()
  }
})
