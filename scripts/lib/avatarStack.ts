const STACK_CLASS = 'amq-avatar-stack'
const BASE_CONTAINER_WIDTH = 160

const STYLE_ID = 'amq-avatar-stack-styles'

let resizeListenerRegistered = false
let stylesInjected = false

/*
 * `.qpAvatarBuffContainerOuter` sits at `top: 100%` (below the avatar) and
 * `updateBuffContainerSize` gives the container inside it an inline height of
 * `documentHeight - topOffset - BOTTOM_BAR_SIZE` — an invisible rect running to
 * the bottom of the page, right where the stack lives. It is a descendant of
 * the avatar's click target, so clicking anywhere in that area opens the player
 * menu. Take the empty container out of hit testing but leave the buff icons
 * themselves interactive, so Nexus buffs still hover and click normally.
 */
const stackCss = `
.qpAvatarBuffContainerOuter {
  pointer-events: none;
}

.qpAvatarBuffContainerOuter .qpAvatarBuff {
  pointer-events: auto;
}
`

function injectStyles() {
  if (stylesInjected || document.getElementById(STYLE_ID)) return
  stylesInjected = true

  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = stackCss
  document.head.appendChild(style)
}

function getAvatarContainerWidth() {
  const avatarContainer = document.querySelector(
    '.qpAvatarContainerOuter:not(.hide)'
  )
  return avatarContainer?.clientWidth ?? 0
}

function getStackTransform() {
  const scale = getAvatarContainerWidth() / BASE_CONTAINER_WIDTH
  return `translateY(calc(100% + 2rem)) scale(${scale})`
}

function registerResizeEvent() {
  if (resizeListenerRegistered) return
  resizeListenerRegistered = true

  window.addEventListener('resize', () => {
    ;[...document.querySelectorAll('.' + STACK_CLASS)].forEach((el) => {
      if (el instanceof HTMLElement) {
        el.style.transform = getStackTransform()
      }
    })
  })
}

/**
 * Single absolutely positioned column hanging below a player's avatar. Multiple
 * scripts share it, each owning its own slot (see `getAvatarStackSlot`).
 */
export function getAvatarStack(avatarContainer: HTMLElement) {
  registerResizeEvent()
  injectStyles()

  const existingStack = avatarContainer.querySelector('.' + STACK_CLASS)
  if (existingStack instanceof HTMLElement) return existingStack

  const stack = document.createElement('div')
  stack.className = STACK_CLASS
  stack.style.position = 'absolute'
  // The stack is a child of the avatar's click target but hangs below it, so
  // any click landing anywhere in this column would open the player menu.
  // Nothing in here is interactive (tooltips hit-test the cursor on a document
  // level mousemove), so take the whole column out of hit testing.
  stack.style.pointerEvents = 'none'
  stack.style.display = 'flex'
  stack.style.flexDirection = 'column'
  stack.style.rowGap = '0.2rem'
  stack.style.transform = getStackTransform()
  stack.style.transformOrigin = 'top'
  stack.style.left = '0'
  stack.style.right = '0'
  stack.style.bottom = '0'
  avatarContainer.appendChild(stack)

  return stack
}

/**
 * A slot within the avatar stack. `order` controls the vertical position
 * regardless of the order in which scripts create their slots.
 */
export function getAvatarStackSlot(
  avatarContainer: HTMLElement,
  className: string,
  order: number
) {
  const stack = getAvatarStack(avatarContainer)

  const existingSlot = stack.querySelector('.' + className)
  if (existingSlot instanceof HTMLElement) return existingSlot

  const slot = document.createElement('div')
  slot.className = className
  slot.style.display = 'flex'
  slot.style.flexDirection = 'column'
  slot.style.rowGap = '0.2rem'
  slot.style.order = String(order)
  stack.appendChild(slot)

  return slot
}
