/**
 * The quiz pane as one flat list of row descriptors (SPEC §13).
 *
 * The list is flat on purpose, not a component per rule block with nested
 * entries. Selection spans blocks, drag moves entries between blocks, and the
 * pane is one scroller. All three are simple over a flat array.
 *
 * Pure, so tests can check the rows without mounting the list.
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
 * Rail colours cycle by block position (SPEC §2), so adjacent rule blocks
 * differ. All five tones are defined in `app.css`.
 */
export const TONES = ['accent', 'violet', 'teal', 'amber', 'rose'] as const
export type Tone = (typeof TONES)[number]

export function toneFor(index: number): Tone {
  return TONES[index % TONES.length]
}

/** An entry drawn as a fixed-column entry row (SPEC §5.4). */
export type RowEntry = AnimeEntry | SongEntry
/** An entry drawn as an indented nested block (SPEC §5.3). */
export type NestedEntry = AlgorithmEntry | MessageEntry | TitleEntry

export function isRowEntry(entry: Entry): entry is RowEntry {
  return entry.kind === 'anime' || entry.kind === 'song'
}

interface RowBase {
  /** Unique in the list. The `{#each}` key. */
  id: string
  block: RuleBlock
  blockIndex: number
  tone: Tone
}

export interface BlockHeaderRow extends RowBase {
  kind: 'block'
  /** 1-based. Rule blocks have no name, so SPEC §5.2 numbers them. */
  position: number
  isTarget: boolean
}

export interface EntryRow extends RowBase {
  kind: 'entry'
  entry: RowEntry
  indexInBlock: number
  /**
   * Whether the chain gutter can show a button above this row (SPEC §5.5).
   * False for the first entry of a block and for a row below a nested block,
   * which breaks a chain.
   */
  canChainUp: boolean
  /** Chained to the row above. */
  chainedUp: boolean
  /**
   * The row below is chained to this one. The rail runs from the middle of
   * the upper row to the middle of the lower one, and each row draws only its
   * own half.
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
  /** True for an empty block. The list then shows the hint. */
  empty: boolean
}

export type QuizRow = BlockHeaderRow | EntryRow | NestedRow | FooterRow

export interface BuildOptions {
  /** Collapsed blocks. Their entries produce no rows. */
  collapsed?: ReadonlySet<string>
  /** The "Adds to" target (SPEC §4). */
  targetBlockId?: string | null
  /** Quiz-pane search. The caller resolves matches against the library. */
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

    // A filter hides rows but must not renumber them. AMQ plays an entry by
    // its position, and a chain across a hidden row is still a chain. So the
    // index and the chain test use the full list.
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
