<script lang="ts" module>
  /**
   * Text width for the chip font, cached by label. One canvas for the whole
   * list; `measureText` is cheap but a fresh 2d context per row is not.
   */
  const widths = new Map<string, number>()
  let context: CanvasRenderingContext2D | null = null

  function measure(label: string) {
    const cached = widths.get(label)
    if (cached !== undefined) return cached
    if (!context) {
      context = document.createElement('canvas').getContext('2d')
      if (context) {
        context.font = "500 11px 'IBM Plex Mono', ui-monospace, monospace"
      }
    }
    // Without a canvas, fall back to a per-character estimate rather than
    // dropping every chip.
    const value = context
      ? context.measureText(label).width
      : label.length * 5.5
    widths.set(label, value)
    return value
  }
</script>

<!--
  Modifiers · genres · tags, fitted to the column.

  The chips are measured and packed; whatever is left over collapses into a
  `+N` chip whose tooltip lists what's hidden (SPEC §3). An empty cell means a
  vanilla room, which is itself information — so nothing is rendered for a
  setting that is at its default.

  Measurement is done with a canvas rather than a shadow copy of the chips in
  the DOM: the list can hold 75 rows, and doubling every chip to measure it
  would double the tree. A ResizeObserver on the cell keeps the fit correct as
  the viewport widens, which it does — the mocks are 1440px and the real one is
  wider (SPEC §8).
-->
<script lang="ts">
  import type { Chip as ChipData } from '../../../amq/derive'
  import Chip from '../../common/Chip.svelte'
  import Tooltip from '../../common/Tooltip.svelte'

  interface Props {
    chips: ChipData[]
  }

  let { chips }: Props = $props()

  const GAP = 4
  const CHIP_PADDING = 18 // 8px each side + 1px border each side
  const OVERFLOW_RESERVE = 38 // room for the widest plausible `+N`
  /** Two 22px chips plus the 4px gap — see `.cell` height below. */
  const MAX_LINES = 2

  let cell = $state<HTMLDivElement | null>(null)
  let width = $state(0)

  $effect(() => {
    const element = cell
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      width = entry.contentRect.width
    })
    observer.observe(element)
    width = element.clientWidth
    return () => observer.disconnect()
  })

  const fitted = $derived.by(() => {
    if (!width || !chips.length) {
      return { shown: chips, hidden: [] as ChipData[] }
    }
    // Pack once with the full width. If everything fits there is no `+N` chip
    // to make room for, so reserving space for one would drop a chip that had
    // room. Only when something overflows is the pack redone with the reserve.
    const full = pack(chips, width, width)
    return full.hidden.length
      ? pack(chips, width, width - OVERFLOW_RESERVE)
      : full
  })

  /**
   * Fills up to `MAX_LINES` lines, left to right.
   *
   * `lastLineBudget` is narrower than the rest only when something overflowed,
   * because that is the only case where a `+N` has to share the final line.
   */
  function pack(list: ChipData[], budget: number, lastLineBudget: number) {
    const shown: ChipData[] = []
    const hidden: ChipData[] = []
    const budgetFor = (line: number) =>
      line === MAX_LINES - 1 ? lastLineBudget : budget
    let line = 0
    let used = 0

    for (const chip of list) {
      // Once anything has overflowed, everything after it does too — otherwise
      // the order in the cell would stop matching the order in the tooltip.
      if (hidden.length) {
        hidden.push(chip)
        continue
      }
      const chipWidth = measure(chip.label) + CHIP_PADDING
      const needed = used ? used + GAP + chipWidth : chipWidth
      if (needed <= budgetFor(line)) {
        shown.push(chip)
        used = needed
        continue
      }
      if (line + 1 < MAX_LINES && chipWidth <= budgetFor(line + 1)) {
        line += 1
        used = chipWidth
        shown.push(chip)
        continue
      }
      hidden.push(chip)
    }
    return { shown, hidden }
  }

  const overflowTooltip = $derived(
    `Also on this room: ${fitted.hidden.map((chip) => chip.label).join(', ')}`
  )
</script>

<div class="cell" bind:this={cell}>
  {#each fitted.shown as chip (chip.id)}
    <Chip
      label={chip.label}
      tone={chip.tone}
      tooltip={chip.tooltip}
      dashed={chip.dashed}
    />
  {/each}
  {#if fitted.hidden.length}
    <Tooltip text={overflowTooltip} wide>
      <span class="more">+{fitted.hidden.length}</span>
    </Tooltip>
  {/if}
</div>

<style>
  /*
   * Two lines of chips, centred in the row without changing its height: two
   * 22px chips plus the 4px gap is 48px, inside a 56px row.
   */
  .cell {
    display: flex;
    flex-wrap: wrap;
    align-content: center;
    gap: 4px;
    height: 48px;
    /* Matches `.col.grow` in ColumnHeader — see the note there. */
    flex: 1 1 0;
    min-width: var(--col-chips);
    overflow: hidden;
  }

  .more {
    display: inline-flex;
    align-items: center;
    height: 22px;
    padding: 0 8px;
    border-radius: 4px;
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 500;
    white-space: nowrap;
    background: var(--chip-off-bg);
    border: 1px solid var(--chip-off-line);
    color: var(--chip-off-fg);
  }
</style>
