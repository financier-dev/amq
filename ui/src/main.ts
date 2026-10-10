/**
 * Entry point.
 *
 * Replaces AMQ's screens by swapping entries in `viewChanger.__controllers`.
 * The original controllers stay on the prototype chain, so outside callers
 * keep working: `ranked.js` calls `roomBrowser.joinLobby`, game invites call
 * `fireSpectateGame`.
 *
 * Each screen is independent. One can be handed back to AMQ while the other
 * stays ours.
 */

import { unsafeWindow } from 'vite-plugin-monkey/dist/client'

import { ensureLoad } from '@shared/amq/ready'
import { exposeDebugApi } from './amq/debug.svelte'
import { libraryStore } from './amq/library.svelte'
import { quizStore } from './amq/quiz.svelte'
import { roomStore } from './amq/rooms.svelte'
import { createScreen } from './lib/screen'
import { installFonts } from './ui/fonts'
import QuizBuilder from './ui/quizBuilder/QuizBuilder.svelte'
import RoomBrowser from './ui/roomBrowser/RoomBrowser.svelte'

const HOST_Z_INDEX = 100

/** Set when AMQ calls `setupNewQuiz`. See the quiz builder's `extra` below. */
let pendingNewQuiz = false

const roomBrowserScreen = createScreen({
  view: 'roomBrowser',
  component: RoomBrowser,
  props: {},
  onOpen: () => roomStore.bind(),
  onClose: () => roomStore.unbind(),
  zIndex: HOST_Z_INDEX,
})

const quizBuilderScreen = createScreen({
  view: 'customQuizCreator',
  component: QuizBuilder,
  props: {},
  /**
   * AMQ's quiz browser calls `setupNewQuiz` right before `changeView` to ask
   * for a blank quiz (`customQuizBrowser.js:93`). Recording the call lets
   * `onOpen` tell a new-quiz navigation from a plain re-entry of the view.
   * `useNew()` re-enters the view and must not wipe the quiz being edited.
   */
  extra: (original) => ({
    setupNewQuiz() {
      pendingNewQuiz = true
      original.setupNewQuiz?.()
    },
  }),
  /**
   * `changeView('customQuizCreator', { quizLoadId })` carries the quiz to edit.
   *
   * The library must be cached before the quiz is read, because entries store
   * only ids and resolve against it. AMQ nests its own load inside
   * `library.setup(callback)` for the same reason and silently drops uncached
   * entries. We refuse the load instead.
   */
  onOpen: (arg?: { quizLoadId?: number }) => {
    quizStore.bind()

    const startingNew = arg?.quizLoadId === undefined
    if (startingNew && (pendingNewQuiz || !quizStore.loaded)) {
      // A blank quiz needs nothing from the library, so show it without
      // waiting for the multi-megabyte library fetch.
      quizStore.startNew()
    }
    pendingNewQuiz = false

    void libraryStore.load().then((ok) => {
      if (arg?.quizLoadId === undefined) return
      if (!ok) {
        // Against an empty cache every entry resolves to its id and every
        // song count to zero. Saving that back would corrupt the quiz, so
        // refuse the load.
        quizStore.failLoad()
        return
      }
      quizStore.load(arg.quizLoadId)
    })
  },
  onClose: () => quizStore.unbind(),
  zIndex: HOST_Z_INDEX,
})

/**
 * AMQ's quest drawer is `position: absolute; z-index: 10` (main.css), so our
 * screens cover it and its tab. Raise it above our screens. Modals use the
 * Bootstrap range (1040+) and already sit above both, which lets the
 * algorithm block open AMQ's own dialog over our screen.
 */
function liftOverlays() {
  if (document.head.querySelector('style[data-amq-ui-overlays]')) return
  const style = document.createElement('style')
  style.dataset.amqUiOverlays = ''
  style.textContent = `#questContainer { z-index: ${HOST_Z_INDEX + 1}; }`
  document.head.appendChild(style)
}

async function main() {
  await ensureLoad()
  installFonts()
  liftOverlays()
  roomBrowserScreen.install()
  quizBuilderScreen.install()

  exposeDebugApi({
    useLegacy: roomBrowserScreen.useLegacy,
    useNew: roomBrowserScreen.useNew,
    quizBuilderScreen: {
      useLegacy: quizBuilderScreen.useLegacy,
      useNew: quizBuilderScreen.useNew,
    },
  })
  console.log(
    '[amq-ui] ready — room browser and quiz builder replaced ' +
      '(__amqUI.useLegacy() / __amqUI.quizBuilder.useLegacy() to revert)'
  )
}

main().catch((error) => {
  console.error('[amq-ui] failed to start', error)
  // A crash during setup must leave the player with AMQ's own screens.
  try {
    roomBrowserScreen.useLegacy()
    quizBuilderScreen.useLegacy()
  } catch {
    // Nothing left to try. A page reload restores AMQ's screens.
  }
  ;(unsafeWindow as any).__amqUIFailed = error
})
