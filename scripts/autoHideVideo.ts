import { addListener, type AnswerResultsData } from '@shared/events'

/** Anime whose video is hidden. Match any of an anime's names. */
const SHOWS_TO_HIDE = [
  'Senki Zesshou Symphogear AXZ',
  'Senki Zesshou Symphogear XV',
  'Little Busters! EX',
]

/** Hides the video when the song is from an anime in `SHOWS_TO_HIDE`. */
export default async function setup() {
  const shouldHideVideo = (songInfo: AnswerResultsData['songInfo']) =>
    SHOWS_TO_HIDE.some((title) =>
      [...songInfo.altAnimeNames, ...songInfo.altAnimeNamesAnswers].some(
        (x) => title.toLocaleLowerCase() === x.toLocaleLowerCase()
      )
    )

  const getPlayers = () => {
    const player0 = document.getElementById('qpMoePlayer-0')
    const player1 = document.getElementById('qpMoePlayer-1')
    if (!player0 || !player1) throw new Error('Could not find video players')
    return [player0, player1]
  }

  addListener('answer results', (data) => {
    if (shouldHideVideo(data.songInfo)) {
      getPlayers().forEach((player) => (player.style.opacity = '0'))
    }
  })

  addListener('play next song', () => {
    getPlayers().forEach((player) => player.style.removeProperty('opacity'))
  })
}
