import { addListener } from '@shared/events'
import { createQuizPageMutationObserver } from '@shared/pages'

/** Shows more song info (type, vintage, rating, difficulty, sample). */
export default async function setup() {
  const options = {
    // Where to show the info: 'song-info' or 'on-video'. 'on-video' suits
    // small screens.
    infoPositon: 'song-info',
  }

  const CONTAINER_ID = '__amq-extra-song-info-container'

  const info: Record<string, { title: string; element: HTMLElement | null }> = {
    type: {
      title: 'Type',
      element: null,
    },
    vintage: {
      title: 'Vintage',
      element: null,
    },
    rating: {
      title: 'Anime Rating',
      element: null,
    },
    difficulty: {
      title: 'Difficulty',
      element: null,
    },
    sample: {
      title: 'Sample',
      element: null,
    },
  }

  function formatSampleTime(totalSeconds: number): string {
    const rounded = Math.round(totalSeconds)
    const minutes = Math.floor(rounded / 60)
    const seconds = rounded % 60
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }

  if (options.infoPositon === 'song-info') {
    const songTypeRow = document.getElementById('qpSongType')?.parentNode
    if (!(songTypeRow instanceof HTMLElement)) return

    const infoHiderEl = document.getElementById('qpInfoHider')
    if (infoHiderEl instanceof HTMLElement) {
      Object.assign(infoHiderEl.style, {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      })
    }

    const extraInfoContainer = document.createElement('div')
    extraInfoContainer.style.marginBottom = '1rem'
    songTypeRow.parentNode?.insertBefore(
      extraInfoContainer,
      songTypeRow.nextSibling
    )

    Object.values(info).forEach((row) => {
      const rowEl = songTypeRow.cloneNode(false) as HTMLElement
      Object.assign(rowEl.style, {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        columnGap: '0.5rem',
      })
      const titleEl = document.createElement('span')
      titleEl.style.fontWeight = 'bold'
      titleEl.innerText = row.title + ':'
      const valueEl = document.createElement('span')
      row.element = valueEl
      rowEl.append(titleEl, valueEl)
      extraInfoContainer.append(rowEl)
    })
  } else if (options.infoPositon === 'on-video') {
    const container = document.createElement('div')
    container.id = CONTAINER_ID
    Object.assign(container.style, {
      position: 'absolute',
      bottom: '.5rem',
      right: '0',
      display: 'flex',
      flexDirection: 'column',
      color: 'white',
      padding: '1rem',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    })
    container.classList.add('hide')

    Object.values(info).forEach((row) => {
      const rowEl = document.createElement('div')
      Object.assign(rowEl.style, {
        display: 'flex',
        flexWrap: 'nowrap',
        columnGap: '.5rem',
      })

      const titleEl = document.createElement('span')
      titleEl.style.fontWeight = 'bold'
      titleEl.innerText = row.title + ':'
      rowEl.appendChild(titleEl)

      const valueEl = document.createElement('span')
      row.element = valueEl
      rowEl.appendChild(valueEl)

      container.appendChild(rowEl)
    })

    const jamVoteContainer = document.getElementById('qpJamVoteContainer')
    if (!jamVoteContainer) {
      throw new Error('qpJamVoteContainer element not found')
    }
    jamVoteContainer.parentNode?.insertBefore(container, jamVoteContainer)
  }

  function updateInfo(songInfo: any) {
    if (options.infoPositon === 'on-video') {
      const container = document.getElementById(CONTAINER_ID)
      if (!container) return
      if (container.classList.contains('hide')) {
        container.classList.remove('hide')
      }
    }

    const setText = (row: { element: HTMLElement | null }, text: string) => {
      if (row.element) row.element.innerText = text
    }

    setText(info.type, songInfo.animeType)
    setText(
      info.vintage,
      typeof songInfo.vintage === 'string'
        ? songInfo.vintage
        : localizationHandler.translate(
            songInfo.vintage.key,
            songInfo.vintage.data
          )
    )
    setText(
      info.rating,
      songInfo.animeScore === '?' ? '?' : songInfo.animeScore + '/10'
    )
    setText(
      info.difficulty,
      songInfo.animeDifficulty === '?'
        ? '?'
        : songInfo.animeDifficulty == null ||
            typeof songInfo.animeDifficulty !== 'number'
          ? 'unrated'
          : songInfo.animeDifficulty.toFixed(2)
    )

    const sampleStart = quizVideoController.getCurrentVideoStartPoint()
    const sampleTotal = quizVideoController.getCurrentVideoLength()
    setText(
      info.sample,
      sampleStart == null ||
        sampleTotal == null ||
        !Number.isFinite(sampleTotal)
        ? 'unknown'
        : `${formatSampleTime(sampleStart)} / ${formatSampleTime(sampleTotal)}`
    )
  }

  addListener('quiz song hint', ({ songInfo }) => {
    updateInfo(songInfo)
  })

  addListener('answer results', ({ songInfo }) => {
    updateInfo(songInfo)
  })

  addListener('Spectate Game', ({ quizState }) => {
    if (quizState.songInfo?.animeType) {
      updateInfo(quizState.songInfo)
    }
  })

  addListener('nexus game events', ({ events }) => {
    events
      .flatMap((event: any) =>
        event.type === 'queueEvent' ? event.events : []
      )
      .filter((event: any) => event.type === 'songInfoHint')
      .forEach(({ songInfo }: any) => updateInfo(songInfo))
  })

  addListener('play next song', () => {
    if (options.infoPositon === 'on-video') {
      const container = document.getElementById(CONTAINER_ID)
      if (!container) return
      container.classList.add('hide')
    }
  })

  createQuizPageMutationObserver(({ visible }) => {
    if (visible) return

    const container = document.getElementById(CONTAINER_ID)
    if (!container) return
    container.classList.add('hide')
  })
}
