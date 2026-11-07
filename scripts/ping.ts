import { GM_addStyle } from 'vite-plugin-monkey/dist/client'
import { addListener } from '@shared/events'

const PROBE_INTERVAL_MS = 5_000
const PROBE_TIMEOUT_MS = 10_000
/** One minute of samples, for the tooltip. */
const HISTORY_SIZE = 12

/**
 * The server answers it with a few list version IDs. Measured on 2026-11-07,
 * its round trip matches the Socket.IO heartbeat's within a few ms, so the
 * server's own time does not show in the result.
 */
const PROBE_COMMAND = 'get current master list id'

const CONTAINER_ID = 'amqPingContainer'

/*
 * Plain text just right of #currencyTicketContainer. Its parent is skewed, and
 * AMQ unskews the direct children of `.leftRightButtonBottom`, so the transform
 * here has to keep `skewX(35.5deg)`.
 */
const css = `
#${CONTAINER_ID} {
  position: absolute;
  top: 0;
  right: 0;
  line-height: 45px;
  padding-left: 12px;
  transform: translateX(100%) skewX(35.5deg);
  font-size: 16px;
  white-space: nowrap;
  text-shadow: 0 0 4px rgba(0, 0, 0, 0.9);
  pointer-events: initial;
}

#${CONTAINER_ID} .amqPingUnit {
  font-size: 11px;
}
`

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2
}

function createDisplay() {
  const container = document.createElement('div')
  container.id = CONTAINER_ID

  const value = document.createElement('span')
  const unit = document.createElement('span')
  unit.className = 'amqPingUnit'
  unit.textContent = ' ms'
  container.append(value, unit)

  document.getElementById('currencyTicketContainer')?.append(container)

  return {
    show(rtt: number | null, history: number[]) {
      if (rtt === null) {
        value.textContent = '—'
        container.title = `No reply in ${PROBE_TIMEOUT_MS / 1000} seconds`
        return
      }
      value.textContent = String(Math.round(rtt))
      container.title =
        `Ping to the game server\n` +
        `Last minute: median ${Math.round(median(history))} ms, ` +
        `lowest ${Math.round(Math.min(...history))} ms`
    },
  }
}

/**
 * Shows the round trip to the game server next to the ticket count. Every 5
 * seconds it sends PROBE_COMMAND and times the reply.
 */
export default async function setup() {
  GM_addStyle(css)
  const display = createDisplay()
  const history: number[] = []

  /*
   * AMQ's listener for PROBE_COMMAND runs the last `getCache` callback on
   * every reply, because `currentRequestCallback` is never cleared. A probe
   * reply would run that callback again, or start a cache download. So the
   * listener is unbound while a probe waits for its reply.
   */
  const gameListener: Listener | undefined =
    libraryCacheHandler.getCurrentMasterListIdListener

  let waiting = false
  let gameSentProbeCommand = false

  /*
   * If the game sends PROBE_COMMAND while a probe waits, bind its listener
   * again before the request goes out. The two replies cannot be told apart,
   * so that sample is dropped.
   */
  const sendCommand = socket.sendCommand.bind(socket)
  socket.sendCommand = (content, responseHandler) => {
    if (waiting && content?.command === PROBE_COMMAND) {
      gameSentProbeCommand = true
      gameListener?.bindListener()
    }
    return sendCommand(content, responseHandler)
  }

  const probe = () => {
    if (waiting || socket._disconnected) return

    const rebindGameListener = gameListener?.bound ?? false
    gameListener?.unbindListener()
    waiting = true
    gameSentProbeCommand = false

    const finish = (rtt: number | null) => {
      waiting = false
      clearTimeout(timeout)
      unbind()
      if (rebindGameListener) gameListener?.bindListener()

      if (rtt === null) {
        display.show(null, history)
        return
      }
      if (gameSentProbeCommand) return

      history.push(rtt)
      if (history.length > HISTORY_SIZE) history.shift()
      display.show(rtt, history)
    }

    const start = performance.now()
    const unbind = addListener(PROBE_COMMAND, () =>
      finish(performance.now() - start)
    )
    const timeout = setTimeout(() => finish(null), PROBE_TIMEOUT_MS)
    sendCommand({ type: 'library', command: PROBE_COMMAND })
  }

  probe()
  setInterval(probe, PROBE_INTERVAL_MS)
}
