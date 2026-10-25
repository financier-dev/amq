/**
 * The local video cache: shared by the cache server (`local/video-cache.ts`),
 * the cleanup script and the userscript that plays cached videos.
 *
 * Pure, no globals: it runs in Node and in the page.
 */

export const VIDEO_CACHE_PORT = 8787
export const VIDEO_CACHE_ORIGIN = `http://127.0.0.1:${VIDEO_CACHE_PORT}`

/** The resolutions the cache keeps, best first. */
export const CACHED_RESOLUTIONS = [720, 480] as const

export interface CachedFile {
  fileId: string
  resolution: number
}

/**
 * The file the cache keeps for a song: the 720p file, else the 480p one.
 * `files` maps resolution to file ID, like one host of a song's video map.
 */
export function cachedFile(
  files: Record<number, string> | undefined
): CachedFile | null {
  for (const resolution of CACHED_RESOLUTIONS) {
    const fileId = files?.[resolution]
    if (fileId && isCacheableFileId(fileId)) return { fileId, resolution }
  }
  return null
}

/**
 * AMQ's video hosts, by the names `videoResolver.hostOrder` uses. They serve
 * the same file under the same file ID.
 */
export const VIDEO_HOSTS: Record<string, string> = {
  EU: 'https://eudist.animemusicquiz.com/',
  NA1: 'https://nawdist.animemusicquiz.com/',
  NA2: 'https://naedist.animemusicquiz.com/',
}

/**
 * A file ID as it appears in a song's video map, such as `008u6f.webm`.
 * Anything else (a full URL, a path) is never cached.
 */
export function isCacheableFileId(fileId: string): boolean {
  return /^[a-z0-9]+\.webm$/i.test(fileId)
}

/**
 * The URL of a cached file. A `HEAD` request answers 200 when the file is
 * cached. Pass `downloadFrom` to have the server queue a download on a miss.
 */
export function videoCacheUrl(fileId: string, downloadFrom?: string): string {
  const url = `${VIDEO_CACHE_ORIGIN}/video/${fileId}`
  return downloadFrom
    ? `${url}?download=${encodeURIComponent(downloadFrom)}`
    : url
}
