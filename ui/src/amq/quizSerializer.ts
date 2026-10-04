/**
 * Our model ⇄ AMQ's custom-quiz save payload.
 *
 * This is the highest-risk file in the screen: everything else can look wrong
 * and be fixed, but a serializer bug silently corrupts a quiz the player has
 * already saved. Two rules keep it honest.
 *
 * **Round-trip, don't reconstruct.** `toSave(fromSave(p))` must deep-equal `p`
 * for any real payload. Anything we do not model — a field added in a capture
 * newer than ours, the message block's avatar blob, the algorithm block's
 * settings — is carried through untouched rather than rebuilt. The README
 * warns that payload shapes drift between captures; an unknown-field bag is
 * what stops that drift from eating a player's quiz.
 *
 * **Emit absence, not `undefined`.** AMQ reads an override's *presence* as
 * "this entry overrides its block" (`customQuizPlayEntryBlock.js:72-87`), and a
 * key set to `undefined` survives a structuredClone and an equality check
 * differently than a missing one. Every optional field is added conditionally.
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

/**
 * Ids are ours and client-local; AMQ identifies blocks and entries by position.
 * They come from one app-wide counter — see `lib/ids.ts` for why.
 */
export { resetIds as __resetIds } from '../lib/ids'

/**
 * Splits an incoming object into the fields we model and everything else.
 *
 * `known` is listed rather than derived so that adding a field to our model is
 * a deliberate act: forget to list it and it stays in the unknown bag, which is
 * harmless, instead of being dropped, which is not.
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

/** Spreads the unknown bag back out, or nothing when there wasn't one. */
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
      // The server pre-supplies matches on load and the client deletes them off
      // the payload; keep them out of the unknown bag or they'd be saved back.
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

  // AMQ's loader silently skips a block it cannot classify. Ours refuses
  // instead: dropping an entry here would round-trip as data loss, and the
  // caller can fall back to `useLegacy()` with the quiz intact.
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
  // Server-added on load; listed so it lands neither in the model nor the
  // unknown bag, and so is not echoed back on save.
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
  // The first entry of a block has nothing to connect up to. AMQ's loader only
  // ever consults the flag for index > 0, so a stale `true` here is invisible
  // in game and would still break an equality check — clear it.
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

    // Message and title spread the base *last* in the client
    // (`customQuizMessageBlock.js:129`). Key order does not affect equality,
    // but matching it keeps a diff of the two payloads readable.
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
