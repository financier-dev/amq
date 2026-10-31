/*
 * Reads the song library from a logged-in page, and asks AMQ for the files of
 * each song. AMQ gives file names one song at a time, through
 * `get song extended info` with `includeFileNames`, as the quiz creator asks.
 *
 * Never run more than 2 requests at the same time.
 */

import type { Page } from 'playwright'
import { LIBRARY_TIMEOUT_MS, request } from '@shared/node/session'
import type { SongInfo } from '@shared/videoCache'
import { type LibrarySongFiles, songFiles } from './songDb'

const REQUEST_TIMEOUT_MS = 15_000
/** AMQ sometimes leaves a request unanswered. A second one usually works. */
const ATTEMPTS = 3

/** A library song. The library has no difficulty and no alt answers. */
export interface LibrarySong extends Omit<
  SongInfo,
  'difficulty' | 'altAnswers'
> {
  /** False when AMQ has no file for the song. */
  uploaded: boolean
}

export interface Library {
  /** Changes when AMQ changes the library. */
  masterListId: string
  songs: LibrarySong[]
}

/**
 * Every song in the library. The names are the ones a song reveal shows: the
 * romaji anime name, else the English one.
 */
export async function readLibrary(page: Page): Promise<Library> {
  return page.evaluate(
    (timeout) =>
      new Promise<Library>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error('timed out waiting for the library')),
          timeout
        )
        libraryCacheHandler.getCache(
          (cache: Record<string, LibraryAnimeEntry>) => {
            clearTimeout(timer)
            const kinds = [
              ['OP', 'OP'],
              ['ED', 'ED'],
              ['INS', 'IN'],
            ] as const
            resolve({
              masterListId: String(libraryCacheHandler.currentMasterId),
              songs: Object.values(cache).flatMap((anime) =>
                kinds.flatMap(([kind, type]) =>
                  anime.songs[kind].map((song) => ({
                    annSongId: song.annSongId,
                    annId: anime.annId,
                    anime: anime.mainNames.JA ?? anime.mainNames.EN ?? '',
                    artist: song.songEntry.artist?.name ?? '',
                    name: song.songEntry.name,
                    type,
                    typeNumber: type === 'IN' ? null : song.number || null,
                    uploaded: Boolean(song.uploaded),
                  }))
                )
              ),
            })
          }
        )
      }),
    LIBRARY_TIMEOUT_MS
  )
}

export type AskResult =
  { ok: true; song: LibrarySongFiles } | { ok: false; reason: string }

/** Asks AMQ for the file names of one song, `ATTEMPTS` times at most. */
export async function askFiles(
  page: Page,
  song: LibrarySong
): Promise<AskResult> {
  let result: AskResult = { ok: false, reason: 'not asked' }
  for (let attempt = 1; attempt <= ATTEMPTS && !result.ok; attempt++) {
    result = await askOnce(page, song)
  }
  return result
}

async function askOnce(page: Page, song: LibrarySong): Promise<AskResult> {
  let info: any
  try {
    info = await request(page, {
      type: 'library',
      command: 'get song extended info',
      reply: 'get song extended info',
      data: { annSongId: song.annSongId, includeFileNames: true },
      matchField: 'annSongId',
      matchValue: song.annSongId,
      timeout: REQUEST_TIMEOUT_MS,
    })
  } catch (error) {
    return { ok: false, reason: (error as Error).message }
  }
  const files = info?.fileNameMap as Record<string, string> | undefined
  if (!files) {
    const keys = info ? Object.keys(info).join(', ') : 'empty reply'
    return { ok: false, reason: `reply without fileNameMap (${keys})` }
  }
  return {
    ok: true,
    song: { ...song, files: songFiles(files), filesAskedAt: Date.now() },
  }
}

export interface AskAllOptions {
  concurrency: number
  /** Waits before each request, in ms. */
  delayMs?: number
  /** Called before each request. Throw to stop. */
  check?: () => Promise<void>
  /** Called with each answer, in the order they arrive. */
  onAnswer: (song: LibrarySongFiles, done: number) => void | Promise<void>
  /** Stop when this many requests in a row get no file names. */
  maxFailuresInARow?: number
}

/** Asks about every song in `songs`, `concurrency` requests at a time. */
export async function askAll(
  page: Page,
  songs: LibrarySong[],
  {
    concurrency,
    delayMs = 0,
    check,
    onAnswer,
    maxFailuresInARow = 5,
  }: AskAllOptions
) {
  let next = 0
  let done = 0
  let failures = 0
  let stopped: Error | null = null

  async function worker() {
    while (!stopped && next < songs.length) {
      const song = songs[next++]
      if (delayMs) await new Promise((r) => setTimeout(r, delayMs))
      await check?.()
      const result = await askFiles(page, song)
      done++
      if (result.ok) {
        failures = 0
        await onAnswer(result.song, done)
        continue
      }
      await check?.()
      failures++
      console.error(`song ${song.annSongId}: ${result.reason}`)
      if (failures >= maxFailuresInARow) {
        stopped = new Error(
          `${failures} songs in a row came back without file names. Stopping.`
        )
      }
    }
  }

  const workers = Array.from({ length: Math.max(1, concurrency) }, worker)
  const results = await Promise.allSettled(workers)
  const failed = results.find((r) => r.status === 'rejected')
  if (failed) throw (failed as PromiseRejectedResult).reason
  if (stopped) throw stopped
}
