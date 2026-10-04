/**
 * One vite config per target, built from a single factory.
 *
 * `vite.config.ts` uses this for the dev server and `build/build.ts` for the
 * real build, so the two cannot drift — the dev script and the shipped script
 * are compiled the same way.
 */

import { fileURLToPath } from 'node:url'

import { svelte } from '@sveltejs/vite-plugin-svelte'
import type { UserConfig } from 'vite'
import monkey from 'vite-plugin-monkey'

import type { Target } from './targets'

const root = fileURLToPath(new URL('..', import.meta.url))

/** `@shared/x` from any project folder. Mirrored in `tsconfig.json#paths`. */
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
               * The screen mounts inside a shadow root, and styles injected
               * into `document.head` cannot cross that boundary — which is
               * what external CSS gets us, whether vite injects it in dev or
               * `GM_addStyle` does in the build. Svelte's own injector is
               * shadow-aware: `append_styles` appends to the component's root
               * node when that root is a ShadowRoot
               * (svelte/src/internal/client/dom/css.js). So emit no CSS asset
               * and let each component carry its own.
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
          // The scripts talk to AMQ globals directly; keep each a single
          // plain file, with no CDN requires to resolve at install time.
          externalGlobals: {},
        },
        server: {
          // Tampermonkey loads the dev script from the vite server directly.
          open: false,
        },
      }),
    ],
    build: {
      // Top-level and committed, so a script can be installed from the repo
      // without a toolchain. Every target writes here.
      outDir: 'dist',
      // Targets share one dist, so a build must not wipe its neighbours'
      // output. `build/build.ts` clears the directory once, up front.
      emptyOutDir: false,
      target: 'esnext',
      minify: false,
    },
  }
}
