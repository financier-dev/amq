import { GM_addStyle } from 'vite-plugin-monkey/dist/client'
import { addListener, type AnswerResultsData } from '@shared/events'
import { getPlayerName } from '@shared/game'
import { createQuizPageMutationObserver } from '@shared/pages'
import {
  addHoverTarget,
  makeColoredText,
  makeTooltipLine,
  TooltipColors,
} from './lib/tooltip'

const CONTAINER_ID = 'amqSongHistoryContainer'
const SCROLL_ID = 'amqSongHistoryScroll'
const TABLE_ID = 'amqSongHistoryTable'
const HOVER_GROUP = 'song-history'
const ONLY_MISTAKES_STORAGE_KEY = 'amq-song-history-only-mistakes'

// Song rows over all games. Separator rows do not count.
const MAX_ROWS = 100

// AMQ's LIST_STATUS enum. LOOTED is a battle royale specific state rather than
// an actual anime list status, so it doesn't count as "in the player's list".
const LIST_STATUS_LOOTED = 6

// Horizontal margin kept between the two boxes and the edges of their band
const SIDE_MARGIN = 20
const VIDEO_CONTAINER_ID = 'qpVideoContainer'
// Vertical gap between the standings box and the panel
const STANDINGS_GAP = 20

// The panel is positioned absolutely from the standings box's measured geometry
// (see syncGeometry): the standings box doesn't start at its parent's content
// edge, and leaving the panel in flow pushed the avatar row down when the
// standings grew tall. Overlapping the avatars is preferable to moving them.
const css = `
#${CONTAINER_ID} {
  position: absolute;
  z-index: 5;
  /* Nexus sets pointer-events: none on everything outside its own whitelist */
  pointer-events: auto;
  display: flex;
  flex-direction: column;
  max-height: 200px;
  padding: 4px 6px 6px;
  border-radius: 5px;
  background-color: rgba(27, 27, 27, 0.7);
}

#${CONTAINER_ID} > .header {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  margin: 2px 0 4px;
}

#${CONTAINER_ID} > .header > h5 {
  grid-column: 2;
  margin: 0;
}

#${CONTAINER_ID} > .header > label {
  grid-column: 3;
  justify-self: end;
  display: flex;
  align-items: center;
  gap: 4px;
  margin: 0;
  font-size: 11px;
  font-weight: normal;
  opacity: 0.85;
  cursor: pointer;
}

#${CONTAINER_ID} > .header input {
  margin: 0;
}

/* Centers the capital letters on the checkbox, whatever the font's metrics */
#${CONTAINER_ID} > .header span {
  line-height: 1;
  text-box: trim-both cap alphabetic;
}

#${SCROLL_ID} {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: #6d6d6d rgba(0, 0, 0, 0.3);
}

#${SCROLL_ID}::-webkit-scrollbar {
  width: 8px;
}

#${SCROLL_ID}::-webkit-scrollbar-track {
  background-color: rgba(0, 0, 0, 0.3);
  border-radius: 4px;
}

#${SCROLL_ID}::-webkit-scrollbar-thumb {
  background-color: #6d6d6d;
  border-radius: 4px;
}

#${SCROLL_ID}::-webkit-scrollbar-thumb:hover {
  background-color: #8a8a8a;
}

#${TABLE_ID} {
  width: 100%;
  table-layout: fixed;
  font-size: 12px;
}

/* Headers share the cells' alignment so each column reads as one strip */
#${TABLE_ID} th,
#${TABLE_ID} td {
  padding: 1px 3px;
  overflow-wrap: break-word;
  vertical-align: top;
  text-align: left;
}

#${TABLE_ID} thead th {
  position: sticky;
  top: 0;
  background-color: #1b1b1b;
  font-weight: normal;
  opacity: 0.8;
}

#${TABLE_ID} tr.correctGuess {
  background-color: #5cb85c77;
}

#${TABLE_ID} tr.wrongGuess {
  background-color: #ac292577;
}

#${TABLE_ID} tbody tr:not(.gameSeparator):hover {
  outline: 1px solid #8a8a8a;
}

#${TABLE_ID} tr.gameSeparator td {
  padding: 2px 3px;
  text-align: center;
  font-size: 11px;
  color: #a9a9a9;
  background-color: rgba(0, 0, 0, 0.45);
  border-top: 1px solid #6d6d6d;
}

#${CONTAINER_ID}.onlyMistakes tbody tr:not(.wrongGuess):not(.gameSeparator) {
  display: none;
}

/* A game without mistakes hides its separator too */
#${CONTAINER_ID}.onlyMistakes tbody:not(:has(tr.wrongGuess)) {
  display: none;
}

/* The sample is a fixed-shape timestamp, so it never needs to wrap */
#${TABLE_ID} th:last-child,
#${TABLE_ID} td:last-child {
  white-space: nowrap;
  text-align: right;
}
`

