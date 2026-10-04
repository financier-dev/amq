/**
 * Flat config, one for the whole repo.
 *
 * Formatting is Prettier's job, not eslint's — nothing here touches layout.
 * What is left is the class of mistake a typecheck misses: an unused import, a
 * promise nobody awaits, a `case` that falls through.
 *
 * Deliberately not type-aware (no `projectService`): these are userscripts that
 * talk to a reverse-engineered client through `any`-ish ambient globals, and
 * the type-checked rule set spends most of its output complaining about that.
 * `npm run check` is where type errors are supposed to surface.
 */

import js from '@eslint/js'
import svelte from 'eslint-plugin-svelte'
import globals from 'globals'
import ts from 'typescript-eslint'

import svelteConfig from './svelte.config.js'

export default ts.config(
  {
    ignores: ['dist/', 'node_modules/', 'ui/tests/screenshots/'],
  },
  js.configs.recommended,
  ts.configs.recommended,
  svelte.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      /*
       * AMQ's payloads are not ours and are only partly typed, so `any` is
       * load-bearing at the boundary — see shared/typings/amq.d.ts.
       */
      '@typescript-eslint/no-explicit-any': 'off',
      /*
       * The game's globals (`socket`, `quiz`, `viewChanger`, …) are declared
       * ambiently, which eslint does not read — it would call every one of
       * them undefined. TypeScript is what actually checks this.
       */
      'no-undef': 'off',
      /* `_` marks a binding kept for shape (positional args, catch) only. */
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      /*
       * The rule flags every plain `Map`/`Set` in a `.svelte.ts` file, and in
       * this codebase they are all either module-level lookup tables that are
       * never written to or throwaway locals inside a `$derived`. Reactivity
       * comes from reassigning the containing `$state`, so swapping in
       * `SvelteMap`/`SvelteSet` would add a proxy and change nothing.
       */
      'svelte/prefer-svelte-reactivity': 'off',
    },
  },
  {
    files: ['**/*.svelte', '**/*.svelte.ts'],
    languageOptions: {
      parserOptions: { parser: ts.parser, svelteConfig },
    },
  }
)
