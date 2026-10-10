<!--
  The ⋯ menu on a rule block header, an entry, or a nested block
  (SPEC §5, §7).

  Every item is also available from the selection bar or a row button. The
  block menu adds Delete. AMQ refuses to delete the last rule block, so the
  item is disabled then, not hidden.
-->
<script lang="ts">
  import { t } from '../../../amq/derive'
  import { quizStore } from '../../../amq/quiz.svelte'
  import Floating from '../../common/Floating.svelte'

  interface Props {
    anchor: HTMLElement
    kind: 'block' | 'entry'
    id: string
    onMove: (anchor: HTMLElement) => void
    onSettings: () => void
    onDismiss: () => void
  }

  let { anchor, kind, id, onMove, onSettings, onDismiss }: Props = $props()

  const isLastBlock = $derived(
    kind === 'block' && quizStore.quiz.blocks.length <= 1
  )

  function act(run: () => void) {
    run()
    onDismiss()
  }
</script>

<Floating {anchor} placement="below" align="end" width={200} {onDismiss}>
  <div class="menu">
    <button type="button" class="item" onclick={onSettings}>Settings</button>

    {#if kind === 'entry'}
      <button
        type="button"
        class="item"
        onclick={() => {
          // A row's own menu acts on that row, whatever the selection was.
          quizStore.clearSelection()
          quizStore.toggleSelected(id)
          onMove(anchor)
        }}
      >
        Move to…
      </button>
      <button
        type="button"
        class="item"
        onclick={() => act(() => quizStore.duplicateEntries([id]))}
      >
        Duplicate
      </button>
      <button
        type="button"
        class="item"
        onclick={() => act(() => quizStore.toggleLock(id))}
      >
        Lock or unlock
      </button>
      <div class="sep"></div>
      <button
        type="button"
        class="item danger"
        onclick={() => act(() => quizStore.removeEntries([id]))}
      >
        Remove
      </button>
    {:else}
      <button
        type="button"
        class="item"
        onclick={() => act(() => quizStore.duplicateRuleBlock(id))}
      >
        Duplicate block
      </button>
      <button
        type="button"
        class="item"
        onclick={() => act(() => (quizStore.targetBlockId = id))}
      >
        Add library items here
      </button>
      <button
        type="button"
        class="item"
        onclick={() => act(() => quizStore.selectBlock(id, true))}
      >
        Select all entries
      </button>
      <div class="sep"></div>
      <button
        type="button"
        class="item danger"
        disabled={isLastBlock}
        title={isLastBlock
          ? t(
              'quiz_builder.rule_block.cannot_delete_message.description',
              'At least one rule block must exist in the quiz'
            )
          : undefined}
        onclick={() => act(() => quizStore.removeRuleBlock(id))}
      >
        {t('quiz_builder.rule_block.delete_message.confirm', 'Delete')} block
      </button>
    {/if}
  </div>
</Floating>

<style>
  .menu {
    display: flex;
    flex-direction: column;
    gap: 1px;
    padding: 5px;
  }

  .item {
    width: 100%;
    height: 28px;
    padding: 0 9px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: var(--text-2);
    font-family: inherit;
    font-size: 12px;
    text-align: left;
    cursor: pointer;
  }

  .item:hover:not(:disabled) {
    background: var(--bg-raised);
    color: var(--text);
  }

  .item:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .danger:hover:not(:disabled) {
    background: var(--chip-rose-bg);
    color: var(--rose-fg);
  }

  .sep {
    height: 1px;
    margin: 4px 2px;
    background: var(--line);
  }
</style>
