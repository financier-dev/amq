/**
 * Verification harness: proves the reducer tracks the live game before any UI
 * depends on it. Delete once the Svelte screen is trusted.
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
 * Logs a table whenever the room set changes. `$effect` needs an owner, so it
 * runs inside an `$effect.root` — returns the disposer.
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
  /** Hands the screen back to AMQ's own room browser, live. */
  useLegacy: () => void
  /** Takes it back. */
  useNew: () => void
  /** The same pair for the quiz builder, which reverts independently. */
  quizBuilderScreen: { useLegacy: () => void; useNew: () => void }
}

/**
 * The quiz builder's serializer, reachable from the page.
 *
 * This is not only a devtools convenience: the round-trip assertion in
 * `tests/render.mjs` drives it from here, because the repo has no unit-test
 * runner and adding one for two pure functions is not worth a new toolchain.
 * It is also the fastest way to diagnose a quiz that will not load in game —
 * `__amqUI.quizBuilder.fromSave(payload)` shows what we made of it.
 */
const quizBuilderApi = {
  fromSave,
  toSave,
  /** `toSave(fromSave(p))` — what saving this payload back would produce. */
  roundTrip: (save: any) => toSave(fromSave(save)),
  /**
   * Fields the server adds on load that a save never carries. Exposed so the
   * live suite strips exactly the same set we do, from one definition — the
   * two drifting apart is how a "round-trips" assertion starts lying.
   */
  serverOnlyFields: {
    quiz: [...SERVER_ONLY_QUIZ_FIELDS],
    block: [...SERVER_ONLY_BLOCK_FIELDS],
    entry: [...SERVER_ONLY_ENTRY_FIELDS],
  },
  dragState,
  libraryStore,
  /** Library entries we could not read; non-zero means the payload moved. */
  unreadable: unreadableAnimeCount,
  libraryFilters,
  bumpCache,
  /**
   * A store wired to a supplied library, for exercising the mutations without
   * a cached library or a live socket.
   */
  makeStore: (library?: any) => {
    const store = new QuizStore(library)
    store.startNew()
    return store
  },
  QuizStore,
}

/** Exposes the store on the page for poking at it from devtools. */
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
    /** Starts the throttled change log; returns its disposer. */
    startLogging: startRoomLogging,
    /** Opens a player profile the way a row does, for diagnosing failures. */
    profile: (name: string) => openProfile(document.body, name),
    quizBuilder: { ...quizBuilderApi, ...quizBuilderScreen, store: quizStore },
  }
}
