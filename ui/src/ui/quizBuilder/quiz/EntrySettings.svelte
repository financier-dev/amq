<!--
  Per-entry settings (SPEC §8).

  Opens from a row's settings button, an amber override chip, a ⋯ menu, or the
  selection bar. From the selection bar it applies to the whole selection, and
  its footer says so.

  **An unset override is absent, not zero.** "Use block default" clears the
  field; it does not copy the block's current value. An entry that follows its
  block therefore keeps following it when the block changes. AMQ stores it the
  same way: the key is not written.
-->
<script lang="ts">
  import { t } from '../../../amq/derive'
  import { QuizStore, quizStore } from '../../../amq/quiz.svelte'
  import {
    PLAYBACK_SPEED_TICKS,
    isPlayEntry,
    type GuessModes,
    type PlayEntry,
  } from '../../../amq/quizModel'
  import Icon from '../../common/Icon.svelte'
  import { formatMaybeRandom } from '../overrides'

  interface Props {
    ids: string[]
    onClose: () => void
  }

  let { ids, onClose }: Props = $props()

  /** Only entries that play a song have overrides. */
  const targets = $derived.by((): PlayEntry[] => {
    const out: PlayEntry[] = []
    for (const block of quizStore.quiz.blocks) {
      for (const entry of block.entries) {
        if (ids.includes(entry.id) && isPlayEntry(entry)) out.push(entry)
      }
    }
    return out
  })

  /** The panel shows the first target's values and applies edits to all. */
  const lead = $derived(targets[0])
  const multiple = $derived(targets.length > 1)

  const guessTime = $derived(lead?.overrides.guessTime)
  const samplePoint = $derived(lead?.overrides.samplePoint)
  const speed = $derived(lead?.overrides.playBackSpeed)
  const modes = $derived(lead?.overrides.guessModes)

  const guessTimeRandom = $derived(
    Array.isArray(guessTime?.guessTime) ||
      Array.isArray(guessTime?.extraGuessTime)
  )
  const sampleRandom = $derived(Array.isArray(samplePoint?.samplePoint))
  const speedRandom = $derived(Array.isArray(speed?.playBackSpeed))

  function apply<
    K extends 'guessTime' | 'samplePoint' | 'playBackSpeed' | 'guessModes',
  >(key: K, value: any) {
    quizStore.setOverride(ids, key, value)
  }

  function clear(
    key?: 'guessTime' | 'samplePoint' | 'playBackSpeed' | 'guessModes'
  ) {
    quizStore.clearOverride(ids, key)
  }

  function toggleMode(key: keyof GuessModes) {
    const current = modes ?? { song: true, tinyVideo: false, blurVideo: false }
    apply('guessModes', QuizStore.toggleGuessMode(current, key))
  }
</script>

