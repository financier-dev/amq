<script lang="ts" module>
  /**
   * Text widths in the chip font, cached by label. All rows share one canvas
   * context, because creating one per row is expensive.
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
    // Without a canvas, estimate the width per character.
    const value = context
      ? context.measureText(label).width
      : label.length * 5.5
    widths.set(label, value)
    return value
  }
</script>

<!--
  Modifiers · genres · tags, fitted to the column.

  The chips are measured and packed. Those that do not fit collapse into a
  `+N` chip whose tooltip lists them (SPEC §3). A setting at its default
  renders nothing.

  Widths are measured on a canvas, not with hidden copies of the chips, which
  would double the DOM of a list that can have 75 rows. A ResizeObserver on
  the cell re-fits the chips when the viewport width changes (SPEC §8).
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
  const CHIP_PADDING = 18 // 8px padding and 1px border on each side
  const OVERFLOW_RESERVE = 38 // width kept free for the `+N` chip
  /** Two 22px chips and the 4px gap. See the `.cell` height below. */
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
    // Pack with the full width first. Reserve space for the `+N` chip only if
    // something overflows; otherwise the reserve would drop a chip that fits.
    const full = pack(chips, width, width)
    return full.hidden.length
      ? pack(chips, width, width - OVERFLOW_RESERVE)
      : full
  })

  /**
   * Fills up to `MAX_LINES` lines, left to right. `lastLineBudget` is the
   * width of the last line, which is narrower when it also holds the `+N`
   * chip.
   */
  function pack(list: ChipData[], budget: number, lastLineBudget: number) {
    const shown: ChipData[] = []
    const hidden: ChipData[] = []
    const budgetFor = (line: number) =>
      line === MAX_LINES - 1 ? lastLineBudget : budget
    let line = 0
    let used = 0

    for (const chip of list) {
      // After the first hidden chip, hide all the rest. The visible chips and
      // the tooltip then keep the same order.
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
   * Two lines of chips, centred in the 56px row: two 22px chips and the 4px
   * gap make 48px.
   */
  .cell {
    display: flex;
    flex-wrap: wrap;
    align-content: center;
    gap: 4px;
    height: 48px;
    /* Same as `.col.grow` in ColumnHeader. See the comment there. */
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
