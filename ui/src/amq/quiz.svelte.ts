/**
 * Quiz builder state.
 *
 * Unlike the room browser, this screen is not a reducer over a live feed — the
 * quiz is a document we own between a load and a save. So the shape here is a
 * document plus an undo stack, and the socket only bookends it: `load custom
 * quiz` fills the document, `save quiz` hands it back.
 *
 * **Reads are ours, writes are delegated.** The save goes out through AMQ's own
 * command so its validation, its caps and its error toasts stay AMQ's; we never
 * invent a payload the client would not have produced. The serializer is what
 * guarantees that, and it is tested to round-trip real quizzes exactly.
 *
 * The library must be loaded before a quiz is, or entries resolve to nothing —
 * AMQ nests its own load inside `library.setup(callback)` for the same reason,
 * and its loader silently drops uncached entries. Ours refuses instead.
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

/** How many steps back `undo()` can walk. */
const UNDO_DEPTH = 50

/** Correlates `get algorithm songs` replies; AMQ uses a plain counter too. */
let nextAlgorithmId = 0

export type SaveState = 'idle' | 'saving' | 'saved' | 'failed'

export class QuizStore {
  #unbind: (() => void) | null = null
  /**
   * The quiz as the server last had it — the target of `revert()`.
   *
   * Captured on load, on a new quiz, and after a successful save.
   */
  #saved: Quiz | null = null
  /** Snapshots for step-by-step undo, oldest first. */
  #history: Quiz[] = []
  // Declared with a default so the `$derived` fields below, which run at
  // field-initialisation time, never read it before the constructor assigns it.
  #library: LibraryLookup = amqLibrary

  quiz = $state<Quiz>(emptyQuiz(nextId('block')))
  /** Server id; null for a quiz that has never been saved. */
  quizId = $state<number | null>(null)
  loaded = $state(false)
  loadFailed = $state(false)
  saveState = $state<SaveState>('idle')

  /** Entries and nested blocks that are selected, by id, across blocks. */
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
   * Whether anything has changed since the last save.
   *
   * `$state`, not a `$derived` over a private array: the array was a plain
   * field, so the derived never invalidated and the Undo button stayed greyed
   * out forever no matter what you did.
   */
  dirty = $state(false)
  /**
   * How many steps `undo()` can walk back.
   *
   * Mirrored into reactive state rather than derived from `#history.length`:
   * a `$derived` over a plain field never invalidates, which is what left the
   * button permanently greyed out the first time round.
   */
  undoDepth = $state(0)
  readonly entryCount = $derived(totalEntryCount(this.quiz))

  /** The block every library add lands in; falls back to the first block. */
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

  /** Songs an anime entry can draw from, for the pick slider's range. */
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
   * Why a given kind of block cannot be added right now, or null when it can.
   * The UI disables at the cap rather than letting AMQ reject the action, so
   * these mirror `customQuizBuilder.js:26-82` exactly.
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
        // A new rule block needs at least one song of the budget to be useful.
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

  /** Blank quiz, one empty rule block — what AMQ's `setupNewQuiz` produces. */
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

