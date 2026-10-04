/**
 * Mounts Svelte components into a shadow root.
 *
 * AMQ's page is global Bootstrap 3 + jQuery UI + perfectScrollbar CSS, and the
 * tampermonkey repo layers more on top. A shadow root is what makes rewriting
 * one screen at a time viable: their CSS cannot reach in, ours cannot leak out.
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
 * Token edits, hot.
 *
 * Component styles already hot-reload on their own — `css: 'injected'` makes
 * each one part of its component's module, so Svelte's HMR carries it. This
 * file's `?inline` import is just a string, though, and a string has no
 * handler: without this, editing a token in `app.css` falls back to a full
 * page reload, which on the live site means reconnecting to the game and
 * navigating back to the screen you were looking at.
 *
 * Every shadow root adopts this one sheet object, so replacing its contents
 * restyles every mounted screen in place. `import.meta.hot` is undefined in a
 * build, so none of this ships.
 */
if (import.meta.hot) {
  import.meta.hot.accept('../ui/app.css?inline', (updated) => {
    if (!sheet || !updated) return
    sheet.replaceSync(updated.default as string)
  })
}

/**
 * Creates a host element, attaches a shadow root with our stylesheet, and
 * mounts `component` inside it.
 *
 * Caveat: `@font-face` does not inherit into a shadow root — webfonts must be
 * declared in the document, see `ui/fonts.ts`.
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
