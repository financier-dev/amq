/*
 * Stays logged in with the room browser open, and tells you when a room whose
 * name matches `ROOM_NAME_PATTERN` opens, or when a room is renamed to match.
 *
 *   npm run watch-rooms
 *   npm run watch-rooms -- --no-notify    # print only, no notifications
 *   npm run watch-rooms -- --match 'ranked|sa\b'   # another pattern
 *
 * It logs in with `AMQ_TEST_ACCOUNT_*`. It only reads: it never joins,
 * spectates or hosts a room, and never chats.
 *
 * AMQ allows one session for each account. When something else logs in with
 * the same account (for example `npm run test:live`), the server disconnects
 * the watcher, and it waits `TAKEN_OVER_WAIT_MS` before it logs in again.
 *
 * A match is printed, shown as a macOS notification, and posted to Discord when
 * `ROOM_ALERT_DISCORD_WEBHOOK` is set in `.env`.
 *
 * While it runs, it keeps the room list in `local/.cache/rooms.json` for
 * `npm run rooms`.
 */

import { parseArgs } from 'node:util'
import { openSession, type Session } from '@shared/node/session'
import type { Room } from '@shared/rooms'
import {
  HEARTBEAT_MS,
  markWatcherOffline,
  writeRoomCache,
} from './lib/roomCache'
import { discordConfigured, notifyRoom } from './lib/notify'
import { roomSummary } from './lib/roomFormat'
import {
  LOAD_TIMEOUT_MS,
  RoomList,
  feedIsHealthy,
  openRoomFeed,
  requestRooms,
  type FeedEvent,
} from './lib/roomFeed'

const ROOM_NAME_PATTERN = /\bno[\s_-]*dd\b/i

const MINUTE = 60_000
/** How long the socket may stay down before the watcher logs in again. */
const RECONNECT_GRACE_MS = 2 * MINUTE
/** A full snapshot fixes any update the watcher missed. */
const RESYNC_MS = 30 * MINUTE
const TAKEN_OVER_WAIT_MS = 30 * MINUTE
const FIRST_RETRY_MS = 30_000
/** For network errors. Retrying does not reach AMQ, so it needs no backoff. */
const NETWORK_RETRY_MS = MINUTE
const MAX_RETRY_MS = 15 * MINUTE
/** A session that lasted this long resets the retry delay. */
const STABLE_SESSION_MS = 10 * MINUTE

