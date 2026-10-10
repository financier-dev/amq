/**
 * Devtools API (`__amqUI`) for checking the stores against the live game. The
 * test suites also drive it.
 */

import { unsafeWindow } from 'vite-plugin-monkey/dist/client'

import { openProfile, rangeLabel } from './derive'
import { roomStore, type Room } from './rooms.svelte'
import { fromSave, toSave } from './quizSerializer'
import {
  SERVER_ONLY_BLOCK_FIELDS,
  SERVER_ONLY_ENTRY_FIELDS,
  SERVER_ONLY_QUIZ_FIELDS,
} from './quizSave'
import { QuizStore, quizStore } from './quiz.svelte'
import { bumpCache, libraryStore, unreadableAnimeCount } from './library.svelte'
import { libraryFilters } from './quizFilters.svelte'
import { dragState } from '../ui/quizBuilder/dnd.svelte'

const LOG_THROTTLE_MS = 1000

function summarise(room: Room) {
  return {
    id: room.id,
    name: room.name,
    host: room.host,
    mode: room.mode,
    players: `${room.playerCount}/${room.roomSize}`,
    spectators: room.spectatorCount,
    state: room.inLobby ? 'lobby' : `playing (${room.songsLeft} left)`,
    songs: room.songCount,
    guessTime: room.guessTime.range ? rangeLabel(room.guessTime.range) : '-',
    selection: room.songSelection,
    types:
      (['openings', 'endings', 'inserts'] as const)
        .filter((type) => room.songTypes[type])
        .map((type) => type[0].toUpperCase())
        .join('') || '-',
    private: room.isPrivate,
    friends: room.friendNames.length,
  }
}

/**
 * Logs a table when the room set changes. Returns the disposer of the
 * `$effect.root` that owns the effect.
 */
export function startRoomLogging() {
  return $effect.root(() => {
    let last = 0
    let pending: ReturnType<typeof setTimeout> | null = null

    $effect(() => {
      const rooms = roomStore.rooms
      if (!roomStore.loaded) return

      const flush = () => {
        last = Date.now()
        pending = null
        console.groupCollapsed(
          `[amq-ui] ${rooms.length} rooms, ${roomStore.playerCount} players`
        )
        console.table(rooms.map(summarise))
        console.groupEnd()
      }

      const elapsed = Date.now() - last
      if (elapsed >= LOG_THROTTLE_MS) {
        flush()
      } else if (!pending) {
        pending = setTimeout(flush, LOG_THROTTLE_MS - elapsed)
      }
    })
  })
}

export interface DebugHooks {
  /** Hands the room browser back to AMQ without a reload. */
  useLegacy: () => void
  useNew: () => void
  /** The quiz builder reverts independently. */
  quizBuilderScreen: { useLegacy: () => void; useNew: () => void }
}

/**
 * The quiz builder's serializer, reachable from the page.
 *
 * The round-trip assertion in `tests/render.mjs` calls it from here, because
 * the repo has no unit-test runner. It also helps diagnose a quiz that fails
 * to load: `__amqUI.quizBuilder.fromSave(payload)` shows how we read it.
 */
const quizBuilderApi = {
  fromSave,
  toSave,
  /** What saving this payload back would produce. */
  roundTrip: (save: any) => toSave(fromSave(save)),
  /**
   * Fields the server adds on load that a save never carries. The live suite
   * reads them from here so it strips the same set as the serializer.
   */
  serverOnlyFields: {
    quiz: [...SERVER_ONLY_QUIZ_FIELDS],
    block: [...SERVER_ONLY_BLOCK_FIELDS],
    entry: [...SERVER_ONLY_ENTRY_FIELDS],
  },
  dragState,
  libraryStore,
  /** Library entries we could not read. Non-zero means the payload changed. */
  unreadable: unreadableAnimeCount,
  libraryFilters,
  bumpCache,
  /** A store on a supplied library. Needs no cached library and no socket. */
  makeStore: (library?: any) => {
    const store = new QuizStore(library)
    store.startNew()
    return store
  },
  QuizStore,
}

export function exposeDebugApi(hooks: DebugHooks) {
  const { quizBuilderScreen, ...roomBrowserHooks } = hooks
  ;(unsafeWindow as any).__amqUI = {
    ...roomBrowserHooks,
    store: roomStore,
    get rooms() {
      return roomStore.rooms
    },
    table: () => console.table(roomStore.rooms.map(summarise)),
    refresh: () => roomStore.refresh(),
    /** Returns the disposer. */
    startLogging: startRoomLogging,
    /** Opens a player profile the same way a room row does. */
    profile: (name: string) => openProfile(document.body, name),
    quizBuilder: { ...quizBuilderApi, ...quizBuilderScreen, store: quizStore },
  }
}
