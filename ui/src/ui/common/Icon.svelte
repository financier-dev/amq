<!--
  The handful of glyphs the screen uses, inline so there is no icon font and no
  second network request. Every one is decorative: the control it sits in always
  carries its own text or `aria-label`.
-->
<script lang="ts">
  interface Props {
    name:
      | 'back'
      | 'search'
      | 'filter'
      | 'plus'
      | 'close'
      | 'check'
      | 'lock'
      | 'eye'
      | 'play'
      | 'caret'
      | 'sliders'
      | 'copy'
      | 'undo'
    size?: number
    strokeWidth?: number
  }

  let { name, size = 15, strokeWidth = 2.2 }: Props = $props()

  const PATHS: Record<Props['name'], string> = {
    back: 'M15 18l-6-6 6-6',
    search: 'M20 20l-3.5-3.5',
    filter: 'M4 6h16M7 12h10M10 18h4',
    plus: 'M12 5v14M5 12h14',
    close: 'M6 6l12 12M18 6L6 18',
    check: 'M5 13l4.5 4.5L19 7',
    lock: 'M8 11V7.5a4 4 0 018 0V11',
    eye: 'M2 12s3.8-6 10-6 10 6 10 6-3.8 6-10 6-10-6-10-6z',
    play: '',
    caret: 'M6 9l6 6 6-6',
    // Settings sliders — the row's "all settings" affordance.
    sliders: 'M4 8h10M18 8h2M4 16h4M12 16h8',
    // Two offset sheets. A "+" here reads as "add", which is what made the
    // duplicate buttons unguessable — they were asked about by name.
    copy: 'M9 9h10v10H9zM5 15H4V4h11v1',
    undo: 'M4 9h11a4.5 4.5 0 010 9h-6M4 9l4-4M4 9l4 4',
  }
</script>

{#if name === 'play'}
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M8 5v14l11-7z" />
  </svg>
{:else}
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width={strokeWidth}
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    {#if name === 'search'}
      <circle cx="11" cy="11" r="7" />
    {:else if name === 'lock'}
      <rect x="5" y="11" width="14" height="10" rx="2" />
    {:else if name === 'eye'}
      <circle cx="12" cy="12" r="2.4" />
    {:else if name === 'sliders'}
      <circle cx="16" cy="8" r="2.2" />
      <circle cx="10" cy="16" r="2.2" />
    {/if}
    <path d={PATHS[name]} />
  </svg>
{/if}
