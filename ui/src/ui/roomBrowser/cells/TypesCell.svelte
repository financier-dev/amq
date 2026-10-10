<!--
  Song types as OP / ED / IN chips. An enabled type is filled. A disabled type
  keeps its slot as a dashed outline, so the three positions stay aligned down
  the column.
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
   * The labels are all capitals, so nothing goes below the baseline, but the
   * line box still reserves room for descenders. Centring the box leaves the
   * letters too high: at 12px IBM Plex Mono there is 5.4px above the glyphs
   * and 7.9px below. A 1px shift evens that out and stays on the pixel grid.
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
