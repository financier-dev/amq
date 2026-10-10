<!--
  An algorithm, message or title block nested in a rule block (SPEC §5.3).

  It is indented 14px behind a 2px rail in the rule block's colour, which
  shows the rule block it belongs to. These rows have no anime, song or pick
  count, so they do not use the fixed-column entry layout.

  The algorithm block's settings button opens **AMQ's own dialog**. Only the
  summary line and the chips are ours.
-->
<script lang="ts">
  import { t } from '../../../amq/derive'
  import type {
    AlgorithmEntry,
    MessageEntry,
    TitleEntry,
  } from '../../../amq/quizModel'
  import Icon from '../../common/Icon.svelte'
  import Tooltip from '../../common/Tooltip.svelte'
  import { algorithmChips } from '../algorithmSummary'
  import type { Tone } from '../rows'

  interface Props {
    entry: AlgorithmEntry | MessageEntry | TitleEntry
    tone: Tone
    selected: boolean
    onSelect: (event: MouseEvent) => void
    onSettings: () => void
    onDuplicate: () => void
    onMenu: (anchor: HTMLElement) => void
  }

  let {
    entry,
    tone,
    selected,
    onSelect,
    onSettings,
    onDuplicate,
    onMenu,
  }: Props = $props()

  const isAlgorithm = $derived(entry.kind === 'algorithm')

  const badge = $derived(
    entry.kind === 'algorithm'
      ? t('quiz_builder.algorithm_button.title', 'Algorithm Block')
      : entry.kind === 'message'
        ? t('quiz_builder.message_button.title', 'Message Block')
        : t('quiz_builder.title_button.title', 'Title Block')
  )

  const chips = $derived(
    entry.kind === 'algorithm' ? algorithmChips(entry.settings) : []
  )

  /**
   * "N matching songs · M chosen". The server sends the match count
   * asynchronously. Until it arrives, the line says the count is pending; it
   * does not show zero.
   */
  const matchLine = $derived.by(() => {
    if (entry.kind !== 'algorithm') return ''
    const wanted = Number(entry.settings?.numberOfSongs ?? 0)
    const matched = entry.matchedAnnSongIds
    if (matched === undefined) return `… · ${wanted} chosen`
    return `${matched.length} matching songs · ${Math.min(wanted, matched.length || wanted)} chosen`
  })

  /** When a message or title block shows (SPEC §5.3). */
  const whenLine = $derived.by(() => {
    if (entry.kind === 'message') {
      const where = entry.videoDisplay ? 'during guessing' : 'chat'
      return `${where} · ${entry.time}s`
    }
    if (entry.kind === 'title') return 'full screen'
    return ''
  })

  const content = $derived(
    entry.kind === 'message'
      ? entry.message
      : entry.kind === 'title'
        ? entry.title
        : ''
  )

  let menuButton = $state<HTMLButtonElement | null>(null)
</script>

<div class="nested tone-{tone}" class:selected class:two-line={isAlgorithm}>
  <span class="rail" aria-hidden="true"></span>

  <div class="body">
    <div class="line">
      <label class="check">
        <input
          type="checkbox"
          checked={selected}
          onclick={(event) => onSelect(event as unknown as MouseEvent)}
        />
        <span class="sr-only">Select {badge}</span>
      </label>

      <span class="tag kind-{entry.kind}">{badge}</span>

      {#if isAlgorithm}
        <span class="match">{matchLine}</span>
        <!-- On the summary line, not below it, to save vertical space. -->
        {#if chips.length > 0}
          <div class="chips">
            {#each chips as chip (chip.key)}
              <Tooltip text={chip.tooltip}>
                <span class="chip">{chip.label}</span>
              </Tooltip>
            {/each}
          </div>
        {/if}
      {:else}
        <span class="content" title={content}>
          {content || '—'}
        </span>
        <span class="when">{whenLine}</span>
      {/if}

      <div class="actions">
        {#if isAlgorithm}
          <button
            type="button"
            class="act"
            aria-label="Algorithm block settings"
            title="Algorithm block settings"
            onclick={onSettings}
          >
            <Icon name="sliders" size={16} />
          </button>
        {/if}
        <button
          type="button"
          class="act"
          aria-label="Duplicate this block"
          title="Duplicate this block. The copy goes directly below."
          onclick={onDuplicate}
        >
          <Icon name="copy" size={13} />
        </button>
        <button
          bind:this={menuButton}
          type="button"
          class="act"
          aria-label="More actions"
          title="More actions"
          onclick={() => menuButton && onMenu(menuButton)}
        >
          ⋯
        </button>
      </div>
    </div>
  </div>
</div>

<style>
  .nested {
    position: relative;
    display: flex;
    padding-left: var(--qb-chain);
  }

  .nested:hover {
    background: rgba(255, 255, 255, 0.04);
  }

  .nested.selected {
    background: rgba(91, 155, 245, 0.13);
    box-shadow: inset 3px 0 0 var(--accent);
  }

  /* The rail has the colour of the rule block that contains this row. */
  .rail {
    position: absolute;
    left: var(--qb-chain);
    top: 0;
    bottom: 0;
    width: 2px;
    background: var(--tone);
    opacity: 0.75;
  }

  .tone-accent {
    --tone: var(--accent);
  }
  .tone-violet {
    --tone: var(--violet);
  }
  .tone-teal {
    --tone: var(--teal);
  }
  .tone-amber {
    --tone: var(--amber);
  }
  .tone-rose {
    --tone: var(--rose);
  }

  .body {
    flex: 1 1 0;
    min-width: 0;
    /* The padding puts the checkbox on `--qb-check-x`, aligned with the
       entry rows. */
    padding: 0 12px 0 calc(var(--qb-check-x) - var(--qb-chain));
  }

  .line {
    display: flex;
    align-items: center;
    gap: var(--qb-row-gap);
    height: var(--qb-entry-h);
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

  .tag {
    flex: none;
    display: inline-flex;
    align-items: center;
    height: 22px;
    padding: 0 8px;
    border-radius: 5px;
    font-size: var(--qb-text-xs);
    font-weight: 700;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .kind-algorithm {
    background: var(--chip-teal-bg);
    color: var(--teal-fg);
  }

  .kind-message {
    background: var(--chip-amber-bg);
    color: var(--amber-fg);
  }

  .kind-title {
    background: var(--chip-rose-bg);
    color: var(--rose-fg);
  }

  .match {
    flex: none;
    font-size: var(--qb-text-sm);
    color: var(--text-3);
    white-space: nowrap;
  }

  .content {
    flex: 1 1 0;
    min-width: 0;
    font-size: var(--qb-text);
    color: var(--text-2);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .when {
    flex: none;
    font-size: var(--qb-text-xs);
    color: var(--text-4);
    white-space: nowrap;
  }

  .actions {
    flex: none;
    display: flex;
    align-items: center;
    gap: 3px;
  }

  .act {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    padding: 0;
    border: 0;
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

  /* Takes the free width between the summary and the action buttons. Clips;
     the line has a fixed height and must not wrap. */
  .chips {
    flex: 1 1 0;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 5px;
    overflow: hidden;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    height: 22px;
    padding: 0 8px;
    border-radius: 5px;
    background: var(--bg-raised);
    border: 1px solid var(--line-soft);
    color: var(--text-3);
    font-family: var(--font-mono);
    font-size: var(--qb-text-xs);
    white-space: nowrap;
  }
</style>
