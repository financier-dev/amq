<!--
  The room browser screen.

  Three fixed bands over a scrolling list (SPEC §1). AMQ's menu bar keeps the
  bottom ~45px of the viewport and is not ours — the list reserves that space
  rather than covering it.
-->
<script lang="ts">
  import { filterStore } from '../../amq/filters.svelte'
  import { roomStore, type Room } from '../../amq/rooms.svelte'
  import { sortRooms } from '../../amq/sort'
  import ActiveFilters from './ActiveFilters.svelte'
  import ColumnHeader from './ColumnHeader.svelte'
  import FilterPanel from './FilterPanel.svelte'
  import RoomRow from './RoomRow.svelte'
  import TopBar from './TopBar.svelte'

  let panelOpen = $state(false)

  const visible = $derived(
    sortRooms(
      roomStore.rooms.filter((room) => filterStore.matches(room)),
      filterStore.state.sort.key,
      filterStore.state.sort.dir
    )
  )

  function back() {
    viewChanger.changeView('main')
  }

  function join(room: Room) {
    roomStore.join(room)
  }

  function spectate(room: Room) {
    roomStore.spectate(room)
  }

  function settings(room: Room) {
    roomStore.previewSettings(room)
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && panelOpen) {
      panelOpen = false
    }
  }

  /**
   * Stops key events from our own text fields reaching AMQ's document-level
   * handlers.
   *
   * `setup.js:56` blocks Backspace unless `event.target` is an input — but an
   * event crossing a shadow boundary is retargeted to the host element, so it
   * sees our wrapper `<div>`, decides the key came from outside a field and
   * calls `preventDefault()`. The result is that Backspace does nothing in the
   * search box. Keeping the event inside the shadow root also stops AMQ's
   * other global shortcuts firing while you type.
   */
  function keepKeysLocal(event: KeyboardEvent) {
    const target = event.target as HTMLElement | null
    const tag = target?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) {
      event.stopPropagation()
    }
  }
</script>

<svelte:window onkeydown={onKeydown} />

<div
  class="screen"
  onkeydown={keepKeysLocal}
  onkeyup={keepKeysLocal}
  role="presentation"
>
  <TopBar
    search={filterStore.search}
    filterCount={filterStore.changedCount}
    {panelOpen}
    onSearch={(value) => filterStore.setSearch(value)}
    onTogglePanel={() => (panelOpen = !panelOpen)}
    onHost={() => roomStore.host()}
    onBack={back}
  />

  <ActiveFilters
    chips={filterStore.activeChips}
    shown={visible.length}
    total={roomStore.roomCount}
    onClearAll={() => filterStore.resetAll()}
  />

  <div class="table">
    <ColumnHeader
      sort={filterStore.state.sort}
      onSort={(key) => filterStore.setSort(key)}
    />

    <div class="list">
      {#each visible as room, index (room.id)}
        <RoomRow
          {room}
          zebra={index % 2 === 1}
          onJoin={join}
          onSpectate={spectate}
          onSettings={settings}
        />
      {:else}
        <div class="empty">
          {#if !roomStore.loaded}
            Loading rooms…
          {:else if roomStore.roomCount === 0}
            No rooms are open right now.
          {:else}
            No rooms match these filters.
          {/if}
        </div>
      {/each}
    </div>
  </div>

  {#if panelOpen}
    <div class="panel-anchor">
      <FilterPanel filters={filterStore} onClose={() => (panelOpen = false)} />
    </div>
  {/if}
</div>

<style>
  .screen {
    position: fixed;
    inset: 0;
    /* AMQ's menu bar owns the bottom strip; leave it alone (SPEC §1). */
    bottom: 45px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .table {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    margin: 0 var(--gutter) var(--gutter);
  }

  .list {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    border-radius: 0 0 var(--radius) var(--radius);
    border: 1px solid var(--line-soft);
    border-top: 0;
    background: var(--bg-list);
  }

  .empty {
    padding: 28px var(--gutter);
    text-align: center;
    color: var(--text-4);
    font-size: 13px;
  }

  .panel-anchor {
    position: absolute;
    top: 56px;
    /* Lines up under the Filters button, which sits left of Host Room. */
    right: calc(var(--gutter) + 132px);
    z-index: 60;
  }
</style>
