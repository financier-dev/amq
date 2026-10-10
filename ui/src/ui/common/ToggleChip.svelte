<!--
  A filter toggle drawn as a chip (SPEC §4): filled accent with a tick when
  on, dashed outline when off. It is a `<button>` with `aria-pressed`, so it
  is keyboard-reachable and announced correctly.
-->
<script lang="ts">
  import Icon from './Icon.svelte'

  interface Props {
    label: string
    on: boolean
    onToggle: () => void
  }

  let { label, on, onToggle }: Props = $props()
</script>

<button
  type="button"
  class="chip"
  class:on
  aria-pressed={on}
  onclick={onToggle}
>
  {#if on}
    <Icon name="check" size={10} strokeWidth={3.4} />
  {/if}
  {label}
</button>

<style>
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    height: 28px;
    padding: 0 11px;
    border-radius: 7px;
    background: rgba(255, 255, 255, 0.035);
    border: 1px dashed rgba(255, 255, 255, 0.17);
    color: var(--chip-off-fg);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
  }

  .chip:hover {
    border-color: rgba(255, 255, 255, 0.3);
    color: var(--text-2);
  }

  .chip.on {
    background: rgba(91, 155, 245, 0.2);
    border: 1px solid rgba(91, 155, 245, 0.48);
    color: var(--accent-soft);
    font-weight: 600;
  }

  .chip.on:hover {
    background: rgba(91, 155, 245, 0.28);
  }
</style>
