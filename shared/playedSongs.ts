/**
 * The record of one song the player played or watched, as
 * `scripts/playedSongs.ts` sends it to `POST /played-song` of the local
 * server (`npm run video-cache`), which saves it in `amq.played-songs`.
 *
 * Pure, no globals: it runs in Node and in the page.
 */

export const PLAYED_SONG_PATH = '/played-song'

export interface PlayedSongPlayer {
  gamePlayerId: number
  name: string
  /** The level when the game started. A correct answer can raise it. */
  level: number | null
  /** Null when the game has no teams. */
  teamNumber: number | null
  host: boolean
  isSelf: boolean
  /** Null when the player sent no answer. */
  answer: string | null
  answerNumber: number | null
  /** The answer the player shared with the team, if any. */
  teamAnswer: string | null
  /** Seconds from the start of the song, as `player answered` gives it. */
  answerTime: number | null
  /** The IDs of the hints the player used, in order. */
  hints: number[]
  /**
   * The rest of the player's entry in `answer results`, as AMQ sends it:
   * `correct`, `score`, `level`, `listStatus`, `showScore`, `position`, and so on.
   */
  [key: string]: unknown
}

export interface PlayedSong {
  /** `<gameKey>:<songNumber>`. Sending the same record again changes nothing. */
  recordId: string
  /** A random ID for each game the script sees start or joins. */
  gameKey: string
  /** ISO time of the reveal. */
  playedAt: string
  /** ISO time of the start of the song. Null when the player joined mid-song. */
  songStartedAt: string | null
  songNumber: number | null
  totalSongs: number | null
  self: {
    name: string
    gamePlayerId: number | null
    spectator: boolean
    /** The player's own answer, or null for a spectator. */
    answer: string | null
    correct: boolean | null
  }
  room: {
    /** `lobby.gameId`. */
    gameId: number | null
    soloMode: boolean
    champGame: boolean
    gameMode: string | null
    teamMode: boolean
    multipleChoice: boolean
    quizDescription: unknown
    /** The full room settings, without the password. */
    settings: Record<string, unknown>
  }
  /** `songInfo` of `answer results`, as AMQ sends it. */
  song: Record<string, unknown> & { annSongId?: number; annId?: number }
  /**
   * The sample, as AMQ's Song History shows it: `startPoint/videoLength`.
   * The game sends `samplePoint`, and the player turns it into `startPoint`:
   *
   *   startPoint = floor((videoLength - buffer) * samplePoint / 100)
   *
   * `buffer` is `(guessTime + 10) * playbackSpeed`, or
   * `guessTime * playbackSpeed` with full song range or a forced sample point.
   * With a forced sample point, AMQ uses `videoLength * samplePoint / 100`,
   * at most `videoLength - buffer`.
   */
  video: {
    /** The sample point in percent (0 to 100), as AMQ sends it. */
    samplePoint: number | null
    /** The second of the file where the song starts to play. */
    startPoint: number | null
    /** The length of the file, in seconds. */
    videoLength: number | null
    playbackSpeed: number | null
    fullSongRange: boolean
    forcedSamplePoint: boolean
    host: string | null
    resolution: number | null
    guessMode: unknown
    /** `time` and `extraGuessTime` of `play next song`. */
    guessTime: number | null
    extraGuessTime: number | null
  }
  players: PlayedSongPlayer[]
  /**
   * The rest of `answer results`: `groupMap`, `watched`, `likedState`,
   * `lateJoinPlayers`, and so on.
   */
  result: Record<string, unknown>
}
