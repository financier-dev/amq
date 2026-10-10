import { addListener } from '@shared/events'

/** Announces the selected theme and the song type distribution in chat. */
export default async function setup() {
  addListener('Jam Vote Result', (data) => {
    const selectedTheme = data.themeResult.option.name
    const winnerVote = data.themeResult.vote.profileInfo.name
    gameChat.systemMessage(
      `<span style="color: #A7C7E7;">Next theme: ${selectedTheme} (${winnerVote})</span>`
    )

    const [nOP, nED, nIN] = data.typeDistribution
      .sort((a, b) => a.typeId - b.typeId)
      .map((x) => x.amount)
    gameChat.systemMessage(
      `<span style="color: #A7C7E7;">Song distribution: ${nOP} OP - ${nED} ED - ${nIN} IN</span>`
    )
  })
}
