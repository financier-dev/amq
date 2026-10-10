<!--
  The save dialog: description and tags, then the save through AMQ.

  **This dialog is ours.** AMQ's `#cqcSaveModal` cannot be reused. Its save
  button calls `generateQuizSave()` (`customQuizCreator.js:136`), which reads
  `this.builder.generateBlockSaves()`. That is AMQ's own DOM builder, and we
  never populate it because we replaced the screen. Reusing the dialog would
  save an empty quiz over the player's work.

  The command is still AMQ's. The payload goes out through `save quiz` in the
  shape the client sends, so server-side validation, the 250-song limit and
  the error reply stay unchanged.

  The tag list comes from AMQ's `tagContainer`, which already has the
  localised names. The limit of two tags is AMQ's.
-->
<script lang="ts">
  import { t } from '../../amq/derive'
  import { quizStore } from '../../amq/quiz.svelte'
  import { MAX_TAGS } from '../../amq/quizModel'
  import Icon from '../common/Icon.svelte'

  interface Props {
    onClose: () => void
  }

  let { onClose }: Props = $props()

  /** Tags from AMQ's tag component. Empty if the component is not built yet. */
  const tags = $derived.by((): { id: number; name: string }[] => {
    try {
      const map = (customQuizCreator as any)?.tagContainer?.tagMap
      if (!map) return []
      return Object.values(map).map((tag: any) => ({
        id: tag.tagId,
        name: tag.name,
      }))
    } catch {
      return []
    }
  })

  const selected = $derived(quizStore.quiz.tags ?? [])
  const atCap = $derived(selected.length >= MAX_TAGS)

  function toggleTag(id: number) {
    const current = quizStore.quiz.tags
    const index = current.indexOf(id)
    if (index !== -1) {
      current.splice(index, 1)
      return
    }
    if (current.length >= MAX_TAGS) return
    current.push(id)
  }

  function save() {
    quizStore.save()
  }

  $effect(() => {
    if (quizStore.saveState === 'saved') onClose()
  })
</script>

<div class="scrim" role="presentation" onclick={onClose}></div>
<div class="panel" role="dialog" aria-label="Save quiz">
  <header class="head">
    <h2>{t('quiz_builder.save_window.title', 'Save Quiz')}</h2>
    <button type="button" class="close" aria-label="Close" onclick={onClose}>
      <Icon name="close" size={14} />
    </button>
  </header>

  <div class="body">
    <label class="field">
      <span class="label">{t('quiz_builder.quiz_name', 'Quiz Name')}</span>
      <input type="text" maxlength="50" bind:value={quizStore.quiz.name} />
    </label>

    <label class="field">
      <span class="label">
        {t('quiz_builder.save_window.description.title', 'Description')}
      </span>
      <textarea
        rows="3"
        maxlength="200"
        placeholder={t(
          'quiz_builder.save_window.description.placeholder',
          'Enter a description for your quiz'
        )}
        bind:value={quizStore.quiz.description}
      ></textarea>
    </label>

    {#if tags.length > 0}
      <div class="field">
        <span class="label">
          {t('quiz_builder.save_window.tags', 'Tags')}
        </span>
        <div class="tags">
          {#each tags as tag (tag.id)}
            {@const on = selected.includes(tag.id)}
            <button
              type="button"
              class="tag"
              class:on
              aria-pressed={on}
              disabled={!on && atCap}
              onclick={() => toggleTag(tag.id)}
            >
              {tag.name}
            </button>
          {/each}
        </div>
        {#if atCap}
          <p class="note">
            {t(
              'quiz_builder.save_window.tags_max_warning',
              'Max 2 tags allowed'
            )}
          </p>
        {/if}
      </div>
    {:else if selected.length > 0}
      <!--
        The tag component is not built, so the names are unknown. The ids
        still round-trip, so a save keeps the tags.
      -->
      <p class="note">
        This quiz has {selected.length}
        {selected.length === 1 ? 'tag' : 'tags'}. The save keeps them.
      </p>
    {/if}

    {#if quizStore.saveState === 'failed'}
      <p class="error">
        {t(
          'quiz_builder.alerts.save_failed.description',
          'An error occurred while trying to save your quiz. Please try again later.'
        )}
      </p>
    {/if}
  </div>

  <footer class="foot">
    <button type="button" class="quiet" onclick={onClose}>
      {t('common.ui.cancel_button', 'Cancel')}
    </button>
    <span class="spacer"></span>
    <button
      type="button"
      class="save"
      disabled={!quizStore.quiz.name.trim() || quizStore.saveState === 'saving'}
      onclick={save}
    >
      {quizStore.saveState === 'saving'
        ? t('quiz_builder.save_window.saving', 'Saving')
        : t('quiz_builder.save_window.save_button', 'Save')}
    </button>
  </footer>
</div>

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
    display: flex;
    flex-direction: column;
    border-radius: 10px;
    background: var(--bg-pop);
    border: 1px solid var(--line-strong);
    box-shadow: 0 18px 50px rgba(0, 0, 0, 0.5);
  }

  .head {
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
    padding: 14px;
  }

  .field {
    display: block;
    margin-bottom: 14px;
  }

  .label {
    display: block;
    margin-bottom: 6px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    color: var(--text-4);
  }

  input,
  textarea {
    width: 100%;
    padding: 7px 9px;
    border-radius: 7px;
    background: var(--bg-sunken);
    border: 1px solid var(--line-strong);
    color: var(--text);
    font-family: inherit;
    font-size: 12.5px;
    resize: vertical;
    outline: none;
  }

  input:focus,
  textarea:focus {
    border-color: var(--accent);
  }

  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
  }

  .tag {
    height: 26px;
    padding: 0 10px;
    border-radius: 6px;
    background: transparent;
    border: 1px dashed var(--chip-off-line);
    color: var(--chip-off-fg);
    font-family: inherit;
    font-size: 11.5px;
    font-weight: 600;
    cursor: pointer;
  }

  .tag.on {
    background: var(--chip-blue-bg);
    border: 1px solid var(--chip-blue-line);
    color: var(--blue-fg);
  }

  .tag:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .note {
    margin: 8px 0 0;
    font-size: 11px;
    color: var(--text-5);
  }

  .error {
    margin: 4px 0 0;
    font-size: 11.5px;
    color: var(--rose-fg);
  }

  .foot {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 54px;
    padding: 0 14px;
    border-top: 1px solid var(--line);
  }

  .spacer {
    flex: 1 1 0;
  }

  .quiet {
    height: 30px;
    padding: 0 12px;
    border-radius: 7px;
    background: transparent;
    border: 1px solid var(--line-soft);
    color: var(--text-3);
    font-family: inherit;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
  }

  .save {
    height: 30px;
    padding: 0 16px;
    border: 0;
    border-radius: 7px;
    background: var(--accent);
    color: var(--accent-fg);
    font-family: inherit;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
  }

  .save:disabled {
    opacity: 0.5;
    cursor: default;
  }
</style>
