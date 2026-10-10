<!--
  Dual-handle range with a number field at each end (SPEC §4).

  Two `<input type="range">` overlay one track. The inputs have
  `pointer-events: none` and only the thumbs accept the pointer, so a click on
  the track cannot move the wrong handle. The fill and thumbs stay grey until
  the range is narrowed, so an untouched slider does not look like an active
  filter.

  `filterStore.setBound` handles a bound that crosses the other one, for the
  number fields and the thumbs alike.
-->
<script lang="ts">
  import { DIFFICULTY_TIERS, tierLabel } from '../../amq/derive'

  /**
   * The same shape as the room browser's `RangeSpec`. Declared here so the
   * quiz builder can use the slider without importing the room filter module.
   */
  export interface SliderSpec {
    key: string
    label: () => string
    min: number
    max: number
    /** Draws the five difficulty tier bands behind the track. */
    tiers?: boolean
    /** The maximum means "unlimited", not the literal `max`. */
    maxIsUnbounded?: boolean
  }

  interface Props {
    spec: SliderSpec
    value: [number, number]
    changed: boolean
    onInput: (index: 0 | 1, value: number) => void
    onReset: () => void
  }

  let { spec, value, changed, onInput, onReset }: Props = $props()

  const id = $derived(`rng-${spec.key}`)
  const title = $derived(spec.label())
  const span = $derived(spec.max - spec.min)
  const lowPct = $derived(((value[0] - spec.min) / span) * 100)
  const highPct = $derived(((value[1] - spec.min) / span) * 100)
</script>

