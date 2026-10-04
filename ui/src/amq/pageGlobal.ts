/**
 * Reading AMQ's globals from inside the userscript sandbox.
 *
 * Tampermonkey runs a granted script with its own `window`, and page globals
 * are reachable as *bare identifiers* (they resolve through the sandbox's
 * prototype chain) but **not** as properties of `globalThis` — `globalThis.$`
 * is `undefined` even though `$` is a live jQuery on the page.
 *
 * Most of this project reads AMQ globals as bare identifiers, which is why
 * they work. jQuery is the exception: Svelte reserves the bare `$` for runes,
 * so it has to be reached by name — and doing that through `globalThis` is
 * what stopped the player profile from ever opening.
 */

import { unsafeWindow } from 'vite-plugin-monkey/dist/client'

export function pageGlobal<T = unknown>(name: string): T | undefined {
  const page = unsafeWindow as any
  return page?.[name] ?? (globalThis as any)[name]
}
