<!--
  The song library, left pane (SPEC §4).

  Four bands over a scrolling list: the tabs and totals, the filters, the
  "Adds to" strip, and the column header.

  The **"Adds to" strip** is the load-bearing idea here. Every add in this pane
  lands in one named rule block, so a player can work down a list of shows
  without aiming each one. It is not our invention either — AMQ has the same
  concept as `selectedRuleBlock`; the strip just makes it visible instead of
  implicit, and names the block it will hit.
-->
<script lang="ts">
  import { t } from '../../../amq/derive'
  import { libraryStore } from '../../../amq/library.svelte'
  import {
    libraryFilters,
    type LibraryTab,
  } from '../../../amq/quizFilters.svelte'
  import { quizStore } from '../../../amq/quiz.svelte'
  import Icon from '../../common/Icon.svelte'
  import { toneFor } from '../rows'
  import LibraryRow from './LibraryRow.svelte'

  interface Props {
    onOpenFilters: (anchor: HTMLElement) => void
    onPickTarget: (anchor: HTMLElement, forEntry?: () => void) => void
    onAddAnime: (annId: number, blockId?: string) => void
    onAddSong: (annSongId: number, blockId?: string) => void
  }

  let { onOpenFilters, onPickTarget, onAddAnime, onAddSong }: Props = $props()

  const TABS: { key: LibraryTab; i18n: string; fallback: string }[] = [
    { key: 'library', i18n: 'song_library.library', fallback: 'Library' },
    { key: 'new', i18n: 'song_library.new_songs', fallback: 'New' },
    { key: 'wrong', i18n: 'song_library.recent_wrong', fallback: 'Wrong' },
  ]

  const targetTone = $derived(
    toneFor(
      Math.max(
        0,
        quizStore.quiz.blocks.findIndex(
          (block) => block.id === quizStore.targetBlock?.id
        )
      )
    )
  )
  const targetPosition = $derived(
    quizStore.quiz.blocks.findIndex(
      (block) => block.id === quizStore.targetBlock?.id
    ) + 1
  )

  let filterButton = $state<HTMLButtonElement | null>(null)
  let targetButton = $state<HTMLButtonElement | null>(null)
</script>

