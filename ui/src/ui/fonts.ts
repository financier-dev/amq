/**
 * Webfonts for our screens.
 *
 * `@font-face` rules do not apply from inside a shadow root, so the faces are
 * declared in the document with a stylesheet `<link>`. The shadow tree then
 * resolves the family names.
 *
 * Every font declaration in `app.css` keeps a system fallback. If CSP blocks
 * this request or the page is offline, the screen renders in the fallback.
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
