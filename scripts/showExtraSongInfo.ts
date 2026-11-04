import { addListener, type AnswerResultsData } from '@shared/events'
import { createQuizPageMutationObserver } from '@shared/pages'
import { SONG_DATES_PATH, type SongDates } from '@shared/songDates'
import { VIDEO_CACHE_ORIGIN } from '@shared/videoCache'
import { addHoverTarget, makeTooltipLine } from './lib/tooltip'

const UNITS = [
  'years',
  'months',
  'days',
  'hours',
  'minutes',
  'seconds',
] as const
type Elapsed = Record<(typeof UNITS)[number], number>

/** The parts of Temporal used here. TypeScript 5.9 has no types for it. */
interface TemporalApi {
  Now: {
    timeZoneId(): string
    zonedDateTimeISO(timeZone: string): TemporalZonedDateTime
  }
  Instant: {
    fromEpochMilliseconds(ms: number): {
      toZonedDateTimeISO(timeZone: string): TemporalZonedDateTime
    }
  }
}
interface TemporalZonedDateTime {
  until(
    other: TemporalZonedDateTime,
    options: { largestUnit: 'years' }
  ): Elapsed
}

const temporal = (globalThis as { Temporal?: TemporalApi }).Temporal

/** Time from `then` to now, truncated to whole units in each field. */
function calendarElapsed(api: TemporalApi, then: number): Elapsed {
  const zone = api.Now.timeZoneId()
  const now = api.Now.zonedDateTimeISO(zone)
  const start = api.Instant.fromEpochMilliseconds(
    Math.min(then, Date.now())
  ).toZonedDateTimeISO(zone)
  return start.until(now, { largestUnit: 'years' })
}

function averageElapsed(then: number): Elapsed {
  const seconds = Math.max(0, Date.now() - then) / 1000
  const day = 24 * 60 * 60
  const lengths: Elapsed = {
    years: 365.25 * day,
    months: 30.44 * day,
    days: day,
    hours: 60 * 60,
    minutes: 60,
    seconds: 1,
  }
  const unit = UNITS.find((u) => seconds >= lengths[u]) ?? 'seconds'
  return {
    ...Object.fromEntries(UNITS.map((u) => [u, 0])),
    [unit]: Math.floor(seconds / lengths[unit]),
  } as Elapsed
}

