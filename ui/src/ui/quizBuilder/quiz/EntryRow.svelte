<!--
  One anime or song entry, 34px, fixed columns (SPEC §5.4).

  The column widths are tokens in `app.css`, not literals here. This table is
  why badges line up all the way down a list that mixes anime rules and single
  songs, and the room browser already learned the hard way that a cell sized to
  its content silently knocks every column after it out of step: a flex item's
  `min-width: auto` raises it to min-content. Every fixed cell is therefore
  `flex: 0 0 <token>` with `min-width: 0`, and only the song column flexes.
-->
<script lang="ts">
  import { t } from '../../../amq/derive'
  import { describeAnime, describeSong } from '../../../amq/library.svelte'
  import type { AnimeEntry, SongEntry } from '../../../amq/quizModel'
  import Icon from '../../common/Icon.svelte'
  import Tooltip from '../../common/Tooltip.svelte'
  import { overrideChips } from '../overrides'
  import ChainGutter from './ChainGutter.svelte'
  import PickCount from './PickCount.svelte'

  interface Props {
    entry: AnimeEntry | SongEntry
    pool: number
    selected: boolean
    canChainUp: boolean
    chainedUp: boolean
    chainedDown: boolean
    onSelect: (event: MouseEvent) => void
    onToggleChain: () => void
    onToggleType: (type: 'op' | 'ed' | 'in') => void
    onPick: (value: number) => void
    onToggleLock: () => void
    onSettings: () => void
    onMenu: (anchor: HTMLElement) => void
    onDragStart: () => void
    onDragEnd: () => void
  }

  let {
    entry,
    pool,
    selected,
    canChainUp,
    chainedUp,
    chainedDown,
    onSelect,
    onToggleChain,
    onToggleType,
    onPick,
    onToggleLock,
    onSettings,
    onMenu,
    onDragStart,
    onDragEnd,
  }: Props = $props()

  const anime = $derived(
    entry.kind === 'anime'
      ? describeAnime(entry.annId)
      : describeSong(entry.annSongId)
  )
  const song = $derived(
    entry.kind === 'song' ? describeSong(entry.annSongId) : null
  )
  const animeName = $derived(
    entry.kind === 'anime'
      ? (anime as ReturnType<typeof describeAnime>).name
      : (song?.animeName ?? '')
  )

  // Counts come from the cache, never from the entry — they are what the
  // library holds today, not what it held when the quiz was saved.
  const counts = $derived(
    entry.kind === 'anime'
      ? describeAnime(entry.annId)
      : { opCount: 0, edCount: 0, insCount: 0 }
  )

  const chips = $derived(overrideChips(entry.overrides))

  const TYPES = [
    {
      key: 'op' as const,
      i18n: 'quiz_builder.algorithm_block.song_type.opening',
      fallback: 'OP',
    },
    {
      key: 'ed' as const,
      i18n: 'quiz_builder.algorithm_block.song_type.ending',
      fallback: 'ED',
    },
    {
      key: 'in' as const,
      i18n: 'quiz_builder.algorithm_block.song_type.insert',
      fallback: 'IN',
    },
  ]

  function typeCount(key: 'op' | 'ed' | 'in') {
    if (key === 'op') return counts.opCount
    if (key === 'ed') return counts.edCount
    return counts.insCount
  }

  let menuButton = $state<HTMLButtonElement | null>(null)

  /**
   * Whether the row may start a drag right now.
   *
   * The whole row is draggable, which is the right target for a 34px row — but
   * an HTML5 drag started on a child still drags the parent, so pressing the
   * pick slider dragged the row instead of moving the handle.
   *
   * The attribute is set **imperatively** rather than bound to state: it is
   * read when `dragstart` fires, and a reactive update is flushed
   * asynchronously, so binding it leaves a window in which the press has
   * happened and the attribute still says the old thing.
   */
  function onPointerDown(event: PointerEvent) {
    const row = event.currentTarget as HTMLElement
    const target = event.target as HTMLElement | null
    row.draggable = !target?.closest('input, button, label, .pick')
  }

  function armDrag(event: Event) {
    ;(event.currentTarget as HTMLElement).draggable = true
  }
