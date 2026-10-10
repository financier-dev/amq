<!--
  The library filter panel (SPEC §10), a 680px popover under the filter
  button. Two columns, no scrolling.

  **Three controls from the spec are missing on purpose.** The bulk library
  payload has no difficulty, genres or tags. Difficulty is available only per
  song through `get song extended info`, and genres and tags only per anime
  through `get anime extended info`: one request per row. They remain
  available in an algorithm block, which AMQ filters on the server.

  Groups work as in the room browser. A group that differs from its default
  shows an accent dot and a Reset, and the header badge counts those groups.
-->
<script lang="ts">
  import { t } from '../../../amq/derive'
  import {
    TOGGLE_GROUPS,
    YEAR_MAX,
    YEAR_MIN,
    libraryFilters,
  } from '../../../amq/quizFilters.svelte'
  import Floating from '../../common/Floating.svelte'
  import Icon from '../../common/Icon.svelte'
  import ToggleChip from '../../common/ToggleChip.svelte'

  interface Props {
    anchor: HTMLElement
    onDismiss: () => void
  }

  let { anchor, onDismiss }: Props = $props()

  const left = TOGGLE_GROUPS.slice(0, 3)
  const right = TOGGLE_GROUPS.slice(3)

  const vintage = $derived(libraryFilters.state.vintage)
  const span = YEAR_MAX - YEAR_MIN
  const lowPct = $derived(((vintage[0] - YEAR_MIN) / span) * 100)
  const highPct = $derived(((vintage[1] - YEAR_MIN) / span) * 100)
</script>

<Floating
  {anchor}
  placement="below"
  align="start"
  width={680}
  maxWidth={680}
  {onDismiss}
