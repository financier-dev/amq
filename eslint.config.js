/**
 * Flat config for the whole repo.
 *
 * Prettier owns formatting; no rule here concerns layout. The rules catch
 * what a typecheck misses: an unused import, a promise nobody awaits, a
 * `case` that falls through.
 *
 * Not type-aware on purpose (no `projectService`). These userscripts talk to
 * a reverse-engineered client through loosely typed ambient globals, and the
 * type-checked rules mostly report that. `npm run check` reports type errors.
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
       * AMQ's payloads are only partly typed, so `any` is needed at that
       * boundary. See shared/typings/amq.d.ts.
       */
      '@typescript-eslint/no-explicit-any': 'off',
      /*
       * The game's globals (`socket`, `quiz`, `viewChanger`, …) are declared
       * ambiently. eslint does not read those declarations and would report
       * every global as undefined. TypeScript checks them.
       */
      'no-undef': 'off',
      /* A leading `_` marks a binding kept only for its position. */
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      /*
       * The rule flags every plain `Map` and `Set` in a `.svelte.ts` file.
       * Here they are module-level lookup tables that are never written, or
       * locals inside a `$derived`. Reactivity comes from reassigning the
       * containing `$state`, so `SvelteMap` and `SvelteSet` would add a proxy
       * for nothing.
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
