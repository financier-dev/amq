/**
 * Entry point of the `amq.user.js` bundle.
 *
 * Every `.ts` file in this folder is bundled. To add a script, create a file
 * here whose default export is `async function setup()`. Files in `lib/` are
 * included only when a script imports them.
 *
 * A script can also export `beforeLoad()`. It runs before `ensureLoad`, while
 * AMQ may still be logging in, so it can only use globals that AMQ defines
 * when its scripts load, such as constructors.
 */

import { ensureLoad } from '@shared/ready'

interface Script {
  default: () => Promise<void>
  beforeLoad?: () => void
}

const scripts = import.meta.glob<Script>(['./*.ts', '!./main.ts'], {
  eager: true,
})

async function main() {
  // The login page has the same URL as the game and none of its globals.
  if (document.getElementById('loginUsername')) return

  for (const [file, { beforeLoad }] of Object.entries(scripts)) {
    try {
      beforeLoad?.()
    } catch (error) {
      console.error(`[amq] ${file} failed before load`, error)
    }
  }

  await ensureLoad()

  for (const [file, { default: setup }] of Object.entries(scripts)) {
    // One script that fails must not stop the others.
    setup().catch((error) =>
      console.error(`[amq] ${file} failed to start`, error)
    )
  }
}

main().catch((error) => console.error('[amq] Failed to start', error))
