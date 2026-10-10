<!--
  A small tinted chip in the Modifiers · genres · tags column.

  The colour family has a meaning (SPEC §3): teal is where songs come from,
  amber is a modifier, violet is an anime filter, rose excludes, blue is a
  play rule. Every chip also has a tooltip that spells out its abbreviation,
  so colour is never the only signal.
-->
<script lang="ts">
  import type { ChipTone } from '../../amq/derive'
  import Tooltip from './Tooltip.svelte'

  interface Props {
    label: string
    tone: ChipTone
    tooltip: string
    dashed?: boolean
  }

  let { label, tone, tooltip, dashed = false }: Props = $props()
</script>

<Tooltip text={tooltip}>
  <span class="chip tone-{tone}" class:dashed>{label}</span>
</Tooltip>

<style>
  .chip {
    display: inline-flex;
    align-items: center;
    height: 22px;
    padding: 0 8px;
    border-radius: 4px;
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 500;
    white-space: nowrap;
    background: var(--chip-bg);
    border: 1px solid var(--chip-line);
    color: var(--chip-fg);
  }

  /* A dashed border marks an optional genre or tag. */
  .dashed {
    background: transparent;
    border-style: dashed;
  }

  .tone-teal {
    --chip-bg: var(--chip-teal-bg);
    --chip-line: var(--chip-teal-line);
    --chip-fg: var(--teal-fg);
  }
  .tone-amber {
    --chip-bg: var(--chip-amber-bg);
    --chip-line: var(--chip-amber-line);
    --chip-fg: var(--amber-fg);
  }
  .tone-violet {
    --chip-bg: var(--chip-violet-bg);
    --chip-line: var(--chip-violet-line);
    --chip-fg: var(--violet-fg);
  }
  .tone-rose {
    --chip-bg: var(--chip-rose-bg);
    --chip-line: var(--chip-rose-line);
    --chip-fg: var(--rose-fg);
  }
  .tone-blue {
    --chip-bg: var(--chip-blue-bg);
    --chip-line: var(--chip-blue-line);
    --chip-fg: var(--blue-fg);
  }
  .tone-off {
    --chip-bg: var(--chip-off-bg);
    --chip-line: var(--chip-off-line);
    --chip-fg: var(--chip-off-fg);
  }
</style>
