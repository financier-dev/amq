/**
 * `viewChanger.__controllers` is a plain mutable object. AMQ only ever calls
 * its entries as `openView(callback, arg)` and `closeView(arg)`
 * (viewChanger.js:44-60), so swapping an entry replaces a whole screen.
 *
 * Two modes:
 *   `wrapViewController`    — AMQ's screen keeps running and our hooks run
 *                             beside it. Use it to check a new screen's state
 *                             against the live game.
 *   `replaceViewController` — our screen runs instead. Other methods still
 *                             reach the original, because other modules call
 *                             them (for example `roomBrowser.joinLobby`).
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
 * The original stays on the prototype chain, so its other methods remain
 * callable: `ranked.js` calls `roomBrowser.joinLobby`, game invites call
 * `fireSpectateGame`.
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