const COLUMNS = [
  { label: 'Anime', width: '38%' },
  { label: 'Type', width: '15%' },
  { label: 'Song', width: '25%' },
  { label: 'Sample', width: '22%' },
]

function createPanel() {
  const standingContainer = document.getElementById('qpStandingContainer')

  if (!standingContainer) {
    throw new Error('Could not find the standings container')
  }

  const container = document.createElement('div')
  container.id = CONTAINER_ID

  const header = document.createElement('div')
  header.className = 'header'
  container.appendChild(header)

  const title = document.createElement('h5')
  title.textContent = 'Song History'
  header.appendChild(title)

  const onlyMistakes = document.createElement('input')
  onlyMistakes.type = 'checkbox'
  onlyMistakes.checked =
    localStorage.getItem(ONLY_MISTAKES_STORAGE_KEY) === 'true'
  container.classList.toggle('onlyMistakes', onlyMistakes.checked)
  onlyMistakes.addEventListener('change', () => {
    container.classList.toggle('onlyMistakes', onlyMistakes.checked)
    localStorage.setItem(
      ONLY_MISTAKES_STORAGE_KEY,
      String(onlyMistakes.checked)
    )
  })

  const onlyMistakesLabel = document.createElement('label')
  const onlyMistakesText = document.createElement('span')
  onlyMistakesText.textContent = 'Only mistakes'
  onlyMistakesLabel.append(onlyMistakes, onlyMistakesText)
  header.appendChild(onlyMistakesLabel)

  const scroll = document.createElement('div')
  scroll.id = SCROLL_ID
  container.appendChild(scroll)

  const table = document.createElement('table')
  table.id = TABLE_ID
  scroll.appendChild(table)

  const colGroup = document.createElement('colgroup')
  const headerRow = document.createElement('tr')

  for (const { label, width } of COLUMNS) {
    const col = document.createElement('col')
    col.style.width = width
    colGroup.appendChild(col)

    const th = document.createElement('th')
    th.textContent = label
    headerRow.appendChild(th)
  }

  table.appendChild(colGroup)

  const head = document.createElement('thead')
  head.appendChild(headerRow)
  table.appendChild(head)

  standingContainer.after(container)
  watchGeometry(container, standingContainer)

  return { table, head, scroll }
}

// Each game is one tbody. Its first row is the separator.
function createGameBody(startTime: Date) {
  const body = document.createElement('tbody')

  const separator = document.createElement('tr')
  separator.className = 'gameSeparator'

  const cell = document.createElement('td')
  cell.colSpan = COLUMNS.length
  cell.textContent = startTime.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })

  separator.appendChild(cell)
  body.appendChild(separator)

  return { body, separator }
}

const SONG_ROW_SELECTOR = 'tbody tr:not(.gameSeparator)'

function removeOldestRows(table: HTMLTableElement) {
  const rows = table.querySelectorAll(SONG_ROW_SELECTOR)

  for (const row of [...rows].slice(MAX_ROWS)) {
    const body = row.parentElement
    row.remove()
    if (body?.childElementCount === 1) body.remove()
  }
}

