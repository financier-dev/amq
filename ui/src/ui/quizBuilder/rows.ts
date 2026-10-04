/**
 * The quiz pane as one flat list of row descriptors (SPEC §13).
 *
 * The obvious shape for a grouped list is a component per rule block with its
 * entries nested inside. This is deliberately not that. Selection spans blocks,
 * drag moves an entry from one block to another, and the whole thing is one
 * scroller — all three are awkward across a component boundary and trivial over
 * a flat array. The design mock reaches the same conclusion independently.
 *
 * Pure, so what the list renders can be asserted without mounting it.
 */

import type {
  AlgorithmEntry,
  AnimeEntry,
  Entry,
  MessageEntry,
  Quiz,
  RuleBlock,
  SongEntry,
  TitleEntry,
} from '../../amq/quizModel'

/**
 * Rail colours cycle by block position (SPEC §2) so two adjacent rule blocks
 * never share one. Five tones, all already in `app.css`.
 */
export const TONES = ['accent', 'violet', 'teal', 'amber', 'rose'] as const
export type Tone = (typeof TONES)[number]

export function toneFor(index: number): Tone {
  return TONES[index % TONES.length]
}

/** An entry that occupies the fixed-column entry row (SPEC §5.4). */
export type RowEntry = AnimeEntry | SongEntry
/** An entry drawn as an indented nested block (SPEC §5.3). */
export type NestedEntry = AlgorithmEntry | MessageEntry | TitleEntry

export function isRowEntry(entry: Entry): entry is RowEntry {
  return entry.kind === 'anime' || entry.kind === 'song'
}

interface RowBase {
  /** Unique across the list; the `{#each}` key. */
  id: string
  block: RuleBlock
  blockIndex: number
  tone: Tone
}

export interface BlockHeaderRow extends RowBase {
  kind: 'block'
  /** 1-based position. Rule blocks have no name — SPEC §5.2 numbers them. */
  position: number
  isTarget: boolean
}

export interface EntryRow extends RowBase {
  kind: 'entry'
  entry: RowEntry
  indexInBlock: number
  /**
   * Whether the chain gutter may draw a button above this row. The first entry
   * of a block has nothing to connect up to, and a nested block breaks a chain,
   * so neither offers one (SPEC §5.5).
   */
  canChainUp: boolean
  /** This row is chained to the one above it. */
  chainedUp: boolean
  /**
   * The row below is chained to this one. The rail runs from the middle of the
   * upper row to the middle of the lower, so both halves have to know — a row
   * can only draw inside itself.
   */
  chainedDown: boolean
}

export interface NestedRow extends RowBase {
  kind: 'nested'
  entry: NestedEntry
  indexInBlock: number
}

export interface FooterRow extends RowBase {
  kind: 'footer'
  /** True when the block has nothing in it — the list shows the hint instead. */
  empty: boolean
}

export type QuizRow = BlockHeaderRow | EntryRow | NestedRow | FooterRow

export interface BuildOptions {
  /** Blocks the user has collapsed; their contents are skipped entirely. */
  collapsed?: ReadonlySet<string>
  /** The "Adds to" target (SPEC §4). */
  targetBlockId?: string | null
  /** Quiz-pane search; matches are resolved by the caller, which has the library. */
  matches?: (entry: Entry) => boolean
}

export function buildRows(quiz: Quiz, options: BuildOptions = {}): QuizRow[] {
  const { collapsed, targetBlockId, matches } = options
  const rows: QuizRow[] = []

  quiz.blocks.forEach((block, blockIndex) => {
    const tone = toneFor(blockIndex)
    const base = { block, blockIndex, tone }

    rows.push({
      ...base,
      kind: 'block',
      id: `block:${block.id}`,
      position: blockIndex + 1,
      isTarget: block.id === targetBlockId,
    })

    if (collapsed?.has(block.id)) return

    // Filtering hides rows but must not renumber them: an entry's position is
    // what AMQ plays it by, and a chain that spans a hidden row is still a
    // chain. So the index and the chain test come from the real list.
    block.entries.forEach((entry, indexInBlock) => {
      if (matches && !matches(entry)) return

      if (isRowEntry(entry)) {
        const previous = block.entries[indexInBlock - 1]
        const next = block.entries[indexInBlock + 1]
        const canChainUp =
          indexInBlock > 0 && previous !== undefined && isRowEntry(previous)
        rows.push({
          ...base,
          kind: 'entry',
          id: entry.id,
          entry,
          indexInBlock,
          canChainUp,
          chainedUp: canChainUp && entry.connectUp,
          chainedDown: next !== undefined && isRowEntry(next) && next.connectUp,
        })
        return
      }

      rows.push({
        ...base,
        kind: 'nested',
        id: entry.id,
        entry: entry as NestedEntry,
        indexInBlock,
      })
    })

    rows.push({
      ...base,
      kind: 'footer',
      id: `footer:${block.id}`,
      empty: block.entries.length === 0,
    })
  })

  return rows
}