export default async function setup() {
  const options = {
    difficulty: false,
    maxHeight: '28rem',
  }

  const CONTAINER_ID = '__amq-show-extra-song-info-container'
  const INFO_ROWS_ID = '__amq-show-extra-song-info-rows'
  const LOCAL_STORAGE_KEY = 'amq-extra-song-info'
  const HOVER_GROUP = 'show-extra-song-info'

  function removeContainerIfExists() {
    document.getElementById(INFO_ROWS_ID)?.remove()
    const container = document.getElementById(CONTAINER_ID)
    container?.remove()
  }

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

  /** When the song was seen before, null for never, or 'error'. */
  function getAndUpdateLastSeen(
    songInfo: AnswerResultsData['songInfo']
  ): Date | null | 'error' {
    const key =
      songInfo.videoTargetMap.catbox[720] ??
      songInfo.videoTargetMap.catbox[480] ??
      songInfo.videoTargetMap.catbox[0] ??
      null

    const data = loadLocalStorage()

    if (!key || data === null) return 'error'

    const last = data[key]
    data[key] = Date.now()

    updateLocalStorage(data)

    return last ? new Date(last) : null
  }

  /**
   * Whole units only: 23 months is "1 year ago", not "2 years ago". Temporal
   * counts real calendar months and years in the local time zone. Browsers
   * without it use average lengths, which can be one day off.
   */
  function relativeTime(then: number) {
    const elapsed = temporal
      ? calendarElapsed(temporal, then)
      : averageElapsed(then)
    const unit = UNITS.find((u) => elapsed[u] > 0) ?? 'seconds'
    const value = elapsed[unit]
    return `${value} ${value === 1 ? unit.slice(0, -1) : unit} ago`
  }

  function infoRow(label: string, value: string) {
    const row = document.createElement('div')
    const labelEl = document.createElement('span')
    labelEl.innerText = label
    Object.assign(labelEl.style, { fontWeight: 'bold', marginRight: '0.5rem' })
    const valueEl = document.createElement('span')
    valueEl.innerText = value
    row.append(labelEl, valueEl)
    return { row, valueEl }
  }

  const toDate = (iso: string | null) => (iso ? new Date(iso) : null)

  /** A relative date, with the exact local time in a tooltip on hover. */
  function dateRow(label: string, date: Date | null, empty: string) {
    if (!date) return infoRow(label, empty).row
    const { row, valueEl } = infoRow(label, relativeTime(date.getTime()))
    const exact = date.toLocaleString(undefined, {
      dateStyle: 'long',
      timeStyle: 'medium',
    })
    addHoverTarget(HOVER_GROUP, {
      el: valueEl,
      getLines: () => [makeTooltipLine(exact)],
    })
    return row
  }

  /**
   * Adds "Added" and "Last updated" from the song database, through the
   * local cache server. Adds nothing when the server is offline or does not
   * know the song.
   */
  async function addSongDates(infoRows: HTMLElement, annSongId?: number) {
    if (annSongId === undefined) return
    let dates: SongDates
    try {
      const res = await fetch(
        `${VIDEO_CACHE_ORIGIN}${SONG_DATES_PATH}?annSongId=${annSongId}`
      )
      if (!res.ok) return
      dates = await res.json()
    } catch {
      return
    }
    // The next song can start before the answer arrives.
    if (!infoRows.isConnected) return
    infoRows.append(
      dateRow('Added:', toDate(dates.added), 'unknown'),
      dateRow('Last updated:', toDate(dates.lastUpdated), 'unknown')
    )
  }

  addListener('answer results', (results) => {
    removeContainerIfExists()

    const container = document.createElement('div')
    container.classList.add('row')
    container.id = CONTAINER_ID
    Object.assign(container.style, {
      padding: '0.5rem',
      borderTop: 'solid 1px black',
      marginTop: '5px',
      maxHeight: options.maxHeight ?? '28rem',
      overflowY: 'auto',
    })

    if (options.difficulty) {
      const difficulty = results.songInfo.animeDifficulty

      const difficultyContainer = document.createElement('div')
      const difficultyLabel = document.createElement('span')
      difficultyLabel.innerText = 'Song difficulty:'
      Object.assign(difficultyLabel.style, {
        fontWeight: 'bold',
        marginRight: '0.5rem',
      })
      difficultyContainer.append(
        difficultyLabel,
        difficulty?.toFixed?.(2) ?? 'unrated'
      )
      container.appendChild(difficultyContainer)
    }

    document.getElementById(INFO_ROWS_ID)?.remove()
    const infoRows = document.createElement('div')
    infoRows.id = INFO_ROWS_ID
    const lastSeen = getAndUpdateLastSeen(results.songInfo)
    infoRows.append(
      lastSeen === 'error'
        ? infoRow('Last seen:', 'Error').row
        : dateRow('Last seen:', lastSeen, 'never')
    )
    document
      .getElementById('qpSongInfoContainer')
      ?.insertBefore(infoRows, document.getElementById('qpSongInfoLinkRow'))
    void addSongDates(infoRows, results.songInfo.annSongId)

    const correctAnswersContainer = document.createElement('div')
    Object.assign(correctAnswersContainer.style, {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
    })

    const correctAnswersLabel = document.createElement('span')
    correctAnswersLabel.innerText = 'Correct Answers'
    Object.assign(correctAnswersLabel.style, {
      marginBottom: '0.5rem',
      alignSelf: 'center',
      fontWeight: 'bold',
    })

    correctAnswersContainer.appendChild(correctAnswersLabel)

    results.songInfo.altAnimeNames.forEach((name) => {
      const node = document.createElement('span')
      node.innerText = `- ${name}`
      Object.assign(node.style, {
        fontSize: '12px',
        textAlign: 'left',
      })
      correctAnswersContainer.appendChild(node)
    })

    container.appendChild(correctAnswersContainer)

    if (results.songInfo.altAnimeNamesAnswers.length > 0) {
      const alternativeAnswersContainer = document.createElement('div')
      Object.assign(alternativeAnswersContainer.style, {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        marginTop: '1rem',
      })

      const alternativeAnswersLabel = document.createElement('span')
      alternativeAnswersLabel.innerText = 'Alternative Answers'
      Object.assign(alternativeAnswersLabel.style, {
        marginBottom: '0.5rem',
        alignSelf: 'center',
        fontWeight: 'bold',
      })

      alternativeAnswersContainer.appendChild(alternativeAnswersLabel)

      results.songInfo.altAnimeNamesAnswers.forEach((name) => {
        const node = document.createElement('span')
        node.innerText = `- ${name}`
        Object.assign(node.style, {
          fontSize: '12px',
          textAlign: 'left',
        })
        alternativeAnswersContainer.appendChild(node)
      })

      container.appendChild(alternativeAnswersContainer)
    }

    document
      .getElementById('qpRateOuterContainer')
      ?.parentNode?.appendChild(container)
  })

  addListener('play next song', () => {
    removeContainerIfExists()
  })

  addListener('quiz over', () => {
    removeContainerIfExists()
  })

  createQuizPageMutationObserver(({ visible }) => {
    if (!visible) removeContainerIfExists()
  })
}
