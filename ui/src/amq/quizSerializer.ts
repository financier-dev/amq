/**
 * Converts between our model and AMQ's custom-quiz save payload.
 *
 * This is the highest-risk file of the quiz builder. A bug here silently
 * corrupts a quiz the player has already saved. Two rules:
 *
 * **Round-trip, do not reconstruct.** `toSave(fromSave(p))` must deep-equal
 * `p` for any real payload. Carry through unchanged everything we do not
 * model: a field a newer client added, the message block's avatar, the
 * algorithm block's settings. Payload shapes change between client versions,
 * and the unknown-field bag keeps such a change from losing data.
 *
 * **Omit a key; never set it to `undefined`.** AMQ reads the presence of an
 * override as "this entry overrides its block"
 * (`customQuizPlayEntryBlock.js:72-87`), and `undefined` does not compare
 * equal to a missing key. Add every optional field conditionally.
 */

import {
  isAlgorithmEntry,
  isAnimeEntry,
  isMessageEntry,
  isSongEntry,
  isTitleEntry,
  SERVER_ONLY_BLOCK_FIELDS,
  SERVER_ONLY_QUIZ_FIELDS,
  type EntrySave,
  type QuizSave,
  type RuleBlockSave,
} from './quizSave'
import { nextId } from '../lib/ids'
import type {
  Entry,
  EntryOverrides,
  Quiz,
  RuleBlock,
  UnknownFields,
} from './quizModel'

export { resetIds as __resetIds } from '../lib/ids'

/**
 * Returns the fields of `source` that are not in `known`.
 *
 * `known` is an explicit list on purpose. A model field missing from it lands
 * in the unknown bag and still round-trips. A derived list could drop it.
 */
function rest(
  source: Record<string, unknown>,
  known: string[]
): UnknownFields | undefined {
  const extra: UnknownFields = {}
  let found = false
  for (const key of Object.keys(source)) {
    if (!known.includes(key)) {
      extra[key] = source[key]
      found = true
    }
  }
  return found ? extra : undefined
}

function withUnknown<T extends object>(value: T, unknown?: UnknownFields): T {
  return unknown ? { ...value, ...unknown } : value
}

const OVERRIDE_KEYS = [
  'guessTime',
  'samplePoint',
  'playBackSpeed',
  'guessModes',
] as const

const ENTRY_BASE_KEYS = ['connectUp', 'locked']
const PLAY_ENTRY_KEYS = [...ENTRY_BASE_KEYS, ...OVERRIDE_KEYS]

function readOverrides(save: Record<string, unknown>): EntryOverrides {
  const overrides: EntryOverrides = {}
  for (const key of OVERRIDE_KEYS) {
    if (save[key] !== undefined) {
      overrides[key] = save[key] as never
    }
  }
  return overrides
}

function writeOverrides(overrides: EntryOverrides): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of OVERRIDE_KEYS) {
    const value = overrides[key]
    if (value !== undefined) out[key] = value
  }
  return out
}

// --- load -------------------------------------------------------------------

function entryFromSave(save: EntrySave): Entry {
  const raw = save as unknown as Record<string, unknown>
  const base = {
    connectUp: Boolean(save.connectUp),
    locked: Boolean(save.locked),
  }

  // Order matches the loader's `if` ladder (`customQuizBuilder.js:346-400`).
  if (isAnimeEntry(save)) {
    return {
      ...base,
      id: nextId('anime'),
      kind: 'anime',
      annId: save.annId,
      includeSongTypes: save.includeSongTypes,
      numberOfSongs: save.numberOfSongs,
      overrides: readOverrides(raw),
      unknown: rest(raw, [
        ...PLAY_ENTRY_KEYS,
        'annId',
        'includeSongTypes',
        'numberOfSongs',
      ]),
    }
  }

  if (isSongEntry(save)) {
    return {
      ...base,
      id: nextId('song'),
      kind: 'song',
      annSongId: save.annSongId,
      overrides: readOverrides(raw),
      unknown: rest(raw, [...PLAY_ENTRY_KEYS, 'annSongId']),
    }
  }

  if (isAlgorithmEntry(save)) {
    return {
      ...base,
      id: nextId('algorithm'),
      kind: 'algorithm',
      settings: save.settings,
      overrides: readOverrides(raw),
      // The server sends matches on load and the client deletes them from the
      // payload. Listing `annSongIds` as known keeps it out of the save.
      matchedAnnSongIds: raw.annSongIds as number[] | undefined,
      unknown: rest(raw, [...PLAY_ENTRY_KEYS, 'settings', 'annSongIds']),
    }
  }

  if (isMessageEntry(save)) {
    return {
      ...base,
      id: nextId('message'),
      kind: 'message',
      message: save.message,
      avatar: save.avatar,
      videoDisplay: Boolean(save.videoDisplay),
      delay: save.delay,
      time: save.time,
      unknown: rest(raw, [
        ...ENTRY_BASE_KEYS,
        'message',
        'avatar',
        'videoDisplay',
        'delay',
        'time',
      ]),
    }
  }

  if (isTitleEntry(save)) {
    return {
      ...base,
      id: nextId('title'),
      kind: 'title',
      title: save.title,
      unknown: rest(raw, [...ENTRY_BASE_KEYS, 'title']),
    }
  }

  // AMQ's loader silently skips a block it cannot classify. We throw: a
  // dropped entry would be lost on the next save. The caller can fall back to
  // `useLegacy()` with the quiz intact.
  throw new Error(
    `[amq-ui] unrecognised quiz block: ${JSON.stringify(Object.keys(raw))}`
  )
}

