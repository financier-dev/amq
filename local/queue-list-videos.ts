/*
 * Queues the video of every song on a MyAnimeList user's list for download
 * by `npm run video-cache`: the 720p file, else the 480p one.
 *
 *   npm run queue-list-videos -- --mal <user>            # all songs
 *   npm run queue-list-videos -- --mal <user> --limit 5  # first 5, as a test
 *   npm run queue-list-videos -- --main-account          # your own list
 *   npm run queue-list-videos -- --from-cache            # queue again, no login
 *
 * With `--mal`, it logs in with `AMQ_TEST_ACCOUNT_*` and sets that account's
 * anime list to the MAL user. That setting stays on the test account. With
 * `--main-account`, it logs in with `AMQ_ACCOUNT_*` and changes no setting.
 * This takes over the game if you are playing.
 *
 * The list follows the account's own Settings → Anime List: the Included
 * Entries ticked there. It also adds every song of every custom list on the
 * account: all uploaded songs of each anime entry, and each song entry.
 *
 * AMQ gives file names one song at a time (`get song extended info` with
 * `includeFileNames`, as the quiz creator asks). The script sends one request
 * every `--delay-ms` and saves each answer in `local/.cache/list-videos.json`,
 * so a run that stops can go on later without asking again. Runs can share
 * the file at the same time: each save merges with what is on disk. Every
 * `SAVE_EVERY` songs it sends the new files to the cache server, so downloads
 * start while the list is still being read.
 *
 * It stops at once when AMQ logs the account off or the connection does not
 * come back within `RECONNECT_GRACE_MS`, and logs why each song failed.
 *
 * It only reads, except for the list setting: it never joins, spectates or
 * hosts a room. It disconnects `npm run watch-rooms`, which uses the same
 * account.
 */

import fs from 'node:fs'
import { stat } from 'node:fs/promises'
import path from 'node:path'
import { parseArgs } from 'node:util'
import type { Page } from 'playwright'
import { repo } from '@shared/node/env'
import {
  LIBRARY_TIMEOUT_MS,
  disableAfkKicker,
  openSession,
  request,
  watchSessionEvents,
} from '@shared/node/session'
import { cachedFile, VIDEO_CACHE_ORIGIN, VIDEO_HOSTS } from '@shared/videoCache'
import { videoCacheDir } from './lib/videoCacheDir'

const MANIFEST = path.join(repo, 'local', '.cache', 'list-videos.json')
const SAVE_EVERY = 25
/** `Options.prototype.LIST_TYPE_ID_MAP` in `options.js`. */
const LIST_TYPE_NAMES: Record<string, string> = {
  1: 'Watching',
  2: 'Completed',
  3: 'On-Hold',
  4: 'Dropped',
  5: 'Plan to Watch',
}
/** Stop when this many requests in a row get no file names. */
const MAX_FAILURES_IN_A_ROW = 5
const RECONNECT_GRACE_MS = 60_000
const REQUEST_TIMEOUT_MS = 30_000

