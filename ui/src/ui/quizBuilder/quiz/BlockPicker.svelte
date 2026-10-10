<!--
  The rule-block picker for "Adds to" and "Move" (SPEC §6, §7).

  Both ask the same question, "which rule block?", so they share one
  component. Each row shows the block's rail colour, position and entry count.
  The list ends with `New rule block`, so the player can create a target
  without leaving the popover.
-->
<script lang="ts">
  import { t } from '../../../amq/derive'
  import { quizStore } from '../../../amq/quiz.svelte'
  import Floating from '../../common/Floating.svelte'
  import { toneFor } from '../rows'

  interface Props {
    anchor: HTMLElement
    /** The block to highlight as the current choice. */
    currentId?: string | null
    onPick: (blockId: string) => void
    onDismiss: () => void
  }

  let { anchor, currentId = null, onPick, onDismiss }: Props = $props()

  const blocked = $derived(quizStore.capReached('rule'))

  function createAndPick() {
    const block = quizStore.addRuleBlock()
    if (block) onPick(block.id)
  }
</script>

<Floating {anchor} placement="below" align="start" width={250} {onDismiss}>
  <div class="menu">
    {#each quizStore.quiz.blocks as block, index (block.id)}
      <button
        type="button"
        class="item"
        class:on={block.id === currentId}
        onclick={() => onPick(block.id)}
      >
        <span class="dot tone-{toneFor(index)}" aria-hidden="true"></span>
        <span class="label">
          {t('quiz_builder.rule_block.title', 'Rule Block')}
          {index + 1}
        </span>
        <span class="count mono">{block.entries.length}</span>
      </button>
    {/each}

    <div class="sep"></div>

    <button
      type="button"
      class="item new"
      disabled={blocked !== null}
      title={blocked ?? undefined}
      onclick={createAndPick}
    >
      + New rule block
    </button>
    {#if blocked}
      <p class="why">{blocked}</p>
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
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    height: 28px;
    padding: 0 8px;
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

  .item.on {
    background: var(--chip-blue-bg);
    color: var(--blue-fg);
  }

  .item:disabled {
    opacity: 0.45;
    cursor: default;
  }

  .dot {
    flex: none;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--tone);
  }

  .tone-accent {
    --tone: var(--accent);
  }
  .tone-violet {
    --tone: var(--violet);
  }
  .tone-teal {
    --tone: var(--teal);
  }
  .tone-amber {
    --tone: var(--amber);
  }
  .tone-rose {
    --tone: var(--rose);
  }

  .label {
    flex: 1 1 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .count {
    flex: none;
    font-size: 10.5px;
    color: var(--text-5);
  }

  .sep {
    height: 1px;
    margin: 4px 2px;
    background: var(--line);
  }

  .new {
    font-weight: 600;
    color: var(--blue-fg);
  }

  .why {
    margin: 2px 6px 4px;
    font-size: 10px;
    color: var(--text-5);
  }
</style>