<section class="pane">
  <header class="band">
    <h2 class="title">{t('song_library.title', 'Library')}</h2>

    <div class="tabs" role="tablist">
      {#each TABS as tab (tab.key)}
        <button
          type="button"
          role="tab"
          class="tab"
          class:on={libraryFilters.state.tab === tab.key}
          aria-selected={libraryFilters.state.tab === tab.key}
          onclick={() => libraryFilters.setTab(tab.key)}
        >
          {t(tab.i18n, tab.fallback)}
        </button>
      {/each}
    </div>

    <span class="totals mono">
      {libraryStore.animeTotal} anime · {libraryStore.songTotal} songs
    </span>
  </header>

  <div class="band filters">
    <label class="search">
      <Icon name="search" size={15} />
      <input
        id="amq-ui-library-search"
        type="search"
        placeholder="Search the library"
        value={libraryFilters.draft}
        oninput={(event) => libraryFilters.setSearch(event.currentTarget.value)}
      />
    </label>

    {#each [{ key: 'watched', label: t('song_library.filters.watched', 'Watched') }, { key: 'unwatched', label: t('song_library.filters.unwatched', 'Unwatched') }] as chip (chip.key)}
      <button
        type="button"
        class="chip"
        class:on={libraryFilters.toggles('watchStatus')[chip.key]}
        aria-pressed={libraryFilters.toggles('watchStatus')[chip.key]}
        onclick={() => libraryFilters.toggle('watchStatus', chip.key)}
      >
        {chip.label}
      </button>
    {/each}

    <button
      bind:this={filterButton}
      type="button"
      class="filter-btn"
      aria-label="Filters"
      title="Filters"
      onclick={() => filterButton && onOpenFilters(filterButton)}
    >
      <Icon name="filter" size={16} />
      {#if libraryFilters.changedCount > 0}
        <span class="badge">{libraryFilters.changedCount}</span>
      {/if}
    </button>
  </div>

  <div class="adds-to">
    <!-- A crosshair: "this is where things land". -->
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="6.5" stroke="currentColor" stroke-width="2" />
      <path
        d="M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
      />
    </svg>
    <span class="adds-label">Adds to</span>

    <button
      bind:this={targetButton}
      type="button"
      class="target"
      onclick={() => targetButton && onPickTarget(targetButton)}
    >
      <span class="dot tone-{targetTone}" aria-hidden="true"></span>
      {t('quiz_builder.rule_block.title', 'Rule Block')}
      {targetPosition}
      <Icon name="caret" size={11} />
    </button>

    <span class="drag-hint">or drag across</span>
  </div>

  <div class="columns">
    <span class="col-text">Anime · song</span>
    <span class="col-count">Songs</span>
    <span class="col-action"></span>
  </div>

  <div class="list">
    {#each libraryStore.rows as row (row.id)}
      <LibraryRow
        {row}
        expanded={row.kind === 'anime' && libraryStore.expanded.has(row.annId)}
        onToggle={() => row.kind === 'anime' && libraryStore.toggle(row.annId)}
        onAdd={() =>
          row.kind === 'anime'
            ? onAddAnime(row.annId)
            : onAddSong(row.annSongId)}
        onAddTo={(anchor) =>
          onPickTarget(anchor, () =>
            row.kind === 'anime'
              ? onAddAnime(row.annId)
              : onAddSong(row.annSongId)
          )}
      />
    {:else}
      <p class="empty">
        {#if libraryStore.loading}
          Loading the library…
        {:else if libraryStore.broken}
          <!--
            A whole pass threw, which means AMQ's payload has changed shape
            under us. Say so rather than showing an empty list that looks like
            a filter mistake.
          -->
          The song library could not be read — the game's data format may have changed.
          <span class="hint">
            Run <code>__amqUI.quizBuilder.useLegacy()</code> to use AMQ's own builder,
            and please report this.
          </span>
        {:else if libraryStore.failed}
          <!--
            Without the cache every entry resolves to its id and every count to
            zero, so say so plainly and name the way out rather than leaving a
            screen that looks merely slow.
          -->
          The song library could not be loaded, so anime and songs cannot be named
          here.
          <span class="hint">
            Reload the page, or run <code>__amqUI.quizBuilder.useLegacy()</code>
            to use AMQ's own builder.
          </span>
        {:else}
          Nothing in the library matches these filters.
        {/if}
      </p>
    {/each}

    {#if libraryStore.capped}
      <!--
        The list is capped rather than virtualised. Saying so with the real
        total is more honest than silently truncating, and search is the way
        through it.
      -->
      <p class="capped">
        Showing the first {libraryStore.shown} of {libraryStore.total} — search to
        narrow it down.
      </p>
    {/if}
  </div>
</section>

<style>
  .pane {
    flex: 1 1 38%;
    min-width: 0;
    display: flex;
    flex-direction: column;
    background: var(--bg-list);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    overflow: hidden;
  }

  .band {
    flex: none;
    display: flex;
    align-items: center;
    gap: 8px;
    height: var(--qb-band-h);
    padding: 0 14px;
    background: var(--bg-head);
    border-bottom: 1px solid var(--line);
  }

  .filters {
    background: var(--bg-strip);
  }

  .title {
    margin: 0;
    font-family: var(--font-display);
    font-size: 16px;
    font-weight: 700;
  }

  .tabs {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 2px;
    border-radius: 7px;
    background: var(--bg-sunken);
  }

  .tab {
    height: 27px;
    padding: 0 11px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: var(--text-4);
    font-family: inherit;
    font-size: var(--qb-text-sm);
    font-weight: 600;
    cursor: pointer;
  }

  .tab.on {
    background: var(--bg-raised);
    color: var(--text);
  }

  .totals {
    margin-left: auto;
    font-size: var(--qb-text-xs);
    color: var(--text-4);
    white-space: nowrap;
  }

  .search {
    flex: 1 1 0;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 6px;
    height: 34px;
    padding: 0 11px;
    border-radius: 8px;
    background: var(--bg-sunken);
    border: 1px solid var(--line-soft);
    color: var(--text-4);
  }

  .search input {
    flex: 1 1 0;
    min-width: 0;
    border: 0;
    background: transparent;
    color: var(--text);
    font-family: inherit;
    font-size: var(--qb-text);
    outline: none;
  }

  .chip {
    height: 31px;
    padding: 0 11px;
    border-radius: 7px;
    background: transparent;
    border: 1px dashed var(--chip-off-line);
    color: var(--chip-off-fg);
    font-family: inherit;
    font-size: var(--qb-text-sm);
    font-weight: 600;
    white-space: nowrap;
    cursor: pointer;
  }

  .chip.on {
    background: var(--chip-blue-bg);
    border: 1px solid var(--chip-blue-line);
    color: var(--blue-fg);
  }

  .filter-btn {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    padding: 0;
    border: 1px solid var(--line-soft);
    border-radius: 8px;
    background: var(--bg-raised);
    color: var(--text-2);
    cursor: pointer;
  }

  .badge {
    position: absolute;
    top: -5px;
    right: -5px;
    min-width: 14px;
    height: 14px;
    padding: 0 3px;
    border-radius: 7px;
    background: var(--accent);
    color: var(--accent-fg);
    font-size: 9px;
    font-weight: 700;
    line-height: 14px;
    text-align: center;
  }

  /* Accent-tinted so the strip reads as a live target, not a heading. */
  .adds-to {
    flex: none;
    display: flex;
    align-items: center;
    gap: 7px;
    height: 46px;
    padding: 0 14px;
    background: rgba(91, 155, 245, 0.1);
    border-bottom: 1px solid var(--line);
    color: var(--blue-fg);
  }

  .adds-label {
    font-size: var(--qb-text);
    font-weight: 600;
  }

  .target {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 30px;
    padding: 0 11px;
    border-radius: 7px;
    background: var(--bg-raised);
    border: 1px solid var(--line-soft);
    color: var(--text);
    font-family: inherit;
    font-size: var(--qb-text-sm);
    font-weight: 600;
    white-space: nowrap;
    cursor: pointer;
  }

  .dot {
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

  .drag-hint {
    margin-left: auto;
    font-size: var(--qb-text-xs);
    color: var(--text-5);
  }

  .columns {
    flex: none;
    display: flex;
    align-items: center;
    gap: 10px;
    height: 30px;
    padding: 0 14px;
    border-bottom: 1px solid var(--line);
    font-size: var(--qb-text-xs);
    font-weight: 700;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: var(--text-5);
  }

  .col-text {
    flex: 1 1 0;
  }

  .col-count {
    flex: 0 0 var(--qb-lib-count);
    text-align: right;
  }

  .col-action {
    flex: 0 0 var(--qb-lib-action);
  }

  .list {
    flex: 1 1 0;
    overflow-y: auto;
    overflow-x: hidden;
  }

  .hint {
    display: block;
    margin-top: 8px;
    font-size: 10.5px;
    color: var(--text-5);
  }

  code {
    font-family: var(--font-mono);
    font-size: 10px;
  }

  .empty,
  .capped {
    padding: 22px 14px;
    text-align: center;
    font-size: var(--qb-text);
    color: var(--text-4);
  }

  .capped {
    border-top: 1px solid var(--line);
  }
</style>
