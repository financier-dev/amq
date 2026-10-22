/*
 * Opens AMQ's room browser in a logged-in page and passes its events to Node.
 *
 * This only reads. It never joins, spectates or hosts a room, and never sends
 * a chat message.
 */

import type { Page } from 'playwright'
import { applyRoomChange, toRoom, type Room } from '@shared/rooms'

/** How long the room scripts wait for the game page to load. */
export const LOAD_TIMEOUT_MS = 5 * 60_000

export type FeedEvent =
  | { kind: 'rooms'; data: NewRoomsData }
  | { kind: 'change'; data: RoomChangeData }
  | { kind: 'disconnect' }
  | { kind: 'reconnect' }
  /** `reason` is a locale key, such as `…kicked_by_server.server_restart`. */
  | { kind: 'logoff'; reason: string }

export async function openRoomFeed(
  page: Page,
  onEvent: (event: FeedEvent) => void
) {
  await page.exposeFunction('__roomFeed', onEvent)
  await page.evaluate(() => {
    const send = (event: FeedEvent) => (window as any).__roomFeed(event)

    // `afkKicker.setup()` started a 30-minute timer during login. When it
    // runs out, the page disconnects itself.
    clearTimeout(afkKicker.afkWarningTimeout)
    afkKicker.setupAfkTimeout = () => {}

    new Listener('New Rooms', (data: NewRoomsData) =>
      send({ kind: 'rooms', data })
    ).bindListener()
    new Listener('Room Change', (data: RoomChangeData) =>
      send({ kind: 'change', data })
    ).bindListener()
    new Listener('force logoff', (data: any) =>
      send({ kind: 'logoff', reason: String(data?.reasonKey ?? '') })
    ).bindListener()
    socket._socket.on('disconnect', () => send({ kind: 'disconnect' }))
    socket._socket.on('reconnect', () => send({ kind: 'reconnect' }))

    // AMQ's own view sends `get rooms`. The server then keeps sending
    // updates until the view closes.
    viewChanger.changeView('roomBrowser')
  })
}

/** Asks for a full snapshot again. It arrives as `rooms` events. */
export async function requestRooms(page: Page) {
  await page.evaluate(() =>
    socket.sendCommand({ type: 'roombrowser', command: 'get rooms' })
  )
}

/** True while the socket is up and the page still shows the room browser. */
export async function feedIsHealthy(page: Page) {
  return page
    .evaluate(
      () =>
        Boolean(socket._socket?.connected) &&
        viewChanger.currentView === 'roomBrowser'
    )
    .catch(() => false)
}

/** The rooms as the feed reports them. */
export class RoomList {
  readonly rooms = new Map<number, Room>()

  clear() {
    this.rooms.clear()
  }

  /**
   * Applies an event. Returns the rooms it added or changed that are still
   * open.
   */
  apply(event: FeedEvent): Room[] {
    if (event.kind === 'rooms') {
      // The server sends a snapshot in several batches, and a new room as a
      // batch of one. So merge; do not replace.
      const added = (event.data.standard ?? []).map(toRoom)
      for (const room of added) this.rooms.set(room.id, room)
      return added
    }
    if (event.kind === 'change') {
      const room = this.rooms.get(event.data.roomId)
      if (!room) return []
      const next = applyRoomChange(room, event.data)
      if (!next) {
        this.rooms.delete(room.id)
        return []
      }
      this.rooms.set(room.id, next)
      return [next]
    }
    return []
  }
}
