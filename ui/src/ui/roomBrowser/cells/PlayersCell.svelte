<!--
  Players: a fill bar for `used/cap`, and a spectator count when there are
  spectators.

  Spectators are not part of `used/cap`, because they take no slot (SPEC §3).
  The Difficulty cell uses the same bar metrics, so the two bars align.
-->
<script lang="ts">
  import type { Room } from '../../../amq/rooms.svelte'
  import Floating from '../../common/Floating.svelte'
  import Icon from '../../common/Icon.svelte'
  import RosterPopover from './RosterPopover.svelte'

  interface Props {
    room: Room
  }

  let { room }: Props = $props()

  const full = $derived(room.playerCount >= room.roomSize)
  const hasFriends = $derived(room.friendNames.length > 0)
  const fillPct = $derived(
    room.roomSize > 0
      ? Math.min(100, Math.round((room.playerCount / room.roomSize) * 100))
      : 0
  )

  let anchor = $state<HTMLDivElement | null>(null)
  let open = $state(false)
  let dismiss: ReturnType<typeof setTimeout> | null = null

  // The delay lets the pointer cross the gap between the cell and the popover.
  const DISMISS_DELAY_MS = 180

  function show() {
    if (dismiss) {
      clearTimeout(dismiss)
      dismiss = null
    }
    open = true
  }

  function hide() {
    if (dismiss) clearTimeout(dismiss)
    dismiss = setTimeout(() => {
      dismiss = null
      open = false
    }, DISMISS_DELAY_MS)
  }
</script>

<!-- The roster test finds this cell by the `players` class. -->
<div
  bind:this={anchor}
  class="cell players"
  onmouseenter={show}
  onmouseleave={hide}
  onfocusin={show}
  onfocusout={hide}
  role="presentation"
>
  <div class="bar">
    <div class="fill" class:full style:width="{fillPct}%"></div>
  </div>
  <div class="counts">
    <span class="count mono" class:friend={hasFriends} class:full>
      {room.playerCount}/{room.roomSize}
    </span>
    {#if room.spectatorCount > 0}
      <span class="specs mono">
        <Icon name="eye" size={12} strokeWidth={2.4} />
        {room.spectatorCount}
      </span>
    {/if}
  </div>
</div>

{#if open && anchor}
  <Floating
    {anchor}
    placement="below"
    width={210}
    onEnter={show}
    onLeave={hide}
    onDismiss={() => (open = false)}
  >
    <RosterPopover
      players={room.players}
      spectators={room.spectators}
      friendNames={room.friendNames}
    />
  </Floating>
{/if}

<style>
  .cell {
    flex: 0 0 var(--col-players);
  }

  .bar {
    height: 5px;
    border-radius: 3px;
    background: rgba(255, 255, 255, 0.12);
    overflow: hidden;
  }

  .fill {
    height: 5px;
    background: var(--accent);
  }

  .fill.full {
    background: var(--rose);
  }

  /*
   * Baseline-aligned and pushed to the two ends of the bar: `used/cap` under
   * its start, the spectator count under its end.
   *
   * The two spans have different font sizes, so centring their boxes does not
   * align the text. Baseline alignment is correct for any font metrics, and
   * the fallback fonts measure differently from IBM Plex Mono.
   */
  .counts {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 6px;
    margin-top: 4px;
  }

  .count {
    font-size: 13px;
    font-weight: 500;
    white-space: nowrap;
    color: var(--text-2);
  }

  /* The friend colour below takes priority over "full". */
  .count.full {
    color: var(--rose-fg);
  }

  .count.friend {
    color: var(--teal-fg);
  }

  /*
   * `align-items: baseline` exposes this box's text baseline to the row. The
   * eye icon gets `align-self: center`. As the first item with no baseline of
   * its own, it would otherwise make the browser derive one from its bottom
   * edge, which places the whole group too high.
   */
  .specs {
    display: inline-flex;
    align-items: baseline;
    gap: 3px;
    font-size: 12px;
    color: var(--chip-off-fg);
  }

  .specs :global(svg) {
    align-self: center;
    flex-shrink: 0;
  }
</style>
