import { VIDEO_CACHE_ORIGIN } from '@shared/videoCache'

/**
 * Adds files to the bulk queue of `npm run video-cache`. Returns how many it
 * added. Throws when the server cannot be reached.
 */
export async function queueDownloads(
  fileIds: string[],
  host: string
): Promise<number> {
  if (!fileIds.length) return 0
  const res = await fetch(`${VIDEO_CACHE_ORIGIN}/queue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      files: fileIds.map((fileId) => ({ fileId, host })),
    }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const { added } = (await res.json()) as { added: number }
  return added
}
