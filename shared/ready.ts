/**
 * A userscript runs before AMQ's own bundle has finished booting, so every
 * entry point must wait for the globals it needs.
 */

const POLL_INTERVAL_MS = 200

function poll(isReady: () => boolean, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs
    const tick = () => {
      let ready = false
      try {
        ready = isReady()
      } catch {
        ready = false
      }
      if (ready) return resolve()
      if (Date.now() > deadline) {
        return reject(new Error('[amq] timed out waiting for AMQ to load'))
      }
      setTimeout(tick, POLL_INTERVAL_MS)
    }
    tick()
  })
}

/** Resolves once the socket exists and the view controllers are registered. */
export function ensureLoad(timeoutMs = 60_000) {
  return poll(
    () =>
      typeof Listener !== 'undefined' &&
      typeof socket !== 'undefined' &&
      socket._socket !== undefined &&
      typeof viewChanger !== 'undefined' &&
      viewChanger.__controllers !== undefined &&
      typeof roomBrowser !== 'undefined',
    timeoutMs
  )
}
