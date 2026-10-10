import { GM_addStyle } from 'vite-plugin-monkey/dist/client'
import { getAvatarStackSlot } from './lib/avatarStack'
import { isDropdownDisabled } from './lib/elements'
import { addListener, type AnswerResultsData } from '@shared/events'
import { getPlayerAvatarContainer, getPlayerName } from '@shared/game'

const options = {
  trackAnswerTimes: true,
}

const LOCAL_STORAGE_KEY = 'amq-answer-times'
const STACK_ORDER = 10

const HINT_ICONS = {
  1: 'fa-font',
  2: 'fa-info-circle',
  3: 'fa-bars',
}

const Classes = {
  CONTAINER: 'player-times-container',
  PB_DIFF_TIME: 'pb-diff-time',
  HINT_1_TIME: 'hint-1-time',
  HINT_2_TIME: 'hint-2-time',
  HINT_3_TIME: 'hint-3-time',
  STANDINGS_HINT: 'standings-hint',
  STANDINGS_CORRECT_GUESSES_WITHOUT_HINTS: 'correct-guesses-without-hint',
  LOCKED_ANSWER: 'player-with-locked-answer',
  HIGHLIGHT_COUNT: 'player-highlight-count',
}

const animationCss = `
@keyframes show {
  from {
    opacity: 0;
    transform: translateY(-100%);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

`

const standingsCss = `
.qpScoreBoardEntry {
  display: flex !important;
  align-items: center !important;
}

.${Classes.LOCKED_ANSWER} {
  color: goldenrod !important;
}

.${Classes.HIGHLIGHT_COUNT} {
  border-bottom: 1px solid;
}
`

const usersHinted = new Set<string>()

function makeHintEl(hintId: 1 | 2 | 3) {
  const hint = document.createElement('span')
  hint.style.display = 'flex'
  hint.style.alignItems = 'center'
  hint.style.justifyContent = 'center'
  hint.style.backgroundColor = 'rgb(9, 81, 133)'
  hint.style.borderRadius = '100%'
  hint.style.color = 'white'
  hint.style.width = '1.75rem'
  hint.style.height = '1.75rem'
  hint.style.fontSize = '1rem'

  const hintIcon = document.createElement('i')

  hintIcon.className = `fa ${HINT_ICONS[hintId]}`

  hint.appendChild(hintIcon)

  return hint
}

function reportHintTime(
  playerName: string,
  hintTime: number,
  hintId: 1 | 2 | 3
) {
  const el = document.createElement('span')
  el.style.position = 'relative'
  el.style.backgroundColor = '#1b1b1b'
  el.style.opacity = '0.8'
  el.style.color = 'skyblue'
  el.style.padding = '0.4rem 1rem'
  el.style.textAlign = 'center'

  const text = document.createElement('span')
  text.innerText = `${hintTime.toFixed(3)}s`
  el.appendChild(text)

  const hint = makeHintEl(hintId)
  hint.style.position = 'absolute'
  hint.style.left = '0'
  hint.style.top = '50%'
  hint.style.transform = 'translate(-50%, -50%)'

  el.appendChild(hint)

  appendBoxToPlayer(playerName, el, Classes[`HINT_${hintId}_TIME`])
}

function updateStandingsPlayer(playerName: string, hintId: 1 | 2 | 3) {
  const scoreBoardEntryEl = getScoreBoardEntryEl(playerName)

  if (!(scoreBoardEntryEl instanceof HTMLElement)) {
    return
  }

  const hintEl = makeHintEl(hintId)
  hintEl.style.marginLeft = '0.5rem'
  hintEl.classList.add(Classes.STANDINGS_HINT)
  scoreBoardEntryEl.appendChild(hintEl)
}

