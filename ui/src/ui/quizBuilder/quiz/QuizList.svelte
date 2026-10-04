<!--
  The quiz pane: header band over one scrolling, grouped list (SPEC §5).

  The list is a flat array of row descriptors rather than a component per rule
  block (SPEC §13). That is what makes selection span blocks, a drag cross from
  one block to another, and the whole pane scroll as one — all three are awkward
  across a component boundary and trivial over a flat array.

  Nesting is one level and the UI says so: the button up here reads *Add rule
  block*, and each block's footer offers only the three kinds that may live
  inside one.
-->
<script lang="ts">
  import { t } from '../../../amq/derive'
  import { quizStore } from '../../../amq/quiz.svelte'
  import { describeAnime, describeSong } from '../../../amq/library.svelte'
  import type { Entry } from '../../../amq/quizModel'
  import Icon from '../../common/Icon.svelte'
  import { dragState } from '../dnd.svelte'
  import { buildRows } from '../rows'
  import EntryRow from './EntryRow.svelte'
  import NestedBlock from './NestedBlock.svelte'
  import RuleBlockHeader from './RuleBlockHeader.svelte'

  interface Props {
    onBlockSettings: (blockId: string) => void
    onEntrySettings: (entryId: string) => void
    onAlgorithmSettings: (entryId: string) => void
    onMenu: (anchor: HTMLElement, kind: 'block' | 'entry', id: string) => void
  }

  let { onBlockSettings, onEntrySettings, onAlgorithmSettings, onMenu }: Props =
    $props()

  let search = $state('')
  let collapsed = $state(new Set<string>())
  /** Anchor for shift-click ranges. */
  let lastClicked: string | null = null

  /**
   * Quiz-pane search. It has to reach the library, because an entry holds ids
   * and the player is searching for the name they can see.
   */
  function matches(entry: Entry): boolean {
    const needle = search.trim().toLowerCase()
    if (!needle) return true

    if (entry.kind === 'anime') {
      return describeAnime(entry.annId).name.toLowerCase().includes(needle)
    }
    if (entry.kind === 'song') {
      const song = describeSong(entry.annSongId)
      return (
        song.title.toLowerCase().includes(needle) ||
        song.artist.toLowerCase().includes(needle) ||
        song.animeName.toLowerCase().includes(needle)
      )
    }
    if (entry.kind === 'message')
      return entry.message.toLowerCase().includes(needle)
    if (entry.kind === 'title')
      return entry.title.toLowerCase().includes(needle)
    // An algorithm block has no text of its own to match.
    return false
  }

  const rows = $derived(
    buildRows(quizStore.quiz, {
      collapsed,
      targetBlockId: quizStore.targetBlockId,
      matches: search.trim() ? matches : undefined,
    })
  )

  function toggleCollapse(blockId: string) {
    const next = new Set(collapsed)
    if (next.has(blockId)) next.delete(blockId)
    else next.add(blockId)
    collapsed = next
  }

  /** Shift extends from the last plain click; a plain click starts a new range. */
  function select(id: string, event: MouseEvent) {
    if (event.shiftKey && lastClicked) {
      quizStore.selectRange(lastClicked, id)
      return
    }
    quizStore.toggleSelected(id)
    lastClicked = id
  }

  function blockAllSelected(blockId: string) {
    const block = quizStore.quiz.blocks.find((item) => item.id === blockId)
    if (!block || block.entries.length === 0) return false
    return block.entries.every((entry) => quizStore.selection.has(entry.id))
  }

  /**
   * Where a drop would land, given the pointer's position within a row.
   *
   * Top half inserts before the row, bottom half after it. Measuring against
   * the row under the pointer — rather than computing an index from a fixed row
   * height — is what lets entries and taller nested blocks share one list.
   */
  function hover(event: DragEvent, blockId: string, index: number) {
    if (!dragState.active) return
    event.preventDefault()
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
    const box = (event.currentTarget as HTMLElement).getBoundingClientRect()
    const after = event.clientY > box.top + box.height / 2
    dragState.enter({ blockId, index: after ? index + 1 : index })
  }

  /** Dropping on a block's footer appends to that block. */
  function hoverEnd(event: DragEvent, blockId: string) {
    if (!dragState.active) return
    event.preventDefault()
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
    dragState.enter({ blockId, index: -1 })
  }

  function indicatorAt(blockId: string, index: number) {
    const over = dragState.over
    return over?.blockId === blockId && over.index === index
  }

  function addNested(blockId: string, kind: 'algorithm' | 'message' | 'title') {
    if (kind === 'message') {
      quizStore.addEntry(
        {
          kind: 'message',
          connectUp: false,
          locked: false,
          message: '',
          avatar: null,
          videoDisplay: false,
          delay: 0,
          time: 5,
        },
        blockId
      )
      return
    }
    if (kind === 'title') {
      quizStore.addEntry(
        { kind: 'title', connectUp: false, locked: false, title: '' },
        blockId
      )
      return
    }
    // An algorithm block is configured before it exists: AMQ's dialog creates
    // it, so the target block is set and the caller opens the modal.
    quizStore.targetBlockId = blockId
    onAlgorithmSettings('')
  }
