/**
 * Entry point of the `amq.user.js` bundle.
 *
 * Every `.ts` file in this folder is bundled. To add a script, create a file
 * here whose default export is `async function setup()`. Files in `lib/` are
 * included only when a script imports them.
 */

import { ensureLoad } from '@shared/ready'

const scripts = import.meta.glob<() => Promise<void>>(
  ['./*.ts', '!./main.ts'],
  { eager: true, import: 'default' }
)

async function main() {
  // The login page has the same URL as the game and none of its globals.
  if (document.getElementById('loginUsername')) return

  await ensureLoad()

  for (const [file, setup] of Object.entries(scripts)) {
    // One script that fails must not stop the others.
    setup().catch((error) =>
      console.error(`[amq] ${file} failed to start`, error)
    )
  }
}

main().catch((error) => console.error('[amq] Failed to start', error))
