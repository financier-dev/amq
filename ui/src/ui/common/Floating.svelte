<!--
  A panel positioned against an anchor in viewport coordinates.

  Everything that escapes a row has to be `position: fixed`: the list is a
  scroll container and the chips cell clips its overflow, so an absolutely
  positioned tooltip gets cut off at the row edge — which is why the modifier
  tooltips never appeared in game. Fixed positioning escapes both, as long as
  no ancestor has a transform (none do).

  Placement flips when there isn't room, and the panel closes on scroll rather
  than chasing the anchor.
-->
<script lang="ts">
  import type { Snippet } from 'svelte'

  interface Props {
    anchor: HTMLElement | null
    /** Preferred side; flipped automatically when it doesn't fit. */
    placement?: 'above' | 'below'
    /** Which edge of the anchor the panel lines up with. */
    align?: 'start' | 'end'
    width?: number
    maxWidth?: number
    onEnter?: () => void
    onLeave?: () => void
    onDismiss?: () => void
    /**
     * Close when a pointer goes down anywhere outside the panel.
     *
     * On by default. A panel that cannot be dismissed by clicking away does
     * not merely linger — it sits over the page swallowing every later click,
     * so the whole screen reads as broken rather than the menu as stuck.
     */
    dismissOnOutside?: boolean
    children: Snippet
  }

  let {
    anchor,
    placement = 'below',
    align = 'start',
    width,
    maxWidth = 260,
    onEnter,
    onLeave,
    onDismiss,
    dismissOnOutside = true,
    children,
  }: Props = $props()

  const GAP = 6
  const MARGIN = 8

  let panel = $state<HTMLDivElement | null>(null)
  let left = $state(0)
  let top = $state(0)
  let placed = $state(false)

  $effect(() => {
    const element = panel
    if (!element || !anchor) return

    const position = () => {
      const from = anchor.getBoundingClientRect()
      const box = element.getBoundingClientRect()

      let x = align === 'end' ? from.right - box.width : from.left
      x = Math.min(Math.max(MARGIN, x), window.innerWidth - box.width - MARGIN)

      const below = from.bottom + GAP
      const above = from.top - box.height - GAP
      // Honour the caller's preference unless the panel would leave the
      // viewport, then take whichever side has room.
      const fitsBelow = below + box.height <= window.innerHeight - MARGIN
      const fitsAbove = above >= MARGIN
      let y: number
      if (placement === 'below') y = fitsBelow || !fitsAbove ? below : above
      else y = fitsAbove || !fitsBelow ? above : below

      left = Math.round(x)
      top = Math.round(y)
      placed = true
    }

    position()

    // Re-measure once the panel has its final size (fonts, images).
    const frame = requestAnimationFrame(position)
    // Scrolling invalidates the anchor; dismissing beats drifting.
    const dismiss = () => onDismiss?.()
    window.addEventListener('scroll', dismiss, true)
    window.addEventListener('resize', dismiss)

    /*
     * `composedPath()` rather than `event.target`: the panel lives in a shadow
     * root, so a listener on the document sees the host element for anything
     * inside it and would treat every click on the panel as an outside click.
     *
     * The anchor is excluded deliberately. Its own handler toggles the panel
     * shut, and dismissing here as well would close and immediately reopen it.
     */
    const onPointerDown = (event: PointerEvent) => {
      if (!dismissOnOutside) return
      const path = event.composedPath()
      if (path.includes(element)) return
      if (anchor && path.includes(anchor)) return
      onDismiss?.()
    }
    document.addEventListener('pointerdown', onPointerDown, true)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', dismiss, true)
      window.removeEventListener('resize', dismiss)
      document.removeEventListener('pointerdown', onPointerDown, true)
    }
  })
</script>

<div
  bind:this={panel}
  class="floating"
  class:placed
  style:left="{left}px"
  style:top="{top}px"
  style:width={width ? `${width}px` : undefined}
  style:max-width="{maxWidth}px"
  onmouseenter={onEnter}
  onmouseleave={onLeave}
  role="presentation"
>
  {@render children()}
</div>

<style>
  .floating {
    position: fixed;
    z-index: 200;
    box-sizing: border-box;
    padding: 8px 10px;
    border-radius: var(--radius);
    background: var(--bg-pop);
    border: 1px solid var(--line-strong);
    box-shadow: 0 8px 22px rgba(0, 0, 0, 0.55);
    color: var(--text);
    text-align: left;
    /* Hidden until measured, so it never flashes at the wrong spot. */
    visibility: hidden;
  }

  .floating.placed {
    visibility: visible;
  }
</style>
