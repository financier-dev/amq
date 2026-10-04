/**
 * `viewChanger.__controllers` is a plain mutable object whose entries are only
 * ever called as `openView(callback, arg)` / `closeView(arg)`
 * (viewChanger.js:44-60). That makes it the injection seam for replacing a
 * whole screen.
 *
 * Two modes:
 *   `wrapViewController`    — AMQ's screen keeps running, we run alongside it.
 *                             Use this while verifying state against the live
 *                             game.
 *   `replaceViewController` — ours runs instead, with non-view methods still
 *                             delegated to the original (other modules call
 *                             e.g. `roomBrowser.joinLobby` from outside).
 */

export interface ViewHooks {
  onOpen?: (arg?: any) => void
  onClose?: (arg?: any) => void
}

function requireController(name: string): ViewController {
  const original = viewChanger.__controllers[name]
  if (!original) {
    throw new Error(`[amq-ui] no such view controller: ${name}`)
  }
  return original
}

/** Runs our hooks around AMQ's own screen, leaving it fully functional. */
export function wrapViewController(name: string, hooks: ViewHooks) {
  const original = requireController(name)

  viewChanger.__controllers[name] = Object.create(original, {
    openView: {
      value: (callback: () => void, arg?: any) => {
        original.openView(() => {
          try {
            hooks.onOpen?.(arg)
          } catch (error) {
            console.error('[amq-ui] onOpen failed', error)
          }
          callback()
        }, arg)
      },
    },
    closeView: {
      value: (arg?: any) => {
        try {
          hooks.onClose?.(arg)
        } catch (error) {
          console.error('[amq-ui] onClose failed', error)
        }
        original.closeView(arg)
      },
    },
  })

  return () => {
    viewChanger.__controllers[name] = original
  }
}

/**
 * Replaces the screen entirely. The prototype chain keeps every other method
 * on the original controller reachable — `ranked.js` calls
 * `roomBrowser.joinLobby`, game invites call `fireSpectateGame`, and those must
 * keep working.
 */
export function replaceViewController(
  name: string,
  controller: ViewController
) {
  const original = requireController(name)
  viewChanger.__controllers[name] = Object.assign(
    Object.create(original),
    controller
  )
  return () => {
    viewChanger.__controllers[name] = original
  }
}
