/**
 * Room browser state.
 *
 * The store reduces two socket events:
 *   `New Rooms`   — snapshot, sent in reply to the `get rooms` command
 *   `Room Change` — incremental patch, keyed by roomId
 *
 * Nothing here reads or writes the DOM. Actions call AMQ's own `roomBrowser`,
 * so the lobby handoff, password prompts and error messages keep working.
 */

import { SvelteMap } from 'svelte/reactivity'
import { applyRoomChange, toRoom, type Room } from '@shared/rooms'
import { addListeners, sendCommand } from './events'
import { t } from './derive'

export type { GameMode, Room, RoomPlayer, SongSelection } from '@shared/rooms'

// --- store ----------------------------------------------------------------

export class RoomStore {
  #rooms = new SvelteMap<number, Room>()
  #unbind: (() => void) | null = null
  /** The room whose settings the host modal is previewing. */
  #previewRoomId: number | null = null

  bound = $state(false)
  /** False until the first `New Rooms` snapshot arrives. */
  loaded = $state(false)

  readonly rooms = $derived([...this.#rooms.values()])
  readonly roomCount = $derived(this.#rooms.size)
  readonly playerCount = $derived(
    this.rooms.reduce((total, room) => total + room.playerCount, 0)
  )

  get(id: number) {
    return this.#rooms.get(id)
  }

  bind() {
    if (this.#unbind) return
    this.#unbind = addListeners({
      'New Rooms': (data) => this.#onNewRooms(data),
      'Room Change': (data) => this.#onRoomChange(data),
    })
    this.bound = true
    this.refresh()
  }

  unbind() {
    this.#unbind?.()
    this.#unbind = null
    this.bound = false
    this.loaded = false
    this.#rooms.clear()
  }

  /** The reply arrives as `New Rooms`. */
  refresh() {
    sendCommand('roombrowser', 'get rooms')
  }

  #onNewRooms(data: NewRoomsData) {
    // The server sends a snapshot in several batches, so merge; do not
    // replace.
    for (const info of data.standard ?? []) {
      this.#rooms.set(info.id, toRoom(info))
    }
    this.loaded = true
  }

  #onRoomChange(payload: RoomChangeData) {
    const room = this.#rooms.get(payload.roomId)
    if (!room) return

    const next = applyRoomChange(room, payload)
    if (next) {
      this.#rooms.set(room.id, next)
    } else {
      this.#rooms.delete(room.id)
    }

    if (this.#previewRoomId !== room.id) return
    if (!next) {
      this.#previewRoomId = null
      hostModal.hide()
    } else if (payload.changeType === 'settings' && payload.change) {
      // roomTile.js:237. Keep the modal in step with the room it previews.
      hostModal.changeSettings(payload.change)
    }
  }

  // --- actions ------------------------------------------------------------
  // These call AMQ's roomBrowser, which runs `lobby.setupLobby` and
  // `viewChanger.changeView('lobby')`.

  /** roomTile.js `joinGame`. A private room asks for the password first. */
  join(room: Room) {
    if (!room.isPrivate) {
      roomBrowser.fireJoinLobby(room.id)
      return
    }
    Swal.fire({
      title: t('room_browser.room_tile.password.title', 'Password'),
      input: 'password',
      inputPlaceholder: t(
        'room_browser.room_tile.password.placeholder',
        'Password'
      ),
      showCancelButton: true,
      confirmButtonText: t(
        'room_browser.room_tile.password.confirm_button',
        'Join'
      ),
      inputAttributes: { maxlength: 50, minlength: 1 },
    }).then((result) => {
      if (result.isConfirmed) roomBrowser.fireJoinLobby(room.id, result.value)
    })
  }

  /** roomTile.js `spectateGame`. AMQ shows the private-room prompt itself. */
  spectate(room: Room) {
    if (room.isPrivate) {
      roomBrowser.spectateGameWithPassword(room.id)
    } else {
      roomBrowser.fireSpectateGame(room.id)
    }
  }

  host() {
    roomBrowser.openHostModal()
  }

  /**
   * Opens AMQ's host modal read-only on a room's settings, as
   * `.rbrAllOptionsIcon` does (roomTile.js `previewSettings`).
   *
   * Keep this call order. `changeSettings` sets `hostModal.gameMode`, and
   * `setModePreviewGame` reads it for the title.
   */
  previewSettings(room: Room) {
    this.#previewRoomId = room.id
    // Look the room up again on click. It may have changed while the modal
    // was open, for example from public to private.
    const live = () => this.#rooms.get(room.id) ?? room
    hostModal.changeSettings(live().settings)
    hostModal.setModePreviewGame({
      joinGame: () => this.join(live()),
      spectateGame: () => this.spectate(live()),
      settingPreviewClosed: () => {
        this.#previewRoomId = null
      },
    })
    hostModal.showSettings()
    hostModal.show()
  }
}

export const roomStore = new RoomStore()