</script>

<section class="pane">
  <header class="band">
    <h2 class="title">{t('quiz_builder.title', 'Quiz')}</h2>
    <span class="count mono">{quizStore.entryCount} entries</span>

    <label class="search">
      <Icon name="search" size={15} />
      <input
        id="amq-ui-quiz-search"
        type="search"
        placeholder="Search this quiz"
        bind:value={search}
      />
    </label>

    <button
      type="button"
      class="add-block"
      disabled={quizStore.capReached('rule') !== null}
      title={quizStore.capReached('rule') ?? 'Add a rule block'}
      onclick={() => quizStore.addRuleBlock()}
    >
      <Icon name="plus" size={15} />
      {t('quiz_builder.rule_button.title', 'Add rule block')}
    </button>
  </header>

  <div class="list">
    {#each rows as row (row.id)}
      {#if row.kind === 'block'}
        <RuleBlockHeader
          block={row.block}
          position={row.position}
          tone={row.tone}
          info={quizStore.info(row.block)}
          chosen={quizStore.chosen(row.block)}
          collapsed={collapsed.has(row.block.id)}
          isTarget={row.isTarget}
          allSelected={blockAllSelected(row.block.id)}
          onToggleCollapse={() => toggleCollapse(row.block.id)}
          onSelectAll={(on) => quizStore.selectBlock(row.block.id, on)}
          onToggleOrder={() =>
            quizStore.updateBlock(row.block.id, {
              randomOrder: !row.block.randomOrder,
            })}
          onSettings={() => onBlockSettings(row.block.id)}
          onDuplicate={() => quizStore.duplicateRuleBlock(row.block.id)}
          onMenu={(anchor) => onMenu(anchor, 'block', row.block.id)}
        />
      {:else if row.kind === 'entry'}
        <div
          class="row-host"
          role="presentation"
          ondragover={(event) => hover(event, row.block.id, row.indexInBlock)}
          ondrop={(event) => {
            event.preventDefault()
            dragState.drop()
          }}
        >
          {#if indicatorAt(row.block.id, row.indexInBlock)}
            <div class="drop-line">
              <span class="drop-count">{dragState.count}</span>
            </div>
          {/if}
          <EntryRow
            entry={row.entry}
            pool={quizStore.pool(row.entry)}
            selected={quizStore.selection.has(row.entry.id)}
            canChainUp={row.canChainUp}
            chainedUp={row.chainedUp}
            chainedDown={row.chainedDown}
            onSelect={(event) => select(row.entry.id, event)}
            onToggleChain={() => quizStore.toggleChain(row.entry.id)}
            onToggleType={(type) =>
              quizStore.toggleSongType(row.entry.id, type)}
            onPick={(value) => quizStore.setNumberOfSongs(row.entry.id, value)}
            onToggleLock={() => quizStore.toggleLock(row.entry.id)}
            onSettings={() => onEntrySettings(row.entry.id)}
            onMenu={(anchor) => onMenu(anchor, 'entry', row.entry.id)}
            onDragStart={() => dragState.start(row.entry.id)}
            onDragEnd={() => dragState.cancel()}
          />
        </div>
      {:else if row.kind === 'nested'}
        <NestedBlock
          entry={row.entry}
          tone={row.tone}
          selected={quizStore.selection.has(row.entry.id)}
          onSelect={(event) => select(row.entry.id, event)}
          onSettings={() => onAlgorithmSettings(row.entry.id)}
          onDuplicate={() => quizStore.duplicateEntries([row.entry.id])}
          onMenu={(anchor) => onMenu(anchor, 'entry', row.entry.id)}
        />
      {:else}
        <div
          class="footer"
          class:drop-into={dragState.active &&
            dragState.over?.blockId === row.block.id &&
            dragState.over.index === -1}
          role="presentation"
          ondragover={(event) => hoverEnd(event, row.block.id)}
          ondrop={(event) => {
            event.preventDefault()
            dragState.drop()
          }}
        >
          {#if row.empty}
            <span class="hint">
              {t(
                'quiz_builder.rule_block.tutorial_text',
                'Add anime or songs from the library to fill this block'
              )}
            </span>
          {/if}
          <span class="add-label">Add to this block:</span>
          {#each [{ kind: 'algorithm', label: 'Algorithm' }, { kind: 'message', label: 'Message' }, { kind: 'title', label: 'Title' }] as option (option.kind)}
            {@const blocked = quizStore.capReached(option.kind as any)}
            <button
              type="button"
              class="add-nested"
              disabled={blocked !== null}
              title={blocked ?? `Add a ${option.label.toLowerCase()} block`}
              onclick={() => addNested(row.block.id, option.kind as any)}
            >
              <Icon name="plus" size={13} />
              {option.label}
            </button>
          {/each}
          <!-- Stating the nesting rule where it would otherwise be violated. -->
          <span class="rule">no rule block inside a rule block</span>
        </div>
      {/if}
    {:else}
      <p class="empty">This quiz has no blocks yet.</p>
    {/each}
  </div>
</section>

<style>
  .pane {
    flex: 1 1 62%;
    min-width: 0;
    display: flex;
    flex-direction: column;
    background: var(--bg-list);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    overflow: hidden;
  }

  .band {
    flex: none;
    display: flex;
    align-items: center;
    gap: 10px;
    height: var(--qb-band-h);
    padding: 0 14px;
    background: var(--bg-head);
    border-bottom: 1px solid var(--line);
  }

  .title {
    margin: 0;
    font-family: var(--font-display);
    font-size: 16px;
    font-weight: 700;
  }

  .count {
    font-size: var(--qb-text-sm);
    color: var(--text-4);
  }

  .search {
    flex: 1 1 0;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 6px;
    height: 34px;
    padding: 0 11px;
    border-radius: 8px;
    background: var(--bg-sunken);
    border: 1px solid var(--line-soft);
    color: var(--text-4);
  }

  .search input {
    flex: 1 1 0;
    min-width: 0;
    border: 0;
    background: transparent;
    color: var(--text);
    font-family: inherit;
    font-size: var(--qb-text);
    outline: none;
  }

  .add-block {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    height: 34px;
    padding: 0 14px;
    border: 0;
    border-radius: 8px;
    background: var(--accent);
    color: var(--accent-fg);
    font-size: var(--qb-text);
    font-weight: 700;
    white-space: nowrap;
    cursor: pointer;
  }

  .add-block:disabled {
    background: var(--bg-raised);
    color: var(--text-5);
    cursor: default;
  }

  .list {
    flex: 1 1 0;
    overflow-y: auto;
    overflow-x: hidden;
  }

  /* Positions the drop line against the row it belongs above. */
  .row-host {
    position: relative;
  }

  .drop-line {
    position: absolute;
    top: -1px;
    left: 14px;
    right: 12px;
    z-index: 2;
    height: 2px;
    background: var(--accent);
    border-radius: 1px;
  }

  /* The count travels with the line: a 12-row drag must not look like one. */
  .drop-count {
    position: absolute;
    top: -8px;
    left: -6px;
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    border-radius: 8px;
    background: var(--accent);
    color: var(--accent-fg);
    font-family: var(--font-mono);
    font-size: 9.5px;
    font-weight: 700;
    line-height: 16px;
    text-align: center;
  }

  .footer {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
    padding: 9px 14px 11px calc(var(--qb-check-x) + 4px);
    border-bottom: 1px solid var(--line);
  }

  /* Dropping here appends to the block, so the whole zone lights up. */
  .drop-into {
    background: rgba(91, 155, 245, 0.12);
    outline: 1px dashed var(--accent);
    outline-offset: -3px;
  }

  .hint {
    flex-basis: 100%;
    font-size: var(--qb-text-sm);
    color: var(--text-5);
  }

  .add-label {
    font-size: var(--qb-text-xs);
    color: var(--text-4);
  }

  .add-nested {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    height: 27px;
    padding: 0 10px;
    border-radius: 6px;
    background: var(--bg-raised);
    border: 1px solid var(--line-soft);
    color: var(--text-2);
    font-size: var(--qb-text-sm);
    font-weight: 600;
    cursor: pointer;
  }

  .add-nested:hover:not(:disabled) {
    border-color: var(--line-strong);
    color: var(--text);
  }

  .add-nested:disabled {
    opacity: 0.45;
    cursor: default;
  }

  .rule {
    margin-left: auto;
    font-size: var(--qb-text-xs);
    color: var(--text-5);
    font-style: italic;
  }

  .empty {
    padding: 24px;
    text-align: center;
    color: var(--text-4);
  }
</style>
