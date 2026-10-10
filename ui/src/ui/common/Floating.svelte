<!--
  A panel positioned against an anchor in viewport coordinates.

  The panel is `position: fixed` because the list is a scroll container and
  the chips cell clips its overflow. An absolutely positioned panel would be
  cut off at the row edge. Fixed positioning escapes both as long as no
  ancestor has a transform, and none has.

  The placement flips when there is no room. The panel closes on scroll; it
  does not follow the anchor.
-->
<script lang="ts">
  import type { Snippet } from 'svelte'

  interface Props {
    anchor: HTMLElement | null
    /** Preferred side. Flips when the panel does not fit. */
    placement?: 'above' | 'below'
    /** The edge of the anchor that the panel aligns with. */
    align?: 'start' | 'end'
    width?: number
    maxWidth?: number
    onEnter?: () => void
    onLeave?: () => void
    onDismiss?: () => void
    /**
     * Close when a pointer goes down outside the panel. On by default: a
     * panel that stays open covers the page and takes every later click.
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
      // Use the preferred side unless the panel would leave the viewport.
      // Then use the side that has room.
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

    // Measure again once fonts and images have set the panel's final size.
    const frame = requestAnimationFrame(position)
    // A scroll moves the anchor, so close the panel.
    const dismiss = () => onDismiss?.()
    window.addEventListener('scroll', dismiss, true)
    window.addEventListener('resize', dismiss)

    /*
     * Use `composedPath()`, not `event.target`. The panel is in a shadow
     * root, so a document listener sees the host element as the target of
     * any click inside it, and every click on the panel would count as
     * outside.
     *
     * The anchor is excluded. Its own handler closes the panel, and a second
     * dismiss here would close and reopen it.
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
    /* Hidden until measured, so it never appears in the wrong place. */
    visibility: hidden;
  }

  .floating.placed {
    visibility: visible;
  }
</style>
