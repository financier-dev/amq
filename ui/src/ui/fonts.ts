/**
 * Webfonts for the room browser.
 *
 * `@font-face` does not inherit into a shadow root, so the faces have to be
 * declared in the document even though everything that uses them lives inside
 * one. A stylesheet `<link>` is enough — the shadow tree then resolves the
 * family names normally.
 *
 * Every declaration in `app.css` keeps a real system fallback, so if this
 * request is blocked by CSP or the page is offline the screen renders in the
 * fallback stack rather than breaking.
 */

const FONT_HREF =
  'https://fonts.googleapis.com/css2' +
  '?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700' +
  '&family=IBM+Plex+Mono:wght@400;500;600' +
  '&family=IBM+Plex+Sans:wght@400;500;600;700' +
  '&display=swap'

const MARKER = 'amqUiFonts'

export function installFonts() {
  if (document.head.querySelector(`link[data-${MARKER.toLowerCase()}]`)) return
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = FONT_HREF
  link.dataset[MARKER] = ''
  document.head.appendChild(link)
}
