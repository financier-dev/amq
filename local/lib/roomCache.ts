/*
 * The room list that `watch-rooms` keeps on disk, so `rooms` can print it
 * without a second login. A second login would disconnect the watcher, because
 * AMQ allows one session for each account.
 */

import fs from 'node:fs'
import path from 'node:path'
import { repo } from '@shared/node/env'
import type { Room } from '@shared/rooms'

export const CACHE_FILE = path.join(repo, 'local', '.cache', 'rooms.json')

/** The watcher rewrites the file at least this often while it is connected. */
export const HEARTBEAT_MS = 30_000

export type CachedRoom = Omit<Room, 'hostAvatar'>

export interface RoomCache {
  /** The watcher's process. */
  pid: number
  /** When the watcher last confirmed that the list is live. */
  heartbeatAt: string
  rooms: CachedRoom[]
}

export function writeRoomCache(rooms: Iterable<Room>) {
  writeCache({
    pid: process.pid,
    heartbeatAt: new Date().toISOString(),
    rooms: [...rooms].map(({ hostAvatar: _, ...room }) => room),
  })
}

/**
 * Tells `rooms` that the watcher runs but is not connected yet, so `rooms`
 * does not log in while the watcher does.
 */
export function markWatcherOffline() {
  writeCache({
    pid: process.pid,
    heartbeatAt: new Date(0).toISOString(),
    rooms: [],
  })
}

function writeCache(cache: RoomCache) {
  fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true })
  // Write to a temporary file and rename it, so a reader never sees half a file.
  const temporary = `${CACHE_FILE}.${process.pid}.tmp`
  fs.writeFileSync(temporary, JSON.stringify(cache))
  fs.renameSync(temporary, CACHE_FILE)
}

export type CacheState =
  | { state: 'fresh'; cache: RoomCache }
  /** The watcher runs, but is not connected now. Do not log in over it. */
  | { state: 'watcher-offline' }
  | { state: 'no-watcher' }

export function readRoomCache(): CacheState {
  let cache: RoomCache
  try {
    cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'))
  } catch {
    return { state: 'no-watcher' }
  }
  if (Date.now() - Date.parse(cache.heartbeatAt) < HEARTBEAT_MS * 3) {
    return { state: 'fresh', cache }
  }
  return processIsAlive(cache.pid)
    ? { state: 'watcher-offline' }
    : { state: 'no-watcher' }
}

function processIsAlive(pid: number) {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    // EPERM: the process exists but belongs to another user.
    return (error as NodeJS.ErrnoException).code === 'EPERM'
  }
}
