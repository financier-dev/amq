<!--
  One room row.

  Every column has a fixed width except Room/Host, which flexes. The columns
  must align down the list.
-->
<script lang="ts">
  import {
    avatarImage,
    chipsFor,
    modeLabel,
    modeTone,
    openProfile,
    rangeLabel,
    songSelectionLabel,
    songSelectionTone,
    t,
  } from '../../amq/derive'
  import type { Room } from '../../amq/rooms.svelte'
  import ChipsCell from './cells/ChipsCell.svelte'
  import DifficultyCell from './cells/DifficultyCell.svelte'
  import Icon from '../common/Icon.svelte'
  import PlayersCell from './cells/PlayersCell.svelte'
  import SongsCell from './cells/SongsCell.svelte'
  import Tooltip from '../common/Tooltip.svelte'
  import TypesCell from './cells/TypesCell.svelte'

  interface Props {
    room: Room
    zebra: boolean
    onJoin: (room: Room) => void
    onSpectate: (room: Room) => void
    onSettings: (room: Room) => void
  }

  let { room, zebra, onJoin, onSpectate, onSettings }: Props = $props()

  const full = $derived(room.playerCount >= room.roomSize)
  const locked = $derived(full || !room.inLobby)
  const avatar = $derived(avatarImage(room.hostAvatar))
  const chips = $derived(chipsFor(room.settings))
  const guess = $derived(room.guessTime)

  // Some avatars and outfits have no head crop. The fallback is the full
  // render, positioned on the face with `object-position` (SPEC §3).
  let headFailed = $state(false)

  const joinLabel = $derived(
    !room.inLobby
      ? t('room_browser.room_tile.playing', 'Playing')
      : full
        ? t('room_browser.room_tile.full', 'Full')
        : t('room_browser.room_tile.join', 'Join')
  )
</script>

