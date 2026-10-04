/**
 * Our quiz model (SPEC §3, corrected against the client source).
 *
 * Pure types and pure helpers — no runes, no DOM, no AMQ globals — so the
 * serializer and the unit tests can use it without pulling in a store.
 *
 * Two deliberate differences from SPEC §3, both forced by the real save format:
 *
 *   - Chaining is `connectUp` on the **lower** entry, not `linkNext` on the
 *     upper one. The spec drew the affordance correctly but guessed the
 *     direction; rendering is unchanged, the click target is not.
 *   - Guess mode is a **set** of three booleans, not one of three values, and
 *     at least one must stay enabled.
 *
 * Entries hold ids, never display text. Anime names, song titles, artists and
 * OP/ED/IN counts are resolved at render time from AMQ's library cache — the
 * client does the same, and storing them would let them drift.
 */

import type {
  GuessModesSave,
  GuessTimeSave,
  IncludeSongTypesSave,
  PlayBackSpeedSave,
  SamplePointSave,
} from './quizSave'

export type { GuessModesSave as GuessModes }

/** Keys AMQ sent that we do not model, kept so a round-trip never drops them. */
export type UnknownFields = Record<string, unknown>

export interface EntryOverrides {
  guessTime?: GuessTimeSave
  samplePoint?: SamplePointSave
  playBackSpeed?: PlayBackSpeedSave
  guessModes?: GuessModesSave
}

interface EntryCommon {
  /** Client-local, ours. Never serialized — AMQ identifies entries by position. */
  id: string
  connectUp: boolean
  locked: boolean
  unknown?: UnknownFields
}

export interface AnimeEntry extends EntryCommon {
  kind: 'anime'
  annId: number
  includeSongTypes: IncludeSongTypesSave
  /** "How many songs to take from this anime", 1..pool. */
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
  /** Opaque host-modal settings blob; round-tripped untouched. */
  settings: Record<string, unknown>
  overrides: EntryOverrides
  /**
   * Server-supplied matches, refreshed by `get algorithm songs`. Never saved —
   * AMQ deletes them off the payload after load.
   */
  matchedAnnSongIds?: number[]
  /**
   * Client-local correlation id for the `get algorithm songs` round-trip. AMQ
   * uses a plain counter for the same job; it is not part of the save.
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
 * Distributive on purpose: a plain `Omit<Entry, 'id'>` over a union keeps only
 * the keys every member shares, which here is `kind | connectUp | locked` — so
 * passing a message's `message` would be rejected as an unknown property.
 */
export type NewEntry = Entry extends infer T
  ? T extends Entry
    ? Omit<T, 'id'>
    : never
  : never

/** The three that play a song, and so can carry per-entry overrides. */
export type PlayEntry = AnimeEntry | SongEntry | AlgorithmEntry

export function isPlayEntry(entry: Entry): entry is PlayEntry {
  return (
    entry.kind === 'anime' ||
    entry.kind === 'song' ||
    entry.kind === 'algorithm'
  )
}

export interface RuleBlock {
  /** Client-local. Rule blocks have no name in AMQ; they are identified by position. */
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
/** `MAX_ALGORIHMN_BLOCKS` in the client — the misspelling is theirs. */
export const MAX_ALGORITHM_BLOCKS = 7
export const MAX_SONG_COUNT = 250
export const MAX_MESSAGE_BLOCKS = 500
export const MAX_TITLE_BLOCKS = 100
/** Every entry across the whole quiz. */
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
 * Songs available from an anime entry, given which types are switched on.
 * The per-type counts are not stored — they come from the library cache, so the
 * caller passes them in.
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

/** `pick` is clamped every time a type toggles, so a pool of 0 still yields 1. */
export function clampPick(value: number, pool: number): number {
  return Math.max(1, Math.min(value, Math.max(pool, 1)))
}

/** Total songs the quiz will play — the number the 250 cap applies to. */
export function totalSongCount(quiz: Quiz): number {
  return quiz.blocks.reduce((total, block) => total + block.songCount, 0)
}

/**
 * How much of the 250-song budget is left for `block` — i.e. the cap on its own
 * slider. Mirrors `customQuizBuilder.js:314` + `customQuizRuleBlock.js:539`.
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
 * Chains, as runs of consecutive entries. AMQ rebuilds its runtime block groups
 * from `connectUp` exactly this way (`customQuizBuilder.js:345`): an entry with
 * the flag joins the run above it, one without starts a new run.
 *
 * The first entry of a block can never continue a chain, so its flag is ignored
 * here — and `toSave` clears it, because a stale `true` there would silently
 * merge the block's opening entry into nothing.
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
