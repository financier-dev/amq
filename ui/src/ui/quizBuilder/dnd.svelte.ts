/**
 * Dragging entries between and within rule blocks (SPEC §7).
 *
 * Drag is optional. Move does everything drag does, so drag must never be the
 * only way to an action. An interrupted drag must leave the quiz unchanged.
 *
 * Two rules from AMQ's builder:
 *
 *   - **A rule block never enters a rule block.** AMQ checks
 *     `if (!currentDragBlock.RULE_BLOCK) return` in the rule body's handlers.
 *     Here, rule blocks are not draggable.
 *   - **A drag of a selected row carries the whole selection.** Dragging one
 *     of twelve selected rows moves all twelve, which matches the count in
 *     the selection bar.
 */

import { quizStore } from '../../amq/quiz.svelte'

export interface DropTarget {
  blockId: string
  /** Insert before this index in the block's entries. -1 appends. */
  index: number
}

class DragState {
  /** Ids of the dragged entries. Null when no drag is active. */
  ids = $state<string[] | null>(null)
  /** Where a drop would insert. Drives the dashed drop zone. */
  over = $state<DropTarget | null>(null)

  readonly active = $derived(this.ids !== null)
  readonly count = $derived(this.ids?.length ?? 0)

  /**
   * Starts a drag. A selected row drags the whole selection. An unselected
   * row drags only itself and replaces the selection.
   */
  start(entryId: string) {
    if (quizStore.selection.has(entryId)) {
      this.ids = [...quizStore.selection]
    } else {
      quizStore.clearSelection()
      quizStore.toggleSelected(entryId)
      this.ids = [entryId]
    }
  }

  enter(target: DropTarget) {
    if (!this.ids) return
    this.over = target
  }

  leave(blockId: string) {
    if (this.over?.blockId === blockId) this.over = null
  }

  /** Applies the move. Does nothing without a target. */
  drop() {
    const ids = this.ids
    const target = this.over
    this.cancel()
    if (!ids || !target) return
    quizStore.moveEntries(ids, target.blockId, target.index)
  }

  cancel() {
    this.ids = null
    this.over = null
  }
}

export const dragState = new DragState()