// Both boxes are centered on the free band between the left edge of the screen
// and the video: the standings keeps its own width and only gets moved, while
// the panel fills the band. The panel is positioned absolutely because leaving
// it in flow pushed the avatar row down when the standings grew tall.
function syncGeometry(container: HTMLElement, standingContainer: HTMLElement) {
  const videoRect = document
    .getElementById(VIDEO_CONTAINER_ID)
    ?.getBoundingClientRect()
  const standingRect = standingContainer.getBoundingClientRect()

  if (!videoRect || videoRect.width === 0 || standingRect.width === 0) {
    return
  }

  const bandRight = videoRect.left - SIDE_MARGIN
  const center = (SIDE_MARGIN + bandRight) / 2

  // Shifting by the delta rather than assigning an absolute offset keeps this
  // correct whatever margins/padding the standings' own column contributes.
  const currentMargin =
    parseFloat(getComputedStyle(standingContainer).marginLeft) || 0
  const standingLeft = center - standingRect.width / 2
  standingContainer.style.marginLeft = `${
    currentMargin + standingLeft - standingRect.left
  }px`

  const width = Math.max(bandRight - SIDE_MARGIN, standingRect.width)

  // left/top are relative to the offset parent, which is whatever positioned
  // ancestor the quiz page happens to provide.
  const origin = (
    container.offsetParent ?? document.body
  ).getBoundingClientRect()

  container.style.width = `${width}px`
  container.style.left = `${center - width / 2 - origin.left}px`
  container.style.top = `${standingRect.bottom + STANDINGS_GAP - origin.top}px`
}

function watchGeometry(container: HTMLElement, standingContainer: HTMLElement) {
  const sync = () => syncGeometry(container, standingContainer)

  // Joining an ongoing game reveals the quiz page with the boxes already sized,
  // so nothing resizes afterwards and a single sync lands on a half-settled
  // layout. Re-run as it settles; syncGeometry is idempotent.
  const resync = () => [0, 100, 500, 1500].forEach((ms) => setTimeout(sync, ms))

  // The standings box is sized in percentages of the quiz page, so it moves
  // whenever the window does rather than only on load.
  const observer = new ResizeObserver(sync)
  observer.observe(standingContainer)

  const videoContainer = document.getElementById(VIDEO_CONTAINER_ID)
  if (videoContainer) {
    observer.observe(videoContainer)
  }

  if (container.parentElement) {
    observer.observe(container.parentElement)
  }

  window.addEventListener('resize', sync)
  createQuizPageMutationObserver(({ visible }) => {
    if (visible) resync()
  })

  resync()
}

const getAnimeName = (songInfo: AnswerResultsData['songInfo']) =>
  options.useRomajiNames
    ? songInfo.animeNames.romaji
    : songInfo.animeNames.english

function getTypeText(songInfo: AnswerResultsData['songInfo']) {
  const { key, data } = convertTypeInfoToText(
    songInfo.type,
    songInfo.typeNumber,
    null,
    null,
    'song_history'
  )
  return localizationHandler.translate(key, data, true)
}

// Same string the built-in song history shows in its Sample column
function getSampleText() {
  const startPoint = quizVideoController.getCurrentVideoStartPoint()
  const videoLength = quizVideoController.getCurrentVideoLength()

  if (startPoint === null || videoLength === null) {
    return '-'
  }

  return `${convertSecondsToTimeString(startPoint)}/${convertSecondsToTimeString(
    videoLength
  )}`
}

function formatVintage(vintage: AnswerResultsData['songInfo']['vintage']) {
  if (!vintage) return '?'

  return typeof vintage === 'string'
    ? vintage
    : localizationHandler.translate(vintage.key, vintage.data)
}

interface ListPlayer {
  name: string
  correct: boolean
}

// Players who had this anime in their list. Names are resolved when the row is
// built rather than on hover, since rows outlive players leaving and renaming.
const getListPlayers = (data: AnswerResultsData): ListPlayer[] =>
  data.players
    .filter(
      (player) => player.listStatus && player.listStatus !== LIST_STATUS_LOOTED
    )
    .map((player) => ({
      name: getPlayerName(player.gamePlayerId),
      correct: player.correct,
    }))
    .filter((player) => !!player.name)

function makeListPlayerLines(listPlayers: ListPlayer[], totalPlayers: number) {
  if (listPlayers.length === 0) return []

  const names = listPlayers.flatMap((player, index) => [
    ...(index === 0 ? [] : [', ']),
    makeColoredText(
      player.name,
      player.correct ? TooltipColors.CORRECT_TITLE : TooltipColors.PLAYER_ANSWER
    ),
  ])

  return [
    makeTooltipLine(
      makeColoredText(
        `In list (${listPlayers.length}/${totalPlayers}): `,
        TooltipColors.MUTED
      )
    ),
    makeTooltipLine(...names),
  ]
}

