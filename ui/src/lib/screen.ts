/**
 * Installs one of our screens over one of AMQ's.
 *
 * Three rules of the handover:
 *
 *   - `changeView` returns early when the target is already the current view
 *     (`viewChanger.js:45`), so it cannot re-open a view after its controller
 *     is swapped. Call the controller's `openView` directly.
 *   - Close AMQ's screen before taking over. Otherwise its DOM and listeners
 *     stay active behind ours.
 *   - Hide a screen on close; do not unmount it. Reopening is then instant
 *     and the scroll position survives.
 */

import type { Component } from 'svelte'

import { mountShadowApp, type ShadowApp } from './shadow'
import { replaceViewController } from '../amq/viewController'

export interface ScreenOptions<Props extends Record<string, any>> {
  /** Key in `viewChanger.__controllers`. */
  view: string
  component: Component<Props>
  props: Props
  /** Receives the argument `changeView` was called with. */
  onOpen?: (arg?: any) => void
  onClose?: () => void
  zIndex?: number
  /**
   * Extra methods for our replacement controller.
   *
   * Other parts of AMQ call controller methods beyond the two view hooks. A
   * method listed here shadows the original, so it must delegate to
   * `original` after doing its own work.
   */
  extra?: (original: ViewController) => Record<string, unknown>
}

export interface Screen {
  readonly view: string
  readonly installed: boolean
  install: () => void
  /** Hands the screen back to AMQ without a reload. */
  useLegacy: () => void
  useNew: () => void
  app: () => ShadowApp | null
}

export function createScreen<Props extends Record<string, any>>(
  options: ScreenOptions<Props>
): Screen {
  const {
    view,
    component,
    props,
    onOpen,
    onClose,
    extra,
    zIndex = 100,
  } = options

  let app: ShadowApp | null = null
  let restore: (() => void) | null = null

  function mount() {
    if (app) return app
    app = mountShadowApp(document.body, component, props)
    // Above AMQ's page but below its menu bar. The screen leaves the bottom
    // strip free for the bar.
    app.host.style.position = 'relative'
    app.host.style.zIndex = String(zIndex)
    return app
  }

  function reopenCurrentView() {
    if (viewChanger.getCurrentView() !== view) return
    viewChanger.__controllers[view].openView(() => {
      viewChanger.hideLoadingScreen()
    })
  }

  function install() {
    if (restore) return
    const original = viewChanger.__controllers[view]
    restore = replaceViewController(view, {
      ...(extra?.(original) ?? {}),
      openView(callback: () => void, arg?: any) {
        try {
          onOpen?.(arg)
        } catch (error) {
          console.error(`[amq-ui] ${view} onOpen failed`, error)
        }
        mount().show()
        callback()
      },
      closeView() {
        app?.hide()
        try {
          onClose?.()
        } catch (error) {
          console.error(`[amq-ui] ${view} onClose failed`, error)
        }
      },
    })
  }

  function useLegacy() {
    if (!restore) return
    app?.hide()
    onClose?.()
    restore()
    restore = null
    reopenCurrentView()
    console.log(`[amq-ui] ${view} handed back to AMQ`)
  }

  function useNew() {
    if (restore) return
    if (viewChanger.getCurrentView() === view) {
      viewChanger.__controllers[view].closeView({})
    }
    install()
    reopenCurrentView()
    console.log(`[amq-ui] ${view} is ours again`)
  }

  return {
    view,
    get installed() {
      return restore !== null
    },
    install,
    useLegacy,
    useNew,
    app: () => app,
  }
}
