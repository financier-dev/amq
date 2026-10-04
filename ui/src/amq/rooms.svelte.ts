/**
 * Room browser state.
 *
 * The whole screen is a reducer over two socket events:
 *   `New Rooms`   — full snapshot, sent in reply to the `get rooms` command
 *   `Room Change` — incremental patches, keyed by roomId
 *
 * Nothing here reads the DOM, and nothing here writes it. Actions delegate to
 * AMQ's own `roomBrowser` so the lobby handoff, password prompts and error
 * messages keep working.
 */

import { SvelteMap } from 'svelte/reactivity'
import { addListeners, sendCommand } from './events'
import {
  guessTimeOf,
  modeOf,
  songSelectionOf,
  songTypesOf,
  t,
  type GameMode,
  type GuessTime,
  type SongSelection,
  type SongTypes,
} from './derive'

export type { GameMode, SongSelection } from './derive'

export interface RoomPlayer {
  name: string
  level: number
}

export interface Room {
  id: number
  name: string
  host: string
  hostAvatar: RoomHostAvatar
  isPrivate: boolean
  inLobby: boolean
  mode: GameMode
  playerCount: number
  roomSize: number
  spectatorCount: number
  players: RoomPlayer[]
  spectators: RoomPlayer[]
  /** Friends of yours in this room, players and spectators alike. */
  friendNames: string[]
  songCount: number
  songsLeft: number
  guessTime: GuessTime
  songSelection: SongSelection
  songTypes: SongTypes
  settings: RoomSettings
}

function toRoom(info: RoomInfo): Room {
  const { settings } = info
  return {
    id: info.id,
    name: settings.roomName,
    host: info.host,
    hostAvatar: info.hostAvatar,
    isPrivate: Boolean(settings.privateRoom),
    inLobby: info.inLobby,
    mode: modeOf(settings),
    playerCount: info.numberOfPlayers,
    roomSize: settings.roomSize,
    spectatorCount: info.numberOfSpectators,
    players: info.allPlayers?.players ?? [],
    spectators: info.allPlayers?.spectators ?? [],
    friendNames: info.friendNames ?? [],
    songCount: settings.numberOfSongs,
    songsLeft: info.songLeft,
    guessTime: guessTimeOf(settings),
    songSelection: songSelectionOf(settings),
    songTypes: songTypesOf(settings),
    settings,
  }
}

/** Recomputes everything derived from `settings` after a patch. */
function applySettings(room: Room, settings: RoomSettings): Room {
  return {
    ...room,
    settings,
    name: settings.roomName,
    isPrivate: Boolean(settings.privateRoom),
    roomSize: settings.roomSize,
    songCount: settings.numberOfSongs,
    mode: modeOf(settings),
    guessTime: guessTimeOf(settings),
    songSelection: songSelectionOf(settings),
    songTypes: songTypesOf(settings),
  }
}

/**
 * roomTile.js:267-281 — presence in the roster decides join vs leave. The
 * player count is *not* what distinguishes them: it is assigned from the
 * payload either way.
 */
function toggleRosterEntry(
  roster: RoomPlayer[],
  name: string,
  level: number
): RoomPlayer[] {
  const index = roster.findIndex((entry) => entry.name === name)
  if (index !== -1) {
    return roster.filter((_, position) => position !== index)
  }
  return [...roster, { name, level }]
}

/** Friends are tracked by the server; `friend` is only set when one moved. */
function toggleFriend(friends: string[], name: string, joined: boolean) {
  if (joined) {
    return friends.includes(name) ? friends : [...friends, name]
  }
  return friends.filter((friend) => friend !== name)
}

// --- store ----------------------------------------------------------------

export class RoomStore {
  #rooms = new SvelteMap<number, Room>()
  #unbind: (() => void) | null = null
  /** Room whose settings the host modal is previewing, if any. */
  #previewRoomId: number | null = null

  /** True between `bind()` and `unbind()`. */
  bound = $state(false)
  /** False until the first `New Rooms` snapshot lands. */
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

  /** Asks the server for a fresh snapshot; the reply arrives as `New Rooms`. */
  refresh() {
    sendCommand('roombrowser', 'get rooms')
  }

  #onNewRooms(data: NewRoomsData) {
    // The server streams snapshots in batches rather than one complete list,
    // so this merges instead of replacing.
    for (const info of data.standard ?? []) {
      this.#rooms.set(info.id, toRoom(info))
    }
    this.loaded = true
  }

  #onRoomChange(payload: RoomChangeData) {
    const room = this.#rooms.get(payload.roomId)
    if (!room) return

    switch (payload.changeType) {
      case 'settings': {
        if (!payload.change) break
        this.#rooms.set(
          room.id,
          applySettings(room, { ...room.settings, ...payload.change })
        )
        // roomTile.js:237 — a room being previewed keeps the modal in sync.
        if (this.#previewRoomId === room.id) {
          hostModal.changeSettings(payload.change)
        }
        break
      }

      case 'players': {
        const next: Room = { ...room }
        if (payload.friend) {
          next.friendNames = toggleFriend(
            room.friendNames,
            payload.friend,
            (payload.playerCount ?? 0) > room.playerCount
          )
        }
        next.playerCount = payload.playerCount ?? room.playerCount
        if (payload.playerName) {
          next.players = toggleRosterEntry(
            room.players,
            payload.playerName,
            payload.playerLevel ?? 0
          )
        }
        if (payload.newHost) next.host = payload.newHost.name
        this.#rooms.set(room.id, next)
        break
      }

      case 'spectators': {
        const next: Room = { ...room }
        if (payload.friend) {
          next.friendNames = toggleFriend(
            room.friendNames,
            payload.friend,
            (payload.spectatorCount ?? 0) > room.spectatorCount
          )
        }
        next.spectatorCount = payload.spectatorCount ?? room.spectatorCount
        if (payload.playerName) {
          next.spectators = toggleRosterEntry(
            room.spectators,
            payload.playerName,
            payload.playerLevel ?? 0
          )
        }
        this.#rooms.set(room.id, next)
        break
      }

      case 'songsLeft': {
        this.#rooms.set(room.id, {
          ...room,
          songsLeft: payload.songsLeft ?? room.songsLeft,
        })
        break
      }

      case 'game start': {
        this.#rooms.set(room.id, {
          ...room,
          inLobby: false,
          songsLeft: room.songCount,
        })
        break
      }

      case 'game over': {
        this.#rooms.set(room.id, { ...room, inLobby: true })
        break
      }

      // roomTile.js:325 — any unrecognised changeType means the room closed.
      default: {
        if (this.#previewRoomId === room.id) {
          this.#previewRoomId = null
          hostModal.hide()
        }
        this.#rooms.delete(room.id)
        break
      }
    }
  }

  // --- actions ------------------------------------------------------------
  // Delegated to AMQ's roomBrowser so `lobby.setupLobby` +
  // `viewChanger.changeView('lobby')` keep running unchanged.

  /** roomTile.js `joinGame` — a private room prompts before it joins. */
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

  /** roomTile.js `spectateGame` — AMQ owns the private-room prompt here. */
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
   * Opens AMQ's host modal read-only on a room's settings — the same view its
   * own `.rbrAllOptionsIcon` opens (roomTile.js `previewSettings`).
   *
   * Call order matters and is copied verbatim: `changeSettings` is what sets
   * `hostModal.gameMode`, which `setModePreviewGame` then reads for its title.
   */
  previewSettings(room: Room) {
    this.#previewRoomId = room.id
    // Read the room back at click time so a room that changed while the modal
    // was open still joins with its current privacy setting.
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