// The extra fields the built-in song history keeps behind its info window
function buildDetailLines(
  data: AnswerResultsData,
  sample: string,
  listPlayers: ListPlayer[]
) {
  const { songInfo } = data
  const { romaji, english } = songInfo.animeNames
  const correctCount = data.players.filter((player) => player.correct).length
  const difficulty =
    typeof songInfo.animeDifficulty === 'number'
      ? `${songInfo.animeDifficulty.toFixed(2)}%`
      : 'unrated'

  const lines = [
    makeTooltipLine(makeColoredText(romaji, TooltipColors.CORRECT_TITLE)),
  ]

  if (english && english !== romaji) {
    lines.push(makeTooltipLine(makeColoredText(english, TooltipColors.MUTED)))
  }

  const details: [string, string][] = [
    ['Song', songInfo.songName],
    ['Artist', songInfo.artist],
    ['Type', getTypeText(songInfo)],
    ['Vintage', formatVintage(songInfo.vintage)],
    ['Anime type', songInfo.animeType],
    ['Rating', songInfo.animeScore == null ? '?' : `${songInfo.animeScore}/10`],
    ['Difficulty', difficulty],
    ['Guessed by', `${correctCount}/${data.players.length}`],
    ['Sample', sample],
  ]

  for (const [label, value] of details) {
    lines.push(
      makeTooltipLine(
        makeColoredText(`${label}: `, TooltipColors.MUTED),
        value ?? '-'
      )
    )
  }

  lines.push(...makeListPlayerLines(listPlayers, data.players.length))

  return lines
}

// A throw in here used to leave the tooltip silently empty, which is a painful
// thing to debug from inside a game.
function getDetailLines(
  data: AnswerResultsData,
  sample: string,
  listPlayers: ListPlayer[]
) {
  try {
    return buildDetailLines(data, sample, listPlayers)
  } catch (error) {
    console.error('amq-song-history: could not build song details', error)
    return [makeTooltipLine('Could not load song details')]
  }
}

function createRow(data: AnswerResultsData, scroll: HTMLElement) {
  const row = document.createElement('tr')

  const selfResult = data.players.find(
    (player) => quiz.players[player.gamePlayerId]?.isSelf
  )
  const correctGuess = selfResult?.correct === true

  if (correctGuess) {
    row.classList.add('correctGuess')
  } else if (!quiz.isSpectator) {
    // Spectators get neither color, matching the built-in song history
    row.classList.add('wrongGuess')
  }

  const sample = getSampleText()
  const values = [
    getAnimeName(data.songInfo),
    getTypeText(data.songInfo),
    data.songInfo.songName,
    sample,
  ]

  for (const value of values) {
    const cell = document.createElement('td')
    cell.textContent = value
    row.appendChild(cell)
  }

  const listPlayers = getListPlayers(data)

  // Registered with the shared hit-testing registry rather than mouseenter:
  // other quiz page elements swallow the row's pointer events. clipEl keeps
  // rows that are scrolled out of the panel from triggering.
  addHoverTarget(HOVER_GROUP, {
    el: row,
    clipEl: scroll,
    getLines: () => getDetailLines(data, sample, listPlayers),
  })

  return row
}

/**
 * Shows a compact song history table under the Standings box. The table keeps
 * the songs of earlier games until the page reloads.
 */
export default async function setup() {
  GM_addStyle(css)

  const { table, head, scroll } = createPanel()

  let gameStartTime: Date | null = null
  let currentGame: ReturnType<typeof createGameBody> | null = null

  addListener('quiz ready', () => {
    gameStartTime = new Date()
    currentGame = null
  })

  addListener('answer results', (data) => {
    // The game's tbody is created with its first result. A game without
    // results then leaves no separator, and a game joined in progress, which
    // sends no 'quiz ready', still gets one.
    if (!currentGame) {
      currentGame = createGameBody(gameStartTime ?? new Date())
      gameStartTime = null
      head.after(currentGame.body)
    }

    // Newest song on top. The dropped rows' hover targets go with them: the
    // registry skips disconnected ones.
    currentGame.separator.after(createRow(data, scroll))
    removeOldestRows(table)
  })
}
