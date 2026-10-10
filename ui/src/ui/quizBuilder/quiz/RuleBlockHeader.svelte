<!--
  A rule block's header, two lines (SPEC §5.2).

  Line 1 identifies the block and reports what it contains. Line 2 shows its
  settings as chips. Keep this split: **the one configurable count is a chip,
  and the derived counts are plain text.** The player can then see what can
  be changed.

  The block is identified by its *position*. AMQ's rule blocks have no names,
  so "Rule Block 2" renumbers when blocks are reordered.

  The info line shows the numbers of AMQ's Block Info tooltip, always
  visible. They come from the port in `quizCounts.ts`.
-->
<script lang="ts">
  import { t } from '../../../amq/derive'
  import type { RuleBlock } from '../../../amq/quizModel'
  import type { BlockInfo } from '../../../amq/quizCounts'
  import Icon from '../../common/Icon.svelte'
  import Tooltip from '../../common/Tooltip.svelte'
  import { formatMaybeRandom, guessModeNames, isSongOnly } from '../overrides'
  import type { Tone } from '../rows'

  interface Props {
    block: RuleBlock
    position: number
    tone: Tone
    info: BlockInfo
    chosen: number
    collapsed: boolean
    isTarget: boolean
    allSelected: boolean
    onToggleCollapse: () => void
    onSelectAll: (selected: boolean) => void
    onToggleOrder: () => void
    onSettings: () => void
    onDuplicate: () => void
    onMenu: (anchor: HTMLElement) => void
  }

  let {
    block,
    position,
    tone,
    info,
    chosen,
    collapsed,
    isTarget,
    allSelected,
    onToggleCollapse,
    onSelectAll,
    onToggleOrder,
    onSettings,
    onDuplicate,
    onMenu,
  }: Props = $props()

  const infoLine = $derived(
    `${info.uniqueAnime} anime · ${info.uniqueSongs} unique songs · ${chosen} chosen`
  )

  // The same three numbers in the wording of AMQ's popover.
  const infoTooltip = $derived(
    t(
      'quiz_builder.rule_block.popovers.block_info_content',
      `Song Count: ${chosen} · Unique Anime: ${info.uniqueAnime} · Unique Songs: ${info.uniqueSongs}`,
      { NUMBER: chosen, NUMBER2: info.uniqueAnime, NUMBER3: info.uniqueSongs }
    )
  )

  const orderLabel = $derived(
    block.randomOrder
      ? t('quiz_builder.rule_block.order_rule.random', 'Random')
      : t('quiz_builder.rule_block.order_rule.sequential', 'Sequential')
  )

  const guessTimeLabel = $derived.by(() => {
    const { guessTime, extraGuessTime } = block.guessTime
    const extra =
      extraGuessTime === 0 ? '' : ` +${formatMaybeRandom(extraGuessTime)}s`
    return `${formatMaybeRandom(guessTime)}s${extra}`
  })

  const speedLabel = $derived(
    Array.isArray(block.playBackSpeed.playBackSpeed)
      ? `${block.playBackSpeed.playBackSpeed.join('/')}×`
      : `${block.playBackSpeed.playBackSpeed}×`
  )

  let menuButton = $state<HTMLButtonElement | null>(null)
</script>

