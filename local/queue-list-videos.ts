/*
 * Queues the video of every song on a MyAnimeList or AniList user's list for download
 * by `npm run video-cache`: the 720p file, else the 480p one.
 *
 *   npm run queue-list-videos -- --mal <user>            # all songs
 *   npm run queue-list-videos -- --mal <user> --limit 5  # first 5, as a test
 *   npm run queue-list-videos -- --anilist <user>        # an AniList user
 *   npm run queue-list-videos -- --main-account          # your own list
 *   npm run queue-list-videos -- --from-cache            # queue again, no login
 *
 * With `--mal` or `--anilist`, it logs in with `AMQ_TEST_ACCOUNT_*` and sets
 * that account's anime list to the user. That setting stays on the test account. With
 * `--main-account`, it logs in with `AMQ_ACCOUNT_*` and changes no setting.
 * This takes over the game if you are playing.
 *
 * It takes every anime on the list, whatever its status (Watching,
 * Completed, On-Hold, Dropped, Plan to Watch). It ignores the Included
 * Entries ticked in Settings → Anime List. It also adds every song of every custom list on the
 * account: all uploaded songs of each anime entry, and each song entry.
 *
 * AMQ gives file names one song at a time. A song whose files are already in
 * the song database (`npm run scan-library`) needs no request. For the
 * others, the script sends one request every `--delay-ms` and saves each
 * answer in the database, so the cache server can find the song of the file.
 * It saves which file each listed song uses in `local/.cache/list-videos.json`,
 * so a run that stops can go on later without asking again. Runs can share
 * that file at the same time: each save merges with what is on disk. Every
 * `SAVE_EVERY` songs it sends the new files to the cache server, so downloads
 * start while the list is still being read.
 *
 * It stops at once when AMQ logs the account off or the connection does not
 * come back within a minute, and logs why each song failed.
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
  guardSession,
  openSession,
  request,
} from '@shared/node/session'
import { cachedFile, VIDEO_HOSTS } from '@shared/videoCache'
import { queueDownloads } from './lib/cacheServer'
import { askAll, readLibrary } from './lib/library'
import { fileMap, openSongDb, saveSong } from './lib/songDb'
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

const { values: flags } = parseArgs({
  options: {
    mal: { type: 'string' },
    anilist: { type: 'string' },
    'main-account': { type: 'boolean', default: false },
    'from-cache': { type: 'boolean', default: false },
    limit: { type: 'string' },
    'delay-ms': { type: 'string', default: '2000' },
    host: { type: 'string', default: 'NA2' },
    headed: { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
})

interface ListUser {
  /** The `listType` of AMQ's `update anime list`. */
  listType: 'MAL' | 'ANILIST'
  site: string
  name: string
}

const listUser: ListUser | undefined = flags.mal
  ? { listType: 'MAL', site: 'MAL', name: flags.mal }
  : flags.anilist
    ? { listType: 'ANILIST', site: 'AniList', name: flags.anilist }
    : undefined

const modes = [
  flags.mal,
  flags.anilist,
  flags['main-account'],
  flags['from-cache'],
]
if (flags.help || modes.filter(Boolean).length !== 1) {
  console.log(`Usage: npm run queue-list-videos -- --mal <user> [options]
       npm run queue-list-videos -- --anilist <user> [options]
       npm run queue-list-videos -- --main-account [options]
       npm run queue-list-videos -- --from-cache

  --mal <user>      log in as the test account and use this MyAnimeList user
  --anilist <user>  log in as the test account and use this AniList user
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
  /** The number of anime on the list, by list status. */
  statusCounts: Record<string, number>
  annSongIds: number[]
  customLists: { name: string; anime: number; songs: number }[]
}

async function setAnimeList(page: Page, user: ListUser) {
  console.error(
    `Setting the test account's anime list to ${user.site} user ${user.name}`
  )
  const result = await request(page, {
    type: 'library',
    command: 'update anime list',
    reply: 'anime list update result',
    data: { newUsername: user.name, listType: user.listType },
    timeout: 120_000,
  })
  if (!result?.success) {
    throw new Error(`AMQ did not update the list: ${result?.message}`)
  }
}

