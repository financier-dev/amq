<!--
  The band under the top bar: one removable chip per filter group that differs
  from default, plus the result count.

  It lists exactly the set the Filters badge counts, so the two can never
  disagree about what "active" means (SPEC §4).
-->
<script lang="ts">
  import type { ActiveChip } from '../../amq/filters.svelte'
  import Icon from '../common/Icon.svelte'

  interface Props {
    chips: ActiveChip[]
    shown: number
    total: number
    onClearAll: () => void
  }

  let { chips, shown, total, onClearAll }: Props = $props()
</script>

<div class="strip">
  {#if chips.length}
    <span class="label">Active</span>
    {#each chips as chip (chip.id)}
      <button type="button" class="chip" onclick={chip.clear}>
        {chip.label}
        <Icon name="close" size={11} strokeWidth={2.6} />
      </button>
    {/each}
    <button type="button" class="clear" onclick={onClearAll}>Clear all</button>
  {:else}
    <span class="none">No filters applied</span>
  {/if}

  <div class="spacer"></div>
  <span class="count mono">{shown} of {total} rooms shown</span>
</div>

<style>
  .strip {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 46px;
    padding: 0 var(--gutter);
    background: var(--bg-strip);
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
    overflow-x: auto;
  }

  .label {
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--text-4);
    flex-shrink: 0;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 26px;
    padding: 0 7px 0 10px;
    border-radius: 6px;
    background: rgba(91, 155, 245, 0.16);
    border: 1px solid rgba(91, 155, 245, 0.36);
    color: var(--accent-soft);
    font-size: 14px;
    font-weight: 600;
    white-space: nowrap;
    cursor: pointer;
    flex-shrink: 0;
  }

  .chip:hover {
    background: rgba(91, 155, 245, 0.26);
  }

  .clear {
    height: 26px;
    padding: 0 10px;
    background: transparent;
    border: 0;
    color: var(--text-4);
    font-size: 14px;
    font-weight: 600;
    text-decoration: underline;
    cursor: pointer;
    flex-shrink: 0;
  }

  .none {
    font-size: 14px;
    color: var(--text-5);
  }

  .spacer {
    flex-grow: 1;
  }

  .count {
    font-size: 14px;
    color: var(--text-4);
    white-space: nowrap;
  }
</style>
