<!--
  How many songs to take from an anime rule (SPEC §5.6).

  Fixed 74px, vertically centred, deliberately *without* a box around it — at
  34px of row height a bordered control would dominate the row it sits in.

  A 3px track carries the fill, a real `<input type="range">` sits on top of it
  with a transparent track of its own, and the typed value lives underneath as
  `− 3/13 +`. The slider and both buttons write the same clamped value, so the
  three can never disagree; toggling a song type off re-clamps immediately and
  the fill follows, which is the whole reason the fill is derived rather than
  stored.
-->
<script lang="ts">
  interface Props {
    value: number
    pool: number
    onChange: (value: number) => void
    label: string
  }

  let { value, pool, onChange, label }: Props = $props()

  // A pool of zero still shows 1: an anime with every type switched off has
  // nothing to give, and `1/0` reads as the mistake it is.
  const max = $derived(Math.max(pool, 1))
  const pct = $derived(max <= 1 ? 100 : ((value - 1) / (max - 1)) * 100)
</script>

<div class="pick">
  <div class="track-host">
    <span class="track" aria-hidden="true"></span>
    <span class="fill" style:width="{pct}%" aria-hidden="true"></span>
    <input
      class="rng"
      type="range"
      min="1"
      {max}
      step="1"
      {value}
      aria-label={label}
      oninput={(event) => onChange(Number(event.currentTarget.value))}
    />
  </div>
  <div class="stepper">
    <button
      type="button"
      class="step"
      aria-label="One fewer"
      disabled={value <= 1}
      onclick={() => onChange(value - 1)}>−</button
    >
    <span class="count mono">{value}/{pool}</span>
    <button
      type="button"
      class="step"
      aria-label="One more"
      disabled={value >= max}
      onclick={() => onChange(value + 1)}>+</button
    >
  </div>
</div>

<style>
  .pick {
    flex: 0 0 var(--qb-pick);
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 2px;
  }

  .track-host {
    position: relative;
    height: 3px;
  }

  .track,
  .fill {
    position: absolute;
    top: 0;
    left: 0;
    height: 3px;
    border-radius: 2px;
  }

  .track {
    width: 100%;
    background: var(--bg-sunken);
  }

  .fill {
    background: var(--accent);
  }

  /*
   * The input covers the track so the whole width is draggable, but only the
   * thumb takes the pointer — otherwise a click anywhere in the cell jumps the
   * value, which at 74px wide is almost always an accident.
   */
  .rng {
    position: absolute;
    top: -5px;
    left: 0;
    width: 100%;
    height: 13px;
    margin: 0;
    padding: 0;
    background: transparent;
    appearance: none;
    pointer-events: none;
  }

  .rng::-webkit-slider-thumb {
    appearance: none;
    width: 9px;
    height: 9px;
    border: 0;
    border-radius: 50%;
    background: var(--accent-soft);
    cursor: pointer;
    pointer-events: auto;
  }

  .rng::-moz-range-thumb {
    width: 9px;
    height: 9px;
    border: 0;
    border-radius: 50%;
    background: var(--accent-soft);
    cursor: pointer;
    pointer-events: auto;
  }

  .rng::-moz-range-track {
    background: transparent;
  }

  .stepper {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .step {
    width: 13px;
    height: 13px;
    padding: 0;
    border: 0;
    border-radius: 3px;
    background: transparent;
    color: var(--text-4);
    font-size: 12px;
    line-height: 1;
    cursor: pointer;
  }

  .step:hover:not(:disabled) {
    background: var(--bg-raised);
    color: var(--text);
  }

  .step:disabled {
    opacity: 0.35;
    cursor: default;
  }

  .count {
    font-size: 10.5px;
    color: var(--text-3);
  }
</style>