{#if lead}
  <div class="scrim" role="presentation" onclick={onClose}></div>
  <div class="panel" role="dialog" aria-label="Entry settings">
    <header class="head">
      <h2>
        {multiple ? `${targets.length} entries` : 'Entry settings'}
      </h2>
      <button type="button" class="close" aria-label="Close" onclick={onClose}>
        <Icon name="close" size={14} />
      </button>
    </header>

    <div class="body">
      <section>
        <h3>Guess mode</h3>
        <div class="segmented">
          {#each [{ key: 'song' as const, i18n: 'quiz_builder.rule_block.guess_mode.song', fallback: 'Song' }, { key: 'tinyVideo' as const, i18n: 'quiz_builder.rule_block.guess_mode.tiny_video', fallback: 'Tiny Video' }, { key: 'blurVideo' as const, i18n: 'quiz_builder.rule_block.guess_mode.blur_video', fallback: 'Blur Video' }] as mode (mode.key)}
            <button
              type="button"
              class:on={modes?.[mode.key]}
              aria-pressed={Boolean(modes?.[mode.key])}
              onclick={() => toggleMode(mode.key)}
            >
              {t(mode.i18n, mode.fallback)}
            </button>
          {/each}
          <button
            type="button"
            class="default"
            class:on={!modes}
            onclick={() => clear('guessModes')}
          >
            Use block default
          </button>
        </div>
      </section>

      <section>
        <h3>{t('quiz_builder.rule_labels.guess_time', 'Guess Time')}</h3>
        {#if guessTimeRandom}
          <p class="readonly">
            Random range: {formatMaybeRandom(guessTime!.guessTime)}s + {formatMaybeRandom(
              guessTime!.extraGuessTime
            )}s
            <span class="why">
              A save keeps it unchanged. To edit a random range, run
              <code>__amqUI.quizBuilder.useLegacy()</code>.
            </span>
          </p>
        {:else}
          <div class="row">
            <label class="field">
              <span>Seconds</span>
              <input
                class="num"
                type="number"
                min="1"
                max="60"
                value={(guessTime?.guessTime as number) ?? 20}
                oninput={(event) =>
                  apply('guessTime', {
                    guessTime: Number(event.currentTarget.value),
                    extraGuessTime: (guessTime?.extraGuessTime as number) ?? 0,
                  })}
              />
            </label>
            <label class="field">
              <span
                >{t('quiz_builder.rule_labels.extra_guess_time', 'Extra')}</span
              >
              <input
                class="num"
                type="number"
                min="0"
                max="15"
                value={(guessTime?.extraGuessTime as number) ?? 0}
                oninput={(event) =>
                  apply('guessTime', {
                    guessTime: (guessTime?.guessTime as number) ?? 20,
                    extraGuessTime: Number(event.currentTarget.value),
                  })}
              />
            </label>
            {#if guessTime}
              <button
                type="button"
                class="unset"
                onclick={() => clear('guessTime')}
              >
                Use block default
              </button>
            {/if}
          </div>
        {/if}
      </section>

      <section>
        <h3>{t('quiz_builder.rule_labels.sample_point', 'Sample Point')}</h3>
        {#if sampleRandom}
          <p class="readonly">
            Random range: {formatMaybeRandom(samplePoint!.samplePoint)}%
            <span class="why"
              >A save keeps it unchanged. Edit it in AMQ's own builder.</span
            >
          </p>
        {:else}
          <div class="row">
            <input
              class="rng"
              type="range"
              min="0"
              max="100"
              step="1"
              value={(samplePoint?.samplePoint as number) ?? 50}
              aria-label={t(
                'quiz_builder.rule_labels.override_sample_point',
                'Override the default sample point for this block'
              )}
              oninput={(event) =>
                apply('samplePoint', {
                  samplePoint: Number(event.currentTarget.value),
                })}
            />
            <span class="pct mono">
              {(samplePoint?.samplePoint as number) ?? 50}%
            </span>
            {#if samplePoint}
              <button
                type="button"
                class="unset"
                onclick={() => clear('samplePoint')}
              >
                Reset
              </button>
            {/if}
          </div>
        {/if}
      </section>

      <section>
        <h3>
          {t('quiz_builder.rule_labels.playback_speed', 'Playback Speed')}
        </h3>
        {#if speedRandom}
          <p class="readonly">
            Random among {(speed!.playBackSpeed as number[]).join(', ')}×
            <span class="why"
              >A save keeps it unchanged. Edit it in AMQ's own builder.</span
            >
          </p>
        {:else}
          <div class="segmented">
            {#each PLAYBACK_SPEED_TICKS as tick (tick)}
              <button
                type="button"
                class:on={speed?.playBackSpeed === tick}
                onclick={() => apply('playBackSpeed', { playBackSpeed: tick })}
              >
                {tick}×
              </button>
            {/each}
            <button
              type="button"
              class="default"
              class:on={!speed}
              onclick={() => clear('playBackSpeed')}
            >
              Use block default
            </button>
          </div>
        {/if}
      </section>
    </div>

    <footer class="foot">
      <button type="button" class="quiet" onclick={() => clear()}>
        Reset to block
      </button>
      <span class="spacer"></span>
      <button type="button" class="done" onclick={onClose}>
        {multiple ? `Applied to ${targets.length} selected` : 'Done'}
      </button>
    </footer>
  </div>
{/if}

<style>
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 20;
    background: rgba(0, 0, 0, 0.45);
  }

  .panel {
    position: fixed;
    top: 50%;
    left: 50%;
    z-index: 21;
    transform: translate(-50%, -50%);
    width: 430px;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    border-radius: 10px;
    background: var(--bg-pop);
    border: 1px solid var(--line-strong);
    box-shadow: 0 18px 50px rgba(0, 0, 0, 0.5);
  }

  .head {
    flex: none;
    display: flex;
    align-items: center;
    height: 46px;
    padding: 0 14px;
    border-bottom: 1px solid var(--line);
  }

  .head h2 {
    flex: 1 1 0;
    margin: 0;
    font-family: var(--font-display);
    font-size: 14px;
    font-weight: 700;
  }

  .close {
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
    cursor: pointer;
  }

  .body {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    padding: 4px 14px 10px;
  }

  section {
    padding: 12px 0;
    border-bottom: 1px solid var(--line);
  }

  section:last-child {
    border-bottom: 0;
  }

  h3 {
    margin: 0 0 8px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    color: var(--text-4);
  }

  .row {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .rng {
    flex: 1 1 0;
    accent-color: var(--amber);
  }

  .num {
    width: 62px;
    height: 27px;
    padding: 0 8px;
    border-radius: 7px;
    background: var(--bg-sunken);
    /* Amber marks an override: the entry differs from its block. */
    border: 1px solid var(--chip-amber-line);
    color: var(--amber-fg);
    font-family: var(--font-mono);
    font-size: 11.5px;
  }

  .field {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11.5px;
    color: var(--text-3);
  }

  .pct {
    width: 42px;
    text-align: right;
    font-size: 12px;
    color: var(--amber-fg);
  }

  .segmented {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }

  .segmented button {
    height: 28px;
    padding: 0 11px;
    border-radius: 7px;
    background: transparent;
    border: 1px dashed var(--chip-off-line);
    color: var(--chip-off-fg);
    font-family: inherit;
    font-size: 11.5px;
    font-weight: 600;
    cursor: pointer;
  }

  .segmented button.on {
    background: var(--chip-amber-bg);
    border: 1px solid var(--chip-amber-line);
    color: var(--amber-fg);
  }

  /* "Follows the block" is the neutral state, so it is not amber. */
  .segmented .default.on {
    background: var(--bg-raised);
    border: 1px solid var(--line-strong);
    color: var(--text-2);
  }

  .unset {
    height: 27px;
    padding: 0 9px;
    border-radius: 7px;
    background: transparent;
    border: 1px solid var(--line-soft);
    color: var(--text-4);
    font-family: inherit;
    font-size: 11px;
    cursor: pointer;
  }

  .unset:hover {
    color: var(--text-2);
  }

  .readonly {
    margin: 0;
    font-size: 12px;
    color: var(--amber-fg);
  }

  .why {
    display: block;
    margin-top: 5px;
    font-size: 10.5px;
    color: var(--text-5);
  }

  code {
    font-family: var(--font-mono);
    font-size: 10.5px;
  }

  .foot {
    flex: none;
    display: flex;
    align-items: center;
    gap: 8px;
    height: 52px;
    padding: 0 14px;
    border-top: 1px solid var(--line);
  }

  .spacer {
    flex: 1 1 0;
  }

  .quiet {
    height: 29px;
    padding: 0 10px;
    border-radius: 7px;
    background: transparent;
    border: 1px solid var(--line-soft);
    color: var(--text-3);
    font-family: inherit;
    font-size: 11.5px;
    font-weight: 600;
    cursor: pointer;
  }

  .done {
    height: 29px;
    padding: 0 12px;
    border-radius: 7px;
    background: var(--chip-blue-bg);
    border: 1px solid var(--chip-blue-line);
    color: var(--accent-soft);
    font-family: inherit;
    font-size: 11.5px;
    font-weight: 700;
    cursor: pointer;
  }
</style>