<div class="row" class:zebra>
  <div class="id mono">{room.id}</div>

  <div class="identity">
    <div class="avatar">
      {#if avatar}
        <img
          src={headFailed ? avatar.fallbackSrc : avatar.src}
          srcset={headFailed ? undefined : avatar.srcset}
          sizes="30px"
          alt=""
          style:object-position={headFailed
            ? avatar.fallbackPosition
            : '50% 50%'}
          onerror={() => (headFailed = true)}
        />
      {/if}
    </div>
    <div class="names">
      <div class="name-line">
        <span class="name">{room.name}</span>
        {#if room.isPrivate}
          <span
            class="lock"
            title={t('room_browser.room_tile.private', 'Private room')}
          >
            <Icon name="lock" size={10} strokeWidth={2.6} />
          </span>
        {/if}
      </div>
      <button
        type="button"
        class="host"
        onclick={(event) => openProfile(event.currentTarget, room.host)}
      >
        {room.host}
      </button>
    </div>
  </div>

  <div class="mode-cell">
    <span class="pill tone-{modeTone(room.mode)}">{modeLabel(room.mode)}</span>
  </div>

  <div class="selection-cell">
    <span class="sel tone-{songSelectionTone(room.songSelection)}">
      {songSelectionLabel(room.songSelection)}
    </span>
  </div>

  <TypesCell types={room.songTypes} />

  <PlayersCell {room} />
  <SongsCell {room} />

  <div class="time">
    {#if guess.range}
      <span class="time-base mono">{rangeLabel(guess.range)}s</span>
      {#if guess.extra}
        <span class="time-extra mono">+ {rangeLabel(guess.extra)}s</span>
      {/if}
    {:else}
      <span class="time-base mono">—</span>
    {/if}
  </div>

  <DifficultyCell {room} />
  <ChipsCell {chips} />

  <div class="actions">
    <Tooltip
      text={t('room_browser.room_tile.popovers.all_settings', 'All settings')}
    >
      <button
        type="button"
        class="settings"
        aria-label={t(
          'room_browser.room_tile.popovers.all_settings',
          'All settings'
        )}
        onclick={() => onSettings(room)}
      >
        <Icon name="sliders" size={15} />
      </button>
    </Tooltip>
    <button
      type="button"
      class="join"
      class:locked
      disabled={locked}
      onclick={() => onJoin(room)}
    >
      {joinLabel}
    </button>
    <button type="button" class="spec" onclick={() => onSpectate(room)}>
      {t('room_browser.room_tile.spectate', 'Spectate')}
    </button>
  </div>
</div>

<style>
  .row {
    display: flex;
    align-items: center;
    gap: var(--col-gap);
    height: 56px;
    padding: 0 var(--row-pad);
    border-bottom: 1px solid var(--line);
    background: transparent;
  }

  .row.zebra {
    background: var(--bg-row);
  }

  .row:hover {
    background: var(--bg-row-hover);
  }

  /* Each fixed column is `flex: 0 0 <token>` so it matches the header. */
  .id {
    flex: 0 0 var(--col-id);
    font-size: 13px;
    color: var(--text-5);
  }

  .identity {
    flex: 0 0 var(--col-identity);
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 9px;
  }

  .avatar {
    width: 36px;
    height: 36px;
    flex-shrink: 0;
    border-radius: 50%;
    background: #343a47;
    border: 1px solid rgba(255, 255, 255, 0.18);
    overflow: hidden;
  }

  .avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .names {
    min-width: 0;
  }

  .name-line {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .name {
    font-size: 15px;
    font-weight: 600;
    color: #ffffff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .lock {
    display: inline-flex;
    color: var(--rose);
    flex-shrink: 0;
  }

  .host {
    display: block;
    max-width: 100%;
    padding: 0;
    background: none;
    border: 0;
    text-align: left;
    cursor: pointer;
    font-size: 13px;
    color: var(--text-4);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .host:hover {
    color: var(--text-2);
    text-decoration: underline;
  }

  .mode-cell {
    flex: 0 0 var(--col-mode);
    min-width: 0;
  }

  /* The cell fits "Last Man Standing", the longest label AMQ ships. A longer
     label gets an ellipsis. */
  .pill {
    display: inline-flex;
    align-items: center;
    max-width: 100%;
    height: 22px;
    padding: 0 9px;
    border-radius: 5px;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.03em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    background: var(--pill-bg);
    color: var(--pill-fg);
  }

  .tone-blue {
    --pill-bg: rgba(91, 155, 245, 0.15);
    --pill-fg: var(--blue-fg);
    --sel-bg: var(--chip-blue-bg);
    --sel-line: rgba(91, 155, 245, 0.3);
    --sel-fg: var(--blue-fg);
  }
  .tone-teal {
    --pill-bg: rgba(52, 201, 163, 0.15);
    --pill-fg: var(--teal-fg);
    --sel-bg: rgba(52, 201, 163, 0.15);
    --sel-line: var(--chip-teal-line);
    --sel-fg: var(--teal-fg);
  }
  .tone-amber {
    --pill-bg: rgba(232, 163, 61, 0.15);
    --pill-fg: var(--amber-fg);
    --sel-bg: var(--chip-amber-bg);
    --sel-line: var(--chip-amber-line);
    --sel-fg: var(--amber-fg);
  }
  .tone-rose {
    --pill-bg: rgba(229, 101, 138, 0.15);
    --pill-fg: var(--rose-fg);
  }
  .tone-cyan {
    --pill-bg: rgba(63, 185, 214, 0.16);
    --pill-fg: var(--cyan-fg);
  }
  .tone-violet {
    --pill-bg: rgba(155, 124, 245, 0.15);
    --pill-fg: var(--violet-fg);
    --sel-bg: rgba(155, 124, 245, 0.14);
    --sel-line: rgba(155, 124, 245, 0.34);
    --sel-fg: var(--violet-fg);
  }

  .time {
    flex: 0 0 var(--col-time);
    display: flex;
    align-items: baseline;
    justify-content: flex-end;
    gap: 4px;
  }

  .time-base {
    font-size: 14px;
    color: var(--text-2);
  }

  /* Extra time is secondary, so it is smaller and dimmer. */
  .time-extra {
    font-size: 12px;
    color: var(--text-4);
    white-space: nowrap;
  }

  .selection-cell {
    flex: 0 0 var(--col-selection);
  }

  .sel {
    display: inline-flex;
    align-items: center;
    height: 22px;
    padding: 0 10px;
    border-radius: 4px;
    font-size: 13px;
    font-weight: 600;
    white-space: nowrap;
    background: var(--sel-bg);
    border: 1px solid var(--sel-line);
    color: var(--sel-fg);
  }

  .actions {
    flex: 0 0 var(--col-action);
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 6px;
  }

  .settings,
  .join,
  .spec {
    height: 30px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
  }

  /*
   * Fixed widths that fit the longest labels, "Spectate" and "Playing". With
   * content sizing, the buttons move sideways when a room starts or ends a
   * game.
   */
  .join,
  .spec {
    flex: 0 0 78px;
    padding: 0;
    text-align: center;
  }

  .settings {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 30px;
    padding: 0;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: var(--text-3);
  }

  .settings:hover {
    background: rgba(255, 255, 255, 0.13);
    color: var(--text);
  }

  .join {
    background: var(--accent);
    border: 0;
    color: var(--accent-fg);
    font-weight: 700;
  }

  .join.locked {
    background: rgba(255, 255, 255, 0.035);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: var(--text-5);
    cursor: not-allowed;
  }

  .spec {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: var(--text-2);
  }

  .spec:hover {
    background: rgba(255, 255, 255, 0.11);
  }
</style>
