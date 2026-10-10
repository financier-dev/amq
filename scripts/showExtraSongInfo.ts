import { addListener, type AnswerResultsData } from '@shared/events'
import { createQuizPageMutationObserver } from '@shared/pages'

export default async function setup() {
  const options = {
    difficulty: false,
    maxHeight: '28rem',
  }

  const CONTAINER_ID = '__amq-show-extra-song-info-container'
  const LAST_SEEN_CONTAINER_ID =
    '__amq-show-extra-song-info-last-seen-container'
  const LOCAL_STORAGE_KEY = 'amq-extra-song-info'

  function removeContainerIfExists() {
    document.getElementById(LAST_SEEN_CONTAINER_ID)?.remove()
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

  function getAndUpdateLastSeen(songInfo: AnswerResultsData['songInfo']) {
    const key =
      songInfo.videoTargetMap.catbox[720] ??
      songInfo.videoTargetMap.catbox[480] ??
      songInfo.videoTargetMap.catbox[0] ??
      null

    const data = loadLocalStorage()

    if (!key || data === null) return 'Error'

    const last = data[key]
    const now = Date.now()
    data[key] = now

    updateLocalStorage(data)

    if (!last) return 'never'

    let diff = (now - last) / 1000

    const units = [
      { label: 'second', step: 60 },
      { label: 'minute', step: 60 },
      { label: 'hour', step: 24 },
      { label: 'day', step: 30 },
      { label: 'month', step: 12 },
      { label: 'year', step: Infinity },
    ]

    for (const unit of units) {
      if (diff >= unit.step) {
        diff /= unit.step
      } else {
        const val = Math.round(diff)
        return `${val} ${unit.label + (val === 1 ? '' : 's')} ago`
      }
    }

    return 'Error'
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

    document.getElementById(LAST_SEEN_CONTAINER_ID)?.remove()
    const lastSeen = getAndUpdateLastSeen(results.songInfo)
    const lastSeenContainer = document.createElement('div')
    lastSeenContainer.id = LAST_SEEN_CONTAINER_ID
    const lastSeenLabel = document.createElement('span')
    lastSeenLabel.innerText = 'Last seen:'
    Object.assign(lastSeenLabel.style, {
      fontWeight: 'bold',
      marginRight: '0.5rem',
    })
    lastSeenContainer.append(lastSeenLabel, lastSeen)
    document
      .getElementById('qpSongInfoContainer')
      ?.insertBefore(
        lastSeenContainer,
        document.getElementById('qpSongInfoLinkRow')
      )

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
