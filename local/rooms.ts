/*
 * Prints the open public rooms with their main settings.
 *
 *   npm run rooms
 *   npm run rooms -- --all     # private rooms too
 *   npm run rooms -- --json    # every setting, as JSON
 *
 * While `npm run watch-rooms` runs, this reads its list and does not log in.
 * Otherwise it logs in with `AMQ_TEST_ACCOUNT_*`, takes one snapshot of the
 * room browser and logs out. It only reads.
 */

import { parseArgs } from 'node:util'
import { openSession } from '@shared/node/session'
import { readRoomCache, type CachedRoom } from './lib/roomCache'
import {
  difficultyLabel,
  guessTimeLabel,
  modeLabel,
  playersLabel,
  selectionLabel,
  songTypesLabel,
  statusLabel,
} from './lib/roomFormat'
import { LOAD_TIMEOUT_MS, RoomList, openRoomFeed } from './lib/roomFeed'

/** The snapshot comes in batches. It is complete after this much quiet. */
const SNAPSHOT_QUIET_MS = 3_000
const SNAPSHOT_TIMEOUT_MS = 30_000
const NAME_WIDTH = 32

const { values: flags } = parseArgs({
  options: {
    all: { type: 'boolean', default: false },
    json: { type: 'boolean', default: false },
    headed: { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
})

if (flags.help) {
  console.log(`Usage: npm run rooms -- [options]

  --all      show private rooms too
  --json     print every setting of each room as JSON
  --headed   show the browser window, if this logs in`)
  process.exit(0)
}

async function snapshot(): Promise<CachedRoom[]> {
  const { browser, page } = await openSession({
    accounts: ['AMQ_TEST_ACCOUNT'],
    headed: flags.headed,
    loadTimeoutMs: LOAD_TIMEOUT_MS,
  })
  try {
    const list = new RoomList()
    await new Promise<void>((resolve, reject) => {
      let quiet: NodeJS.Timeout | undefined
      const timeout = setTimeout(() => {
        clearTimeout(quiet)
        reject(new Error('The room browser sent no rooms.'))
      }, SNAPSHOT_TIMEOUT_MS)
      openRoomFeed(page, (event) => {
        list.apply(event)
        if (event.kind !== 'rooms') return
        clearTimeout(quiet)
        quiet = setTimeout(() => {
          clearTimeout(timeout)
          resolve()
        }, SNAPSHOT_QUIET_MS)
      }).catch(reject)
    })
    return [...list.rooms.values()].map(({ hostAvatar: _, ...room }) => room)
  } finally {
    await browser.close()
  }
}

async function loadRooms(): Promise<CachedRoom[]> {
  const cached = readRoomCache()
  if (cached.state === 'fresh') {
    const age = Math.round(
      (Date.now() - Date.parse(cached.cache.heartbeatAt)) / 1000
    )
    console.error(`from watch-rooms, confirmed ${age}s ago`)
    return cached.cache.rooms
  }
  if (cached.state === 'watcher-offline') {
    console.error(
      'watch-rooms is running but is not connected now. Try again in a minute.'
    )
    process.exit(1)
  }
  return snapshot()
}

function truncate(text: string, width: number) {
  return text.length > width ? `${text.slice(0, width - 1)}…` : text
}

type Column = [title: string, cell: (room: CachedRoom) => string]

const privateColumn: Column = ['', (room) => (room.isPrivate ? 'private' : '')]

function printTable(rooms: CachedRoom[]) {
  const columns: Column[] = [
    ['Name', (room) => truncate(room.name, NAME_WIDTH)],
    ...(flags.all ? [privateColumn] : []),
    ['Host', (room) => room.host],
    ['Players', playersLabel],
    ['Status', statusLabel],
    ['Mode', modeLabel],
    ['Songs', (room) => String(room.songCount)],
    ['Guess', guessTimeLabel],
    ['Types', songTypesLabel],
    ['Selection', selectionLabel],
    ['Difficulty', difficultyLabel],
  ]
  const rows = [
    columns.map(([title]) => title),
    ...rooms.map((room) => columns.map(([, cell]) => cell(room))),
  ]
  const widths = columns.map((_, index) =>
    Math.max(...rows.map((row) => row[index].length))
  )
  for (const row of rows) {
    console.log(
      row
        .map((cell, index) => cell.padEnd(widths[index]))
        .join('  ')
        .trimEnd()
    )
  }
}

const rooms = (await loadRooms())
  .filter((room) => flags.all || !room.isPrivate)
  .sort((a, b) => b.playerCount - a.playerCount || a.id - b.id)

if (flags.json) {
  console.log(JSON.stringify(rooms, null, 2))
} else if (!rooms.length) {
  console.error(flags.all ? 'No rooms are open.' : 'No public rooms are open.')
} else {
  printTable(rooms)
}
