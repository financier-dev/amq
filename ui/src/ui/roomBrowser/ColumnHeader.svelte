<!--
  Sticky column header.

  Each data column is a sort button (SPEC §3). The sort state is in the
  button's accessible name, because a flex layout has no role that takes
  `aria-sort`. Widths come from the tokens in app.css that the rows also use.
-->
<script lang="ts">
  import type { SortKey } from '../../amq/sort'
  import Icon from '../common/Icon.svelte'

  interface Props {
    sort: { key: string; dir: 'asc' | 'desc' }
    onSort: (key: SortKey) => void
  }

  let { sort, onSort }: Props = $props()

  const COLUMNS: {
    key: SortKey
    label: string
    /** The token with this column's width. Absent for the flexible column. */
    width?: string
    align?: 'right'
  }[] = [
    { key: 'id', label: 'ID', width: 'var(--col-id)' },
    { key: 'room', label: 'Room / Host', width: 'var(--col-identity)' },
    { key: 'mode', label: 'Mode', width: 'var(--col-mode)' },
    { key: 'selection', label: 'Selection', width: 'var(--col-selection)' },
    { key: 'types', label: 'Types', width: 'var(--col-types)' },
    { key: 'players', label: 'Players', width: 'var(--col-players)' },
    { key: 'songs', label: 'Songs', width: 'var(--col-songs)' },
    { key: 'time', label: 'Time', width: 'var(--col-time)', align: 'right' },
    { key: 'difficulty', label: 'Difficulty', width: 'var(--col-difficulty)' },
  ]

  function sortLabel(key: SortKey, label: string) {
    if (sort.key !== key) return `${label}, sort by this column`
    return sort.dir === 'asc'
      ? `${label}, sorted ascending`
      : `${label}, sorted descending`
  }
</script>

<div class="header">
  {#each COLUMNS as column (column.key)}
    <button
      type="button"
      class="col"
      class:flex={!column.width}
      class:right={column.align === 'right'}
      class:active={sort.key === column.key}
      style:width={column.width}
      aria-label={sortLabel(column.key, column.label)}
      onclick={() => onSort(column.key)}
    >
      {column.label}
      {#if sort.key === column.key}
        <span class="arrow" class:up={sort.dir === 'asc'}>
          <Icon name="caret" size={11} strokeWidth={3} />
        </span>
      {/if}
    </button>
  {/each}

  <!-- These two columns have no order to sort by. The action column needs no
       heading. -->
  <span class="col static grow">Modifiers · genres · tags</span>
  <span class="col static" style:width="var(--col-action)" aria-hidden="true"
  ></span>
</div>

<style>
  .header {
    display: flex;
    align-items: center;
    gap: var(--col-gap);
    height: 44px;
    padding: 0 var(--row-pad);
    border-radius: var(--radius) var(--radius) 0 0;
    background: var(--bg-head);
    border: 1px solid var(--line-soft);
    border-bottom: 1px solid var(--line-strong);
  }

  .col {
    display: flex;
    align-items: center;
    gap: 4px;
    /* Fixed columns must not shrink. The rows do not shrink either, and the
       headings must stay aligned with them. */
    flex: 0 0 auto;
    min-width: 0;
    padding: 0;
    background: transparent;
    border: 0;
    color: var(--text-4);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    text-align: left;
    cursor: pointer;
  }

  /*
   * The chips column takes the leftover width. The basis is 0, not `auto`:
   * with `auto` the header label and a row's chips would each size the column
   * from their own content and get different widths. `min-width` replaces the
   * flex default of `auto`, which would raise the column to its min-content
   * size.
   */
  .col.grow {
    flex: 1 1 0;
    min-width: var(--col-chips);
  }

  .col.right {
    justify-content: flex-end;
  }

  .col.static {
    cursor: default;
  }

  .col:not(.static):hover {
    color: var(--text-2);
  }

  .col.active {
    color: var(--accent-soft);
  }

  .arrow {
    display: inline-flex;
  }

  .arrow.up {
    transform: rotate(180deg);
  }
</style>
