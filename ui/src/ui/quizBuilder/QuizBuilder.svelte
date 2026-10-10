<!--
  The Quiz Builder screen (SPEC §1).

  A 60px top bar over two panes that scroll independently: the library at 38%
  and the quiz at 62%, 16px apart inside a 24px gutter. AMQ's menu bar keeps
  the bottom 45px of the viewport, so the screen stops above it, as the room
  browser does.

  This component owns the overlays, because several open from more than one
  place. The block picker serves "Adds to" and "Move". The entry settings
  panel opens from a row, an override chip, a ⋯ menu and the selection bar.
-->
<script lang="ts">
  import { t } from '../../amq/derive'
  import { quizStore } from '../../amq/quiz.svelte'
  import BlockPicker from './quiz/BlockPicker.svelte'
  import BlockSettings from './quiz/BlockSettings.svelte'
  import EntrySettings from './quiz/EntrySettings.svelte'
  import FilterPanel from './library/FilterPanel.svelte'
  import Library from './library/Library.svelte'
  import QuizList from './quiz/QuizList.svelte'
  import RowMenu from './quiz/RowMenu.svelte'
  import SaveDialog from './SaveDialog.svelte'
  import SelectionBar from './quiz/SelectionBar.svelte'
  import TopBar from './TopBar.svelte'

  /** The open overlays. The handlers below open one at a time. */
  let picker = $state<{
    anchor: HTMLElement
    /** Set for a one-off add. Absent means "change the pane's target". */
    then?: () => void
  } | null>(null)
  let moving = $state<HTMLElement | null>(null)
  let filters = $state<HTMLElement | null>(null)
  let blockSettings = $state<string | null>(null)
  let entrySettings = $state<string[] | null>(null)
  let rowMenu = $state<{
    anchor: HTMLElement
    kind: 'block' | 'entry'
    id: string
  } | null>(null)
  let saving = $state(false)

  function back() {
    viewChanger.changeView('main')
  }

  /**
   * Checks the name before the save dialog opens, as AMQ does. A dialog with
   * only a disabled button would not say what is wrong.
   */
  function save() {
    if (!quizStore.quiz.name.trim()) {
      messageDisplayer?.displayMessage?.(
        t('quiz_builder.alerts.no_quiz_name.title', 'No Quiz Name'),
        t(
          'quiz_builder.alerts.no_quiz_name.description',
          'You must provide a name for your quiz before saving'
        )
      )
      return
    }
    saving = true
  }

  /**
   * Discards every change since the last save.
   *
   * Asks for confirmation through AMQ's Swal, like the game's other
   * destructive prompts. The text says what happens: the changes are lost.
   */
  function revert() {
    if (!quizStore.dirty) return
    Swal.fire({
      title: 'Discard changes?',
      text: quizStore.quizId
        ? 'This restores the last saved version of the quiz. You cannot undo it.'
        : 'This removes everything from the quiz. You cannot undo it.',
      showCancelButton: true,
      confirmButtonText: 'Discard',
      cancelButtonText: t('common.ui.cancel_button', 'Cancel'),
    }).then((result: { isConfirmed?: boolean }) => {
      if (result?.isConfirmed) quizStore.revert()
    })
  }

  function addAnime(annId: number, blockId?: string) {
    quizStore.addEntry(
      {
        kind: 'anime',
        connectUp: false,
        locked: false,
        annId,
        // AMQ's default for a new anime block: openings and endings on,
        // inserts off.
        includeSongTypes: { op: true, ed: true, in: false },
        numberOfSongs: 1,
        overrides: {},
      },
      blockId
    )
  }

  function addSong(annSongId: number, blockId?: string) {
    quizStore.addEntry(
      {
        kind: 'song',
        connectUp: false,
        locked: false,
        annSongId,
        overrides: {},
      },
      blockId
    )
  }

  /**
   * Opens AMQ's algorithm dialog. `setModeQuizBuilder` takes the settings to
   * edit and an object on which it calls `updateSettings` when the player
   * confirms. We pass a shim that writes to our model. With no entry id the
   * dialog creates a block, which AMQ routes through
   * `customQuizCreator.createAlgorithmBlock`. We own that too.
   */
  function openAlgorithm(entryId: string) {
    const block = quizStore.quiz.blocks.find((item) =>
      item.entries.some((entry) => entry.id === entryId)
    )
    const entry = block?.entries.find((item) => item.id === entryId)

    if (entry?.kind === 'algorithm') {
      hostModal.setModeQuizBuilder($state.snapshot(entry.settings), {
        updateSettings: (settings: Record<string, unknown>) => {
          quizStore.updateAlgorithmSettings(entryId, settings)
        },
      })
    } else {
      hostModal.setModeQuizBuilder()
    }
    hostModal.show()
  }

  /*
   * A second click on the button that opened a menu closes it. `Floating`
   * ignores its own anchor on an outside click, so without this toggle the
   * second click would close and reopen the menu.
   */
  function openMenu(anchor: HTMLElement, kind: 'block' | 'entry', id: string) {
    rowMenu =
      rowMenu?.anchor === anchor && rowMenu.id === id
        ? null
        : { anchor, kind, id }
  }

  /**
   * Whether the focused element takes typed text.
   *
   * `tagName === 'INPUT'` is not enough. A click on a row's checkbox focuses
   * it, and the shortcuts below would then stop working until focus moved.
   * Only text controls keep their keys.
   */
  const TYPING_TYPES = new Set([
    'text',
    'search',
    'number',
    'password',
    'email',
    'url',
    'tel',
  ])

  function isTyping(target: HTMLElement | null): boolean {
    if (!target) return false
    if (target.isContentEditable) return true
    if (target.tagName === 'TEXTAREA') return true
    if (target.tagName !== 'INPUT') return false
    return TYPING_TYPES.has((target as HTMLInputElement).type)
  }

  /** The shortcuts of SPEC §11. Ignored while a text field has focus. */
  function onKeydown(event: KeyboardEvent) {
    const target = event.target as HTMLElement | null
    if (isTyping(target)) {
      if (event.key === 'Escape') (target as HTMLElement).blur()
      return
    }

    const selection = [...quizStore.selection]

    if (event.key === 'Escape') {
      if (
        picker ||
        moving ||
        filters ||
        blockSettings ||
        entrySettings ||
        rowMenu ||
        saving
      ) {
        picker = moving = filters = null
        blockSettings = entrySettings = null
        rowMenu = null
        saving = false
        return
      }
      quizStore.clearSelection()
      return
    }

    if (selection.length === 0) return

    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault()
      quizStore.removeEntries(selection)
      return
    }
    if (event.key === 'l' || event.key === 'L') {
      quizStore.setLocked(selection, true)
      return
    }
    if (event.key === 'k' || event.key === 'K') {
      for (const id of selection) quizStore.toggleChain(id)
      return
    }
    if (
      (event.key === 'm' || event.key === 'M') &&
      (event.ctrlKey || event.metaKey)
    ) {
      event.preventDefault()
      // No button is under the cursor, so anchor on the focused element.
      const anchor = document.activeElement as HTMLElement
      if (anchor) moving = anchor
    }
  }

  /**
   * Keeps our key events inside the shadow root.
   *
   * `setup.js:56` blocks Backspace unless `event.target` is an input. An
   * event that crosses a shadow boundary is retargeted to the host, so AMQ
   * sees our wrapper div and cancels the key. Backspace then does nothing in
   * either search box.
   */
  function keepKeysLocal(event: KeyboardEvent) {
    if (isTyping(event.target as HTMLElement | null)) {
      event.stopPropagation()
    }
  }
