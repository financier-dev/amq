import { GM_addStyle } from 'vite-plugin-monkey/dist/client'
import { registerCommand } from './commands'

const STORAGE_KEY = 'amqForcedVideoHost'
const FORCED_CLASS = 'amqForcedVideoHost'

const CSS = `
.${FORCED_CLASS} {
  outline: 1px solid #4497ea;
  outline-offset: -1px;
  border-radius: 3px;
}
`

/**
 * Pins the video host region (NA1, NA2 or EU). Without it, the game picks
 * the region by connection speed.
 */
export default async function setup() {
  await ensureHostRowsLoaded()

  const hosts = videoResolver.hostOrder
  let forcedHost = readStoredHost(hosts)

  GM_addStyle(CSS)

  // The game re-picks the host on every connection test and on buffering
  // issues; this is the single funnel where that decision is applied.
  const originalUpdateActiveHost =
    videoResolver.updateActiveHost.bind(videoResolver)
  videoResolver.updateActiveHost = () => {
    if (!forcedHost) return originalUpdateActiveHost()
    sendHostChange(forcedHost)
    videoResolver.targetHost = forcedHost
    return true
  }

  const updateRowHighlights = () => {
    hosts.forEach((host) => {
      const row = videoConnectionStatus.hostStatusRows[host]
      if (row) row.$body[0].classList.toggle(FORCED_CLASS, host === forcedHost)
    })
  }

  const setForcedHost = (host: string | null) => {
    forcedHost = host
    if (host) {
      localStorage.setItem(STORAGE_KEY, host)
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
    updateRowHighlights()
    videoResolver.updateActiveHost()
  }

  hosts.forEach((host) => {
    const row = videoConnectionStatus.hostStatusRows[host]
    if (!row) return

    // The game binds its own retest-on-click handler to the row. Listening in
    // the capture phase and stopping propagation keeps that handler from
    // running on a plain click, while a modifier click falls through to it.
    row.$body[0].addEventListener(
      'click',
      (event) => {
        if (event.ctrlKey || event.metaKey || event.shiftKey) return
        event.stopPropagation()
        setForcedHost(forcedHost === host ? null : host)
      },
      true
    )
  })

  updateRowHighlights()
  if (forcedHost) videoResolver.updateActiveHost()

  registerCommand(
    'forcehost',
    () => ({
      shortHelp: 'Pin the video host region',
      longHelp: `Usage: /forcehost [${hosts.join('|')}|off]</br>Pins the video host region instead of letting the game pick it by connection speed. You can also click a region in the video host tooltip to pin it (ctrl+click still retests it).</br>Current value: ${forcedHost ?? 'not forced'}`,
    }),
    (args) => {
      const value = args.trim()
      if (!value) {
        gameChat.systemMessage(
          `Forced video host: ${forcedHost ?? 'not forced'} (current: ${videoResolver.targetHost})`
        )
        return
      }
      if (/^(off|none|auto)$/i.test(value)) {
        setForcedHost(null)
        gameChat.systemMessage('Video host is no longer forced')
        return
      }
      const host = hosts.find((h) => h.toLowerCase() === value.toLowerCase())
      if (!host) {
        gameChat.systemMessage(
          `Unknown video host. Options: ${hosts.join(', ')}, off`
        )
        return
      }
      setForcedHost(host)
      gameChat.systemMessage(`Video host forced to ${host}`)
    }
  )
}

function sendHostChange(host: string) {
  if (videoResolver.targetHost === host) return
  socket.sendCommand({
    command: 'video host change',
    type: 'settings',
    data: { host },
  })
}

function readStoredHost(hosts: string[]) {
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored && hosts.includes(stored) ? stored : null
}

async function ensureHostRowsLoaded() {
  while (
    typeof videoResolver === 'undefined' ||
    videoResolver.hostOrder.length === 0 ||
    Object.keys(videoConnectionStatus.hostStatusRows).length === 0
  ) {
    await new Promise((res) => setTimeout(res, 1000))
  }
}
