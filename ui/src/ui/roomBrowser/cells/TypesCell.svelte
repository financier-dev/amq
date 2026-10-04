<!--
  Song types as OP / ED / IN chips. An enabled type is filled; a disabled one
  keeps its slot as a dashed outline, so the three positions stay comparable
  down the column instead of shifting when a room drops a type.
-->
<script lang="ts">
  import type { SongTypes } from '../../../amq/derive'
  import { t } from '../../../amq/derive'
  import Tooltip from '../../common/Tooltip.svelte'

  interface Props {
    types: SongTypes
  }

  let { types }: Props = $props()

  const entries = $derived([
    {
      key: 'openings' as const,
      short: 'OP',
      label: t('room_browser.room_tile.song_types.opening', 'Openings'),
    },
    {
      key: 'endings' as const,
      short: 'ED',
      label: t('room_browser.room_tile.song_types.ending', 'Endings'),
    },
    {
      key: 'inserts' as const,
      short: 'IN',
      label: t('room_browser.room_tile.song_types.insert', 'Inserts'),
    },
  ])
</script>

<div class="cell">
  {#each entries as entry (entry.key)}
    <Tooltip
      text="{entry.label} — {types[entry.key] ? 'played' : 'not played'}"
    >
      <span class="type" class:on={types[entry.key]}>
        <span class="glyph">{entry.short}</span>
      </span>
    </Tooltip>
  {/each}
</div>

<style>
  .cell {
    display: flex;
    gap: 4px;
    flex: 0 0 var(--col-types);
  }

  .type {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 22px;
    border-radius: 4px;
    font-family: var(--font-mono);
    font-size: 12px;
    font-weight: 600;
    background: transparent;
    border: 1px dashed rgba(255, 255, 255, 0.12);
    color: #545d6b;
  }

  /*
   * These labels are all capitals, so their ink stops at the baseline while the
   * line box still reserves room for descenders — centring the box therefore
   * leaves the letters sitting high. Measured against the rendered pixels at
   * 12px IBM Plex Mono: 5.4px of space above the glyphs and 7.9px below. One
   * pixel down splits the difference and stays on the pixel grid, which a
   * fractional transform would not.
   */
  .glyph {
    position: relative;
    top: 1px;
  }

  .type.on {
    background: rgba(91, 155, 245, 0.22);
    border: 1px solid rgba(91, 155, 245, 0.45);
    color: #9cc4f9;
  }
</style>