/**
 * The uploaded songs of every anime on the list, whatever its status, and of
 * every custom list.
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
            const uploadedSongs = (anime: LibraryAnimeEntry) =>
              [...anime.songs.OP, ...anime.songs.ED, ...anime.songs.INS]
                .filter((song) => song.uploaded)
                .map((song) => song.annSongId)
            const statusCounts: Record<string, number> = {}
            const ids = new Set<number>()
            const statuses = libraryCacheHandler.animeListMapCache ?? {}
            for (const [annId, status] of Object.entries(statuses)) {
              statusCounts[status] = (statusCounts[status] ?? 0) + 1
              const anime = cache[annId]
              if (anime) uploadedSongs(anime).forEach((id) => ids.add(id))
            }
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
              statusCounts,
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

/** Uses the test account with `user`'s list, else the main account as it is. */
async function collect(user: ListUser | undefined): Promise<Manifest> {
  // File IDs do not depend on the list, so answers from any run are kept.
  const manifest = readManifest()

  const db = await openSongDb()
  const { browser, page } = await openSession({
    headed: flags.headed,
    accounts: [user ? 'AMQ_TEST_ACCOUNT' : 'AMQ_ACCOUNT'],
  })

  try {
    const check = await guardSession(page)
    if (user) await setAnimeList(page, user)
    const listed = await listedSongs(page)
    const counts = Object.entries(listed.statusCounts)
    const animeCount = counts.reduce((sum, [, count]) => sum + count, 0)
    const byStatus = counts
      .map(([type, count]) => `${LIST_TYPE_NAMES[type] ?? type} ${count}`)
      .join(', ')
    for (const list of listed.customLists) {
      console.error(
        `custom list "${list.name}": ${list.anime} anime, ${list.songs} songs`
      )
    }
    console.error(
      `${animeCount} anime on the list (${byStatus || 'none'}), ` +
        `${listed.annSongIds.length} songs in all`
    )

    // The song database comes first: `scan-library` keeps its files up to
    // date, and the manifest can still have a file AMQ replaced.
    const known = await db.songs
      .find({
        annSongId: { $in: listed.annSongIds },
        files: { $exists: true },
      })
      .toArray()
    for (const doc of known) {
      manifest.songs[doc.annSongId!] =
        cachedFile(fileMap(doc.files))?.fileId ?? null
    }
    const unknown = new Set(
      listed.annSongIds.filter((id) => !(id in manifest.songs))
    )
    const todo = (await readLibrary(page)).songs
      .filter((song) => unknown.has(song.annSongId))
      .slice(0, limit)
    const minutes = Math.ceil((todo.length * delayMs) / 60_000)
    console.error(
      `${listed.annSongIds.length - unknown.size} songs already known ` +
        `(${known.length} from the song database), asking about ` +
        `${todo.length} of ${unknown.size} (about ${minutes} min)`
    )

    let batch: string[] = []
    await askAll(page, todo, {
      concurrency: 1,
      delayMs,
      check,
      async onAnswer(song, done) {
        await saveSong(db.songs, song)
        const fileId = cachedFile(fileMap(song.files))?.fileId ?? null
        manifest.songs[song.annSongId] = fileId
        if (fileId) batch.push(fileId)
        if (done % SAVE_EVERY === 0) {
          saveManifest(manifest)
          const queued = await postQueue(await notCached(batch), true)
          batch = []
          console.error(
            `asked ${done}/${todo.length}` +
              (queued ? `, queued ${queued} downloads` : '')
          )
        }
      },
    })
  } finally {
    saveManifest(manifest)
    await browser.close()
    await db.client.close()
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
  try {
    return await queueDownloads(fileIds, flags.host)
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
    console.error(
      `Nothing saved yet in ${MANIFEST}. Run with --mal or --anilist first.`
    )
    process.exit(1)
  }
  await queue(manifest)
} else {
  await queue(await collect(listUser))
}
