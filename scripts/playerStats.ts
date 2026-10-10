import { registerCommand } from './commands'
import { getAvatarStackSlot } from './lib/avatarStack'
import { addListener, type AnswerResultsData } from '@shared/events'
import { getPlayerAvatarContainer, getPlayerName } from '@shared/game'
import {
  hideTooltip,
  makeColoredText,
  makeTooltipLine,
  setHoverTargets,
  TooltipColors as Colors,
  type HoverTarget,
} from './lib/tooltip'

const LOCAL_STORAGE_KEY = 'amq-player-stats'
const CONTAINER_CLASS = 'player-stats-container'
const HOVER_GROUP = 'player-stats'
const STACK_ORDER = 0
const MAX_TRACKED_MISSES = 20
// Fixed so every player's box lines up. In rem, like the font size, so the two
// scale together; wide enough for the longest line ("Game: 100/100 (100.00%)").
const CONTAINER_WIDTH = '12rem'

// AMQ's LIST_STATUS enum. LOOTED is a battle royale specific state rather than
// an actual anime list status, so it doesn't count as "in the player's list".
const LIST_STATUS_LOOTED = 6

interface ListStats {
  correct: number
  total: number
}

interface Miss {
  anime: string
  answer: string
}

type StatsMap = Record<string, ListStats>

function loadLocalStorage(): StatsMap {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY)
    return JSON.parse(raw ?? '{}')
  } catch {
    console.error('amq-player-stats: error while loading stats')
    return {}
  }
}

function updateLocalStorage(data: StatsMap) {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data))
}

// Read-only lookup: never inserts, so rendering doesn't pollute the stats maps
// with empty entries for players who have no tracked songs yet.
const readStats = (map: StatsMap, playerName: string): ListStats =>
  map[playerName] ?? { correct: 0, total: 0 }

const getOrCreateStats = (map: StatsMap, playerName: string): ListStats =>
  (map[playerName] ??= { correct: 0, total: 0 })

const formatPercent = ({ correct, total }: ListStats) =>
  total === 0 ? '-' : `${((correct / total) * 100).toFixed(2)}%`

const formatFull = (stats: ListStats) =>
  `${stats.correct}/${stats.total} (${formatPercent(stats)})`

// A missed song: the correct title, then the player's answer on its own
// indented line. Keeps the two readable even when a long title wraps.
function makeMissEntry({ anime, answer }: Miss) {
  const entry = document.createElement('div')
  entry.style.marginTop = '0.2rem'

  const answerLine = makeTooltipLine(
    makeColoredText('→ ', Colors.MUTED),
    makeColoredText(answer || '(no answer)', Colors.PLAYER_ANSWER)
  )
  answerLine.style.paddingLeft = '1rem'
  answerLine.style.textIndent = '-1rem'
  answerLine.style.marginLeft = '0.6rem'

  entry.append(
    makeTooltipLine(makeColoredText(anime, Colors.CORRECT_TITLE)),
    answerLine
  )

  return entry
}

function getPlayerNames() {
  const names = Object.values(quiz.players ?? []).map((player) => player._name)

  if (names.length > 0) return names

  return [...document.querySelectorAll('.qpAvatarName')]
    .filter((el): el is HTMLElement => el instanceof HTMLElement)
    .map((el) => el.innerText)
}

function removeAllContainers() {
  ;[...document.querySelectorAll('.' + CONTAINER_CLASS)].forEach((el) =>
    el.remove()
  )
}

/**
 * Shows each player's accuracy on songs from their own list, under their
 * avatar: this game, this session and all time.
 */
