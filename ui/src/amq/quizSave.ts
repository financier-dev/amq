/**
 * AMQ's custom-quiz save payload, typed from the client source.
 *
 * Every shape here is transcribed from
 * `~/amq-source/<capture>/animemusicquiz.com/scripts/pages/gamePage/customQuiz/creator/`,
 * not inferred from a screenshot. The serializer's whole job is to reproduce
 * these objects exactly, so the field names — including AMQ's own misspellings —
 * are load-bearing. Do not "tidy" them.
 *
 * Two structural facts drive everything:
 *
 *   1. A block's *kind* is discriminated by which field is present, not by a
 *      `type` tag (`customQuizBuilder.js:343-405`). Emitting a stray `type`
 *      would make AMQ misread the block.
 *   2. Chaining is stored as `connectUp` on the **lower** entry. The runtime
 *      `CustomQuizCreatorBlockGroup` that holds a chain together is never
 *      serialized — it is rebuilt from the flag on load.
 */

/**
 * Several rule values are "a number, or a two-element range the game picks from
 * at random". Array means random (`customQuizBlockRuleBlocks.js:412-423`).
 */
export type MaybeRandom = number | [number, number]

/** `customQuizBlockRuleBlocks.js:557` */
export interface GuessTimeSave {
  guessTime: MaybeRandom
  extraGuessTime: MaybeRandom
}

/** `customQuizBlockRuleBlocks.js:804` — a percentage, 0-100, never seconds. */
export interface SamplePointSave {
  samplePoint: MaybeRandom
}

/**
 * `customQuizBlockRuleBlocks.js:687`. Fixed values come from the tick list
 * [1, 1.5, 2, 4]; random mode stores a subset of it, so this is an array of
 * choices rather than a [min, max] pair.
 */
export interface PlayBackSpeedSave {
  playBackSpeed: number | number[]
}

/**
 * `customQuizBlockRuleBlocks.js:173` — three independent booleans, **not** an
 * enum, and at least one must stay true (the client refuses the last toggle).
 */
export interface GuessModesSave {
  song: boolean
  tinyVideo: boolean
  blurVideo: boolean
}

/** `customQuizAnimeBlock.js:39-43` — booleans, not counts. */
export interface IncludeSongTypesSave {
  op: boolean
  ed: boolean
  in: boolean
}

/** `customQuizDragBlock.js:177` — carried by every entry and nested block. */
export interface EntryBaseSave {
  connectUp: boolean
  locked: boolean
}

export interface AnimeEntrySave extends EntryBaseSave, EntryOverridesSave {
  annId: number
  includeSongTypes: IncludeSongTypesSave
  numberOfSongs: number
}

export interface SongEntrySave extends EntryBaseSave, EntryOverridesSave {
  annSongId: number
}

export interface AlgorithmEntrySave extends EntryBaseSave, EntryOverridesSave {
  /**
   * Opaque. Produced by `hostModal.getQuizBuilderSettings()` and stored
   * verbatim; the filter set is large and server-backed, so we never inspect or
   * rebuild it — we round-trip it untouched.
   */
  settings: Record<string, unknown>
}

export interface MessageEntrySave extends EntryBaseSave {
  message: string
  avatar: unknown
  videoDisplay: boolean
  delay: number
  time: number
}

export interface TitleEntrySave extends EntryBaseSave {
  title: string
}

/**
 * Overrides are written **only when the entry actually overrides its block**
 * (`customQuizPlayEntryBlock.js:72-87`). An absent key means "follow the
 * block", so these must stay optional and must not be emitted as `undefined`.
 */
export interface EntryOverridesSave {
  guessTime?: GuessTimeSave
  samplePoint?: SamplePointSave
  playBackSpeed?: PlayBackSpeedSave
  guessModes?: GuessModesSave
}

export type EntrySave =
  | AnimeEntrySave
  | SongEntrySave
  | AlgorithmEntrySave
  | MessageEntrySave
  | TitleEntrySave

/**
 * Fields the **server** adds on load that a save never carries.
 *
 * `annSongIds` was the first: the client consumes and deletes it
 * (`customQuizAlgorithmBlock.js:126`). The live suite found two more by saving
 * a quiz and diffing what came back — `matchSongCount` on a rule block and a
 * top-level `version`. None of the three appears in `generateQuizSave`, so
 * echoing them back would send AMQ something its own client never would.
 */
export const SERVER_ONLY_QUIZ_FIELDS = ['version'] as const
export const SERVER_ONLY_BLOCK_FIELDS = ['matchSongCount'] as const
export const SERVER_ONLY_ENTRY_FIELDS = ['annSongIds'] as const

/** `customQuizRuleBlock.js:303` */
export interface RuleBlockSave {
  randomOrder: boolean
  songCount: number
  guessTime: GuessTimeSave
  samplePoint: SamplePointSave
  playBackSpeed: PlayBackSpeedSave
  duplicates: boolean
  guessModes: GuessModesSave
  blocks: EntrySave[]
}

/** `customQuizCreator.js:136` — what `save quiz` carries and `load custom quiz` returns. */
export interface QuizSave {
  name: string
  description: string
  /** Community tag ids; AMQ caps the selection at 2. */
  tags: number[]
  ruleBlocks: RuleBlockSave[]
  ruleBlockRandomOrder: boolean
}

// --- kind discrimination ----------------------------------------------------
// Mirrors the loader's `if` ladder exactly, in the same order. `message` and
// `title` are checked with `!= undefined` there because an empty string is a
// legitimate value for both.

export function isAnimeEntry(save: EntrySave): save is AnimeEntrySave {
  return (save as AnimeEntrySave).annId !== undefined
}

export function isSongEntry(save: EntrySave): save is SongEntrySave {
  return (save as SongEntrySave).annSongId !== undefined
}

export function isAlgorithmEntry(save: EntrySave): save is AlgorithmEntrySave {
  return (save as AlgorithmEntrySave).settings !== undefined
}

export function isMessageEntry(save: EntrySave): save is MessageEntrySave {
  return (save as MessageEntrySave).message !== undefined
}

export function isTitleEntry(save: EntrySave): save is TitleEntrySave {
  return (save as TitleEntrySave).title !== undefined
}
