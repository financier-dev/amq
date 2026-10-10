<!--
  Rule block settings (SPEC §9).

  **No name field.** AMQ's rule blocks have no names.

  The sections follow the spec's order, plus `Allow duplicates`. AMQ has that
  setting on every rule block, and it changes the block's info line.

  Guess time, sample point and playback speed can each hold a *random range*.
  There is no editor for a range, so the panel shows it read-only and tells
  the player where to edit it. An incomplete range editor could turn a range
  into a single value on save and corrupt the quiz.
-->
<script lang="ts">
  import { t } from '../../../amq/derive'
  import { QuizStore, quizStore } from '../../../amq/quiz.svelte'
  import {
    MAX_SONG_COUNT,
    PLAYBACK_SPEED_TICKS,
    type GuessModes,
  } from '../../../amq/quizModel'
  import Icon from '../../common/Icon.svelte'
  import { formatMaybeRandom } from '../overrides'

  interface Props {
    blockId: string
    onClose: () => void
  }

  let { blockId, onClose }: Props = $props()

  const block = $derived(
    quizStore.quiz.blocks.find((entry) => entry.id === blockId)
  )
  const position = $derived(
    quizStore.quiz.blocks.findIndex((entry) => entry.id === blockId) + 1
  )
  const ceiling = $derived(block ? quizStore.ceiling(block) : MAX_SONG_COUNT)
  const otherBlocks = $derived(block ? MAX_SONG_COUNT - ceiling : 0)

  const guessTimeRandom = $derived(
    Array.isArray(block?.guessTime.guessTime) ||
      Array.isArray(block?.guessTime.extraGuessTime)
  )
  const sampleRandom = $derived(Array.isArray(block?.samplePoint.samplePoint))
  const speedRandom = $derived(
    Array.isArray(block?.playBackSpeed.playBackSpeed)
  )

  function setGuessTime(field: 'guessTime' | 'extraGuessTime', value: number) {
    if (!block || guessTimeRandom) return
    quizStore.updateBlock(blockId, {
      guessTime: { ...block.guessTime, [field]: value },
    })
  }

  function toggleMode(key: keyof GuessModes) {
    if (!block) return
    quizStore.updateBlock(blockId, {
      guessModes: QuizStore.toggleGuessMode(block.guessModes, key),
    })
  }
</script>

