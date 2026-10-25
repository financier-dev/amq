# amq

These are all the scripts I use for
[Anime Music Quiz](https://animemusicquiz.com), both in the game and offline
on my computer. I made them myself. Some ideas came from other players'
scripts, and recently Claude has done most of the implementation.

The scripts are personalized for how I play. I did not make them for other
people, but you can use them as a base for your own scripts.

## Projects

Everything is TypeScript. Vite builds the userscripts into plain `.user.js`
files under [`dist/`](dist).

The repository has three projects:

- **[`ui/`](ui)** replaces two screens of the game on the live site: the room
  browser and the custom quiz builder. It uses Svelte 5 and renders in a
  shadow root. See [`ui/README.md`](ui/README.md).
- **[`scripts/`](scripts)** holds the userscripts for the game page. They
  build into one file, `dist/amq.user.js`: chat commands, answer dropdown
  changes, song history, player stats, styles and more. See
  [`scripts/README.md`](scripts/README.md).
- **[`local/`](local)** holds scripts that run on your computer, not in the
  browser: a local cache of song videos that the game plays from your disk,
  a room watcher that alerts you when a "no dd" room opens, a list of open
  rooms, and the Japanese titles of the anime on your list. See
  [`local/README.md`](local/README.md).

## Install

`dist/` is committed, so you do not need to build anything. Open the raw
file on GitHub, and Tampermonkey offers to install it.

## Build

```
npm install
npm run build            # every target → dist/
npm run build -- amq-ui  # one target
npm run dev              # dev server for the game page (see below)
npm run check            # svelte-check
npm run lint             # eslint
npm run format           # prettier
npm test                 # build, then render in headless Chromium and assert
```

One output file is one **target**. [`build/targets.ts`](build/targets.ts)
declares each target with its entry module and its `==UserScript==` metadata.
`build/config.ts` turns a target into a Vite config, and `build/build.ts`
builds all targets. To add a script, add a target to `build/targets.ts`.

All projects share one configuration at the root: `tsconfig.json`,
`eslint.config.js`, `.prettierrc.js` and `package.json`. Code that more than
one project uses is in [`shared/`](shared). Import it as `@shared/…`.

## Developing with HMR

`npm run dev` starts a dev server that sends your edits to the open game
page. You do not rebuild the userscript or install it again for each change.

```
npm run dev                    # the default target
AMQ_TARGET=amq-ui npm run dev  # one named target
```

The command prints a URL. Open it once, and Tampermonkey offers to install a
**loader** script named `server:<target>`. The loader has the target's
`@match` and `@run-at`. It does not contain your script. It adds a module
`<script>` that points at the dev server, so each visit to the game loads the
current source through Vite.

What an edit does:

| You change                                    | Result                                          |
| --------------------------------------------- | ----------------------------------------------- |
| A Svelte component (markup, logic, `<style>`) | The page updates without a reload               |
| `ui/src/ui/app.css`                           | The page updates without a reload               |
| Anything else, including a plain-TS script    | Vite reloads the page and the script runs again |

A plain userscript therefore reloads on save with no setup. A script that can
remove everything it added can accept a hot update with
`import.meta.hot.accept`. `import.meta.hot` is `undefined` in a build, so
that code does not ship.

Four rules:

- **Disable the built script while you develop.** The loader is a separate
  userscript. If both are enabled, Tampermonkey runs both, and both try to
  replace the same screens or patch the same methods.
- **The loader does nothing when the dev server is not running.** The game
  then behaves as if the script is not installed.
- **The dev server serves one target at a time.** `AMQ_TARGET` selects it.
- **`run-at: document-start` does not apply in dev.** The dev entry is a
  deferred module. A script that must patch something before the game's own
  JS starts can do that only from a real build. Test such a script with
  `npm run build`.

## Layout

```
build/     the build: target registry, config factory, runner
shared/    code that more than one project uses, imported as `@shared/*`
ui/        the interface reimplementation: src/, tests/
scripts/   userscripts for the game page, bundled into amq.user.js
local/     scripts that run on your computer
dist/      build output, committed
```

## Licence

MIT. The font subsets under `ui/tests/fonts/` use the SIL Open Font License
1.1. See [`ui/tests/fonts/README.md`](ui/tests/fonts/README.md).