  /** Marks the load as impossible — used when the library never arrived. */
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
      // An unrecognised block means our serializer is behind the client. Better
      // to refuse the whole quiz than to load it minus a block and save that
      // back over the original.
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
   * Hands the quiz to AMQ. The name check is AMQ's too, but doing it here keeps
   * the button honest rather than firing a command we know will be refused.
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
    // What is on the server now is what reverting should come back to.
    this.#markSaved()
  }

  /** Match counts arrive per algorithm block, keyed by the id we sent. */
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
   * Marks the quiz as changed. Every mutation below calls this first, so being
   * dirty is a property of the store rather than something each caller
   * remembers to set.
   */
  #checkpoint() {
    this.#history.push($state.snapshot(this.quiz) as Quiz)
    if (this.#history.length > UNDO_DEPTH) this.#history.shift()
    this.undoDepth = this.#history.length
    this.dirty = true
  }

  /**
   * Steps back one mutation.
   *
   * Like `revert()`, this swaps the whole document, so a reference held across
   * it points into the discarded tree. Components re-read from `quiz` each
   * render; anything caching an entry must look it up again by id.
   */
  undo() {
    const previous = this.#history.pop()
    if (!previous) return false
    this.undoDepth = this.#history.length
    this.quiz = previous
    // Ids survive a snapshot, but a row that came back may no longer exist.
    for (const id of [...this.selection]) {
      if (!this.blockOf(id)) this.selection.delete(id)
    }
    // Back at the saved state exactly when there is nothing left to undo.
    this.dirty = this.#history.length > 0
    return true
  }

  /** Records the current quiz as the saved state; clears the dirty flag. */
  #markSaved() {
    this.#saved = $state.snapshot(this.quiz) as Quiz
    this.#history = []
    this.undoDepth = 0
    this.dirty = false
  }

  /**
   * Throws away every change since the last save.
   *
   * This replaces the whole document, so **any entry or block reference held
   * across it is stale** — it points into the discarded tree and its edits go
   * nowhere. Components re-read from `quiz` every render and are fine; code
   * that caches an entry between calls must look it up again by id.
   *
   * Destructive and not itself undoable, so the caller confirms first.
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
    // A new block may not claim more of the 250 than is left.
    block.songCount = Math.min(block.songCount, this.songBudgetLeft)
    this.quiz.blocks.push(block)
    // Read it back out: `$state` deep-proxies on write, so the object we just
    // pushed is not the one now in the store. Handing the caller the raw object
    // would give them a detached copy whose edits never reach the UI.
    return this.quiz.blocks[this.quiz.blocks.length - 1]
  }

  /** AMQ refuses to delete the last rule block; so do we. */
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
   * SPEC §7: a duplicated rule block carries its entries, its nested blocks,
   * every setting and every override, and lands directly after the original.
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
   * A detached copy of an entry.
   *
   * `$state.snapshot`, not `structuredClone`: entries are deep reactive
   * proxies, and cloning one directly can throw — which is what made the
   * algorithm block's duplicate button look dead, since the error surfaced
   * nowhere the player could see it.
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

  /** Clamped to what the 250-song budget leaves this block. */
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

  /** Adds into the "Adds to" block unless a one-off target is given (SPEC §7). */
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
      // An entry that was chained to a removed one above it would otherwise
      // connect to whatever slid into that slot.
      if (block.entries.length > 0) block.entries[0].connectUp = false
    }
    for (const id of doomed) this.selection.delete(id)
  }

  /**
   * SPEC §6: moving preserves each entry's overrides, and their order.
   *
   * `at` inserts before that index in the target block; omitted or -1 appends.
   * The index is resolved **after** the entries are taken out, because removing
   * rows above the drop point shifts it — dropping onto row 5 of the block you
   * are dragging out of would otherwise land in the wrong place.
   */
  moveEntries(ids: Iterable<string>, toBlockId: string, at = -1) {
    const moving = new Set(ids)
    const target = this.quiz.blocks.find((block) => block.id === toBlockId)
    if (!target || moving.size === 0) return
    this.#checkpoint()

    // How many of the target's own rows above the drop point are leaving.
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
    // A chain cannot start a block, wherever the rows landed.
    if (target.entries.length > 0) target.entries[0].connectUp = false
  }

  duplicateEntries(ids: Iterable<string>) {
    const wanted = new Set(ids)
    if (wanted.size === 0) return
    // Duplicating is still an add, so it is still subject to the caps.
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
          // The copy is a fresh link in no chain of its own.
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
   * SPEC §5.5's chain button sits between two rows and toggles the *lower*
   * entry's `connectUp`. The first entry of a block has nothing above it, so
   * it can never be chained.
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
   * SPEC §5.6: toggling a type re-clamps the pick count immediately, so the
   * slider's fill can never point past the pool it draws from.
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
   * Writes back the settings AMQ's host modal produced for an algorithm block,
   * and asks the server for a fresh match count.
   *
   * The blob is stored verbatim — we never inspect or normalise it, because the
   * filter set is AMQ's and a field we did not know about would be lost.
   */
  updateAlgorithmSettings(entryId: string, settings: Record<string, unknown>) {
    const entry = this.#entry(entryId)
    if (entry?.kind !== 'algorithm') return
    this.#checkpoint()
    entry.settings = settings
    // The old count describes the old filters; clear it so the row says
    // "pending" rather than showing a number that is now wrong.
    entry.matchedAnnSongIds = undefined
    this.requestAlgorithmSongs(entry.id)
  }

  /** Asks the server how many songs an algorithm block matches. */
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

  /** Applies an override to every selected play entry (SPEC §8's footer). */
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

  /** "Reset to block" — absence is what makes an entry follow its block. */
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
   * At least one guess mode must stay on — AMQ refuses the last toggle rather
   * than allowing a mode-less block, and so do we.
   */
  static toggleGuessMode(modes: GuessModes, key: keyof GuessModes): GuessModes {
    const next = { ...modes, [key]: !modes[key] }
    if (!next.song && !next.tinyVideo && !next.blurVideo) return modes
    return next
  }

  // --- selection -----------------------------------------------------------

  /** The flat list the list renders, used for shift-range selection. */
  get flatIds() {
    return this.quiz.blocks.flatMap((block) =>
      block.entries.map((entry) => entry.id)
    )
  }

  toggleSelected(id: string) {
    if (this.selection.has(id)) this.selection.delete(id)
    else this.selection.add(id)
  }

  /** Shift-click extends across blocks (SPEC §6). */
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
