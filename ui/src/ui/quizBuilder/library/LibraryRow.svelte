<!--
  One row of the song library (SPEC §4.1).

  An anime row is taller than a song row. The two align by their *lead cell*,
  not by indentation: `--qb-lib-lead` on an anime row and the wider
  `--qb-lib-song-lead` on a song row, so the type badge clears the chevron
  above it. The offset and the height difference make an expanded anime read
  as a group.

  A click anywhere on an anime row expands it. See `onRowClick`.

  Both buttons read `+ Add`. An anime row adds the anime as an entry, and the
  player picks the song types on that entry. A song row adds that one song.
-->
<script lang="ts">
  import type { LibraryRow } from '../../../amq/library.svelte'
  import Icon from '../../common/Icon.svelte'

  interface Props {
    row: LibraryRow
    expanded: boolean
    onToggle: () => void
    onAdd: () => void
    onAddTo: (anchor: HTMLElement) => void
  }

  let { row, expanded, onToggle, onAdd, onAddTo }: Props = $props()

  let addChevron = $state<HTMLButtonElement | null>(null)

  /**
   * The whole anime row toggles, not only the 24px chevron.
   *
   * Clicks on any `<button>` in the row are ignored here. That covers
   * `+ Add`, the add-to-block caret and the chevron, whose own handler does
   * the toggle.
   */
  function onRowClick(event: MouseEvent) {
    if (row.kind !== 'anime') return
    if ((event.target as HTMLElement | null)?.closest('button')) return
    onToggle()
  }
</script>

<div
  class="lib-row"
  class:song={row.kind === 'song'}
  class:open={expanded}
  onclick={onRowClick}
  role="presentation"
>
  {#if row.kind === 'anime'}
    <span class="lead">
      <button
        type="button"
        class="chev"
        class:open={expanded}
        aria-expanded={expanded}
        aria-label={expanded ? `Collapse ${row.name}` : `Expand ${row.name}`}
        onclick={onToggle}
      >
        <Icon name="caret" size={15} />
      </button>
    </span>

    <span class="text">
      <span class="name" title={row.name}>{row.name}</span>
      <span class="sub">{row.sub}</span>
    </span>

    <span class="count mono">{row.songCount}</span>
  {:else}
    <span class="lead song-lead">
      <span class="badge">{row.badge}</span>
    </span>

    <span class="text">
      <span class="name" title={row.title}>{row.title}</span>
      <span class="sub">
        {row.animeName ? `${row.artist} · ${row.animeName}` : row.artist}
      </span>
    </span>

    <span class="count"></span>
  {/if}

  <span class="add-cell">
    <button type="button" class="add" class:loud={expanded} onclick={onAdd}>
      <Icon name="plus" size={13} />
      Add
    </button>
    <!-- Adds to one chosen block without changing the pane's target (SPEC §7). -->
    <button
      bind:this={addChevron}
      type="button"
      class="add-chev"
      aria-label="Add to a specific block"
      title="Add to a specific block"
      onclick={() => addChevron && onAddTo(addChevron)}
    >
      <Icon name="caret" size={13} />
    </button>
  </span>
</div>

<style>
  .lib-row {
    display: flex;
    align-items: center;
    gap: 10px;
    height: var(--qb-lib-anime-h);
    padding: 0 14px;
    border-bottom: 1px solid var(--line);
    cursor: pointer;
  }

  .lib-row.song {
    height: var(--qb-lib-song-h);
    /* A song row has nothing to expand. */
    cursor: default;
  }

  .lib-row:hover {
    background: var(--bg-row-hover);
  }

  /* The tint groups an expanded anime with its songs. */
  .lib-row.open {
    background: rgba(91, 155, 245, 0.08);
  }

  .lead {
    flex: 0 0 var(--qb-lib-lead);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .song-lead {
    flex: 0 0 var(--qb-lib-song-lead);
  }

  /* Centred in its cell. Do not shift it to align with the type badges
     below: it then looks off-centre in its own row. */
  .chev {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    padding: 0;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: var(--text-3);
    cursor: pointer;
    transform: rotate(-90deg);
  }

  .chev.open {
    transform: rotate(0deg);
    color: var(--blue-fg);
  }

  .badge {
    display: inline-flex;
    align-items: center;
    height: 23px;
    padding: 0 9px;
    border-radius: 5px;
    background: var(--chip-teal-bg);
    border: 1px solid var(--chip-teal-line);
    color: var(--teal-fg);
    font-family: var(--font-mono);
    font-size: var(--qb-badge);
    font-weight: 600;
  }

  .text {
    flex: 1 1 0;
    min-width: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    line-height: 1.2;
  }

  .name,
  .sub {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .name {
    font-size: 15px;
    font-weight: 600;
    color: var(--text);
  }

  .lib-row.song .name {
    font-size: var(--qb-text);
    font-weight: 500;
    color: var(--text-2);
  }

  .sub {
    font-size: var(--qb-text-xs);
    color: var(--text-4);
  }

  .count {
    flex: 0 0 var(--qb-lib-count);
    text-align: right;
    font-size: var(--qb-text-sm);
    color: var(--text-3);
  }

  .add-cell {
    flex: 0 0 var(--qb-lib-action);
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 3px;
  }

  .add {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    height: 30px;
    padding: 0 11px;
    border-radius: 7px;
    background: var(--bg-raised);
    border: 1px solid var(--line-soft);
    color: var(--text-2);
    font-size: var(--qb-text-sm);
    font-weight: 600;
    white-space: nowrap;
    cursor: pointer;
  }

  .add:hover {
    border-color: var(--line-strong);
    color: var(--text);
  }

  .add.loud {
    background: var(--accent);
    border-color: transparent;
    color: var(--accent-fg);
    font-weight: 700;
  }

  .add-chev {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 30px;
    padding: 0;
    border: 1px solid var(--line-soft);
    border-radius: 7px;
    background: var(--bg-raised);
    color: var(--text-4);
    cursor: pointer;
  }

  .add-chev:hover {
    color: var(--text);
    border-color: var(--line-strong);
  }
</style>
