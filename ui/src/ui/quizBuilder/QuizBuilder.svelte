<!--
  The Quiz Builder screen (SPEC §1).

  A 60px top bar over two independently scrolling panes: the library at 38%, the
  quiz at 62%, 16px apart inside a 24px gutter. AMQ's menu bar keeps the bottom
  ~45px of the viewport and is not ours — the screen reserves that strip rather
  than covering it, exactly as the room browser does.

  Overlays are owned here rather than by the panes that trigger them, because
  several of them are opened from more than one place: the block picker serves
  both "Adds to" and "Move", and the entry settings panel is reachable from a
  row, an override chip, a ⋯ menu and the selection bar.
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

  /** Which overlay is open, if any. One at a time, by construction. */
  let picker = $state<{
    anchor: HTMLElement
    /** Set for a one-off add; absent means "re-aim the pane". */
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
   * AMQ checks the name before opening its save dialog, and so do we — a dialog
   * whose only button is disabled explains nothing.
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
   * Throws away every change since the last save.
   *
   * Confirmed through AMQ's own Swal so it looks like every other destructive
   * prompt in the game, and worded as what it does rather than as its button
   * label — "Undo" is the affordance, discarding your work is the effect.
   */
  function revert() {
    if (!quizStore.dirty) return
    Swal.fire({
      title: 'Discard changes?',
      text: quizStore.quizId
        ? 'This puts the quiz back to the last version you saved. It cannot be undone.'
        : 'This clears the quiz back to empty. It cannot be undone.',
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
        // Openings on, endings on, inserts off — AMQ's own default for a new
        // anime block, and the one people change least often.
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
   * The algorithm dialog is AMQ's. `setModeQuizBuilder` takes the settings to
   * edit and an object it will call `updateSettings` on when the player
   * confirms — so we hand it a shim that writes back into our model. With no
   * entry id it creates instead, and AMQ routes that through
   * `customQuizCreator.createAlgorithmBlock`, which we also own.
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
   * Opening is a toggle: clicking the button that opened a menu closes it.
   * `Floating` deliberately ignores its own anchor when dismissing on an
   * outside click, so without this the second click would close and reopen it
   * in the same gesture and the menu would look stuck.
   */
  function openMenu(anchor: HTMLElement, kind: 'block' | 'entry', id: string) {
    rowMenu =
      rowMenu?.anchor === anchor && rowMenu.id === id
        ? null
        : { anchor, kind, id }
  }

  /**
   * Whether a key belongs to whatever has focus rather than to the screen.
   *
   * Checking `tagName === 'INPUT'` is not enough: clicking a row's checkbox
   * focuses it, and every shortcut below would then be dead until you clicked
   * somewhere else. Only controls you actually *type* into swallow keys.
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

  /** SPEC §11's shortcuts. Ignored while a text field has focus. */
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
      // Anchor on the quiz pane itself — there is no button under the cursor.
      const anchor = document.activeElement as HTMLElement
      if (anchor) moving = anchor
    }
  }

  /**
   * Keeps our own key events inside the shadow root.
   *
   * `setup.js:56` blocks Backspace unless `event.target` is an input — but an
   * event crossing a shadow boundary is retargeted to the host, so AMQ sees our
   * wrapper div, decides the key came from outside a field, and cancels it. The
   * result is that Backspace does nothing in either search box.
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
      <!-- The escape hatch is the honest next step, so name it. -->
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
      // Picking from any "add to…" popover re-targets the pane too (SPEC §4).
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
  /*
   * Fixed, and stopping short of AMQ's menu bar. `bottom: 45px` is that bar's
   * height, not a margin — the strip belongs to AMQ.
   */
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

  /* Positions the selection island over this pane rather than the viewport. */
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
