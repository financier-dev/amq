<!--
  Songs. In lobby: the total and a dim caption. Playing: a progress bar and
  `27 / 45`.

  The progress fill is neutral, not amber. Amber reads as a warning, and a
  game in progress is not one (SPEC §3).
-->
<script lang="ts">
  import type { Room } from '../../../amq/rooms.svelte'
  import Icon from '../../common/Icon.svelte'
  import { t } from '../../../amq/derive'

  interface Props {
    room: Room
  }

  let { room }: Props = $props()

  // `songsLeft` counts down. The cell shows the songs already played.
  const played = $derived(Math.max(0, room.songCount - room.songsLeft))
  const pct = $derived(
    room.songCount > 0 ? Math.round((played / room.songCount) * 100) : 0
  )
</script>

<div class="cell">
  {#if room.inLobby}
    <div class="total mono">{room.songCount}</div>
    <div class="caption">
      {t('room_browser.room_tile.in_lobby', 'in lobby')}
    </div>
  {:else}
    <div class="bar">
      <div class="fill" style:width="{pct}%"></div>
    </div>
    <div class="progress mono">
      <Icon name="play" size={9} />
      {played} / {room.songCount}
    </div>
  {/if}
</div>

<style>
  .cell {
    flex: 0 0 var(--col-songs);
  }

  .total {
    font-size: 14px;
    color: var(--text-2);
  }

  .caption {
    margin-top: 2px;
    font-size: 12px;
    color: var(--text-5);
  }

  .bar {
    height: 5px;
    border-radius: 3px;
    background: rgba(255, 255, 255, 0.1);
    overflow: hidden;
  }

  .fill {
    height: 5px;
    background: rgba(255, 255, 255, 0.52);
  }

  .progress {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-top: 4px;
    font-size: 12px;
    color: #a3acbb;
    white-space: nowrap;
  }
</style>
