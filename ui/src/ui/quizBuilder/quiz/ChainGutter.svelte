<!--
  The 14px gutter at the start of an entry row (SPEC §5.5).

  Two consecutive entries can be chained so they always play back to back,
  even when the block is shuffled. The button sits on the boundary between the
  two rows. It is always visible at 30% opacity so that players can find it,
  as in AMQ's builder.

  The rail runs from the middle of the upper row to the middle of the lower
  one. Each row draws its own half, hence `chainedUp` and `chainedDown`. The
  flag is on the *lower* entry (`connectUp`), as AMQ stores it.
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
      <!-- Two interlocking arcs. A chain link stays readable at 9px. -->
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

  /* Each half is 50% high. The halves meet at the row boundary. */
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
   * Centred on the row boundary: half of it overhangs the row above.
   * `z-index` keeps it above the rail.
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
