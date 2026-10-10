import { addListener } from '@shared/events'

const CONTAINER_ID = 'amq-online-notifications-container'

/** Shows a notification when a friend comes online or goes offline. */
export default async function setup() {
  const containerEl = document.createElement('div')
  containerEl.id = CONTAINER_ID
  containerEl.style.position = 'absolute'
  containerEl.style.top = '0'
  containerEl.style.left = '0'
  containerEl.style.transform = 'translateY(calc(-100% - 1rem))'
  containerEl.style.display = 'flex'
  containerEl.style.flexDirection = 'column'
  containerEl.style.width = '230px'
  containerEl.style.opacity = '0.9'

  document.getElementById('footerMenuBar')?.appendChild(containerEl)

  const createNotification = (text: string, type: 'online' | 'offline') => {
    const notifEl = document.createElement('span')
    notifEl.style.padding = '0.5rem'
    notifEl.style.backgroundColor = type === 'online' ? 'green' : '#3f3f3f'
    notifEl.textContent = text
    const containerEl = document.getElementById(CONTAINER_ID)
    if (!containerEl) return
    containerEl.appendChild(notifEl)
    setTimeout(() => {
      notifEl.remove()
    }, 5000)
  }

  addListener('friend state change', (data) => {
    if (data.online) {
      createNotification(`${data.name} is online`, 'online')
    } else {
      createNotification(`${data.name} went offline`, 'offline')
    }
  })
}