export default async function setup() {
  const allTime = loadLocalStorage()
  let session: StatsMap = {}
  let game: StatsMap = {}
  let gameMisses: Record<string, Miss[]> = {}
  let songAnswers: Record<number, string> = {}
  let active = true

  // Rebuilt from scratch on every render and handed to the shared hit-testing
  // registry, which is what makes these tooltips work at all: the stats box sits
  // below the avatar row, where other quiz page elements swallow pointer events.
  let hoverTargets: HoverTarget[] = []

  const getMissLines = (playerName: string) => {
    const misses = gameMisses[playerName] ?? []

    if (misses.length === 0) {
      return [makeTooltipLine('No missed list songs this game')]
    }

    return [
      makeTooltipLine(
        makeColoredText(
          `Missed this game (last ${MAX_TRACKED_MISSES}):`,
          Colors.MUTED
        )
      ),
      ...misses.map(makeMissEntry),
    ]
  }

  const renderPlayer = (playerName: string) => {
    const avatarContainer = getPlayerAvatarContainer(playerName)
    if (!avatarContainer) return

    const container = getAvatarStackSlot(
      avatarContainer,
      CONTAINER_CLASS,
      STACK_ORDER
    )
    container.style.alignSelf = 'center'
    container.style.boxSizing = 'border-box'
    container.style.width = CONTAINER_WIDTH
    container.style.backgroundColor = '#1b1b1b'
    container.style.opacity = '0.8'
    container.style.color = 'white'
    container.style.padding = '0.3rem 0.6rem'
    container.style.rowGap = '0'
    container.style.textAlign = 'center'
    container.style.fontSize = '0.9rem'
    container.style.lineHeight = '1.3'
    container.style.whiteSpace = 'nowrap'

    const gameStats = readStats(game, playerName)
    const sessionStats = readStats(session, playerName)
    const allTimeStats = readStats(allTime, playerName)

    const lines: [string, string, () => HTMLElement[]][] = [
      ['Game', formatFull(gameStats), () => getMissLines(playerName)],
      [
        'Session',
        formatPercent(sessionStats),
        () => [
          makeTooltipLine(
            `Session: ${formatFull(readStats(session, playerName))}`
          ),
        ],
      ],
      [
        'All time',
        formatPercent(allTimeStats),
        () => [
          makeTooltipLine(
            `All time: ${formatFull(readStats(allTime, playerName))}`
          ),
        ],
      ],
    ]

    container.replaceChildren(
      ...lines.map(([label, text, getLines]) => {
        const el = document.createElement('div')
        el.innerText = `${label}: ${text}`
        hoverTargets.push({ el, getLines })
        return el
      })
    )
  }

  const render = () => {
    hoverTargets = []
    hideTooltip()

    if (active) {
      getPlayerNames().forEach(renderPlayer)
    }

    setHoverTargets(HOVER_GROUP, hoverTargets)
  }

  const registerSongResults = (data: AnswerResultsData) => {
    const anime = data.songInfo.animeNames.romaji

    for (const player of data.players) {
      if (!player.listStatus || player.listStatus === LIST_STATUS_LOOTED) {
        continue
      }

      const playerName = getPlayerName(player.gamePlayerId)
      if (!playerName) continue

      for (const map of [game, session, allTime]) {
        const stats = getOrCreateStats(map, playerName)
        stats.total += 1
        if (player.correct) {
          stats.correct += 1
        }
      }

      if (player.correct) continue

      const misses = (gameMisses[playerName] ??= [])
      misses.push({ anime, answer: songAnswers[player.gamePlayerId] ?? '' })
      if (misses.length > MAX_TRACKED_MISSES) {
        misses.shift()
      }
    }

    updateLocalStorage(allTime)
  }

  addListener('quiz ready', () => {
    game = {}
    gameMisses = {}
    render()
  })

  addListener('play next song', () => {
    songAnswers = {}
    render()
  })

  addListener('player answers', (data) => {
    data.answers.forEach(({ answer, gamePlayerId }) => {
      songAnswers[gamePlayerId] = answer
    })
  })

  addListener('player name change', () => render())

  addListener('answer results', (data) => {
    registerSongResults(data)
    render()
  })

  registerCommand(
    'stats',
    () => ({
      shortHelp: 'Toggle the player stats display',
      longHelp: `Usage: /stats</br>Toggles the own list accuracy box shown under each player's avatar.</br>Usage: /stats reset</br>Resets the current session (and current game) stats. All time stats are never cleared.</br>Current value: ${active ? 'enabled' : 'disabled'}`,
    }),
    (args) => {
      const arg = args.trim()

      if (arg === 'reset') {
        session = {}
        game = {}
        gameMisses = {}
        render()
        gameChat.systemMessage('Player stats: session stats reset')
        return
      }

      if (arg !== '') {
        gameChat.systemMessage(`Player stats: unknown argument "${arg}"`)
        return
      }

      active = !active
      if (!active) {
        removeAllContainers()
      }
      // render() clears the hover targets and the tooltip either way
      render()
      gameChat.systemMessage(`Player stats: ${active ? 'enabled' : 'disabled'}`)
    }
  )
}