function updateStandings(players: AnswerResultsData['players']) {
  for (const player of players) {
    const name = getPlayerName(player.gamePlayerId)
    const scoreBoardEntryEl = getScoreBoardEntryEl(name)

    if (!(scoreBoardEntryEl instanceof HTMLElement)) {
      return
    }

    if (
      !scoreBoardEntryEl.querySelector(
        '.' + Classes.STANDINGS_CORRECT_GUESSES_WITHOUT_HINTS
      )
    ) {
      const correctGuessesEl = scoreBoardEntryEl.querySelector(
        '.qpsPlayerGuessCount'
      )
      if (correctGuessesEl instanceof HTMLElement) {
        const hintlessGuessesEl = document.createElement('span')
        hintlessGuessesEl.classList.add(
          Classes.STANDINGS_CORRECT_GUESSES_WITHOUT_HINTS
        )
        hintlessGuessesEl.innerText = '0'
        hintlessGuessesEl.style.marginLeft = '.5rem'
        hintlessGuessesEl.style.color = 'limegreen'
        hintlessGuessesEl.style.opacity = '.6'

        correctGuessesEl.parentNode?.insertBefore(
          hintlessGuessesEl,
          correctGuessesEl.nextSibling
        )
      }
    }

    if (player.correct) {
      const correctCountEl = scoreBoardEntryEl.querySelector(
        '.qpsPlayerGuessCount'
      )
      if (correctCountEl instanceof HTMLElement) {
        correctCountEl.classList.add(Classes.HIGHLIGHT_COUNT)
      }

      if (!usersHinted.has(name)) {
        const hintlessGuessesEl = scoreBoardEntryEl.querySelector(
          '.' + Classes.STANDINGS_CORRECT_GUESSES_WITHOUT_HINTS
        )

        if (hintlessGuessesEl instanceof HTMLElement) {
          const curScore = parseInt(hintlessGuessesEl.innerText)
          hintlessGuessesEl.innerText = (curScore + 1).toString()
          hintlessGuessesEl.classList.add(Classes.HIGHLIGHT_COUNT)
        }
      }
    }

    if (player.listStatus) {
      const listCountEl = scoreBoardEntryEl.querySelector(
        '.qpScoreBoardListNumber'
      )
      if (listCountEl instanceof HTMLElement) {
        listCountEl.classList.add(Classes.HIGHLIGHT_COUNT)
      }
    }
  }
}

function highlightLockedPlayer(playerName: string) {
  const nameEl = [...document.querySelectorAll('.qpsPlayerName')].find(
    (el) => el instanceof HTMLElement && el.innerText === playerName
  )

  if (!nameEl || nameEl.classList.contains(Classes.LOCKED_ANSWER)) return

  nameEl.classList.add(Classes.LOCKED_ANSWER)
}

function appendBoxToPlayer(
  playerName: string,
  element: HTMLElement,
  className: string
) {
  const avatarContainer = getPlayerAvatarContainer(playerName)

  if (!avatarContainer) return

  const container = getAvatarStackSlot(
    avatarContainer,
    Classes.CONTAINER,
    STACK_ORDER
  )

  const existingEl = container.querySelector('.' + className)
  if (existingEl) {
    existingEl.remove()
  }

  const box = document.createElement('div')
  box.className = className
  box.style.display = 'flex'
  box.style.alignItems = 'center'
  box.style.justifyContent = 'center'
  box.style.animationName = 'show'
  box.style.animationTimingFunction = 'ease-out'
  box.style.animationDuration = '0.5s'
  box.style.animationFillMode = 'forwards'
  box.appendChild(element)
  container.appendChild(box)
}

function reportPBDiff(delta: number | null) {
  const el = document.createElement('span')
  el.innerText =
    delta === null ? 'New' : `${delta >= 0 ? '+' : ''}${delta.toFixed(3)}s`
  el.style.backgroundColor = '#1b1b1b'
  el.style.opacity = '0.8'
  el.style.color = delta === null || delta < 0 ? 'gold' : 'indianred'
  el.style.padding = '0.4rem 1rem'
  el.style.textAlign = 'center'

  appendBoxToPlayer(selfName, el, Classes.PB_DIFF_TIME)
}

const getTime = (timer: number) => (new Date().getTime() - timer) / 1000

const getScoreBoardEntryEl = (playerName: string) =>
  [...document.querySelectorAll('.qpsPlayerName')]
    .find((el) => el instanceof HTMLElement && el.innerText === playerName)
    ?.closest('.qpScoreBoardEntry')

function loadLocalStorage() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY)
    const data = JSON.parse(raw ?? '{}')
    return data
  } catch {
    return null
  }
}

function updateLocalStorage(data: Record<string, number>) {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data))
}

// With the dropdown disabled (see /dd) the answer can only have been typed out.
// Otherwise, fall back to the casing heuristic: dropdown entries keep their
// original casing, so an all-lowercase/all-uppercase answer was typed by hand.
const isTypedAnswer = (
  answer: string | null,
  dropdownDisabled: boolean
): answer is string =>
  answer !== null &&
  (dropdownDisabled ||
    answer === answer.toLocaleLowerCase() ||
    answer === answer.toLocaleUpperCase())

