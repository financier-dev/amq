/**
 * Quiz builder state.
 *
 * The quiz is a document we own between a load and a save, with an undo
 * stack. The socket is used only at the ends: `load custom quiz` fills the
 * document and `save quiz` sends it back.
 *
 * **Reads are ours, writes go through AMQ.** The save uses AMQ's own command,
 * so validation, limits and error messages stay AMQ's. The serializer
 * guarantees the payload has the shape the client sends.
 *
 * Load the library before a quiz, or entries resolve to nothing. AMQ nests
 * its own load inside `library.setup(callback)` for the same reason and
 * silently drops uncached entries. We refuse the load instead.
 */

import { SvelteSet } from 'svelte/reactivity'
import { addListeners, sendCommand } from './events'
import {
  blockChosen,
  blockInfo,
  quizTotals,
  type LibraryLookup,
} from './quizCounts'
import { nextId } from '../lib/ids'
import { amqLibrary } from './library.svelte'
import { fromSave, toSave } from './quizSerializer'
import type { QuizSave } from './quizSave'
import {
  MAX_ALGORITHM_BLOCKS,
  MAX_BLOCK_COUNT,
  MAX_MESSAGE_BLOCKS,
  MAX_RULE_BLOCKS,
  MAX_SONG_COUNT,
  MAX_TITLE_BLOCKS,
  clampPick,
  countEntries,
  defaultRuleBlock,
  emptyQuiz,
  songCountCeiling,
  totalEntryCount,
  type Entry,
  type EntryOverrides,
  type NewEntry,
  type GuessModes,
  type PlayEntry,
  type Quiz,
  type RuleBlock,
} from './quizModel'

/** The maximum number of undo steps. */
const UNDO_DEPTH = 50

/** Pairs `get algorithm songs` replies with their requests. */
let nextAlgorithmId = 0

export type SaveState = 'idle' | 'saving' | 'saved' | 'failed'

export class QuizStore {
  #unbind: (() => void) | null = null
  /**
   * The quiz as the server last had it, which `revert()` restores. Set on
   * load, on a new quiz, and after a successful save.
   */
  #saved: Quiz | null = null
  /** Snapshots for undo, oldest first. */
  #history: Quiz[] = []
  // The default matters: the `$derived` fields below run at field
  // initialisation, before the constructor assigns this.
  #library: LibraryLookup = amqLibrary

  quiz = $state<Quiz>(emptyQuiz(nextId('block')))
  /** Server id. Null for a quiz that was never saved. */
  quizId = $state<number | null>(null)
  loaded = $state(false)
  loadFailed = $state(false)
  saveState = $state<SaveState>('idle')

  /** Ids of the selected entries, across all blocks. */
  readonly selection = new SvelteSet<string>()
  /** The rule block the library's "Adds to" strip targets (SPEC §4). */
  targetBlockId = $state<string | null>(null)

  constructor(library: LibraryLookup = amqLibrary) {
    this.#library = library
  }

  // --- reads ---------------------------------------------------------------