{#if block}
  <div class="scrim" role="presentation" onclick={onClose}></div>
  <div class="panel" role="dialog" aria-label="Rule block settings">
    <header class="head">
      <h2>
        {t('quiz_builder.rule_block.title', 'Rule Block')}
        {position}
      </h2>
      <button type="button" class="close" aria-label="Close" onclick={onClose}>
        <Icon name="close" size={14} />
      </button>
    </header>

    <div class="body">
      <section>
        <h3>Songs from this block</h3>
        <div class="row">
          <input
            class="rng"
            type="range"
            min="1"
            max={ceiling}
            step="1"
            value={block.songCount}
            aria-label={t(
              'quiz_builder.rule_block.song_count.description',
              'Number of songs to select from this block'
            )}
            oninput={(event) =>
              quizStore.setSongCount(
                blockId,
                Number(event.currentTarget.value)
              )}
          />
          <input
            class="num"
            type="number"
            min="1"
            max={ceiling}
            value={block.songCount}
            aria-label="Song count, typed"
            oninput={(event) =>
              quizStore.setSongCount(
                blockId,
                Number(event.currentTarget.value)
              )}
          />
        </div>
        <p class="note">
          The quiz uses {otherBlocks + block.songCount} of {MAX_SONG_COUNT} songs.
          This block can have up to {ceiling}.
        </p>
      </section>

      <section>
        <h3>{t('quiz_builder.rule_block.order_rule.description', 'Order')}</h3>
        <div class="segmented">
          <button
            type="button"
            class:on={block.randomOrder}
            onclick={() =>
              quizStore.updateBlock(blockId, { randomOrder: true })}
          >
            {t('quiz_builder.rule_block.order_rule.random', 'Random')}
          </button>
          <button
            type="button"
            class:on={!block.randomOrder}
            onclick={() =>
              quizStore.updateBlock(blockId, { randomOrder: false })}
          >
            {t('quiz_builder.rule_block.order_rule.sequential', 'Sequential')}
          </button>
        </div>
        <p class="note">Locked entries keep their position either way.</p>
      </section>

      <section>
        <h3>{t('quiz_builder.rule_labels.guess_time', 'Guess Time')}</h3>
        {#if guessTimeRandom}
          <p class="readonly">
            Random range: {formatMaybeRandom(block.guessTime.guessTime)}s + {formatMaybeRandom(
              block.guessTime.extraGuessTime
            )}s
            <span class="why">
              You cannot edit a random range here. To edit it, run
              <code>__amqUI.quizBuilder.useLegacy()</code>. A save keeps it
              unchanged.
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
                value={block.guessTime.guessTime}
                oninput={(event) =>
                  setGuessTime('guessTime', Number(event.currentTarget.value))}
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
                value={block.guessTime.extraGuessTime}
                oninput={(event) =>
                  setGuessTime(
                    'extraGuessTime',
                    Number(event.currentTarget.value)
                  )}
              />
            </label>
          </div>
        {/if}
      </section>

      <section>
        <h3>{t('quiz_builder.rule_labels.sample_point', 'Sample Point')}</h3>
        {#if sampleRandom}
          <p class="readonly">
            Random range: {formatMaybeRandom(block.samplePoint.samplePoint)}%
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
              value={block.samplePoint.samplePoint}
              aria-label={t(
                'quiz_builder.rule_block.popovers.sample_point_description',
                'The default sample point for songs in this block'
              )}
              oninput={(event) =>
                quizStore.updateBlock(blockId, {
                  samplePoint: {
                    samplePoint: Number(event.currentTarget.value),
                  },
                })}
            />
            <span class="pct mono">{block.samplePoint.samplePoint}%</span>
          </div>
          <!-- A percentage of the song. AMQ has no song duration to convert with. -->
          <p class="note">
            Where in the song playback starts, as a percentage.
          </p>
        {/if}
      </section>

      <section>
        <h3>
          {t('quiz_builder.rule_labels.playback_speed', 'Playback Speed')}
        </h3>
        {#if speedRandom}
          <p class="readonly">
            Random among {(block.playBackSpeed.playBackSpeed as number[]).join(
              ', '
            )}×
            <span class="why"
              >A save keeps it unchanged. Edit it in AMQ's own builder.</span
            >
          </p>
        {:else}
          <div class="segmented">
            {#each PLAYBACK_SPEED_TICKS as tick (tick)}
              <button
                type="button"
                class:on={block.playBackSpeed.playBackSpeed === tick}
                onclick={() =>
                  quizStore.updateBlock(blockId, {
                    playBackSpeed: { playBackSpeed: tick },
                  })}
              >
                {tick}×
              </button>
            {/each}
          </div>
        {/if}
      </section>

      <section>
        <h3>Guess mode</h3>
        <!-- A set, not a single choice. AMQ refuses to turn the last one off. -->
        <div class="segmented">
          {#each [{ key: 'song' as const, i18n: 'quiz_builder.rule_block.guess_mode.song', fallback: 'Song' }, { key: 'tinyVideo' as const, i18n: 'quiz_builder.rule_block.guess_mode.tiny_video', fallback: 'Tiny Video' }, { key: 'blurVideo' as const, i18n: 'quiz_builder.rule_block.guess_mode.blur_video', fallback: 'Blur Video' }] as mode (mode.key)}
            <button
              type="button"
              class:on={block.guessModes[mode.key]}
              aria-pressed={block.guessModes[mode.key]}
              onclick={() => toggleMode(mode.key)}
            >
              {t(mode.i18n, mode.fallback)}
            </button>
          {/each}
        </div>
        <p class="note">
          At least one is always on. Entries can override this.
        </p>
      </section>

      <section>
        <h3>Duplicates</h3>
        <label class="switch">
          <input
            type="checkbox"
            checked={block.duplicates}
            onchange={(event) =>
              quizStore.updateBlock(blockId, {
                duplicates: event.currentTarget.checked,
              })}
          />
          {t(
            'quiz_builder.rule_block.popovers.allow_duplicates',
            'Allow duplicate shows to be selected from this block'
          )}
        </label>
      </section>
    </div>
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
    width: 420px;
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

  .close:hover {
    background: var(--bg-raised);
    color: var(--text);
  }

  .body {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    padding: 4px 14px 14px;
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
    accent-color: var(--accent);
  }

  .num {
    width: 70px;
    height: 28px;
    padding: 0 8px;
    border-radius: 7px;
    background: var(--bg-sunken);
    border: 1px solid var(--line-strong);
    color: var(--text);
    font-family: var(--font-mono);
    font-size: 12px;
  }

  .field {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11.5px;
    color: var(--text-3);
  }

  .pct {
    width: 44px;
    text-align: right;
    font-size: 12px;
    color: var(--text-2);
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
    background: var(--chip-blue-bg);
    border: 1px solid var(--chip-blue-line);
    color: var(--blue-fg);
  }

  .note {
    margin: 8px 0 0;
    font-size: 11px;
    color: var(--text-5);
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

  .switch {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: var(--text-2);
    cursor: pointer;
  }

  .switch input {
    width: 14px;
    height: 14px;
    accent-color: var(--accent);
  }
</style>
