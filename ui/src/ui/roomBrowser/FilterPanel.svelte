<!--
  Filter popover, anchored under the Filters button: 680px, two columns, no
  scrolling (SPEC §4).

  There is no "All" / "3 of 4" status text anywhere. A group renders a marker
  only when it differs from default — an accent dot plus a Reset that clears
  that group — and the header badge is simply the count of those markers.
-->
<script lang="ts">
  import {
    RANGES,
    TOGGLE_GROUPS,
    type FilterStore,
    type RangeKey,
    type ToggleGroupKey,
  } from '../../amq/filters.svelte'
  import Icon from '../common/Icon.svelte'
  import RangeSlider from '../common/RangeSlider.svelte'
  import ToggleChip from '../common/ToggleChip.svelte'

  interface Props {
    filters: FilterStore
    onClose: () => void
  }

  let { filters, onClose }: Props = $props()

  const LEFT: ToggleGroupKey[] = [
    'only',
    'scoring',
    'showSelection',
    'answering',
    'animeType',
  ]
  const RIGHT_TOP: ToggleGroupKey[] = ['songTypes', 'songSelection']
  const RIGHT_BOTTOM: ToggleGroupKey[] = ['nonDefault']

  const byKey = new Map(TOGGLE_GROUPS.map((entry) => [entry.key, entry]))
  const groups = (keys: ToggleGroupKey[]) => keys.map((key) => byKey.get(key)!)

  const changed = $derived(filters.changedCount > 0)
</script>

<div class="panel">
  <div class="head">
    <span class="head-icon"><Icon name="filter" size={16} /></span>
    <span class="head-title">Filters</span>
    {#if changed}
      <span class="badge mono">{filters.changedCount}</span>
    {/if}
    <div class="spacer"></div>
    <button
      type="button"
      class="reset-all"
      class:enabled={changed}
      disabled={!changed}
      onclick={() => filters.resetAll()}
    >
      Reset all
    </button>
    <button
      type="button"
      class="close"
      aria-label="Close filters"
      onclick={onClose}
    >
      <Icon name="close" size={14} strokeWidth={2.6} />
    </button>
  </div>

  <div class="body">
    <div class="column">
      {#each groups(LEFT) as group (group.key)}
        {@render toggleGroup(group.key)}
      {/each}
    </div>

    <div class="column">
      {#each groups(RIGHT_TOP) as group (group.key)}
        {@render toggleGroup(group.key)}
      {/each}

      {#each RANGES as spec (spec.key)}
        <RangeSlider
          {spec}
          value={filters.range(spec.key as RangeKey)}
          changed={filters.rangeChanged(spec.key as RangeKey)}
          onInput={(index, value) =>
            filters.setBound(spec.key as RangeKey, index, value)}
          onReset={() => filters.resetRange(spec.key as RangeKey)}
        />
      {/each}

      {#each groups(RIGHT_BOTTOM) as group (group.key)}
        {@render toggleGroup(group.key)}
      {/each}
    </div>
  </div>
</div>

{#snippet toggleGroup(key: ToggleGroupKey)}
  {@const group = byKey.get(key)!}
  {@const isChanged = filters.groupChanged(key)}
  <div class="group">
    <div class="group-head">
      <span class="group-title">{group.label()}</span>
      <div class="rule"></div>
      {#if isChanged}
        <button
          type="button"
          class="reset"
          onclick={() => filters.resetGroup(key)}
        >
          <span class="dot"></span>
          Reset
        </button>
      {/if}
    </div>
    <div class="chips">
      {#each group.options as option (option.key)}
        <ToggleChip
          label={option.label()}
          on={filters.toggles(key)[option.key]}
          onToggle={() => filters.toggle(key, option.key)}
        />
      {/each}
    </div>
  </div>
{/snippet}

<style>
  .panel {
    width: 680px;
    border-radius: var(--radius);
    background: rgba(12, 16, 23, 0.98);
    border: 1px solid var(--line-strong);
    box-shadow: 0 18px 44px rgba(0, 0, 0, 0.6);
  }

  .head {
    display: flex;
    align-items: center;
    gap: 10px;
    height: 48px;
    padding: 0 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.09);
  }

  .head-icon {
    display: inline-flex;
    color: var(--accent-soft);
  }

  .head-title {
    font-size: 14px;
    font-weight: 600;
    color: #ffffff;
  }

  .badge {
    font-size: 11px;
    font-weight: 600;
    color: #08101c;
    background: var(--accent);
    border-radius: 5px;
    padding: 1px 6px;
  }

  .spacer {
    flex-grow: 1;
  }

  .reset-all {
    height: 26px;
    padding: 0 10px;
    border-radius: 6px;
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.14);
    color: #5b6472;
    font-size: 12px;
    font-weight: 600;
    cursor: default;
  }

  .reset-all.enabled {
    color: var(--text-2);
    cursor: pointer;
  }

  .close {
    width: 26px;
    height: 26px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    background: transparent;
    border: 0;
    color: var(--text-4);
    cursor: pointer;
  }

  .close:hover {
    color: var(--text);
  }

  .body {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 22px;
    padding: 16px;
  }

  .group {
    margin-bottom: 15px;
  }

  .group:last-child {
    margin-bottom: 0;
  }

  .group-head {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 16px;
    margin-bottom: 8px;
  }

  .group-title {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #a3acbb;
    white-space: nowrap;
  }

  .rule {
    flex-grow: 1;
    height: 1px;
    background: rgba(255, 255, 255, 0.08);
  }

  .reset {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    height: 16px;
    padding: 0;
    background: transparent;
    border: 0;
    color: var(--blue-fg);
    font-size: 10px;
    font-weight: 600;
    cursor: pointer;
  }

  .dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--accent);
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
  }
</style>
