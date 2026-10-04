/**
 * Builds every target in `targets.ts` into the top-level `dist/`.
 *
 *   npm run build              # all targets
 *   npm run build -- amq-ui    # just one
 *
 * vite-plugin-monkey writes one userscript per build, so targets are built in
 * sequence rather than as one multi-entry bundle.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { build } from 'vite'

import { configFor } from './config'
import { findTarget, targets } from './targets'

const root = fileURLToPath(new URL('..', import.meta.url))
const dist = path.join(root, 'dist')

const requested = process.argv.slice(2)
const selected = requested.length
  ? requested.map((name) => findTarget(name))
  : targets

/*
 * Cleared once here rather than per build (`emptyOutDir: false`), so one
 * target's build cannot delete another's output, while a renamed or deleted
 * target still stops shipping a stale file from dist.
 */
if (!requested.length && fs.existsSync(dist)) {
  for (const entry of fs.readdirSync(dist)) {
    fs.rmSync(path.join(dist, entry), { recursive: true })
  }
}

for (const target of selected) {
  console.log(`\nbuilding ${target.name} → dist/${target.fileName}`)
  // `configFile: false` — the config is right here; don't re-read
  // vite.config.ts, which would build the dev server's single target.
  await build({ ...configFor(target), configFile: false })
}