const { values: flags } = parseArgs({
  options: {
    'no-notify': { type: 'boolean', default: false },
    match: { type: 'string' },
    headed: { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
})

if (flags.help) {
  console.log(`Usage: npm run watch-rooms -- [options]

  --match <re>  report rooms whose name matches this regular expression
                (case-insensitive) instead of ${ROOM_NAME_PATTERN}
  --no-notify   print matches only; send no notifications
  --headed      show the browser window`)
  process.exit(0)
}

const pattern = flags.match ? new RegExp(flags.match, 'i') : ROOM_NAME_PATTERN

const log = (message: string) =>
  console.error(`[${new Date().toLocaleTimeString()}] ${message}`)

function notify(room: Room) {
  console.log(
    `[${new Date().toLocaleTimeString()}] Room: ${room.name} — ${roomSummary(room)}`
  )
  if (!flags['no-notify']) void notifyRoom(room, log)
}

/** Rooms already reported. A room is reported again only after it stops matching. */
const reported = new Set<number>()

function checkRoom(room: Room) {
  if (!pattern.test(room.name)) {
    reported.delete(room.id)
    return
  }
  if (reported.has(room.id)) return
  reported.add(room.id)
  notify(room)
}

interface SessionEnd {
  reason: string
  /** How long to wait before the next login, if not the usual backoff. */
  wait?: number
  fatal?: boolean
}

function endForLogoff(reason: string): SessionEnd {
  if (reason.endsWith('logged_in_elsewhere')) {
    return {
      reason: 'another session logged in with this account',
      wait: TAKEN_OVER_WAIT_MS,
    }
  }
  if (reason.includes('ban')) {
    return { reason: `the account is banned (${reason})`, fatal: true }
  }
  return { reason: `the server logged the watcher off (${reason})` }
}

async function watch(session: Session): Promise<SessionEnd> {
  const { browser, page } = session
  const list = new RoomList()
  let ended = false
  let writeTimer: NodeJS.Timeout | undefined
  const saveSoon = () => {
    if (ended) return
    writeTimer ??= setTimeout(() => {
      writeTimer = undefined
      writeRoomCache(list.rooms.values())
    }, 1_000)
  }

  return new Promise<SessionEnd>((resolve) => {
    let disconnectTimer: NodeJS.Timeout | undefined
    const timers: NodeJS.Timeout[] = []
    const end = (result: SessionEnd) => {
      ended = true
      clearTimeout(disconnectTimer)
      clearTimeout(writeTimer)
      timers.forEach(clearInterval)
      resolve(result)
    }

    const resync = () => {
      list.clear()
      requestRooms(page).catch(() => {})
    }

    const onEvent = (event: FeedEvent) => {
      switch (event.kind) {
        case 'rooms':
        case 'change':
          list.apply(event).forEach(checkRoom)
          saveSoon()
          return
        case 'disconnect':
          log('socket disconnected, waiting for it to reconnect')
          disconnectTimer = setTimeout(
            () => end({ reason: 'the socket did not reconnect' }),
            RECONNECT_GRACE_MS
          )
          return
        case 'reconnect':
          log('socket reconnected')
          clearTimeout(disconnectTimer)
          disconnectTimer = undefined
          resync()
          return
        case 'logoff':
          end(endForLogoff(event.reason))
          return
      }
    }

    page.on('close', () => end({ reason: 'the page closed' }))
    browser.on('disconnected', () => end({ reason: 'the browser closed' }))

    openRoomFeed(page, onEvent).then(
      () => {
        log('watching the room browser')
        // Any later navigation means the page reloaded or left the game.
        page.on('framenavigated', (frame) => {
          if (frame === page.mainFrame()) end({ reason: 'the page reloaded' })
        })
        timers.push(
          setInterval(async () => {
            if (disconnectTimer) return
            const healthy = await feedIsHealthy(page)
            // The socket may have dropped during the check. Then the
            // reconnect grace decides, not this check.
            if (ended || disconnectTimer) return
            if (healthy) {
              writeRoomCache(list.rooms.values())
            } else {
              end({ reason: 'the room browser is no longer open' })
            }
          }, HEARTBEAT_MS),
          setInterval(resync, RESYNC_MS)
        )
      },
      (error) => end({ reason: `could not open the room browser: ${error}` })
    )
  })
}

let session: Session | undefined

if (!flags['no-notify']) {
  log(
    discordConfigured()
      ? 'matches go to macOS notifications and Discord'
      : 'matches go to macOS notifications; Discord is not set up'
  )
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    markWatcherOffline()
    await session?.browser.close().catch(() => {})
    process.exit(0)
  })
}

let retryMs = FIRST_RETRY_MS
for (;;) {
  const started = Date.now()
  let result: SessionEnd
  session = undefined
  try {
    markWatcherOffline()
    session = await openSession({
      accounts: ['AMQ_TEST_ACCOUNT'],
      headed: flags.headed,
      loadTimeoutMs: LOAD_TIMEOUT_MS,
    })
    result = await watch(session)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    // For example, the computer is asleep or offline.
    const offline = message.includes('net::ERR_')
    result = {
      reason: offline ? message.split('\n')[0] : message,
      wait: offline ? NETWORK_RETRY_MS : undefined,
    }
  } finally {
    markWatcherOffline()
    await session?.browser.close().catch(() => {})
  }

  if (result.fatal) {
    log(`stopping: ${result.reason}`)
    process.exit(1)
  }
  if (Date.now() - started > STABLE_SESSION_MS) retryMs = FIRST_RETRY_MS
  const wait = result.wait ?? retryMs
  if (!result.wait) retryMs = Math.min(retryMs * 2, MAX_RETRY_MS)
  log(`${result.reason}. Logging in again in ${Math.round(wait / 1000)}s.`)
  await new Promise((resolve) => setTimeout(resolve, wait))
}