const { values: flags } = parseArgs({
  options: {
    mal: { type: 'string' },
    'main-account': { type: 'boolean', default: false },
    'from-cache': { type: 'boolean', default: false },
    limit: { type: 'string' },
    'delay-ms': { type: 'string', default: '2000' },
    host: { type: 'string', default: 'NA2' },
    headed: { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
})

const modes = [flags.mal, flags['main-account'], flags['from-cache']]
if (flags.help || modes.filter(Boolean).length !== 1) {
  console.log(`Usage: npm run queue-list-videos -- --mal <user> [options]
       npm run queue-list-videos -- --main-account [options]
       npm run queue-list-videos -- --from-cache

  --mal <user>    log in as the test account and use this MyAnimeList user
  --main-account  log in as AMQ_ACCOUNT and use its own list and custom lists
  --limit <n>     only the first n songs that have no answer yet
  --delay-ms <n>  wait between file name requests (default 2000)
  --host <name>   the AMQ host to download from: EU, NA1 or NA2 (default NA2)
  --from-cache    do not log in; queue the files saved by an earlier run
  --headed        show the browser`)
  process.exit(flags.help ? 0 : 1)
}

const delayMs = Number(flags['delay-ms'])
const limit = flags.limit === undefined ? Infinity : Number(flags.limit)
if (!(delayMs >= 0) || !(limit > 0)) {
  console.error('--delay-ms and --limit must be positive numbers.')
  process.exit(1)
}
if (!(flags.host in VIDEO_HOSTS)) {
  console.error(`Unknown host "${flags.host}". Use EU, NA1 or NA2.`)
  process.exit(1)
}

/** Version 1 kept only 720p files. Its nulls may have a 480p file. */
const MANIFEST_VERSION = 2

interface Manifest {
  version: number
  /** The cached file ID by annSongId, or null when the song has none. */
  songs: Record<string, string | null>
}

function readManifest(): Manifest {
  let saved: Partial<Manifest> = {}
  try {
    saved = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'))
  } catch {
    // No answers saved yet.
  }
  const songs = saved.songs ?? {}
  if (saved.version !== MANIFEST_VERSION) {
    for (const [id, fileId] of Object.entries(songs)) {
      if (fileId === null) delete songs[id]
    }
  }
  return { version: MANIFEST_VERSION, songs }
}

/** Adds the answers on disk to `manifest`, and saves the result. */
function saveManifest(manifest: Manifest) {
  Object.assign(manifest.songs, {
    ...readManifest().songs,
    ...manifest.songs,
  })
  fs.mkdirSync(path.dirname(MANIFEST), { recursive: true })
  const temp = `${MANIFEST}.${process.pid}.tmp`
  fs.writeFileSync(temp, JSON.stringify(manifest))
  fs.renameSync(temp, MANIFEST)
}

interface ListedSongs {
  includedTypes: string[]
  animeCount: number
  annSongIds: number[]
  customLists: { name: string; anime: number; songs: number }[]
}

async function setAnimeList(page: Page, mal: string) {
  console.error(`Setting the test account's anime list to MAL user ${mal}`)
  const result = await request(page, {
    type: 'library',
    command: 'update anime list',
    reply: 'anime list update result',
    data: { newUsername: mal, listType: 'MAL' },
    timeout: 120_000,
  })
  if (!result?.success) {
    throw new Error(`AMQ did not update the list: ${result?.message}`)
  }
}

/**
 * The uploaded songs of every anime the list marks as watched, and of every
 * custom list.
 */
async function listedSongs(page: Page): Promise<ListedSongs> {
  return page.evaluate(
    (timeout) =>
      new Promise<ListedSongs>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error('timed out waiting for the library')),
          timeout
        )
        libraryCacheHandler.getCache(
          (cache: Record<string, LibraryAnimeEntry>) => {
            clearTimeout(timer)
            const included = options.getIncludedListTypesMap()
            const uploadedSongs = (anime: LibraryAnimeEntry) =>
              [...anime.songs.OP, ...anime.songs.ED, ...anime.songs.INS]
                .filter((song) => song.uploaded)
                .map((song) => song.annSongId)
            const watched = Object.values(cache).filter(
              (anime) => anime.watched
            )
            const ids = new Set(watched.flatMap(uploadedSongs))
            const lists = [...customListHandler.customListMap.values()]
            for (const list of lists) {
              for (const annId of list.animeMap.keys()) {
                const anime = cache[annId]
                if (anime) uploadedSongs(anime).forEach((id) => ids.add(id))
              }
              for (const annSongId of list.songMap.keys()) {
                const song =
                  libraryCacheHandler.getCachedAnnSongEntry(annSongId)
                if (song?.uploaded) ids.add(annSongId)
              }
            }
            resolve({
              includedTypes: Object.keys(included).filter(
                (key) => included[key]
              ),
              animeCount: watched.length,
              annSongIds: [...ids],
              customLists: lists.map((list) => ({
                name: list.name,
                anime: list.animeMap.size,
                songs: list.songMap.size,
              })),
            })
          }
        )
      }),
    LIBRARY_TIMEOUT_MS
  )
}

type FileNameResult =
  { ok: true; fileId: string | null } | { ok: false; reason: string }

