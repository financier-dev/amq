/*
 * Downloads the messages posted in the Discord approvals channel since the
 * last download, saves them as a new export, then sets `added` and
 * `lastUpdated` on the songs (`local/lib/approvalDates.ts`).
 *
 *   npm run fetch-approvals
 *   npm run fetch-approvals -- --verbose   # print matches not found by file
 *
 * Exports go to `local/.cache/discord/approvals-<UTC time>.json`. A new
 * export has only the messages after the newest one in the older exports.
 * With no export yet, it downloads the whole channel.
 *
 * It reads `APPROVALS_CHANNEL_ID` and `BOT_DISCORD_TOKEN` from `.env`. Reading
 * a channel with a user token, not a bot token, is against Discord's terms.
 * It does not log in to AMQ.
 */

import fs from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { envValue } from '@shared/node/env'
import {
  EXPORT_DIR,
  exportFileName,
  newestExportedMessageId,
  updateApprovalDates,
} from './lib/approvalDates'
import {
  DiscordAuthError,
  type DiscordChannel,
  DiscordClient,
} from './lib/discord'
import { openSongDb } from './lib/songDb'

const { values: flags } = parseArgs({
  options: {
    verbose: { type: 'boolean', short: 'v', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
})

if (flags.help) {
  console.log(`Usage: npm run fetch-approvals [-- options]

Downloads the new messages of the Discord approvals channel to
local/.cache/discord/, then sets when each song was approved (added) and last
replaced (lastUpdated).

  -v, --verbose  print each match not found by file`)
  process.exit(0)
}

const token = envValue('BOT_DISCORD_TOKEN')
const channelId = envValue('APPROVALS_CHANNEL_ID')
if (!token || !channelId) {
  console.error('Set BOT_DISCORD_TOKEN and APPROVALS_CHANNEL_ID in .env.')
  process.exit(1)
}

const discord = new DiscordClient(token)
let channel: DiscordChannel
try {
  channel = await discord.channel(channelId)
} catch (error) {
  if (!(error instanceof DiscordAuthError)) throw error
  console.error(`${error.message} Check BOT_DISCORD_TOKEN in .env.`)
  process.exit(1)
}
const afterId = newestExportedMessageId()
console.error(
  afterId
    ? `Downloading the messages after ${afterId} in #${channel.name}.`
    : `No export yet: downloading all of #${channel.name}.`
)
const messages = await discord.messagesAfter(
  channelId,
  afterId ?? undefined,
  (count) => process.stderr.write(`\r${count} messages`)
)
if (messages.length) process.stderr.write('\n')
const exportedAt = new Date()

if (messages.length === 0) {
  console.error('No new messages.')
} else {
  fs.mkdirSync(EXPORT_DIR, { recursive: true })
  const file = path.join(EXPORT_DIR, exportFileName(exportedAt))
  const data = {
    channel: { id: channel.id, name: channel.name, guildId: channel.guild_id },
    exportedAt: exportedAt.toISOString(),
    messageCount: messages.length,
    messages,
  }
  // Written in one step, so a stopped run leaves no partial export.
  fs.writeFileSync(`${file}.partial`, JSON.stringify(data, null, 2))
  fs.renameSync(`${file}.partial`, file)
  console.error(`Saved ${messages.length} messages to ${path.basename(file)}.`)
}

const db = await openSongDb()
try {
  await updateApprovalDates(db, { verbose: flags.verbose })
} finally {
  await db.client.close()
}
