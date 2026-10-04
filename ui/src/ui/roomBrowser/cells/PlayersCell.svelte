<!--
  Players: a fill bar over `used/cap`, plus a spectator count when there is one.

  Spectators are never folded into `used/cap` — they do not consume slots
  (SPEC §3). The Difficulty cell uses identical bar metrics so the two bars line
  up across every row.
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

  // A short delay on leave is what makes the gap between trigger and popover
  // survivable with a real pointer.
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

<!-- `players` names this cell for the roster test, which would otherwise have
     to reach it by position among the several cells sharing `.cell`. -->
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
   * Baseline-aligned, and pushed to the two ends of the bar above: the used/cap
   * sits under its start, the spectator count under its end.
   *
   * Centring the boxes is not the same as aligning the text — the two spans are
   * different sizes, so their glyphs still sat off from each other. Baseline is
   * the only alignment that is correct whatever the font metrics turn out to
   * be, which matters because the real IBM Plex Mono is not what a fallback
   * stack measures.
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

  /* A friend in the room outranks "full" — it is the reason you'd still look. */
  .count.full {
    color: var(--rose-fg);
  }

  .count.friend {
    color: var(--teal-fg);
  }

  /*
   * `align-items: baseline` makes this box expose its *text's* baseline to the
   * row above. The eye is excluded from that with `align-self: center` —
   * otherwise, being the first item and having no baseline of its own, it
   * would force the browser to synthesise one from its bottom edge, which is
   * what sat the whole group too high.
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
