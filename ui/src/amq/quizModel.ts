/**
 * Our quiz model (SPEC §3, corrected against the client source).
 *
 * Types and pure helpers only: no runes, no DOM, no AMQ globals. The
 * serializer and the tests use it without a store.
 *
 * Two differences from SPEC §3, both required by the real save format:
 *
 *   - Chaining is `connectUp` on the **lower** entry, not `linkNext` on the
 *     upper one.
 *   - Guess mode is a **set** of three booleans, not one of three values. At
 *     least one must stay enabled.
 *
 * Entries hold ids, never display text. Anime names, song titles, artists and
 * OP/ED/IN counts resolve from AMQ's library cache at render time, as in the
 * client. Stored copies would go stale.
 */

import type {
  GuessModesSave,
  GuessTimeSave,
  IncludeSongTypesSave,
  PlayBackSpeedSave,
  SamplePointSave,
} from './quizSave'

export type { GuessModesSave as GuessModes }

/** Keys AMQ sent that we do not model. A round-trip must carry them back. */
export type UnknownFields = Record<string, unknown>

export interface EntryOverrides {
  guessTime?: GuessTimeSave
  samplePoint?: SamplePointSave
  playBackSpeed?: PlayBackSpeedSave
  guessModes?: GuessModesSave
}

interface EntryCommon {
  /** Client-local. Never serialized: AMQ identifies entries by position. */
  id: string
  connectUp: boolean
  locked: boolean
  unknown?: UnknownFields
}

export interface AnimeEntry extends EntryCommon {
  kind: 'anime'
  annId: number
  includeSongTypes: IncludeSongTypesSave
  /** How many songs to take from this anime, from 1 to the pool size. */
  numberOfSongs: number
  overrides: EntryOverrides
}

export interface SongEntry extends EntryCommon {
  kind: 'song'
  annSongId: number
  overrides: EntryOverrides
}

export interface AlgorithmEntry extends EntryCommon {
  kind: 'algorithm'
  /** Opaque settings from the host modal. Carried through unchanged. */
  settings: Record<string, unknown>
  overrides: EntryOverrides
  /**
   * Matches from the server, refreshed by `get algorithm songs`. Never saved:
   * AMQ deletes them from the payload after load.
   */
  matchedAnnSongIds?: number[]
  /**
   * Client-local id that pairs a `get algorithm songs` reply with its
   * request. Not part of the save.
   */
  algorithmBlockId?: number
}

export interface MessageEntry extends EntryCommon {
  kind: 'message'
  message: string
  avatar: unknown
  videoDisplay: boolean
  delay: number
  time: number
}

export interface TitleEntry extends EntryCommon {
  kind: 'title'
  title: string
}

export type Entry =
  AnimeEntry | SongEntry | AlgorithmEntry | MessageEntry | TitleEntry

/**
 * An entry before the store gives it an id.
 *
 * The conditional type distributes over the union. A plain
 * `Omit<Entry, 'id'>` keeps only the keys every member shares
 * (`kind | connectUp | locked`), so it would reject a message's `message`.
 */
export type NewEntry = Entry extends infer T
  ? T extends Entry
    ? Omit<T, 'id'>
    : never
  : never

/** The kinds that play a song. Only these carry per-entry overrides. */
export type PlayEntry = AnimeEntry | SongEntry | AlgorithmEntry

export function isPlayEntry(entry: Entry): entry is PlayEntry {
  return (
    entry.kind === 'anime' ||
    entry.kind === 'song' ||
    entry.kind === 'algorithm'
  )
}

export interface RuleBlock {
  /** Client-local. AMQ identifies rule blocks by position. */
  id: string
  randomOrder: boolean
  songCount: number
  guessTime: GuessTimeSave
  samplePoint: SamplePointSave
  playBackSpeed: PlayBackSpeedSave
  duplicates: boolean
  guessModes: GuessModesSave
  entries: Entry[]
  unknown?: UnknownFields
}

