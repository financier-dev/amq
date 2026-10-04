<!--
  The 14px gutter at the head of an entry row (SPEC §5.5).

  Two consecutive entries can be chained so they always play back to back, even
  when the block is shuffled. The button sits on the *boundary* between the two
  rows, and is always present at 30% opacity so the affordance is discoverable —
  the live builder does the same, and a button that only appears on hover is one
  nobody finds.

  The rail runs from the middle of the upper row to the middle of the lower one,
  which no single row can draw: each renders its own half, hence `chainedUp` and
  `chainedDown`. The flag itself lives on the *lower* entry (`connectUp`), which
  is how AMQ stores it.
-->
<script lang="ts">
  interface Props {
    canChainUp: boolean
    chainedUp: boolean
    chainedDown: boolean
    onToggle: () => void
    label: string
  }

  let { canChainUp, chainedUp, chainedDown, onToggle, label }: Props = $props()
</script>

<div class="gutter">
  {#if chainedUp}
    <span class="rail up" aria-hidden="true"></span>
  {/if}
  {#if chainedDown}
    <span class="rail down" aria-hidden="true"></span>
  {/if}
  {#if canChainUp}
    <button
      type="button"
      class="link"
      class:on={chainedUp}
      aria-pressed={chainedUp}
      aria-label={label}
      title={label}
      onclick={onToggle}
    >
      <!-- Two interlocking arcs; a chain link reads at 9px where a glyph does not. -->
      <svg
        width="9"
        height="9"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M9.5 14.5l5-5M8 12l-2 2a3.5 3.5 0 105 5l2-2M16 12l2-2a3.5 3.5 0 10-5-5l-2 2"
          stroke="currentColor"
          stroke-width="2.4"
          stroke-linecap="round"
        />
      </svg>
    </button>
  {/if}
</div>

<style>
  .gutter {
    position: relative;
    flex: 0 0 var(--qb-chain);
    align-self: stretch;
  }

  /* Half-height each, meeting at the row boundary. */
  .rail {
    position: absolute;
    left: 50%;
    width: 2px;
    margin-left: -1px;
    background: var(--accent);
    border-radius: 1px;
  }

  .up {
    top: 0;
    height: 50%;
  }

  .down {
    top: 50%;
    height: 50%;
  }

  /*
   * Centred on the boundary, not inside the row: half of it overhangs the row
   * above. `z-index` keeps it over the rail it interrupts.
   */
  .link {
    position: absolute;
    top: 0;
    left: 50%;
    z-index: 1;
    transform: translate(-50%, -50%);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    height: 14px;
    padding: 0;
    border: 0;
    border-radius: 4px;
    background: var(--bg-list);
    color: var(--text-5);
    cursor: pointer;
    opacity: 0.3;
  }

  .link:hover,
  .link:focus-visible {
    opacity: 1;
    color: var(--accent-soft);
  }

  .link.on {
    opacity: 1;
    color: var(--accent);
  }
</style>