  readonly totals = $derived(quizTotals(this.quiz, this.#library))
  readonly songBudgetLeft = $derived(
    MAX_SONG_COUNT -
      this.quiz.blocks.reduce((total, block) => total + block.songCount, 0)
  )
  /**
   * Whether the quiz changed since the last save.
   *
   * `$state`, not a `$derived` over `#history`: that is a plain field, and a
   * derived over it never invalidates.
   */
  dirty = $state(false)
  /** `#history.length`, copied into reactive state for the same reason. */
  undoDepth = $state(0)
  readonly entryCount = $derived(totalEntryCount(this.quiz))

  /** The block library adds go to. Falls back to the first block. */
  readonly targetBlock = $derived(
    this.quiz.blocks.find((block) => block.id === this.targetBlockId) ??
      this.quiz.blocks[0]
  )

  info(block: RuleBlock) {
    return blockInfo(block, this.#library)
  }

  chosen(block: RuleBlock) {
    return blockChosen(block, this.#library)
  }

  ceiling(block: RuleBlock) {
    return songCountCeiling(this.quiz, block)
  }

  /** How many songs an entry can draw from. Sets the pick slider's range. */
  pool(entry: Entry) {
    if (entry.kind === 'anime') {
      return this.#library.animeSongIds(entry.annId, entry.includeSongTypes)
        .length
    }
    return 1
  }

  blockOf(entryId: string) {
    return this.quiz.blocks.find((block) =>
      block.entries.some((entry) => entry.id === entryId)
    )
  }

  /**
   * The reason a block of this kind cannot be added now, or null when it can.
   * The limits follow `customQuizBuilder.js:26-82`, so the UI can disable the
   * action before AMQ rejects it.
   */
  capReached(kind: Entry['kind'] | 'rule'): string | null {
    if (totalEntryCount(this.quiz) >= MAX_BLOCK_COUNT && kind !== 'rule') {
      return `A quiz can hold ${MAX_BLOCK_COUNT} blocks.`
    }
    switch (kind) {
      case 'rule':
        if (this.quiz.blocks.length >= MAX_RULE_BLOCKS) {
          return `A quiz can hold ${MAX_RULE_BLOCKS} rule blocks.`
        }
        // A new rule block needs at least one song of the 250.
        if (this.songBudgetLeft <= 0) {
          return `All ${MAX_SONG_COUNT} songs are already assigned to rule blocks.`
        }
        return null
      case 'algorithm':
        return countEntries(this.quiz, 'algorithm') >= MAX_ALGORITHM_BLOCKS
          ? `A quiz can hold ${MAX_ALGORITHM_BLOCKS} algorithm blocks.`
          : null
      case 'message':
        return countEntries(this.quiz, 'message') >= MAX_MESSAGE_BLOCKS
          ? `A quiz can hold ${MAX_MESSAGE_BLOCKS} message blocks.`
          : null
      case 'title':
        return countEntries(this.quiz, 'title') >= MAX_TITLE_BLOCKS
          ? `A quiz can hold ${MAX_TITLE_BLOCKS} title blocks.`
          : null
      default:
        return null
    }
  }

  // --- lifecycle -----------------------------------------------------------

  bind() {
    if (this.#unbind) return
    this.#unbind = addListeners({
      'load custom quiz': (data) => this.#onLoaded(data),
      'save custom quiz': (data) => this.#onSaved(data),
      'get algorithm songs': (data) => this.#onAlgorithmSongs(data),
    })
  }

  unbind() {
    this.#unbind?.()
    this.#unbind = null
  }

  /** A blank quiz with one empty rule block, as `setupNewQuiz` produces. */
  startNew() {
    this.quiz = emptyQuiz(nextId('block'))
    this.quizId = null
    this.selection.clear()
    this.targetBlockId = this.quiz.blocks[0].id
    this.loaded = true
    this.loadFailed = false
    this.saveState = 'idle'
    this.#markSaved()
  }

  /** Marks the load as failed. Used when the library did not load. */
  failLoad() {
    this.loadFailed = true
    this.loaded = true
  }

  load(quizId: number) {
    this.loaded = false
    this.loadFailed = false
    this.quizId = quizId
    sendCommand('quizCreator', 'load custom quiz', { quizId })
  }

  #onLoaded(data: { quizId: number; failed?: boolean; quizSave?: QuizSave }) {
    if (data.failed || !data.quizSave) {
      this.loadFailed = true
      this.loaded = true
      return
    }
    try {
      this.quiz = fromSave(data.quizSave)
    } catch (error) {
      // An unrecognised block means the serializer is behind the client.
      // Refuse the quiz: loading it without that block and saving would
      // overwrite the original.
      console.error('[amq-ui] could not read this quiz', error)
      this.loadFailed = true
      this.loaded = true
      return
    }
    this.quizId = data.quizId
    this.selection.clear()
    this.targetBlockId = this.quiz.blocks[0]?.id ?? null
    this.loaded = true
    this.#markSaved()
  }

  /**
   * Sends the quiz through AMQ's `save quiz` command. `QuizBuilder.svelte`
   * checks the name before it opens the save dialog.
   */
  save() {
    this.saveState = 'saving'
    sendCommand('quizCreator', 'save quiz', {
      quizSave: toSave($state.snapshot(this.quiz) as Quiz),
      quizId: this.quizId,
    })
  }

  #onSaved(data: { success?: boolean; quizId?: number }) {
    if (!data.success) {
      this.saveState = 'failed'
      return
    }
    if (data.quizId !== undefined) this.quizId = data.quizId
    this.saveState = 'saved'
    // `revert()` must now return to what the server has.
    this.#markSaved()
  }

  /** Stores the matches on the algorithm entry whose id we sent. */
  #onAlgorithmSongs(data: { blockId: number; annSongIds: number[] }) {
    for (const block of this.quiz.blocks) {
      for (const entry of block.entries) {
        if (
          entry.kind === 'algorithm' &&
          entry.algorithmBlockId === data.blockId
        ) {
          entry.matchedAnnSongIds = data.annSongIds
        }
      }
    }
  }

