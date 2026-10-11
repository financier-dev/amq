import { GM_addStyle } from 'vite-plugin-monkey/dist/client'
import { addListener } from '@shared/events'
import { getPlayerAvatarContainer, getPlayerName } from '@shared/game'
import { isDropdownDisabled } from './lib/elements'

const BOX_CLASS = 'amq-typing-speed'

// Same definition as Monkeytype: one word is five characters.
const CHARACTERS_PER_WORD = 5

// Same colors as the answer time boxes in answerTimes.ts
const css = `
.${BOX_CLASS} {
  position: absolute;
  bottom: 100%;
  right: 0;
  padding: 0.1rem 0.7rem;
  background-color: #1b1b1b;
  opacity: 0.8;
  color: #a9a9a9;
  font-size: 1.1rem;
  white-space: nowrap;
  pointer-events: none;
}

.${BOX_CLASS} > .value {
  color: skyblue;
  font-size: 1.2rem;
}
`

function showSpeed(gamePlayerId: number, wpm: number) {
  const answerContainer = getPlayerAvatarContainer(
    getPlayerName(gamePlayerId)
  )?.querySelector('.qpAvatarAnswerContainer')

  if (!answerContainer) return

  let box = answerContainer.querySelector('.' + BOX_CLASS)

  if (!box) {
    box = document.createElement('div')
    box.className = BOX_CLASS

    const value = document.createElement('span')
    value.className = 'value'
    box.append(value, ' WPM')

    answerContainer.appendChild(box)
  }

  const value = box.querySelector('.value')
  if (value) value.textContent = String(Math.round(wpm))
}

const removeBoxes = () =>
  document.querySelectorAll('.' + BOX_CLASS).forEach((el) => el.remove())

/**
 * Shows the typing speed of each team member above their answer while the
 * dropdown is disabled (see /dd). It needs the player to submit on every
 * keystroke, as autoSubmit.ts does.
 */
export default async function setup() {
  GM_addStyle(css)

  // Time of the first character of the current answer, by gamePlayerId
  const startTimes = new Map<number, number>()

  addListener('play next song', () => {
    startTimes.clear()
    removeBoxes()
  })

  addListener('team member answer', ({ answer, gamePlayerId }) => {
    if (!isDropdownDisabled()) {
      startTimes.clear()
      removeBoxes()
      return
    }

    // autoSubmit.ts sends a single space for an empty input
    if (answer.trim() === '') {
      startTimes.delete(gamePlayerId)
      return
    }

    const now = performance.now()
    const startTime = startTimes.get(gamePlayerId)

    if (startTime === undefined) {
      startTimes.set(gamePlayerId, now)
      return
    }

    const minutes = (now - startTime) / 60_000
    if (minutes === 0) return

    showSpeed(gamePlayerId, answer.length / CHARACTERS_PER_WORD / minutes)
  })
}
