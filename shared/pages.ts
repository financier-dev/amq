/** Watches an AMQ page. The game hides a page with the `hidden` class. */

type VisibilityCallback = (args: { visible: boolean }) => void

function observePageVisibility(id: string, callback: VisibilityCallback) {
  const el = document.getElementById(id)

  if (!el) {
    throw new Error(`Element not found: ${id}`)
  }

  new MutationObserver((mutations) =>
    mutations.forEach((mutation) => {
      if (mutation.type !== 'attributes' || mutation.attributeName !== 'class')
        return
      if (mutation.target instanceof HTMLElement) {
        callback({ visible: !mutation.target.classList.contains('hidden') })
      }
    })
  ).observe(el, { attributes: true })
}

export const createQuizPageMutationObserver = (callback: VisibilityCallback) =>
  observePageVisibility('quizPage', callback)

export const createLobbyPageMutationObserver = (callback: VisibilityCallback) =>
  observePageVisibility('lobbyPage', callback)
