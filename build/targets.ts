/**
 * Every buildable thing in this repo, in one place.
 *
 * One target is one output file. `build/config.ts` turns a target into a vite
 * config, `build/build.ts` builds them all, and `vite.config.ts` picks a single
 * one for the dev server. Adding a script means adding an entry here — no new
 * config file, and nothing to keep in step with `dist/`.
 *
 * Projects live in their own folders (`ui/`, later `scripts/`, `local/`) but
 * share this build, so any of them can import from `shared/` via `@shared/*`.
 */

import type { MonkeyUserScript } from 'vite-plugin-monkey'

export interface Target {
  /** Script id. `AMQ_TARGET=<name>` selects it; also the dist file's stem. */
  name: string
  /** Entry module, relative to the repo root. */
  entry: string
  /** Output file under `dist/`. */
  fileName: string
  /**
   * `==UserScript==` metadata. vite-plugin-monkey writes the header from this,
   * so it is typed rather than a comment block that can drift from the build.
   */
  userscript: MonkeyUserScript
  /** Svelte needed? Keeps the compiler out of plain-TS script builds. */
  svelte?: boolean
}

/** Shared by everything that runs on the game's pages. */
const AMQ_MATCH = ['https://animemusicquiz.com/*']

export const targets: Target[] = [
  {
    name: 'amq-ui',
    entry: 'ui/src/main.ts',
    fileName: 'amq-ui.user.js',
    svelte: true,
    userscript: {
      name: 'AMQ UI',
      namespace: 'amq-ui',
      description: 'Reimplementation of the Anime Music Quiz interface',
      author: 'Financier',
      match: AMQ_MATCH,
      grant: ['unsafeWindow'],
      'run-at': 'document-end',
    },
  },
]

export const DEFAULT_TARGET = targets[0].name

export function findTarget(name = DEFAULT_TARGET): Target {
  const target = targets.find((candidate) => candidate.name === name)
  if (!target) {
    const known = targets.map((candidate) => candidate.name).join(', ')
    throw new Error(`unknown build target "${name}" — known targets: ${known}`)
  }
  return target
}