<div class="group">
  <div class="head">
    <span class="title">{title}</span>
    <div class="rule"></div>
    {#if changed}
      <button type="button" class="reset" onclick={onReset}>
        <span class="dot"></span>
        Reset
      </button>
    {/if}
  </div>

  <div class="controls">
    <label class="sr-only" for="{id}-lo">{title} minimum</label>
    <input
      id="{id}-lo"
      class="num mono"
      type="number"
      min={spec.min}
      max={spec.max}
      value={value[0]}
      onchange={(event) => onInput(0, event.currentTarget.valueAsNumber)}
    />

    <div class="track-host" class:has-tiers={spec.tiers}>
      <div class="track"></div>

      {#if spec.tiers}
        <!-- The bands show the difficulty scale. The hover legend below names
             them. -->
        <div class="bands">
          {#each DIFFICULTY_TIERS as tier (tier.key)}
            <div
              class="band"
              style:width="{tier.max - tier.min}%"
              style:background={tier.colour}
            ></div>
          {/each}
        </div>
      {/if}

      <div
        class="fill"
        class:on={changed}
        style:left="{lowPct}%"
        style:width="{highPct - lowPct}%"
      ></div>

      <input
        class="rng"
        class:on={changed}
        type="range"
        min={spec.min}
        max={spec.max}
        value={value[0]}
        aria-label="{title} lower bound"
        oninput={(event) => onInput(0, event.currentTarget.valueAsNumber)}
      />
      <input
        class="rng"
        class:on={changed}
        type="range"
        min={spec.min}
        max={spec.max}
        value={value[1]}
        aria-label="{title} upper bound"
        oninput={(event) => onInput(1, event.currentTarget.valueAsNumber)}
      />

      {#if spec.tiers}
        <div class="legend" role="tooltip">
          <div class="legend-head">Share of players who guess correctly</div>
          {#each DIFFICULTY_TIERS as tier (tier.key)}
            <div class="legend-row">
              <span class="swatch" style:background={tier.colour}></span>
              <span class="legend-name">{tierLabel(tier)}</span>
              <div class="rule"></div>
              <span class="legend-range mono">{tier.min}–{tier.max}%</span>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <label class="sr-only" for="{id}-hi">{title} maximum</label>
    <input
      id="{id}-hi"
      class="num mono"
      type="number"
      min={spec.min}
      max={spec.max}
      value={value[1]}
      onchange={(event) => onInput(1, event.currentTarget.valueAsNumber)}
    />
  </div>
</div>

<style>
  .group {
    margin-bottom: 14px;
  }

  .head {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 16px;
    margin-bottom: 8px;
  }

  .title {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #a3acbb;
    white-space: nowrap;
  }

  .rule {
    flex-grow: 1;
    height: 1px;
    background: rgba(255, 255, 255, 0.08);
  }

  .reset {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    height: 16px;
    padding: 0;
    background: transparent;
    border: 0;
    color: var(--blue-fg);
    font-size: 10px;
    font-weight: 600;
    cursor: pointer;
  }

  .dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--accent);
  }

  .controls {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .num {
    width: 54px;
    height: 26px;
    padding: 0 4px;
    text-align: center;
    border-radius: 6px;
    background: var(--bg-sunken);
    border: 1px solid rgba(255, 255, 255, 0.14);
    color: var(--text);
    font-size: 12px;
    -moz-appearance: textfield;
    appearance: textfield;
  }

  .num:focus {
    outline: none;
    border-color: var(--accent);
  }

  .num::-webkit-outer-spin-button,
  .num::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  .track-host {
    position: relative;
    flex-grow: 1;
    height: 18px;
  }

  .track,
  .bands,
  .fill {
    position: absolute;
    top: 7px;
    height: 4px;
    border-radius: 2px;
  }

  .track {
    left: 0;
    right: 0;
    background: rgba(255, 255, 255, 0.12);
  }

  .bands {
    left: 0;
    right: 0;
    display: flex;
    overflow: hidden;
    opacity: 0.42;
  }

  .band {
    height: 4px;
  }

  .fill {
    background: rgba(255, 255, 255, 0.34);
  }

  .fill.on {
    background: var(--accent);
  }

  .rng {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 18px;
    margin: 0;
    padding: 0;
    background: transparent;
    -webkit-appearance: none;
    appearance: none;
    /* Only the thumbs accept the pointer. See the header comment. */
    pointer-events: none;
  }

  .rng:focus {
    outline: none;
  }

  .rng::-webkit-slider-runnable-track {
    height: 18px;
    background: transparent;
    border: none;
  }

  .rng::-moz-range-track {
    height: 18px;
    background: transparent;
    border: none;
  }

  .rng::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 16px;
    height: 16px;
    margin-top: 1px;
    border-radius: 50%;
    background: #fff;
    border: 3px solid var(--text-5);
    box-sizing: border-box;
    cursor: grab;
    pointer-events: auto;
  }

  .rng::-moz-range-thumb {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #fff;
    border: 3px solid var(--text-5);
    box-sizing: border-box;
    cursor: grab;
    pointer-events: auto;
  }

  .rng.on::-webkit-slider-thumb {
    border-color: var(--accent);
  }

  .rng.on::-moz-range-thumb {
    border-color: var(--accent);
  }

  .rng:focus-visible::-webkit-slider-thumb {
    box-shadow: 0 0 0 3px rgba(91, 155, 245, 0.45);
  }

  .legend {
    position: absolute;
    z-index: 40;
    right: -6px;
    bottom: calc(100% + 6px);
    width: 208px;
    padding: 7px 9px;
    border-radius: var(--radius);
    background: var(--bg-pop);
    border: 1px solid var(--line-strong);
    box-shadow: 0 8px 22px rgba(0, 0, 0, 0.55);
    opacity: 0;
    visibility: hidden;
    transition: opacity 0.12s ease;
    pointer-events: none;
  }

  .has-tiers:hover .legend,
  .has-tiers:focus-within .legend {
    opacity: 1;
    visibility: visible;
  }

  .legend-head {
    margin-bottom: 5px;
    font-size: 10px;
    color: var(--text-4);
  }

  .legend-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 1px 0;
  }

  .swatch {
    width: 9px;
    height: 9px;
    border-radius: 2px;
    flex-shrink: 0;
  }

  .legend-name {
    font-size: 11px;
    font-weight: 600;
    color: var(--text);
    white-space: nowrap;
  }

  .legend-range {
    font-size: 10px;
    color: var(--text-3);
    white-space: nowrap;
  }
</style>
