/*
 * Sets `added` and `lastUpdated` on the songs of the song database from the
 * Discord approvals exports already on disk. `local/lib/approvalDates.ts`
 * explains how. `npm run fetch-approvals` downloads new messages first.
 *
 *   npm run approval-dates               # read new exports, set the dates
 *   npm run approval-dates -- --full     # read every export again
 *   npm run approval-dates -- --dry-run  # report, do not write
 */

import { parseArgs } from 'node:util'
import { updateApprovalDates } from './lib/approvalDates'
import { openSongDb } from './lib/songDb'

const { values: flags } = parseArgs({
  options: {
    full: { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
    verbose: { type: 'boolean', short: 'v', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
})

if (flags.help) {
  console.log(`Usage: npm run approval-dates [-- options]

Reads new exports of the Discord approvals channel from local/.cache/discord/,
then sets when each song was approved (added) and last replaced (lastUpdated).

  --full     read every export again, not only the new ones
  --dry-run  print what would change, and write nothing
  --verbose  print each match not found by file`)
  process.exit(0)
}

const db = await openSongDb()
try {
  await updateApprovalDates(db, {
    full: flags.full,
    dryRun: flags['dry-run'],
    verbose: flags.verbose,
  })
} finally {
  await db.client.close()
}
