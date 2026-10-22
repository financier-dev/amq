import { execFile } from 'node:child_process'
import { envValue } from '@shared/node/env'
import type { CachedRoom } from './roomCache'
import {
  difficultyLabel,
  guessTimeLabel,
  modeLabel,
  playersLabel,
  roomSummary,
  selectionLabel,
  songTypesLabel,
  statusLabel,
} from './roomFormat'

/** Set in `.env`. Anyone with the URL can post to the channel. Never print or commit it. */
const DISCORD_WEBHOOK_KEY = 'ROOM_ALERT_DISCORD_WEBHOOK'

export function discordConfigured() {
  return Boolean(envValue(DISCORD_WEBHOOK_KEY))
}

/** Sends the room to every channel that is set up. Never throws. */
export async function notifyRoom(
  room: CachedRoom,
  log: (message: string) => void
) {
  await Promise.all([
    notifyMac(`Room: ${room.name}`, roomSummary(room)).catch((error) =>
      log(`macOS notification failed: ${error.message}`)
    ),
    notifyDiscord(room).catch((error) =>
      log(`Discord notification failed: ${error.message}`)
    ),
  ])
}

function notifyMac(title: string, body: string) {
  if (process.platform !== 'darwin') return Promise.resolve()
  return new Promise<void>((resolve, reject) => {
    // Pass the text as arguments, so a room name cannot inject AppleScript.
    execFile(
      'osascript',
      [
        '-e',
        'on run argv',
        '-e',
        'display notification (item 2 of argv) with title (item 1 of argv) sound name "Glass"',
        '-e',
        'end run',
        title,
        body,
      ],
      (error) => (error ? reject(error) : resolve())
    )
  })
}

async function notifyDiscord(room: CachedRoom) {
  const url = envValue(DISCORD_WEBHOOK_KEY)
  if (!url) return
  const field = (name: string, value: string) => ({ name, value, inline: true })
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      // Room names come from other players. Do not let one ping anyone.
      allowed_mentions: { parse: [] },
      embeds: [
        {
          title: room.name,
          description: `Host: ${room.host}${room.isPrivate ? ' · private' : ''}`,
          color: room.isPrivate ? 0x8a8f98 : 0x34c9a3,
          fields: [
            field('Players', playersLabel(room)),
            field('Status', statusLabel(room)),
            field('Mode', modeLabel(room)),
            field('Songs', String(room.songCount)),
            field('Guess time', guessTimeLabel(room)),
            field('Types', songTypesLabel(room)),
            field('Selection', selectionLabel(room)),
            field('Difficulty', difficultyLabel(room)),
          ],
          timestamp: new Date().toISOString(),
        },
      ],
    }),
  })
  // Report the status only. The URL holds the webhook's secret.
  if (!response.ok) throw new Error(`the webhook returned ${response.status}`)
}
