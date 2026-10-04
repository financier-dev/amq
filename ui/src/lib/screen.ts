/**
 * Installing one of our screens over one of AMQ's.
 *
 * Extracted from `main.ts` when the quiz builder became the second screen. The
 * three awkward parts of the handover are all here rather than duplicated per
 * screen, because each of them was a bug once:
 *
 *   - `changeView` early-returns when the target is already the current view
 *     (`viewChanger.js:45`), so swapping the controller under our feet cannot
 *     be done through it. Drive the restored controller directly instead.
 *   - Taking over while AMQ's screen is open leaves its DOM and its listeners
 *     behind ours, so close it first.
 *   - A screen is hidden rather than unmounted, so reopening it is instant and
 *     its scroll position survives.
 */

import type { Component } from 'svelte'

import { mountShadowApp, type ShadowApp } from './shadow'
import { replaceViewController } from '../amq/viewController'

export interface ScreenOptions<Props extends Record<string, any>> {
  /** Key in `viewChanger.__controllers`. */
  view: string
  component: Component<Props>
  props: Props
  /** Runs when the screen opens; receives whatever `changeView` was passed. */
  onOpen?: (arg?: any) => void
  onClose?: () => void
  zIndex?: number
  /**
   * Extra controller methods to define on our replacement.
   *
   * The controllers are not only view hooks — other parts of AMQ call into
   * them. Anything listed here shadows the original, so a handler that needs
   * to observe such a call should do its work and then delegate.
   */
  extra?: (original: ViewController) => Record<string, unknown>
}

export interface Screen {
  readonly view: string
  readonly installed: boolean
  install: () => void
  /** Hands the screen back to AMQ, live. The escape hatch. */
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
    // Above AMQ's page, below its menu bar's own stacking — the screen reserves
    // the bottom strip rather than covering it.
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
