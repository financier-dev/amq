# amq

Userscripts and tooling for [Anime Music Quiz](https://animemusicquiz.com).
TypeScript throughout, built with Vite into plain `.user.js` files under [`dist/`](dist).

So far one project lives here:

- **[`ui/`](ui)** — a reimplementation of parts of the game's interface (the
  room browser and the custom quiz builder), injected over the live site.
  Svelte 5, rendered in a shadow root. See [`ui/README.md`](ui/README.md).

## Install

`dist/` is committed, so a script can be installed without a toolchain: open
the raw file on GitHub and Tampermonkey offers to install it.

## Build

```
npm install
npm run build            # every target → dist/
npm run build -- amq-ui  # one target
npm run dev              # live edit loop against the game (see below)
npm run check            # svelte-check
npm run lint             # eslint
npm run format           # prettier
npm test                 # build, then render in headless Chromium and assert
```

One output file is one **target**, declared in
[`build/targets.ts`](build/targets.ts) with its entry module and its
`==UserScript==` metadata. `build/config.ts` turns a target into a Vite config
and `build/build.ts` builds them all, so adding a script means adding an entry
there rather than another build setup.

Configuration is shared: one `tsconfig.json`, `eslint.config.js`,
`.prettierrc.js` and `package.json` at the root, covering every project folder.
Code any of them may import lives in [`shared/`](shared) and is reached as
`@shared/…`.

## Developing with HMR

Rebuilding a userscript and re-importing it into Tampermonkey for every change
gets old fast. `npm run dev` replaces that with a dev server the installed
script reads from, so edits reach the running game by themselves.

```
npm run dev                    # the default target
AMQ_TARGET=amq-ui npm run dev  # a specific one
```

It prints a URL. Open it once and Tampermonkey offers to install a **loader**
script — named `server:<target>`, carrying that target's own `@match` and
`@run-at`, and about a hundred lines long. It is not your script: it injects a
module `<script>` pointing at the dev server. From then on, every visit to the
game pulls the current source through Vite.

What an edit does:

| you change                                    | what happens                                 |
| --------------------------------------------- | -------------------------------------------- |
| a Svelte component (markup, logic, `<style>`) | hot-swapped in place, no reload              |
| `ui/src/ui/app.css`                           | hot-swapped in place, no reload              |
| anything else, including a plain-TS script    | Vite reloads the page and the script re-runs |

So a plain userscript needs no setup to get reload-on-save. One that can tear
itself down cleanly may opt into a hot update with `import.meta.hot.accept`;
`import.meta.hot` is `undefined` in a build, so nothing extra ships.

Four things to keep in mind:

- **Disable the built script while developing.** The loader is a separate
  userscript, so Tampermonkey runs both, and both will try to claim the same
  screens or patch the same methods.
- **The loader does nothing when the dev server is down.** The game simply
  behaves as if the script were not installed.
- **One target at a time.** The dev server serves a single entry, which is what
  `AMQ_TARGET` picks.
- **`run-at: document-start` does not really hold in dev.** The dev entry is a
  deferred module, so a script that has to patch something before the game's own
  JS boots can only do that from a real build. Test those with `npm run build`.

## Layout

```
build/     the build: target registry, config factory, runner
shared/    code every project may import, as `@shared/*`
ui/        interface reimplementation — src/, tests/
dist/      build output, committed
```

## Licence

MIT, except the font subsets under `ui/tests/fonts/`, which are under the SIL
Open Font License 1.1 — see [`ui/tests/fonts/README.md`](ui/tests/fonts/README.md).