</script>

<!--
  The whole row is the drag handle, not just the grip — the grip is the
  affordance, but a 11px target is a poor one, and dragging a row by its body is
  what people try first.
-->
<div
  class="row"
  class:selected
  class:unknown={!anime.known}
  draggable="true"
  onpointerdown={onPointerDown}
  onpointerup={armDrag}
  ondragstart={(event) => {
    // Firefox refuses to start a drag without data on the transfer.
    event.dataTransfer?.setData('text/plain', entry.id)
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
    onDragStart()
  }}
  ondragend={(event) => {
    armDrag(event)
    onDragEnd()
  }}
  role="presentation"
>
  <ChainGutter
    {canChainUp}
    {chainedUp}
    {chainedDown}
    onToggle={onToggleChain}
    label={t(
      'quiz_builder.rule_labels.connect_description',
      'Connect these blocks, making them always appear next to each other in the quiz'
    )}
  />

  <span class="grip" aria-hidden="true">
    <!-- Six dots: the conventional "drag me" without a label to translate. -->
    <svg width="8" height="14" viewBox="0 0 7 12" fill="currentColor">
      <circle cx="1.5" cy="2" r="1" /><circle cx="5.5" cy="2" r="1" />
      <circle cx="1.5" cy="6" r="1" /><circle cx="5.5" cy="6" r="1" />
      <circle cx="1.5" cy="10" r="1" /><circle cx="5.5" cy="10" r="1" />
    </svg>
  </span>

  <label class="check">
    <input
      type="checkbox"
      checked={selected}
      onclick={(event) => onSelect(event as unknown as MouseEvent)}
    />
    <span class="sr-only">Select {animeName}</span>
  </label>

  <span class="anime" title={animeName}>{animeName}</span>

  <div class="types">
    {#if entry.kind === 'anime'}
      {#each TYPES as type (type.key)}
        <button
          type="button"
          class="type"
          class:on={entry.includeSongTypes[type.key]}
          aria-pressed={entry.includeSongTypes[type.key]}
          onclick={() => onToggleType(type.key)}
        >
          {t(type.i18n, type.fallback)}
          <span class="n">{typeCount(type.key)}</span>
        </button>
      {/each}
    {:else if song}
      <span class="badge">{song.badge}</span>
    {/if}
  </div>

  <div class="song">
    {#if song}
      <span class="title" title={song.title}>{song.title}</span>
      <span class="artist" title={song.artist}>{song.artist}</span>
    {/if}
  </div>

  {#if entry.kind === 'anime'}
    <PickCount
      value={entry.numberOfSongs}
      {pool}
      onChange={onPick}
      label={t(
        'quiz_builder.anime_block.number_of_songs_selected.description',
        'Number of Songs Selected from this Anime Block'
      )}
    />
  {:else}
    <span class="pick-spacer" aria-hidden="true"></span>
  {/if}

  <div class="overrides">
    {#each chips as chip (chip.key)}
      <Tooltip text={chip.tooltip}>
        <button
          type="button"
          class="chip"
          class:readonly={chip.readOnly}
          onclick={onSettings}
        >
          {chip.label}
        </button>
      </Tooltip>
    {/each}
  </div>

  <div class="actions">
    <button
      type="button"
      class="act settings"
      aria-label="Entry settings"
      title="Entry settings"
      onclick={onSettings}
    >
      <Icon name="sliders" size={16} />
    </button>
    <button
      type="button"
      class="act lock"
      class:on={entry.locked}
      aria-pressed={entry.locked}
      aria-label="Keep this entry's position when the block is shuffled"
      title="Keep this entry's position when the block is shuffled"
      onclick={onToggleLock}
    >
      <Icon name="lock" size={16} />
    </button>
    <button
      bind:this={menuButton}
      type="button"
      class="act menu"
      aria-label="More actions"
      title="More actions"
      onclick={() => menuButton && onMenu(menuButton)}
    >
      ⋯
    </button>
  </div>
</div>

<style>
  .row {
    display: flex;
    align-items: center;
    gap: var(--qb-row-gap);
    height: var(--qb-entry-h);
    padding: 0 12px 0 var(--qb-row-pad-left);
    position: relative;
  }

  .row:hover {
    background: rgba(255, 255, 255, 0.04);
  }

  /* The inset bar reads as "selected" without tinting the text under it. */
  .row.selected {
    background: rgba(91, 155, 245, 0.13);
    box-shadow: inset 3px 0 0 var(--accent);
  }

  /* An entry whose anime is not in the cache still renders — see library.svelte.ts. */
  .row.unknown .anime {
    color: var(--text-5);
    font-style: italic;
  }

  .grip {
    flex: 0 0 var(--qb-grip);
    display: flex;
    align-items: center;
    color: var(--text-5);
    cursor: grab;
  }

  .check {
    flex: 0 0 var(--qb-check);
    display: flex;
    align-items: center;
  }

  .check input {
    width: var(--qb-check);
    height: var(--qb-check);
    margin: 0;
    accent-color: var(--accent);
    cursor: pointer;
  }

  /* Both text columns flex and share the slack — see `--qb-anime-min`. */
  .anime {
    flex: 1 1 0;
    min-width: var(--qb-anime-min);
    font-size: var(--qb-text);
    font-weight: 500;
    color: var(--text-2);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .types {
    flex: 0 0 var(--qb-types);
    min-width: var(--qb-types);
    display: flex;
    align-items: center;
    gap: 4px;
  }

  /* Off is dashed and unfilled: the type exists but contributes nothing. */
  .type {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    height: 24px;
    padding: 0 8px;
    border-radius: 5px;
    background: transparent;
    border: 1px dashed var(--chip-off-line);
    color: var(--chip-off-fg);
    font-family: var(--font-mono);
    font-size: var(--qb-badge);
    font-weight: 600;
    cursor: pointer;
  }

  .type.on {
    background: var(--chip-blue-bg);
    border: 1px solid var(--chip-blue-line);
    color: var(--blue-fg);
  }

  .type .n {
    opacity: 0.75;
  }

  .badge {
    display: inline-flex;
    align-items: center;
    height: 24px;
    padding: 0 9px;
    border-radius: 5px;
    background: var(--chip-teal-bg);
    border: 1px solid var(--chip-teal-line);
    color: var(--teal-fg);
    font-family: var(--font-mono);
    font-size: var(--qb-badge);
    font-weight: 600;
  }

  /*
   * Two lines of text inside a 34px row. The line heights are tight on purpose;
   * anything looser pushes the artist's descenders past the row edge.
   */
  .song {
    flex: 1 1 0;
    min-width: var(--qb-song-min);
    display: flex;
    flex-direction: column;
    justify-content: center;
    line-height: 1.15;
  }

  .title,
  .artist {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .title {
    font-size: var(--qb-text-sm);
    font-weight: 500;
    color: var(--text);
  }

  .artist {
    font-size: var(--qb-text-xs);
    color: var(--text-4);
  }

  /* Keeps a song row's later columns in step with an anime row's. */
  .pick-spacer {
    flex: 0 0 var(--qb-pick);
  }

  .overrides {
    flex: 0 0 var(--qb-overrides);
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 4px;
    overflow: hidden;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    height: 22px;
    padding: 0 8px;
    border-radius: 5px;
    background: var(--chip-amber-bg);
    border: 1px solid var(--chip-amber-line);
    color: var(--amber-fg);
    font-family: var(--font-mono);
    font-size: var(--qb-text-xs);
    font-weight: 600;
    white-space: nowrap;
    cursor: pointer;
  }

  /* A random range has no editor; the panel it opens is read-only. */
  .chip.readonly {
    border-style: dashed;
  }

  .actions {
    flex: 0 0 var(--qb-actions);
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 3px;
  }

  .act {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    padding: 0;
    border: 1px solid transparent;
    border-radius: 6px;
    background: transparent;
    color: var(--text-4);
    font-size: 16px;
    line-height: 1;
    cursor: pointer;
  }

  .act:hover {
    background: var(--bg-raised);
    color: var(--text);
  }

  .act.lock.on {
    background: rgba(91, 155, 245, 0.2);
    border-color: rgba(91, 155, 245, 0.45);
    color: var(--accent-soft);
  }
</style>