<div class="head tone-{tone}">
  <div class="line one">
    <button
      type="button"
      class="chev"
      class:open={!collapsed}
      aria-expanded={!collapsed}
      aria-label={collapsed ? 'Expand this block' : 'Collapse this block'}
      onclick={onToggleCollapse}
    >
      <Icon name="caret" size={15} />
    </button>

    <label class="check">
      <input
        type="checkbox"
        checked={allSelected}
        onchange={(event) => onSelectAll(event.currentTarget.checked)}
      />
      <span class="sr-only">Select everything in rule block {position}</span>
    </label>

    <span class="name">
      {t('quiz_builder.rule_block.title', 'Rule Block')}
      {position}
    </span>

    {#if isTarget}
      <Tooltip text="Items you add from the library go to this block">
        <span class="badge target">Adding here</span>
      </Tooltip>
    {/if}

    <Tooltip text={infoTooltip} wide>
      <span class="info">{infoLine}</span>
    </Tooltip>

    <div class="actions">
      <button
        type="button"
        class="act"
        aria-label="Rule block settings"
        title="Rule block settings"
        onclick={onSettings}
      >
        <Icon name="sliders" size={17} />
      </button>
      <button
        type="button"
        class="act"
        aria-label="Duplicate this rule block"
        title="Duplicate this rule block with its entries and settings. The copy goes directly below."
        onclick={onDuplicate}
      >
        <Icon name="copy" size={14} />
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

  <div class="line two">
    <!-- The one configurable count. -->
    <button type="button" class="chip plays" onclick={onSettings}>
      {t('quiz_builder.rule_block.song_count.label', 'Song Count')}
      {block.songCount}
    </button>

    <!-- Order toggles in place. Every other chip opens the panel (SPEC §5.2). -->
    <Tooltip
      text={t(
        'quiz_builder.rule_block.order_rule.description',
        'The order songs are selected from this block'
      )}
    >
      <button type="button" class="chip" onclick={onToggleOrder}>
        {orderLabel}
      </button>
    </Tooltip>

    <Tooltip
      text={t(
        'quiz_builder.rule_block.popovers.guess_time_description',
        'The default guess time for songs in this block'
      )}
    >
      <button type="button" class="chip" onclick={onSettings}>
        {guessTimeLabel}
      </button>
    </Tooltip>

    <Tooltip
      text={t(
        'quiz_builder.rule_block.popovers.sample_point_description',
        'The default sample point for songs in this block'
      )}
    >
      <button type="button" class="chip" onclick={onSettings}>
        Sample {formatMaybeRandom(block.samplePoint.samplePoint)}%
      </button>
    </Tooltip>

    <Tooltip
      text={t(
        'quiz_builder.rule_block.popovers.playback_speed_description',
        'The default playback speed for songs in this block'
      )}
    >
      <button type="button" class="chip" onclick={onSettings}>
        {speedLabel}
      </button>
    </Tooltip>

    <!-- Shown only when it differs from the default (SPEC §5.2). -->
    {#if !isSongOnly(block.guessModes)}
      <Tooltip
        text={t(
          'quiz_builder.rule_block.popovers.guess_mode_description',
          'The default guess modes for songs in this block'
        )}
      >
        <button type="button" class="chip mode" onclick={onSettings}>
          {guessModeNames(block.guessModes).join(' · ')}
        </button>
      </Tooltip>
    {/if}

    <!--
      Not in the mock. AMQ's rule blocks have this setting, and it changes how
      the info line counts. Only the off state gets a chip.
    -->
    {#if !block.duplicates}
      <Tooltip
        text={t(
          'quiz_builder.rule_block.popovers.allow_duplicates',
          'Allow duplicate shows to be selected from this block'
        )}
      >
        <button type="button" class="chip warn" onclick={onSettings}>
          No duplicates
        </button>
      </Tooltip>
    {/if}
  </div>
</div>

<style>
  .head {
    padding: 9px 14px 10px;
    background: var(--tone-bg);
    border-top: 1px solid var(--line-soft);
    border-bottom: 1px solid var(--line-soft);
    border-left: 3px solid var(--tone);
  }

  .tone-accent {
    --tone: var(--accent);
    --tone-bg: rgba(91, 155, 245, 0.1);
    --tone-fg: var(--blue-fg);
  }
  .tone-violet {
    --tone: var(--violet);
    --tone-bg: rgba(155, 124, 245, 0.1);
    --tone-fg: var(--violet-fg);
  }
  .tone-teal {
    --tone: var(--teal);
    --tone-bg: rgba(52, 201, 163, 0.1);
    --tone-fg: var(--teal-fg);
  }
  .tone-amber {
    --tone: var(--amber);
    --tone-bg: rgba(232, 163, 61, 0.1);
    --tone-fg: var(--amber-fg);
  }
  .tone-rose {
    --tone: var(--rose);
    --tone-bg: rgba(229, 101, 138, 0.1);
    --tone-fg: var(--rose-fg);
  }

  .line {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .two {
    gap: 5px;
    margin-top: 6px;
    flex-wrap: wrap;
  }

  .chev {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    padding: 0;
    border: 0;
    border-radius: 5px;
    background: transparent;
    color: var(--text-3);
    cursor: pointer;
    transition: transform 120ms ease;
    transform: rotate(-90deg);
  }

  .chev.open {
    transform: rotate(0deg);
    color: var(--tone-fg);
  }

  .check {
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

  .name {
    font-family: var(--font-display);
    font-size: 16px;
    font-weight: 700;
    color: var(--text);
    white-space: nowrap;
  }

  .badge {
    display: inline-flex;
    align-items: center;
    height: 22px;
    padding: 0 9px;
    border-radius: 5px;
    font-size: var(--qb-text-xs);
    font-weight: 700;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .target {
    background: rgba(91, 155, 245, 0.2);
    color: var(--blue-fg);
  }

  /* Plain text: these counts are derived and cannot be set. */
  .info {
    flex: 1 1 0;
    min-width: 0;
    font-size: var(--qb-text-sm);
    color: var(--text-3);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
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
    width: 28px;
    height: 28px;
    padding: 0;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: var(--text-4);
    font-size: 17px;
    line-height: 1;
    cursor: pointer;
  }

  .act:hover {
    background: var(--bg-raised);
    color: var(--text);
  }

  .chip {
    display: inline-flex;
    align-items: center;
    height: 26px;
    padding: 0 10px;
    border-radius: 6px;
    background: var(--chip-blue-bg);
    border: 1px solid var(--chip-blue-line);
    color: var(--blue-fg);
    font-size: var(--qb-text-sm);
    font-weight: 600;
    white-space: nowrap;
    cursor: pointer;
  }

  .chip:hover {
    border-color: var(--line-strong);
  }

  .plays {
    font-family: var(--font-mono);
  }

  .mode {
    background: var(--chip-violet-bg);
    border-color: var(--chip-violet-line);
    color: var(--violet-fg);
  }

  .warn {
    background: var(--chip-amber-bg);
    border-color: var(--chip-amber-line);
    color: var(--amber-fg);
  }
</style>
