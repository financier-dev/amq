<!--
  Difficulty as a five-tier band.

  Every row paints all five bands at full width and then masks everything
  outside the room's own range, so the position of the lit segment is
  comparable across rows at a glance. Lower % correct is harder, so the scale
  runs hard→easy left to right.

  The label is always the percentage range, and the hover tooltip names the
  tiers the range touches — that tooltip is the only legend, which is why the
  column header stays plain text (SPEC §3).
-->
<script lang="ts">
  import {
    DIFFICULTY_TIERS,
    difficultyRange,
    tierLabel,
    tiersTouched,
  } from '../../../amq/derive'
  import type { Room } from '../../../amq/rooms.svelte'
  import Floating from '../../common/Floating.svelte'

  interface Props {
    room: Room
  }

  let { room }: Props = $props()

  const range = $derived(difficultyRange(room.settings))
  const touched = $derived(tiersTouched(range))

  let anchor = $state<HTMLDivElement | null>(null)
  let open = $state(false)
</script>

<div
  bind:this={anchor}
  class="cell"
  onmouseenter={() => (open = true)}
  onmouseleave={() => (open = false)}
  onfocusin={() => (open = true)}
  onfocusout={() => (open = false)}
  role="presentation"
>
  <div class="bands">
    {#each DIFFICULTY_TIERS as tier (tier.key)}
      <div
        class="band"
        style:width="{tier.max - tier.min}%"
        style:background={tier.colour}
      ></div>
    {/each}
    <div class="mask" style:left="0" style:width="{range.min}%"></div>
    <div
      class="mask"
      style:left="{range.max}%"
      style:width="{100 - range.max}%"
    ></div>
  </div>
  <div class="label mono">{range.min}–{range.max}%</div>
</div>

{#if open && anchor}
  <Floating {anchor} placement="below" onDismiss={() => (open = false)}>
    <div class="tip-head">Difficulty {range.min}–{range.max}%</div>
    {#each touched as tier (tier.key)}
      <div class="tip-row">
        <span class="swatch" style:background={tier.colour}></span>
        <span class="tier-name">{tierLabel(tier)}</span>
        <div class="spacer"></div>
        <span class="tier-range mono">{tier.min}–{tier.max}%</span>
      </div>
    {/each}
  </Floating>
{/if}

<style>
  .cell {
    flex: 0 0 var(--col-difficulty);
  }

  .bands {
    position: relative;
    display: flex;
    height: 5px;
    border-radius: 3px;
    overflow: hidden;
  }

  .band {
    height: 5px;
  }

  .mask {
    position: absolute;
    top: 0;
    height: 5px;
    background: rgba(13, 17, 25, 0.78);
  }

  .label {
    margin-top: 4px;
    font-size: 13px;
    color: var(--text-3);
    white-space: nowrap;
  }

  .tip-head {
    margin-bottom: 6px;
    font-size: 11px;
    color: var(--text-4);
    white-space: nowrap;
  }

  .tip-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 2px 0;
  }

  .swatch {
    width: 10px;
    height: 10px;
    border-radius: 2px;
    flex-shrink: 0;
  }

  .tier-name {
    font-size: 12px;
    font-weight: 600;
    color: var(--text);
    white-space: nowrap;
  }

  .spacer {
    flex-grow: 1;
  }

  .tier-range {
    font-size: 11px;
    color: var(--text-3);
    white-space: nowrap;
  }
</style>
