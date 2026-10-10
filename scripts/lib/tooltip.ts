// Shared hover tooltip: a single floating box reused by every script that needs
// one, so only one element ever exists in the DOM.

const TOOLTIP_ID = 'amq-shared-tooltip'
const MAX_WIDTH = 420

export const TooltipColors = {
  CORRECT_TITLE: '#5cb85c',
  PLAYER_ANSWER: 'indianred',
  MUTED: '#a0a0a0',
}

function getTooltipEl() {
  const existing = document.getElementById(TOOLTIP_ID)
  if (existing instanceof HTMLElement) return existing

  const tooltip = document.createElement('div')
  tooltip.id = TOOLTIP_ID
  tooltip.style.position = 'fixed'
  tooltip.style.display = 'none'
  tooltip.style.zIndex = '10000'
  // Translucent via rgba rather than `opacity`, so the text stays crisp.
  tooltip.style.backgroundColor = 'rgba(27, 27, 27, 0.85)'
  tooltip.style.border = '1px solid rgba(77, 77, 77, 0.85)'
  tooltip.style.borderRadius = '4px'
  tooltip.style.boxShadow = '0 0 5px 2px rgb(0, 0, 0)'
  tooltip.style.color = 'white'
  tooltip.style.padding = '0.4rem 0.6rem'
  tooltip.style.fontSize = '14px'
  tooltip.style.lineHeight = '1.4'
  // Shrink to fit the content, but cap it so a long anime title wraps instead
  // of stretching the box across the screen.
  tooltip.style.width = 'max-content'
  tooltip.style.maxWidth = `${MAX_WIDTH}px`
  tooltip.style.textAlign = 'left'
  tooltip.style.pointerEvents = 'none'
  document.body.appendChild(tooltip)

  return tooltip
}

export function makeTooltipLine(...parts: (string | HTMLElement)[]) {
  const line = document.createElement('div')
  line.style.overflowWrap = 'break-word'
  line.append(...parts)
  return line
}

export function makeColoredText(text: string, color: string) {
  const span = document.createElement('span')
  span.style.color = color
  span.innerText = text
  return span
}

export function showTooltip(lines: HTMLElement[], anchor: DOMRect) {
  const tooltip = getTooltipEl()
  tooltip.replaceChildren(...lines)
  tooltip.style.display = 'block'

  // Positioned after being made visible so the measured size is accurate.
  const { width, height } = tooltip.getBoundingClientRect()
  const left = Math.min(
    Math.max(anchor.left + anchor.width / 2 - width / 2, 4),
    window.innerWidth - width - 4
  )
  const top =
    anchor.top - height - 6 >= 0 ? anchor.top - height - 6 : anchor.bottom + 6

  tooltip.style.left = `${left}px`
  tooltip.style.top = `${top}px`
}

export function hideTooltip() {
  const tooltip = document.getElementById(TOOLTIP_ID)
  if (tooltip instanceof HTMLElement) {
    tooltip.style.display = 'none'
  }
}

export interface HoverTarget {
  el: HTMLElement
  getLines: () => HTMLElement[]
  // Optional scroll container. The target only counts while the cursor is
  // inside this rect too, so rows scrolled out of view don't trigger.
  clipEl?: HTMLElement
}

// Quiz page elements routinely end up on top of ours (and Nexus disables
// pointer events for everything outside its own whitelist), which swallows
// mouseenter. Hit testing the cursor against the rects on a document level
// mousemove works regardless. One listener serves every script.
const hoverGroups = new Map<string, HoverTarget[]>()
let hoveredEl: HTMLElement | null = null
let listening = false

const containsPoint = (rect: DOMRect, x: number, y: number) =>
  x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom

function findHoverTarget(x: number, y: number) {
  for (const [group, targets] of hoverGroups) {
    // Targets whose element left the DOM are dropped here, so callers never
    // have to unregister anything they remove.
    const live = targets.filter((target) => target.el.isConnected)
    if (live.length !== targets.length) {
      hoverGroups.set(group, live)
    }

    for (const target of live) {
      if (!containsPoint(target.el.getBoundingClientRect(), x, y)) continue

      if (
        target.clipEl &&
        !containsPoint(target.clipEl.getBoundingClientRect(), x, y)
      ) {
        continue
      }

      return target
    }
  }
}

function ensureHoverListener() {
  if (listening) return
  listening = true

  document.addEventListener('mousemove', (event) => {
    const target = findHoverTarget(event.clientX, event.clientY)

    if (!target) {
      hoveredEl = null
      hideTooltip()
      return
    }

    if (target.el === hoveredEl) return

    hoveredEl = target.el
    showTooltip(target.getLines(), target.el.getBoundingClientRect())
  })
}

export function setHoverTargets(group: string, targets: HoverTarget[]) {
  ensureHoverListener()
  hoverGroups.set(group, targets)
  hoveredEl = null
}

export function addHoverTarget(group: string, target: HoverTarget) {
  ensureHoverListener()
  const targets = hoverGroups.get(group)

  if (targets) {
    targets.push(target)
  } else {
    hoverGroups.set(group, [target])
  }
}

export function clearHoverTargets(group: string) {
  hoverGroups.delete(group)
  hoveredEl = null
}
