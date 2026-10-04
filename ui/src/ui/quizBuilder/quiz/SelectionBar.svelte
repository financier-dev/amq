<!--
  The floating action island over the bottom of the quiz pane (SPEC §6).

  Appears only while something is selected. Every label is one short word and
  they must not wrap — the bar is fixed over a scrolling list, so a second line
  would cover the rows it acts on.

  A selection may span rule blocks, so every action here has to be
  block-agnostic. `Move` is the one with a target, and its popover lists every
  rule block with its entry count plus `New rule block`.
-->
<script lang="ts">
  import { quizStore } from '../../../amq/quiz.svelte'

  interface Props {
    onMove: (anchor: HTMLElement) => void
    onSettings: () => void
  }

  let { onMove, onSettings }: Props = $props()

  const count = $derived(quizStore.selection.size)

  /**
   * Lock is a single button rather than a pair, so it needs a direction: if
   * anything in the selection is unlocked, lock everything; otherwise unlock.
   * That makes it idempotent in the direction the player can see.
   */
  const anyUnlocked = $derived.by(() => {
    for (const id of quizStore.selection) {
      const block = quizStore.blockOf(id)
      const entry = block?.entries.find((item) => item.id === id)
      if (entry && !entry.locked) return true
    }
    return false
  })

  let moveButton = $state<HTMLButtonElement | null>(null)
</script>

{#if count > 0}
  <div class="island" role="region" aria-label="Selection actions">
    <span class="count mono">{count} selected</span>

    <button
      bind:this={moveButton}
      type="button"
      class="act"
      onclick={() => moveButton && onMove(moveButton)}
    >
      Move ▾
    </button>
    <button
      type="button"
      class="act"
      onclick={() => quizStore.duplicateEntries([...quizStore.selection])}
    >
      Copy
    </button>
    <button type="button" class="act" onclick={onSettings}>Settings</button>
    <button
      type="button"
      class="act"
      onclick={() => quizStore.setLocked([...quizStore.selection], anyUnlocked)}
    >
      {anyUnlocked ? 'Lock' : 'Unlock'}
    </button>
    <button
      type="button"
      class="act danger"
      onclick={() => quizStore.removeEntries([...quizStore.selection])}
    >
      Remove
    </button>

    <button
      type="button"
      class="clear"
      onclick={() => quizStore.clearSelection()}
    >
      Clear
    </button>
  </div>
{/if}

<style>
  .island {
    position: absolute;
    left: 50%;
    bottom: 14px;
    transform: translateX(-50%);
    z-index: 5;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 7px 10px;
    border-radius: 10px;
    background: var(--bg-pop);
    border: 1px solid var(--line-strong);
    box-shadow: 0 8px 26px rgba(0, 0, 0, 0.45);
    white-space: nowrap;
  }

  .count {
    padding-right: 4px;
    font-size: 11.5px;
    font-weight: 600;
    color: var(--text-2);
  }

  .act {
    height: 26px;
    padding: 0 10px;
    border-radius: 6px;
    background: var(--bg-raised);
    border: 1px solid var(--line-soft);
    color: var(--text);
    font-family: inherit;
    font-size: 11.5px;
    font-weight: 600;
    white-space: nowrap;
    cursor: pointer;
  }

  .act:hover {
    border-color: var(--line-strong);
  }

  .danger:hover {
    background: var(--chip-rose-bg);
    border-color: var(--chip-rose-line);
    color: var(--rose-fg);
  }

  .clear {
    height: 26px;
    padding: 0 8px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: var(--text-4);
    font-family: inherit;
    font-size: 11.5px;
    cursor: pointer;
  }

  .clear:hover {
    color: var(--text);
  }
</style>