export interface Quiz {
  name: string
  description: string
  tags: number[]
  ruleBlockRandomOrder: boolean
  blocks: RuleBlock[]
  unknown?: UnknownFields
}

// --- limits (customQuizBuilder.js:432-436, customQuizCreator.js:287) --------

export const MAX_RULE_BLOCKS = 30
/** `MAX_ALGORIHMN_BLOCKS` in the client (sic). */
export const MAX_ALGORITHM_BLOCKS = 7
export const MAX_SONG_COUNT = 250
export const MAX_MESSAGE_BLOCKS = 500
export const MAX_TITLE_BLOCKS = 100
/** Counts every entry in the quiz. */
export const MAX_BLOCK_COUNT = 2000
export const MAX_TAGS = 2

/** `customQuizRuleBlock.js:626` */
export const DEFAULT_SONG_COUNT = 20
/** `customQuizBlockRuleBlocks.js:621` */
export const PLAYBACK_SPEED_TICKS = [1, 1.5, 2, 4]

// --- defaults ---------------------------------------------------------------

export function defaultGuessModes(): GuessModesSave {
  return { song: true, tinyVideo: false, blurVideo: false }
}

export function defaultRuleBlock(id: string): RuleBlock {
  return {
    id,
    randomOrder: true,
    songCount: DEFAULT_SONG_COUNT,
    guessTime: { guessTime: 20, extraGuessTime: 0 },
    samplePoint: { samplePoint: 50 },
    playBackSpeed: { playBackSpeed: 1 },
    duplicates: true,
    guessModes: defaultGuessModes(),
    entries: [],
  }
}

export function emptyQuiz(id: string): Quiz {
  return {
    name: '',
    description: '',
    tags: [],
    ruleBlockRandomOrder: false,
    blocks: [defaultRuleBlock(id)],
  }
}

// --- derived counts ---------------------------------------------------------

/**
 * Songs available from an anime entry for its enabled types. The caller
 * passes the per-type counts, which come from the library cache.
 */
export function animePool(
  entry: AnimeEntry,
  counts: { op: number; ed: number; ins: number }
): number {
  const { includeSongTypes: on } = entry
  return (
    (on.op ? counts.op : 0) + (on.ed ? counts.ed : 0) + (on.in ? counts.ins : 0)
  )
}

/** Never below 1, even for an empty pool. */
export function clampPick(value: number, pool: number): number {
  return Math.max(1, Math.min(value, Math.max(pool, 1)))
}

/** Total songs the quiz plays. The 250-song limit applies to this number. */
export function totalSongCount(quiz: Quiz): number {
  return quiz.blocks.reduce((total, block) => total + block.songCount, 0)
}

/**
 * The most songs `block` may take: what is left of the 250-song limit.
 * Follows `customQuizBuilder.js:314` and `customQuizRuleBlock.js:539`.
 */
export function songCountCeiling(quiz: Quiz, block: RuleBlock): number {
  const others = totalSongCount(quiz) - block.songCount
  return Math.min(MAX_SONG_COUNT - others, MAX_SONG_COUNT)
}

export function countEntries(quiz: Quiz, kind: Entry['kind']): number {
  return quiz.blocks.reduce(
    (total, block) =>
      total + block.entries.filter((entry) => entry.kind === kind).length,
    0
  )
}

export function totalEntryCount(quiz: Quiz): number {
  return quiz.blocks.reduce((total, block) => total + block.entries.length, 0)
}

/**
 * Chains, as runs of consecutive entries. AMQ rebuilds its runtime block
 * groups from `connectUp` the same way (`customQuizBuilder.js:345`): an entry
 * with the flag joins the run above it, an entry without starts a new run.
 *
 * The first entry of a block cannot continue a chain, so its flag is ignored
 * here. `toSave` clears it.
 */
export function chainRuns(entries: Entry[]): Entry[][] {
  const runs: Entry[][] = []
  entries.forEach((entry, index) => {
    if (index > 0 && entry.connectUp && runs.length > 0) {
      runs[runs.length - 1].push(entry)
    } else {
      runs.push([entry])
    }
  })
  return runs
}
