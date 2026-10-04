/**
 * Entry point.
 *
 * Installs our screens in place of AMQ's by swapping entries in
 * `viewChanger.__controllers`. The original controllers stay on the prototype
 * chain, so everything that calls into them from outside — `ranked.js` calling
 * `roomBrowser.joinLobby`, game invites calling `fireSpectateGame` — keeps
 * working untouched.
 *
 * Each screen is independent: one can be handed back to AMQ while the other
 * stays ours, which matters because they are at very different stages of
 * trust.
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

/** Set by AMQ's `setupNewQuiz`; see the quiz builder's `extra` below. */
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
   * `setupNewQuiz` is how AMQ's own browser says "blank quiz" — it calls it
   * immediately before `changeView` (`customQuizBrowser.js:93`). Observing it
   * is what lets `openView` tell a real new-quiz navigation apart from merely
   * re-entering the view, which `useNew()` does and which must not wipe the
   * quiz being edited.
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
   * The library has to be in the cache before the quiz is read, because entries
   * store only ids and resolve against it — AMQ nests its own load inside
   * `library.setup(callback)` for exactly this reason, and drops uncached
   * entries silently. Ours refuses the load instead of half-reading it.
   */
  onOpen: (arg?: { quizLoadId?: number }) => {
    quizStore.bind()

    const startingNew = arg?.quizLoadId === undefined
    if (startingNew && (pendingNewQuiz || !quizStore.loaded)) {
      // A blank quiz needs nothing from the library, so show it immediately
      // rather than holding the screen behind a multi-megabyte fetch.
      quizStore.startNew()
    }
    pendingNewQuiz = false

    void libraryStore.load().then((ok) => {
      if (arg?.quizLoadId === undefined) return
      if (!ok) {
        // Loading a quiz against an empty cache resolves every entry to its
        // id and every song count to zero. Refusing is the honest outcome:
        // saving that back would be saving a quiz we could not read.
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
 * screens cover it and its stick-out tab. It isn't ours to redesign — lift it
 * over us instead. Modals sit in the Bootstrap range (1040+) and are already
 * clear of both, which is what lets the algorithm block open AMQ's own dialog
 * over our screen.
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
  // A crash during setup must not leave the player without either screen.
  try {
    roomBrowserScreen.useLegacy()
    quizBuilderScreen.useLegacy()
  } catch {
    // Nothing more we can do; a reload restores AMQ's own screens.
  }
  ;(unsafeWindow as any).__amqUIFailed = error
})
