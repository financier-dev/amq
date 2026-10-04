<!--
  Top band: back to the main menu, the page title and counts, search, the
  Filters toggle and Host Room.
-->
<script lang="ts">
  import { t } from '../../amq/derive'
  import Icon from '../common/Icon.svelte'

  interface Props {
    search: string
    filterCount: number
    panelOpen: boolean
    onSearch: (value: string) => void
    onTogglePanel: () => void
    onHost: () => void
    onBack: () => void
  }

  let {
    search,
    filterCount,
    panelOpen,
    onSearch,
    onTogglePanel,
    onHost,
    onBack,
  }: Props = $props()
</script>

<div class="bar">
  <button type="button" class="ghost back" onclick={onBack}>
    <Icon name="back" size={15} />
    Home
  </button>

  <h1>Rooms</h1>

  <div class="spacer"></div>

  <div class="search">
    <Icon name="search" size={15} />
    <label class="sr-only" for="amq-ui-search">
      {t('room_browser.filters.search_placeholder', 'Search rooms')}
    </label>
    <input
      id="amq-ui-search"
      type="text"
      placeholder={t('room_browser.filters.search_placeholder', 'Search rooms')}
      value={search}
      oninput={(event) => onSearch(event.currentTarget.value)}
    />
  </div>

  <button
    type="button"
    class="ghost filters"
    class:open={panelOpen}
    aria-expanded={panelOpen}
    onclick={onTogglePanel}
  >
    <Icon name="filter" size={15} />
    Filters
    {#if filterCount > 0}
      <span class="badge mono">{filterCount}</span>
    {/if}
  </button>

  <button type="button" class="host" onclick={onHost}>
    <Icon name="plus" size={15} strokeWidth={2.6} />
    {t('room_browser.host_room', 'Host Room')}
  </button>
</div>

<style>
  .bar {
    display: flex;
    align-items: center;
    gap: 16px;
    height: 60px;
    padding: 0 var(--gutter);
    background: var(--bg-top);
    border-bottom: 1px solid var(--line-soft);
  }

  h1 {
    margin: 0;
    font-family: var(--font-display);
    font-size: 19px;
    font-weight: 700;
    letter-spacing: -0.01em;
    color: #ffffff;
  }

  .spacer {
    flex-grow: 1;
  }

  .ghost,
  .host {
    display: flex;
    align-items: center;
    height: 36px;
    border-radius: var(--radius);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }

  .ghost {
    gap: 7px;
    padding: 0 13px;
    background: var(--bg-raised);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: var(--text-2);
  }

  .ghost:hover {
    background: rgba(255, 255, 255, 0.12);
  }

  .back {
    gap: 8px;
    padding: 0 14px 0 10px;
  }

  .ghost.open {
    background: rgba(91, 155, 245, 0.2);
    border-color: rgba(91, 155, 245, 0.5);
    color: var(--accent-soft);
  }

  .badge {
    font-size: 11px;
    font-weight: 600;
    color: #08101c;
    background: var(--accent);
    border-radius: 5px;
    padding: 1px 6px;
  }

  .search {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 36px;
    width: 268px;
    padding: 0 12px;
    border-radius: var(--radius);
    background: var(--bg-sunken);
    border: 1px solid rgba(255, 255, 255, 0.13);
    color: var(--text-4);
  }

  .search:focus-within {
    border-color: var(--accent);
  }

  .search input {
    flex-grow: 1;
    min-width: 0;
    background: transparent;
    border: 0;
    outline: none;
    color: var(--text);
    font-family: inherit;
    font-size: 13px;
  }

  .host {
    gap: 7px;
    padding: 0 16px;
    background: var(--accent);
    border: 0;
    color: var(--accent-fg);
    font-weight: 700;
  }

  .host:hover {
    background: #6ea8f7;
  }
</style>