async function fileNameFor(
  page: Page,
  annSongId: number
): Promise<FileNameResult> {
  let info: any
  try {
    info = await request(page, {
      type: 'library',
      command: 'get song extended info',
      reply: 'get song extended info',
      data: { annSongId, includeFileNames: true },
      matchField: 'annSongId',
      matchValue: annSongId,
      timeout: REQUEST_TIMEOUT_MS,
    })
  } catch (error) {
    return { ok: false, reason: (error as Error).message }
  }
  const map = info?.fileNameMap as Record<number, string> | undefined
  if (!map) {
    const keys = info ? Object.keys(info).join(', ') : 'empty reply'
    return { ok: false, reason: `reply without fileNameMap (${keys})` }
  }
  return { ok: true, fileId: cachedFile(map)?.fileId ?? null }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Uses the test account with `mal`, else the main account as it is. */
async function collect(mal: string | undefined): Promise<Manifest> {
  // File IDs do not depend on the list, so answers from any run are kept.
  const manifest = readManifest()

  const { browser, page } = await openSession({
    headed: flags.headed,
    accounts: [mal ? 'AMQ_TEST_ACCOUNT' : 'AMQ_ACCOUNT'],
  })
  let loggedOff: string | null = null
  let disconnectedAt: number | null = null
  await disableAfkKicker(page)
  await watchSessionEvents(page, (event) => {
    if (event.kind === 'logoff') {
      loggedOff = event.reason || 'no reason given'
    } else if (event.kind === 'disconnect') {
      disconnectedAt = Date.now()
      console.error('socket disconnected, waiting for it to reconnect')
    } else {
      disconnectedAt = null
      console.error('socket reconnected')
    }
  })
  const checkSession = async () => {
    if (loggedOff) {
      throw new Error(`AMQ logged the test account off (${loggedOff}).`)
    }
    while (disconnectedAt !== null) {
      if (Date.now() - disconnectedAt > RECONNECT_GRACE_MS) {
        throw new Error('The connection to AMQ did not come back.')
      }
      await sleep(1_000)
    }
  }

  try {
    if (mal) await setAnimeList(page, mal)
    const listed = await listedSongs(page)
    const included = listed.includedTypes
      .map((type) => LIST_TYPE_NAMES[type] ?? type)
      .join(', ')
    for (const list of listed.customLists) {
      console.error(
        `custom list "${list.name}": ${list.anime} anime, ${list.songs} songs`
      )
    }
    console.error(
      `${listed.animeCount} anime on the list (included entries: ` +
        `${included || 'none'}), ${listed.annSongIds.length} songs in all`
    )

    const unknown = listed.annSongIds.filter((id) => !(id in manifest.songs))
    const todo = unknown.slice(0, limit)
    const minutes = Math.ceil((todo.length * delayMs) / 60_000)
    console.error(
      `${listed.annSongIds.length - unknown.length} songs already known, ` +
        `asking about ${todo.length} of ${unknown.length} (about ${minutes} min)`
    )

    let failures = 0
    let batch: string[] = []
    for (const [index, annSongId] of todo.entries()) {
      await checkSession()
      const result = await fileNameFor(page, annSongId)
      if (!result.ok) {
        await checkSession()
        failures++
        console.error(`song ${annSongId}: ${result.reason}`)
        if (failures >= MAX_FAILURES_IN_A_ROW) {
          throw new Error(
            `${failures} songs in a row came back without file names. Stopping.`
          )
        }
      } else {
        failures = 0
        manifest.songs[annSongId] = result.fileId
        if (result.fileId) batch.push(result.fileId)
      }
      if ((index + 1) % SAVE_EVERY === 0) {
        saveManifest(manifest)
        const queued = await postQueue(await notCached(batch), true)
        batch = []
        console.error(
          `asked ${index + 1}/${todo.length}` +
            (queued ? `, queued ${queued} downloads` : '')
        )
      }
      await sleep(delayMs)
    }
  } finally {
    saveManifest(manifest)
    await browser.close()
  }
  return manifest
}

async function notCached(fileIds: string[]): Promise<string[]> {
  const dir = videoCacheDir()
  const missing: string[] = []
  for (const fileId of new Set(fileIds)) {
    try {
      await stat(path.join(dir, fileId))
    } catch {
      missing.push(fileId)
    }
  }
  return missing
}

let serverWarned = false

/**
 * Sends files to the cache server's bulk queue. Returns how many it added.
 * `quiet` warns only once when the server cannot be reached.
 */
async function postQueue(fileIds: string[], quiet = false): Promise<number> {
  if (!fileIds.length) return 0
  try {
    const res = await fetch(`${VIDEO_CACHE_ORIGIN}/queue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        files: fileIds.map((fileId) => ({ fileId, host: flags.host })),
      }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const { added } = (await res.json()) as { added: number }
    return added
  } catch (error) {
    if (!quiet || !serverWarned) {
      console.error(
        `Could not reach the cache server (${(error as Error).message}). ` +
          'Start `npm run video-cache`, then run ' +
          '`npm run queue-list-videos -- --from-cache`.'
      )
    }
    serverWarned = true
    if (!quiet) process.exitCode = 1
    return 0
  }
}

async function queue(manifest: Manifest) {
  const fileIds = [...new Set(Object.values(manifest.songs))].filter(
    (fileId): fileId is string => fileId !== null
  )
  const missing = await notCached(fileIds)
  console.error(
    `${fileIds.length} songs have a video, ${missing.length} not cached yet`
  )
  const added = await postQueue(missing)
  if (added || !serverWarned) console.error(`Queued ${added} new downloads.`)
}

if (flags['from-cache']) {
  const manifest = readManifest()
  if (!Object.keys(manifest.songs).length) {
    console.error(`Nothing saved yet in ${MANIFEST}. Run with --mal first.`)
    process.exit(1)
  }
  await queue(manifest)
} else {
  await queue(await collect(flags.mal))
}
