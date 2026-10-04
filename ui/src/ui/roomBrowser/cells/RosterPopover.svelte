<!--
  Who is in the room. Players with levels, then a divided Spectators section
  when there is one (SPEC §3).

  Names are real `<button>`s that open AMQ's own profile modal, so the popover
  has to stay open while the pointer travels into it — `Floating` forwards the
  enter/leave events back to the cell that owns the open state, and the gap is
  small enough to cross within the dismiss delay.
-->
<script lang="ts">
  import type { RoomPlayer } from '../../../amq/rooms.svelte'
  import { openProfile, t } from '../../../amq/derive'

  interface Props {
    players: RoomPlayer[]
    spectators: RoomPlayer[]
    friendNames: string[]
  }

  let { players, spectators, friendNames }: Props = $props()

  const friends = $derived(new Set(friendNames))

  /**
   * roomTile.js `buildPlayerList` sorts friends first, then blocked.
   *
   * The list is keyed by name, and a keyed `{#each}` throws on a duplicate —
   * which would blank the whole screen, not just this popover. The reducer
   * keeps the roster unique, so a repeat means the payload disagreed with that
   * assumption; drop it rather than take the list down over it.
   */
  function ordered(list: RoomPlayer[]) {
    const seen = new Set<string>()
    return list
      .filter((player) => !seen.has(player.name) && seen.add(player.name))
      .sort((a, b) => rank(a.name) - rank(b.name))
  }

  function rank(name: string) {
    if (friends.has(name)) return 0
    try {
      if (socialTab.isBlocked(name)) return 1
    } catch {
      // socialTab is not up yet; treat as an ordinary player.
    }
    return 2
  }
</script>

<div class="section-title">
  {t('room_browser.room_tile.popovers.players', 'Players')}
</div>
{#each ordered(players) as player (player.name)}
  <div class="row">
    <button
      type="button"
      class="name"
      class:friend={friends.has(player.name)}
      onclick={(event) => openProfile(event.currentTarget, player.name)}
    >
      {player.name}
    </button>
    <div class="spacer"></div>
    <span class="level mono">{player.level}</span>
  </div>
{:else}
  <div class="empty">—</div>
{/each}

{#if spectators.length}
  <div class="section-title divided">
    {t('room_browser.room_tile.popovers.spectators', 'Spectators')}
  </div>
  {#each ordered(spectators) as player (player.name)}
    <div class="row">
      <button
        type="button"
        class="name spectator"
        class:friend={friends.has(player.name)}
        onclick={(event) => openProfile(event.currentTarget, player.name)}
      >
        {player.name}
      </button>
      <div class="spacer"></div>
      <span class="level mono">{player.level}</span>
    </div>
  {/each}
{/if}

<style>
  .section-title {
    margin-bottom: 5px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--text-4);
  }

  .section-title.divided {
    margin: 8px 0 5px;
    padding-top: 7px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }

  .row {
    display: flex;
    align-items: baseline;
    gap: 10px;
    padding: 2px 0;
  }

  .spacer {
    flex-grow: 1;
  }

  .name {
    background: none;
    border: 0;
    padding: 0;
    text-align: left;
    cursor: pointer;
    font-size: 13px;
    font-weight: 600;
    color: var(--text);
  }

  .name:hover {
    text-decoration: underline;
  }

  .name.spectator {
    font-weight: 500;
    color: var(--text-3);
  }

  /* Repeated here as well as on the count, so the friend signal is never
     carried by colour alone in only one place (SPEC §7). */
  .name.friend {
    color: var(--teal-fg);
  }

  .level {
    font-size: 11px;
    color: var(--text-3);
  }

  .empty {
    font-size: 12px;
    color: var(--text-5);
  }
</style>
