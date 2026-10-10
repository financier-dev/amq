/**
 * Mounts Svelte components into a shadow root.
 *
 * AMQ's page loads global Bootstrap 3, jQuery UI and perfectScrollbar CSS, and
 * other userscripts add more. A shadow root keeps their CSS out and ours in.
 */

import { mount, unmount, type Component } from 'svelte'
import styles from '../ui/app.css?inline'

export interface ShadowApp {
  host: HTMLElement
  root: ShadowRoot
  show: () => void
  hide: () => void
  destroy: () => void
}

let sheet: CSSStyleSheet | null = null

function styleSheet() {
  if (!sheet) {
    sheet = new CSSStyleSheet()
    sheet.replaceSync(styles)
  }
  return sheet
}

/*
 * Hot updates for `app.css`.
 *
 * Component styles hot-reload through Svelte's HMR, because `css: 'injected'`
 * makes each one part of its component's module. `app.css` is imported with
 * `?inline` as a plain string, which has no HMR handler. Without this one,
 * editing `app.css` reloads the page, and on the live site that means
 * reconnecting to the game.
 *
 * Every shadow root adopts the same sheet object, so replacing its contents
 * restyles every mounted screen. `import.meta.hot` is undefined in a build.
 */
if (import.meta.hot) {
  import.meta.hot.accept('../ui/app.css?inline', (updated) => {
    if (!sheet || !updated) return
    sheet.replaceSync(updated.default as string)
  })
}

/**
 * `@font-face` rules do not apply from inside a shadow root. Declare webfonts
 * in the document; see `ui/fonts.ts`.
 */
export function mountShadowApp<Props extends Record<string, any>>(
  parent: HTMLElement,
  component: Component<Props>,
  props: Props
): ShadowApp {
  const host = document.createElement('div')
  host.dataset.amqUi = ''
  host.style.display = 'none'
  parent.appendChild(host)

  const root = host.attachShadow({ mode: 'open' })
  root.adoptedStyleSheets = [styleSheet()]

  const container = document.createElement('div')
  container.className = 'amq-ui-root'
  root.appendChild(container)

  const instance = mount(component, { target: container, props })

  return {
    host,
    root,
    show: () => (host.style.display = ''),
    hide: () => (host.style.display = 'none'),
    destroy: () => {
      unmount(instance)
      host.remove()
    },
  }
}
