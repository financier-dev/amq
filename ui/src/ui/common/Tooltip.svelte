<!--
  Tooltip that opens on hover or keyboard focus. It renders through
  `Floating`, so the list's scroll container and the chips cell do not clip it.
-->
<script lang="ts">
  import type { Snippet } from 'svelte'
  import Floating from './Floating.svelte'

  interface Props {
    text: string
    placement?: 'above' | 'below'
    wide?: boolean
    children: Snippet
  }

  let { text, placement = 'below', wide = false, children }: Props = $props()

  let anchor = $state<HTMLSpanElement | null>(null)
  let open = $state(false)
</script>

<span
  bind:this={anchor}
  class="tip-anchor"
  onmouseenter={() => (open = true)}
  onmouseleave={() => (open = false)}
  onfocusin={() => (open = true)}
  onfocusout={() => (open = false)}
  role="presentation"
>
  {@render children()}
</span>

{#if open && anchor}
  <Floating
    {anchor}
    {placement}
    maxWidth={wide ? 340 : 260}
    onDismiss={() => (open = false)}
  >
    <span class="text">{text}</span>
  </Floating>
{/if}

<style>
  .tip-anchor {
    display: inline-flex;
  }

  .text {
    display: block;
    font-size: 12px;
    font-weight: 400;
    line-height: 1.45;
    white-space: normal;
  }
</style>
