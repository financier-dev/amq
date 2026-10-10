/**
 * AMQ's custom-quiz save payload, typed from the client source:
 * `~/amq-source/<capture>/animemusicquiz.com/scripts/pages/gamePage/customQuiz/creator/`.
 *
 * The serializer must reproduce these objects exactly. Keep every field name
 * as AMQ spells it, misspellings included.
 *
 * Two facts shape the model:
 *
 *   1. The field that is present decides a block's kind. There is no `type`
 *      tag (`customQuizBuilder.js:343-405`), and a stray `type` makes AMQ
 *      misread the block.
 *   2. Chaining is stored as `connectUp` on the **lower** entry. The runtime
 *      `CustomQuizCreatorBlockGroup` that holds a chain is never serialized.
 *      AMQ rebuilds it from the flag on load.
 */

/**
 * A fixed number, or a `[min, max]` range the game picks from at random
 * (`customQuizBlockRuleBlocks.js:412-423`).
 */
export type MaybeRandom = number | [number, number]

/** `customQuizBlockRuleBlocks.js:557` */
export interface GuessTimeSave {
  guessTime: MaybeRandom
  extraGuessTime: MaybeRandom
}

/** `customQuizBlockRuleBlocks.js:804`. A percentage, 0-100. Not seconds. */
export interface SamplePointSave {
  samplePoint: MaybeRandom
}

/**
 * `customQuizBlockRuleBlocks.js:687`. A fixed value comes from the tick list
 * [1, 1.5, 2, 4]. Random mode stores a subset of that list, so the array holds
 * choices, not a `[min, max]` pair.
 */
export interface PlayBackSpeedSave {
  playBackSpeed: number | number[]
}

/**
 * `customQuizBlockRuleBlocks.js:173`. Three independent booleans, not an enum.
 * At least one must stay true; the client refuses to turn the last one off.
 */
export interface GuessModesSave {
  song: boolean
  tinyVideo: boolean
  blurVideo: boolean
}

/** `customQuizAnimeBlock.js:39-43`. Booleans, not counts. */
export interface IncludeSongTypesSave {
  op: boolean
  ed: boolean
  in: boolean
}

/** `customQuizDragBlock.js:177`. Every entry and nested block carries these. */
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
   * Opaque. `hostModal.getQuizBuilderSettings()` produces it and we store it
   * unchanged. Never inspect or rebuild it.
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
 * A key is written only when the entry overrides its block
 * (`customQuizPlayEntryBlock.js:72-87`). An absent key means "follow the
 * block", so never emit one as `undefined`.
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
 * The client consumes and deletes `annSongIds`
 * (`customQuizAlgorithmBlock.js:126`). The server also returns
 * `matchSongCount` on a rule block and a top-level `version`. None of the
 * three appears in `generateQuizSave`, so do not send them back.
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

/**
 * `customQuizCreator.js:136`. `save quiz` sends it and `load custom quiz`
 * returns it.
 */
export interface QuizSave {
  name: string
  description: string
  /** Community tag ids. AMQ allows at most 2. */
  tags: number[]
  ruleBlocks: RuleBlockSave[]
  ruleBlockRandomOrder: boolean
}

// These guards follow the order of the loader's `if` ladder. The loader checks
// `message` and `title` with `!= undefined` because an empty string is a valid
// value for both.

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
