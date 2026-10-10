/**
 * Builds the vite config for a target.
 *
 * Both `vite.config.ts` (dev server) and `build/build.ts` (real build) use
 * it, so the dev script and the shipped script compile the same way.
 */

import { fileURLToPath } from 'node:url'

import { svelte } from '@sveltejs/vite-plugin-svelte'
import type { UserConfig } from 'vite'
import monkey from 'vite-plugin-monkey'

import type { Target } from './targets'

const root = fileURLToPath(new URL('..', import.meta.url))

/** Keep in step with `paths` in `tsconfig.json`. */
export const alias = {
  '@shared': fileURLToPath(new URL('../shared', import.meta.url)),
}

export function configFor(target: Target): UserConfig {
  return {
    root,
    resolve: { alias },
    plugins: [
      ...(target.svelte
        ? [
            svelte({
              /*
               * The screen mounts inside a shadow root. External CSS lands in
               * `document.head` (vite injects it in dev, `GM_addStyle` in the
               * build) and cannot cross into a shadow root. Svelte's injector
               * can: `append_styles` appends to the component's root node
               * when that is a ShadowRoot
               * (svelte/src/internal/client/dom/css.js). So emit no CSS asset
               * and let each component carry its own styles.
               */
              emitCss: false,
              compilerOptions: { css: 'injected' },
            }),
          ]
        : []),
      monkey({
        entry: target.entry,
        userscript: target.userscript,
        build: {
          fileName: target.fileName,
          // No CDN requires: each script stays a single plain file with
          // nothing to resolve at install time.
          externalGlobals: {},
        },
        server: {
          // Tampermonkey loads the dev script from the vite server itself.
          open: false,
        },
      }),
    ],
    build: {
      // Committed, so a script can be installed from the repo without a
      // toolchain.
      outDir: 'dist',
      // Every target writes to `dist/`, so one build must not delete another's
      // output. `build/build.ts` clears the directory once, up front.
      emptyOutDir: false,
      target: 'esnext',
      minify: false,
    },
  }
}