</script>

<svelte:window onkeydown={onKeydown} />

<div
  class="screen"
  onkeydown={keepKeysLocal}
  onkeyup={keepKeysLocal}
  role="presentation"
>
  <TopBar onBack={back} onSave={save} onRevert={revert} />

  {#if quizStore.loadFailed}
    <p class="failure">
      {t(
        'quiz_builder.alerts.error_loading.description',
        'An error occurred while trying to load the quiz.'
      )}
      <span class="hint"
        >Run <code>__amqUI.quizBuilder.useLegacy()</code> to open it in AMQ's own
        builder.</span
      >
    </p>
  {:else}
    <div class="panes">
      <Library
        onOpenFilters={(anchor) => (filters = filters ? null : anchor)}
        onPickTarget={(anchor, then) =>
          (picker = picker?.anchor === anchor ? null : { anchor, then })}
        onAddAnime={addAnime}
        onAddSong={addSong}
      />

      <div class="quiz-host">
        <QuizList
          onBlockSettings={(id) => (blockSettings = id)}
          onEntrySettings={(id) => (entrySettings = [id])}
          onAlgorithmSettings={openAlgorithm}
          onMenu={openMenu}
        />
        <SelectionBar
          onMove={(anchor) => (moving = moving === anchor ? null : anchor)}
          onSettings={() => (entrySettings = [...quizStore.selection])}
        />
      </div>
    </div>
  {/if}
</div>

{#if picker}
  <BlockPicker
    anchor={picker.anchor}
    currentId={quizStore.targetBlock?.id ?? null}
    onPick={(blockId) => {
      // A pick from any "add to" popover also sets the pane's target
      // (SPEC §4).
      quizStore.targetBlockId = blockId
      picker?.then?.()
      picker = null
    }}
    onDismiss={() => (picker = null)}
  />
{/if}

{#if moving}
  <BlockPicker
    anchor={moving}
    onPick={(blockId) => {
      quizStore.moveEntries([...quizStore.selection], blockId)
      moving = null
    }}
    onDismiss={() => (moving = null)}
  />
{/if}

{#if filters}
  <FilterPanel anchor={filters} onDismiss={() => (filters = null)} />
{/if}

{#if blockSettings}
  <BlockSettings
    blockId={blockSettings}
    onClose={() => (blockSettings = null)}
  />
{/if}

{#if entrySettings && entrySettings.length > 0}
  <EntrySettings ids={entrySettings} onClose={() => (entrySettings = null)} />
{/if}

{#if saving}
  <SaveDialog onClose={() => (saving = false)} />
{/if}

{#if rowMenu}
  <RowMenu
    anchor={rowMenu.anchor}
    kind={rowMenu.kind}
    id={rowMenu.id}
    onMove={(anchor) => {
      rowMenu = null
      moving = anchor
    }}
    onSettings={() => {
      const menu = rowMenu
      rowMenu = null
      if (!menu) return
      if (menu.kind === 'block') blockSettings = menu.id
      else entrySettings = [menu.id]
    }}
    onDismiss={() => (rowMenu = null)}
  />
{/if}

<style>
  /* Fixed. `bottom: 45px` is the height of AMQ's menu bar. */
  .screen {
    position: fixed;
    inset: 0 0 45px 0;
    display: flex;
    flex-direction: column;
    font-size: 15px;
  }

  .panes {
    flex: 1 1 0;
    min-height: 0;
    display: flex;
    gap: 16px;
    padding: 12px var(--gutter) 12px;
  }

  /* Positions the selection bar over this pane, not the viewport. */
  .quiz-host {
    position: relative;
    flex: 1 1 62%;
    min-width: 0;
    display: flex;
  }

  .failure {
    margin: 48px auto;
    max-width: 460px;
    text-align: center;
    color: var(--text-3);
  }

  .hint {
    display: block;
    margin-top: 10px;
    font-size: 12px;
    color: var(--text-5);
  }

  code {
    font-family: var(--font-mono);
    font-size: 11.5px;
    color: var(--text-3);
  }
</style>
