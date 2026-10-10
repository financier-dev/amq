export const getPlayerName = (id: number): string => quiz.players?.[id]?._name

export const getPlayerAvatarContainer = (playerName: string) =>
  [...document.querySelectorAll('.qpAvatarContainerOuter')].find(
    (el): el is HTMLElement => {
      const avatarName = el.querySelector('.qpAvatarName')
      return (
        avatarName instanceof HTMLElement && avatarName.innerText === playerName
      )
    }
  )

export const sendChatMessage = (message: string) => {
  socket.sendCommand({
    type: 'lobby',
    command: 'game chat message',
    data: { msg: message, teamMessage: false },
  })
}
