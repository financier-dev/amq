/**
 * Dragging entries between and within rule blocks (SPEC §7).
 *
 * Last by design, and the only part of the screen that is pure luxury:
 * everything drag does is reachable through Move, so this must never be the
 * only route to an action, and a browser that drops an event mid-gesture must
 * leave the quiz untouched rather than half-moved.
 *
 * Two rules from AMQ's own builder are enforced here rather than left to the
 * drop handler to remember:
 *
 *   - **A rule block never enters a rule block.** AMQ gates this with
 *     `if (!currentDragBlock.RULE_BLOCK) return` on the rule body's own
 *     handlers; here, rule blocks simply are not draggable items.
 *   - **A drag carries the selection when the dragged row is part of it**,
 *     so dragging one of twelve selected rows moves all twelve — otherwise the
 *     gesture silently disagrees with the count in the action island.
 */

import { quizStore } from '../../amq/quiz.svelte'

export interface DropTarget {
  blockId: string
  /** Index within the block's entries to insert before; -1 means append. */
  index: number
}

class DragState {
  /** Entry ids being dragged, or null when nothing is. */
  ids = $state<string[] | null>(null)
  /** Where the drop would land, for the dashed zone. */
  over = $state<DropTarget | null>(null)

  readonly active = $derived(this.ids !== null)
  readonly count = $derived(this.ids?.length ?? 0)

  /**
   * Starts a drag. A row inside the current selection drags the whole
   * selection; a row outside it drags only itself and replaces the selection,
   * which is what every file manager does and what people expect.
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

  /** Applies the move. A drop with no target is a no-op, not an error. */
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