export default async function setup() {
  let answerTimes: Record<string, number> | null = null
  let userAnswer: string | null = null
  let revealedAnswer: string | null = null
  let userAnswerTime: number | null = null
  // Dropdown state (see /dd) at the time the answer was locked in
  let dropdownDisabled = false

  if (options.trackAnswerTimes) {
    answerTimes = loadLocalStorage()
    if (answerTimes === null) {
      console.error('Error while loading answer times from local storage')
    }
  }

  GM_addStyle(animationCss)
  GM_addStyle(standingsCss)

  let timer: number | null = null
  const debounceTimeoutIds: Record<string, any> = {}

  addListener('play next song', () => {
    timer = new Date().getTime()
    ;[
      ...document.querySelectorAll('.' + Classes.CONTAINER),
      ...document.querySelectorAll('.' + Classes.STANDINGS_HINT),
    ].forEach((el) => el.remove())
    usersHinted.clear()
    ;[...document.querySelectorAll('.qpsPlayerName')].forEach((el) => {
      if (!(el instanceof HTMLElement)) return
      el.classList.remove(Classes.LOCKED_ANSWER)
    })
    ;[...document.querySelectorAll('.' + Classes.HIGHLIGHT_COUNT)].forEach(
      (el) => {
        if (!(el instanceof HTMLElement)) return
        el.classList.remove(Classes.HIGHLIGHT_COUNT)
      }
    )

    userAnswer = null
    revealedAnswer = null
    userAnswerTime = null
    dropdownDisabled = false
  })

  addListener('player answered', (data) => {
    data.forEach(({ gamePlayerIds, answerTime }) => {
      gamePlayerIds.forEach((idx) => {
        const playerName = getPlayerName(idx)

        if (playerName === selfName) {
          userAnswerTime = answerTime
          dropdownDisabled = isDropdownDisabled()
        }

        highlightLockedPlayer(playerName)
      })
    })
  })

  addListener('quiz player hint used', ({ gamePlayerIds, hintId }) => {
    if (!timer) return

    const hintTime = getTime(timer)

    gamePlayerIds.forEach((idx: number) => {
      const playerName = getPlayerName(idx)

      usersHinted.add(playerName)

      updateStandingsPlayer(playerName, hintId)

      const debounceKey = `hint-${hintId}::${playerName}`
      if (debounceTimeoutIds[debounceKey]) {
        clearTimeout(debounceTimeoutIds[debounceKey])
      }

      debounceTimeoutIds[debounceKey] = setTimeout(
        () => reportHintTime(playerName, hintTime, hintId),
        200
      )
    })
  })

  addListener('player answers', (data) => {
    data.answers.forEach((answer) => {
      if (getPlayerName(answer.gamePlayerId) === selfName) {
        revealedAnswer = answer.answer
        if (!quiz.teamMode) {
          userAnswer = answer.answer
        }
      }
    })
  })

  // In team games, 'player answers' reveals a team-unified answer, which can
  // differ from what the user actually typed if a teammate answered instead.
  // 'team member answer' only fires for a player once they personally submit,
  // so it's the reliable source for self in team games.
  addListener('team member answer', (data) => {
    if (getPlayerName(data.gamePlayerId) === selfName) {
      userAnswer = data.answer
    }
  })

  addListener('answer results', (data) => {
    updateStandings(data.players)

    if (options.trackAnswerTimes) {
      const player = data.players.find(
        (p) => getPlayerName(p.gamePlayerId) === selfName
      )
      if (
        player &&
        player.correct &&
        isTypedAnswer(userAnswer, dropdownDisabled) &&
        revealedAnswer !== null &&
        userAnswer.trim().toLocaleLowerCase() ===
          revealedAnswer.trim().toLocaleLowerCase() &&
        answerTimes &&
        userAnswerTime !== null
      ) {
        const canonicalAnswer = userAnswer.trim().toLocaleLowerCase()
        const curPB = answerTimes[canonicalAnswer]
        if (!curPB || userAnswerTime < curPB) {
          reportPBDiff(curPB ? userAnswerTime - curPB : null)
          answerTimes[canonicalAnswer] = userAnswerTime
          updateLocalStorage(answerTimes)
        } else {
          reportPBDiff(userAnswerTime - curPB)
        }
      }
    }
  })
}