const RULE_BLOCK_KEYS = [
  'randomOrder',
  'songCount',
  'guessTime',
  'samplePoint',
  'playBackSpeed',
  'duplicates',
  'guessModes',
  'blocks',
  // Listed so they reach neither the model nor the unknown bag, and are not
  // sent back on save.
  ...SERVER_ONLY_BLOCK_FIELDS,
]

function ruleBlockFromSave(save: RuleBlockSave): RuleBlock {
  const raw = save as unknown as Record<string, unknown>
  return {
    id: nextId('block'),
    randomOrder: Boolean(save.randomOrder),
    songCount: save.songCount,
    guessTime: save.guessTime,
    samplePoint: save.samplePoint,
    playBackSpeed: save.playBackSpeed,
    duplicates: Boolean(save.duplicates),
    guessModes: save.guessModes,
    entries: (save.blocks ?? []).map(entryFromSave),
    unknown: rest(raw, RULE_BLOCK_KEYS),
  }
}

const QUIZ_KEYS = [
  'name',
  'description',
  'tags',
  'ruleBlocks',
  'ruleBlockRandomOrder',
  ...SERVER_ONLY_QUIZ_FIELDS,
]

export function fromSave(save: QuizSave): Quiz {
  const raw = save as unknown as Record<string, unknown>
  return {
    name: save.name,
    description: save.description,
    tags: save.tags ?? [],
    ruleBlockRandomOrder: Boolean(save.ruleBlockRandomOrder),
    blocks: (save.ruleBlocks ?? []).map(ruleBlockFromSave),
    unknown: rest(raw, QUIZ_KEYS),
  }
}

// --- save -------------------------------------------------------------------

function entryToSave(entry: Entry, index: number): EntrySave {
  // The first entry of a block has nothing above it. AMQ's loader reads the
  // flag only for index > 0, so clear a stale `true` to keep round-trip
  // equality.
  const base = { connectUp: index > 0 && entry.connectUp, locked: entry.locked }

  switch (entry.kind) {
    case 'anime':
      return withUnknown(
        {
          ...base,
          annId: entry.annId,
          includeSongTypes: entry.includeSongTypes,
          numberOfSongs: entry.numberOfSongs,
          ...writeOverrides(entry.overrides),
        },
        entry.unknown
      ) as EntrySave

    case 'song':
      return withUnknown(
        {
          ...base,
          annSongId: entry.annSongId,
          ...writeOverrides(entry.overrides),
        },
        entry.unknown
      ) as EntrySave

    case 'algorithm':
      return withUnknown(
        {
          ...base,
          settings: entry.settings,
          ...writeOverrides(entry.overrides),
        },
        entry.unknown
      ) as EntrySave

    // The client spreads the base last for message and title
    // (`customQuizMessageBlock.js:129`). Key order does not affect equality,
    // but the same order keeps a diff of the two payloads readable.
    case 'message':
      return withUnknown(
        {
          message: entry.message,
          avatar: entry.avatar,
          videoDisplay: entry.videoDisplay,
          delay: entry.delay,
          time: entry.time,
          ...base,
        },
        entry.unknown
      ) as EntrySave

    case 'title':
      return withUnknown(
        { title: entry.title, ...base },
        entry.unknown
      ) as EntrySave
  }
}

function ruleBlockToSave(block: RuleBlock): RuleBlockSave {
  return withUnknown(
    {
      randomOrder: block.randomOrder,
      songCount: block.songCount,
      guessTime: block.guessTime,
      samplePoint: block.samplePoint,
      playBackSpeed: block.playBackSpeed,
      blocks: block.entries.map(entryToSave),
      duplicates: block.duplicates,
      guessModes: block.guessModes,
    },
    block.unknown
  )
}

export function toSave(quiz: Quiz): QuizSave {
  return withUnknown(
    {
      name: quiz.name,
      description: quiz.description,
      tags: quiz.tags,
      ruleBlocks: quiz.blocks.map(ruleBlockToSave),
      ruleBlockRandomOrder: quiz.ruleBlockRandomOrder,
    },
    quiz.unknown
  )
}
