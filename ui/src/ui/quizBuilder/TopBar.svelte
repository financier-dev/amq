<!--
  The builder's top bar, 60px (SPEC §1).

  Back · "Quiz Builder" · the quiz's name · the totals · Undo · Save.

  The summary shows how many songs the quiz plays against the 250-song limit.
  It uses `--text`, not grey, because it is the main number. There is **no
  estimated length**: the client has no song durations.
-->
<script lang="ts">
  import { t } from '../../amq/derive'
  import { quizStore } from '../../amq/quiz.svelte'
  import { MAX_SONG_COUNT } from '../../amq/quizModel'
  import Icon from '../common/Icon.svelte'
  import Tooltip from '../common/Tooltip.svelte'

  interface Props {
    onBack: () => void
    onSave: () => void
    onRevert: () => void
  }

  let { onBack, onSave, onRevert }: Props = $props()

  const totals = $derived(quizStore.totals)
  const overCap = $derived(totals.chosen > MAX_SONG_COUNT)
</script>

<header class="bar">
  <button type="button" class="back" onclick={onBack} aria-label="Back">
    <Icon name="back" size={16} />
  </button>

  <h1 class="title">{t('quiz_builder.title', 'Quiz Builder')}</h1>

  <label class="name">
    <span class="sr-only">{t('quiz_builder.quiz_name', 'Quiz Name')}</span>
    <input
      id="amq-ui-quiz-name"
      type="text"
      maxlength="50"
      placeholder={t('quiz_builder.quiz_name', 'Quiz Name')}
      bind:value={quizStore.quiz.name}
    />
  </label>

  <div class="totals">
    <span class="headline" class:over={overCap}>
      {totals.uniqueSongs} unique songs · {totals.chosen} chosen
    </span>
    <span class="sub">
      {totals.blocks}
      {totals.blocks === 1 ? 'block' : 'blocks'} · {totals.uniqueAnime} anime
    </span>
  </div>

  <!--
    Not in the mock, but every AMQ quiz has this setting. When it is on, the
    rule blocks play in a random order, not the order shown here.
  -->
  <Tooltip
    text={t(
      'quiz_builder.rule_block_random_order_button.description',
      'When toggled on, all rule blocks plays in a random order during quizzes, instead of the set order'
    )}
  >
    <button
      type="button"
      class="toggle"
      class:on={quizStore.quiz.ruleBlockRandomOrder}
      aria-pressed={quizStore.quiz.ruleBlockRandomOrder}
      onclick={() =>
        (quizStore.quiz.ruleBlockRandomOrder =
          !quizStore.quiz.ruleBlockRandomOrder)}
    >
      Shuffle blocks
    </button>
  </Tooltip>

  <!-- Undoes one step, so it needs no confirmation. -->
  <button
    type="button"
    class="quiet icon"
    disabled={quizStore.undoDepth === 0}
    aria-label="Undo the last change"
    title={quizStore.undoDepth === 0
      ? 'Nothing to undo'
      : `Undo the last change (${quizStore.undoDepth} step${quizStore.undoDepth === 1 ? '' : 's'})`}
    onclick={() => quizStore.undo()}
  >
    <Icon name="undo" size={14} />
    Undo
  </button>

  <!-- Discards every change since the last save and cannot be undone, so it
       asks first. -->
  <button
    type="button"
    class="quiet"
    disabled={!quizStore.dirty}
    title={quizStore.dirty
      ? 'Discard all changes since the last save'
      : 'No unsaved changes'}
    onclick={onRevert}
  >
    Reset
  </button>

  <button
    type="button"
    class="save"
    disabled={quizStore.saveState === 'saving'}
    onclick={onSave}
  >
    {quizStore.saveState === 'saving'
      ? t('quiz_builder.save_window.saving', 'Saving')
      : t('quiz_builder.save', 'Save')}
  </button>
</header>

<style>
  .bar {
    flex: none;
    display: flex;
    align-items: center;
    gap: 12px;
    height: 60px;
    padding: 0 var(--gutter);
    background: var(--bg-top);
    border-bottom: 1px solid var(--line);
  }

  .back {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    padding: 0;
    border: 1px solid var(--line-soft);
    border-radius: 7px;
    background: var(--bg-raised);
    color: var(--text-2);
    cursor: pointer;
  }

  .back:hover {
    color: var(--text);
    border-color: var(--line-strong);
  }

  .title {
    margin: 0;
    font-family: var(--font-display);
    font-size: 17px;
    font-weight: 700;
    white-space: nowrap;
  }

  .name input {
    width: 220px;
    height: 30px;
    padding: 0 10px;
    border-radius: 7px;
    background: var(--bg-sunken);
    border: 1px solid var(--line-soft);
    color: var(--text);
    font-family: inherit;
    font-size: 13px;
    outline: none;
  }

  .name input:focus {
    border-color: var(--accent);
  }

  .totals {
    display: flex;
    flex-direction: column;
    justify-content: center;
    margin-left: auto;
    line-height: 1.25;
    text-align: right;
  }

  .headline {
    font-size: 12.5px;
    font-weight: 600;
    color: var(--text);
    white-space: nowrap;
  }

  /* Over the limit. AMQ refuses the save. */
  .headline.over {
    color: var(--rose-fg);
  }

  .sub {
    font-size: 10.5px;
    color: var(--text-4);
    white-space: nowrap;
  }

  .toggle {
    height: 28px;
    padding: 0 10px;
    border-radius: 7px;
    background: transparent;
    border: 1px dashed var(--chip-off-line);
    color: var(--chip-off-fg);
    font-size: 11.5px;
    font-weight: 600;
    white-space: nowrap;
    cursor: pointer;
  }

  .toggle.on {
    background: var(--chip-violet-bg);
    border: 1px solid var(--chip-violet-line);
    color: var(--violet-fg);
  }

  .quiet {
    height: 30px;
    padding: 0 12px;
    border-radius: 7px;
    background: var(--bg-raised);
    border: 1px solid var(--line-soft);
    color: var(--text-2);
    font-size: 12.5px;
    font-weight: 600;
    cursor: pointer;
  }

  .quiet:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .quiet.icon {
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }

  .save {
    height: 30px;
    padding: 0 16px;
    border: 0;
    border-radius: 7px;
    background: var(--accent);
    color: var(--accent-fg);
    font-size: 12.5px;
    font-weight: 700;
    cursor: pointer;
  }

  .save:disabled {
    opacity: 0.6;
    cursor: default;
  }
</style>