>
  <div class="panel">
    <header class="head">
      <h2>Filters</h2>
      {#if libraryFilters.changedCount > 0}
        <span class="badge">{libraryFilters.changedCount}</span>
        <button
          type="button"
          class="reset-all"
          onclick={() => libraryFilters.resetAll()}
        >
          Reset all
        </button>
      {/if}
      <button
        type="button"
        class="close"
        aria-label="Close"
        onclick={onDismiss}
      >
        <Icon name="close" size={13} />
      </button>
    </header>

    <div class="cols">
      {#each [left, right] as column, columnIndex (columnIndex)}
        <div class="col">
          {#each column as group (group.key)}
            <div class="group">
              <div class="group-head">
                <span class="group-title">{group.label()}</span>
                <span class="rule"></span>
                {#if libraryFilters.groupChanged(group.key)}
                  <button
                    type="button"
                    class="reset"
                    onclick={() => libraryFilters.resetGroup(group.key)}
                  >
                    <span class="dot"></span>
                    Reset
                  </button>
                {/if}
              </div>
              <div class="chips">
                {#each group.options as option (option.key)}
                  <ToggleChip
                    label={option.label()}
                    on={libraryFilters.toggles(group.key)[option.key]}
                    onToggle={() =>
                      libraryFilters.toggle(group.key, option.key)}
                  />
                {/each}
              </div>
            </div>
          {/each}

          {#if columnIndex === 1}
            <div class="group">
              <div class="group-head">
                <span class="group-title">
                  {t('room_browser.filters.vintage', 'Vintage')}
                </span>
                <span class="rule"></span>
                {#if libraryFilters.vintageChanged}
                  <button
                    type="button"
                    class="reset"
                    onclick={() => libraryFilters.resetVintage()}
                  >
                    <span class="dot"></span>
                    Reset
                  </button>
                {/if}
              </div>

              <div class="track-host">
                <span class="track"></span>
                <span
                  class="fill"
                  style:left="{lowPct}%"
                  style:width="{highPct - lowPct}%"
                ></span>
                <input
                  class="rng"
                  type="range"
                  min={YEAR_MIN}
                  max={YEAR_MAX}
                  value={vintage[0]}
                  aria-label="Earliest year"
                  oninput={(event) =>
                    libraryFilters.setVintage(
                      0,
                      Number(event.currentTarget.value)
                    )}
                />
                <input
                  class="rng"
                  type="range"
                  min={YEAR_MIN}
                  max={YEAR_MAX}
                  value={vintage[1]}
                  aria-label="Latest year"
                  oninput={(event) =>
                    libraryFilters.setVintage(
                      1,
                      Number(event.currentTarget.value)
                    )}
                />
              </div>

              <div class="bounds">
                <input
                  class="num"
                  type="number"
                  min={YEAR_MIN}
                  max={YEAR_MAX}
                  value={vintage[0]}
                  aria-label="Earliest year, typed"
                  oninput={(event) =>
                    libraryFilters.setVintage(
                      0,
                      Number(event.currentTarget.value)
                    )}
                />
                <span class="dash">–</span>
                <input
                  class="num"
                  type="number"
                  min={YEAR_MIN}
                  max={YEAR_MAX}
                  value={vintage[1]}
                  aria-label="Latest year, typed"
                  oninput={(event) =>
                    libraryFilters.setVintage(
                      1,
                      Number(event.currentTarget.value)
                    )}
                />
              </div>
            </div>
          {/if}
        </div>
      {/each}
    </div>

    <p class="absent">
      You cannot filter by difficulty, genres or tags here. Use an algorithm
      block for those filters.
    </p>
  </div>
</Floating>

<style>
  .panel {
    padding: 12px 14px 10px;
  }

  .head {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-bottom: 10px;
    border-bottom: 1px solid var(--line);
  }

  .head h2 {
    margin: 0;
    font-family: var(--font-display);
    font-size: 13px;
    font-weight: 700;
  }

  .badge {
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    border-radius: 8px;
    background: var(--accent);
    color: var(--accent-fg);
    font-size: 9.5px;
    font-weight: 700;
    line-height: 16px;
    text-align: center;
  }

  .reset-all {
    margin-left: auto;
    height: 24px;
    padding: 0 9px;
    border-radius: 6px;
    background: transparent;
    border: 1px solid var(--line-soft);
    color: var(--text-3);
    font-family: inherit;
    font-size: 11px;
    cursor: pointer;
  }

  .close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    padding: 0;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: var(--text-4);
    cursor: pointer;
  }

  .close:hover {
    background: var(--bg-raised);
    color: var(--text);
  }

  .cols {
    display: flex;
    gap: 22px;
    padding-top: 10px;
  }

  .col {
    flex: 1 1 0;
    min-width: 0;
  }

  .group {
    padding: 8px 0;
  }

  .group-head {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 7px;
  }

  .group-title {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    color: var(--text-4);
    white-space: nowrap;
  }

  .rule {
    flex: 1 1 0;
    height: 1px;
    background: var(--line);
  }

  .reset {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    height: 20px;
    padding: 0 7px;
    border: 0;
    border-radius: 5px;
    background: transparent;
    color: var(--text-3);
    font-family: inherit;
    font-size: 10.5px;
    cursor: pointer;
  }

  .dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--accent);
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
  }

  .track-host {
    position: relative;
    height: 16px;
    margin: 6px 0 4px;
  }

  .track,
  .fill {
    position: absolute;
    top: 6px;
    height: 4px;
    border-radius: 2px;
  }

  .track {
    left: 0;
    width: 100%;
    background: var(--bg-sunken);
  }

  .fill {
    background: var(--accent);
  }

  /*
   * Both inputs overlay one track. They have `pointer-events: none` and only
   * the thumbs accept the pointer, so a click on the track cannot move the
   * wrong handle.
   */
  .rng {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 16px;
    margin: 0;
    background: transparent;
    appearance: none;
    pointer-events: none;
  }

  .rng::-webkit-slider-thumb {
    appearance: none;
    width: 12px;
    height: 12px;
    border: 2px solid var(--bg-pop);
    border-radius: 50%;
    background: var(--accent-soft);
    cursor: pointer;
    pointer-events: auto;
  }

  .rng::-moz-range-thumb {
    width: 12px;
    height: 12px;
    border: 2px solid var(--bg-pop);
    border-radius: 50%;
    background: var(--accent-soft);
    cursor: pointer;
    pointer-events: auto;
  }

  .bounds {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .num {
    width: 72px;
    height: 26px;
    padding: 0 8px;
    border-radius: 6px;
    background: var(--bg-sunken);
    border: 1px solid var(--line-strong);
    color: var(--text);
    font-family: var(--font-mono);
    font-size: 11.5px;
  }

  .dash {
    color: var(--text-5);
  }

  .absent {
    margin: 10px 0 0;
    padding-top: 9px;
    border-top: 1px solid var(--line);
    font-size: 10.5px;
    color: var(--text-5);
  }
</style>
