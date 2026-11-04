/**
 * When a song was approved and last replaced, as `npm run approval-dates`
 * saved them in the song database. The cache server (`local/video-cache.ts`)
 * answers `GET /song-dates?annSongId=<id>` with a `SongDates`, or 404 when
 * the song is not in the database.
 */

export const SONG_DATES_PATH = '/song-dates'

export interface SongDates {
  /** ISO time, or null when no approval message matches the song. */
  added: string | null
  /** ISO time, or null when the song has no replacement. */
  lastUpdated: string | null
}