  // --- undo ----------------------------------------------------------------

  /**
   * Records an undo step and marks the quiz as changed. Every mutation calls
   * it first.
   */
  #checkpoint() {
    this.#history.push($state.snapshot(this.quiz) as Quiz)
    if (this.#history.length > UNDO_DEPTH) this.#history.shift()
    this.undoDepth = this.#history.length
    this.dirty = true
  }

  /**
   * Undoes one mutation.
   *
   * Replaces the whole document, as `revert()` does. See the warning there
   * about stale references.
   */
  undo() {
    const previous = this.#history.pop()
    if (!previous) return false
    this.undoDepth = this.#history.length
    this.quiz = previous
    // Drop selected ids whose rows no longer exist.
    for (const id of [...this.selection]) {
      if (!this.blockOf(id)) this.selection.delete(id)
    }
    // With nothing left to undo, the quiz equals the saved state.
    this.dirty = this.#history.length > 0
    return true
  }

  /** Sets the current quiz as the saved state and clears the undo history. */
  #markSaved() {
    this.#saved = $state.snapshot(this.quiz) as Quiz
    this.#history = []
    this.undoDepth = 0
    this.dirty = false
  }

  /**
   * Discards every change since the last save.
   *
   * Replaces the whole document, so **any entry or block reference held
   * across the call is stale** and edits to it are lost. Components re-read
   * from `quiz` on every render. Code that caches an entry must look it up
   * again by id.
   *
   * Cannot be undone. The caller must confirm first.
   */
  revert() {
    if (!this.#saved) return false
    this.quiz = structuredClone(this.#saved)
    this.selection.clear()
    this.targetBlockId = this.quiz.blocks[0]?.id ?? null
    this.#history = []
    this.undoDepth = 0
    this.dirty = false
    return true
  }

  // --- rule blocks ---------------------------------------------------------

  addRuleBlock(): RuleBlock | null {
    if (this.capReached('rule')) return null
    this.#checkpoint()
    const block = defaultRuleBlock(nextId('block'))
    // A new block takes at most what is left of the 250.
    block.songCount = Math.min(block.songCount, this.songBudgetLeft)
    this.quiz.blocks.push(block)
    // Return the stored block, not `block`. `$state` proxies deeply on write,
    // so edits to the raw object would not reach the UI.
    return this.quiz.blocks[this.quiz.blocks.length - 1]
  }

  /** AMQ refuses to delete the last rule block. So do we. */
  removeRuleBlock(blockId: string) {
    if (this.quiz.blocks.length <= 1) return false
    this.#checkpoint()
    const block = this.quiz.blocks.find((entry) => entry.id === blockId)
    for (const entry of block?.entries ?? []) this.selection.delete(entry.id)
    this.quiz.blocks = this.quiz.blocks.filter((entry) => entry.id !== blockId)
    if (this.targetBlockId === blockId) {
      this.targetBlockId = this.quiz.blocks[0]?.id ?? null
    }
    return true
  }

  /**
   * SPEC §7: the copy carries the entries, nested blocks, settings and
   * overrides, and goes directly after the original.
   */
  duplicateRuleBlock(blockId: string) {
    if (this.capReached('rule')) return null
    const index = this.quiz.blocks.findIndex((block) => block.id === blockId)
    if (index === -1) return null
    this.#checkpoint()
    const source = $state.snapshot(this.quiz.blocks[index]) as RuleBlock
    const copy: RuleBlock = {
      ...source,
      id: nextId('block'),
      songCount: Math.min(source.songCount, this.songBudgetLeft),
      entries: source.entries.map((entry) => this.#copyEntry(entry)),
    }
    this.quiz.blocks.splice(index + 1, 0, copy)
    return this.quiz.blocks[index + 1]
  }

  /**
   * A detached copy of an entry with a new id.
   *
   * Uses `$state.snapshot`, not `structuredClone`: entries are deep reactive
   * proxies, and `structuredClone` can throw on one.
   */
  #copyEntry(entry: Entry): Entry {
    const plain = $state.snapshot(entry) as Entry
    return { ...plain, id: nextId(entry.kind) }
  }

  // --- block settings ------------------------------------------------------

  updateBlock(
    blockId: string,
    patch: Partial<Omit<RuleBlock, 'id' | 'entries'>>
  ) {
    const block = this.quiz.blocks.find((entry) => entry.id === blockId)
    if (!block) return
    this.#checkpoint()
    Object.assign(block, patch)
  }

  /** Clamped to what the 250-song limit leaves for this block. */
  setSongCount(blockId: string, value: number) {
    const block = this.quiz.blocks.find((entry) => entry.id === blockId)
    if (!block) return
    this.#checkpoint()
    block.songCount = Math.max(
      1,
      Math.min(Math.round(value), this.ceiling(block))
    )
  }

  // --- entries -------------------------------------------------------------

  /** Adds to the "Adds to" block unless `blockId` is given (SPEC §7). */
  addEntry(entry: NewEntry, blockId?: string): Entry | null {
    const block =
      this.quiz.blocks.find(
        (item) => item.id === (blockId ?? this.targetBlockId)
      ) ?? this.quiz.blocks[0]
    if (!block) return null
    if (this.capReached(entry.kind)) return null
    this.#checkpoint()
    const created = { ...entry, id: nextId(entry.kind) } as Entry
    block.entries.push(created)
    return block.entries[block.entries.length - 1]
  }

  removeEntries(ids: Iterable<string>) {
    const doomed = new Set(ids)
    if (doomed.size === 0) return
    this.#checkpoint()
    for (const block of this.quiz.blocks) {
      block.entries = block.entries.filter((entry) => !doomed.has(entry.id))
      // Clear the flag on the new first entry. It may have been chained to a
      // removed entry above it.
      if (block.entries.length > 0) block.entries[0].connectUp = false
    }
    for (const id of doomed) this.selection.delete(id)
  }

  /**
   * SPEC §6: a move keeps each entry's overrides and the entries' order.
   *
   * `at` inserts before that index in the target block. Omitted or -1
   * appends. The index is adjusted for moved entries that sat above it in the
   * target block, because removing them shifts the drop point.
   */
  moveEntries(ids: Iterable<string>, toBlockId: string, at = -1) {
    const moving = new Set(ids)
    const target = this.quiz.blocks.find((block) => block.id === toBlockId)
    if (!target || moving.size === 0) return
    this.#checkpoint()

    // Count the target's own entries above the drop point that are moving.
    let removedBefore = 0
    if (at >= 0) {
      target.entries.forEach((entry, index) => {
        if (index < at && moving.has(entry.id)) removedBefore += 1
      })
    }

    const taken: Entry[] = []
    for (const block of this.quiz.blocks) {
      const keep: Entry[] = []
      for (const entry of block.entries) {
        if (moving.has(entry.id)) taken.push(entry)
        else keep.push(entry)
      }
      block.entries = keep
      if (block.entries.length > 0) block.entries[0].connectUp = false
    }

    if (at < 0) {
      target.entries.push(...taken)
    } else {
      target.entries.splice(Math.max(0, at - removedBefore), 0, ...taken)
    }
    // The first entry of a block cannot continue a chain.
    if (target.entries.length > 0) target.entries[0].connectUp = false
  }

  duplicateEntries(ids: Iterable<string>) {
    const wanted = new Set(ids)
    if (wanted.size === 0) return
    // A duplicate is an add, so the limits apply.
    for (const id of wanted) {
      const entry = this.#entry(id)
      if (entry && this.capReached(entry.kind)) return
    }
    this.#checkpoint()
    for (const block of this.quiz.blocks) {
      const out: Entry[] = []
      for (const entry of block.entries) {
        out.push(entry)
        if (wanted.has(entry.id)) {
          // The copy starts unchained.
          out.push({ ...this.#copyEntry(entry), connectUp: false })
        }
      }
      block.entries = out
    }
  }

  #entry(entryId: string): Entry | undefined {
    for (const block of this.quiz.blocks) {
      const found = block.entries.find((entry) => entry.id === entryId)
      if (found) return found
    }
    return undefined
  }

  toggleLock(entryId: string) {
    const entry = this.#entry(entryId)
    if (!entry) return
    this.#checkpoint()
    entry.locked = !entry.locked
  }

  setLocked(ids: Iterable<string>, locked: boolean) {
    this.#checkpoint()
    for (const id of ids) {
      const entry = this.#entry(id)
      if (entry) entry.locked = locked
    }
  }

  /**
   * SPEC §5.5: the chain button sits between two rows and toggles
   * `connectUp` on the *lower* entry. The first entry of a block has nothing
   * above it and cannot be chained.
   */
  toggleChain(entryId: string) {
    const block = this.blockOf(entryId)
    if (!block) return
    const index = block.entries.findIndex((entry) => entry.id === entryId)
    if (index <= 0) return
    this.#checkpoint()
    block.entries[index].connectUp = !block.entries[index].connectUp
  }

  // --- anime entry controls ------------------------------------------------

  /**
   * SPEC §5.6: toggling a type clamps the pick count at once, so it never
   * exceeds the pool.
   */
  toggleSongType(entryId: string, type: 'op' | 'ed' | 'in') {
    const entry = this.#entry(entryId)
    if (entry?.kind !== 'anime') return
    this.#checkpoint()
    entry.includeSongTypes[type] = !entry.includeSongTypes[type]
    entry.numberOfSongs = clampPick(entry.numberOfSongs, this.pool(entry))
  }

  setNumberOfSongs(entryId: string, value: number) {
    const entry = this.#entry(entryId)
    if (entry?.kind !== 'anime') return
    this.#checkpoint()
    entry.numberOfSongs = clampPick(Math.round(value), this.pool(entry))
  }

  /**
   * Stores the settings AMQ's host modal produced for an algorithm block and
   * requests a new match count.
   *
   * The settings are stored unchanged. Never inspect or normalise them: a
   * field we do not know would be lost.
   */
  updateAlgorithmSettings(entryId: string, settings: Record<string, unknown>) {
    const entry = this.#entry(entryId)
    if (entry?.kind !== 'algorithm') return
    this.#checkpoint()
    entry.settings = settings
    // The old matches belong to the old settings. Clear them so the row
    // shows "pending".
    entry.matchedAnnSongIds = undefined
    this.requestAlgorithmSongs(entry.id)
  }

  /** Requests the songs an algorithm block matches. */
  requestAlgorithmSongs(entryId: string) {
    const entry = this.#entry(entryId)
    if (entry?.kind !== 'algorithm') return
    if (entry.algorithmBlockId === undefined) {
      nextAlgorithmId += 1
      entry.algorithmBlockId = nextAlgorithmId
    }
    sendCommand('quizCreator', 'get algorithm songs', {
      settings: $state.snapshot(entry.settings),
      blockId: entry.algorithmBlockId,
    })
  }

  // --- per-entry overrides -------------------------------------------------

  /** Applies an override to every given play entry (SPEC §8's footer). */
  setOverride<K extends keyof EntryOverrides>(
    ids: Iterable<string>,
    key: K,
    value: EntryOverrides[K]
  ) {
    this.#checkpoint()
    for (const id of ids) {
      const entry = this.#entry(id)
      if (entry && 'overrides' in entry) {
        ;(entry as PlayEntry).overrides[key] = value
      }
    }
  }

  /** "Reset to block". An entry with no override key follows its block. */
  clearOverride(ids: Iterable<string>, key?: keyof EntryOverrides) {
    this.#checkpoint()
    for (const id of ids) {
      const entry = this.#entry(id)
      if (!entry || !('overrides' in entry)) continue
      const play = entry as PlayEntry
      if (key) delete play.overrides[key]
      else play.overrides = {}
    }
  }

  /**
   * At least one guess mode must stay on. AMQ refuses to turn the last one
   * off, and so do we.
   */
  static toggleGuessMode(modes: GuessModes, key: keyof GuessModes): GuessModes {
    const next = { ...modes, [key]: !modes[key] }
    if (!next.song && !next.tinyVideo && !next.blurVideo) return modes
    return next
  }

  // --- selection -----------------------------------------------------------

  /** Entry ids in render order, for shift-range selection. */
  get flatIds() {
    return this.quiz.blocks.flatMap((block) =>
      block.entries.map((entry) => entry.id)
    )
  }

  toggleSelected(id: string) {
    if (this.selection.has(id)) this.selection.delete(id)
    else this.selection.add(id)
  }

  /** A shift-click range can span blocks (SPEC §6). */
  selectRange(fromId: string, toId: string) {
    const ids = this.flatIds
    const start = ids.indexOf(fromId)
    const end = ids.indexOf(toId)
    if (start === -1 || end === -1) return
    const [low, high] = start <= end ? [start, end] : [end, start]
    for (let index = low; index <= high; index += 1) {
      this.selection.add(ids[index])
    }
  }

  selectBlock(blockId: string, selected: boolean) {
    const block = this.quiz.blocks.find((entry) => entry.id === blockId)
    if (!block) return
    for (const entry of block.entries) {
      if (selected) this.selection.add(entry.id)
      else this.selection.delete(entry.id)
    }
  }

  clearSelection() {
    this.selection.clear()
  }
}

export const quizStore = new QuizStore()
