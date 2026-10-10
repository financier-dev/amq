/**
 * Reads an AMQ global from inside the userscript sandbox.
 *
 * Tampermonkey gives a granted script its own `window`. Page globals resolve
 * as bare identifiers, through the sandbox's prototype chain, but not as
 * properties of `globalThis`: `globalThis.$` is `undefined` while `$` is the
 * page's jQuery.
 *
 * Most code here uses bare identifiers. jQuery cannot, because Svelte reserves
 * the bare `$` for runes, so read it by name through this function.
 */

import { unsafeWindow } from 'vite-plugin-monkey/dist/client'

export function pageGlobal<T = unknown>(name: string): T | undefined {
  const page = unsafeWindow as any
  return page?.[name] ?? (globalThis as any)[name]
}
