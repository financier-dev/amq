/**
 * The registry of build targets. One target is one output file.
 *
 * `build/config.ts` turns a target into a vite config, `build/build.ts` builds
 * them all, and `vite.config.ts` picks one for the dev server. To add a
 * script, add an entry here.
 */

import type { MonkeyUserScript } from 'vite-plugin-monkey'

export interface Target {
  /** `AMQ_TARGET=<name>` selects it for the dev server. */
  name: string
  /** Relative to the repo root. */
  entry: string
  /** Output file under `dist/`. */
  fileName: string
  /** vite-plugin-monkey writes the `==UserScript==` header from this. */
  userscript: MonkeyUserScript
  /** Set for targets that need the Svelte compiler. */
  svelte?: boolean
}

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
  {
    name: 'amq',
    entry: 'scripts/main.ts',
    fileName: 'amq.user.js',
    userscript: {
      name: 'AMQ Master Script',
      namespace: 'amq',
      description: "Financier's bundle of AMQ userscripts",
      author: 'Financier',
      match: AMQ_MATCH,
      grant: ['GM_addStyle'],
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
