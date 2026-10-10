/*
 * Logs in to the real site from Node. The local scripts and the live tests
 * share this one login flow.
 *
 * It uses a headless browser, not its own socket client. The game page boots
 * AMQ's globals (`socket`, `libraryCacheHandler`, `options`, …), and a caller
 * reads them inside `page.evaluate`.
 *
 * Never log a credential here.
 */

import {
  chromium,
  type Browser,
  type BrowserContext,
  type Page,
} from 'playwright'
import { credentials, type Account } from './env'

export const SITE = 'https://animemusicquiz.com/'

const LOGIN_TIMEOUT_MS = 60_000
/** The library is several megabytes. An account's first load is the slowest. */
export const LIBRARY_TIMEOUT_MS = 180_000

/**
 * Provides what Tampermonkey provides, for a session that injects a
 * userscript.
 *
 * The bundle reads `unsafeWindow` once at load. Without this it is
 * `undefined`, `_unsafeWindow.__amqUI = …` throws, and the script stops with
 * no visible error.
 */
const TAMPERMONKEY_SHIM = `
  window.unsafeWindow = window
  window.GM_addStyle = (css) => {
    const style = document.createElement('style')
    style.textContent = css
    document.head.appendChild(style)
  }
`

/**
 * tsx compiles with esbuild's `keepNames`, which wraps named functions in a
 * `__name()` helper. That helper does not exist inside `page.evaluate`.
 */
const KEEP_NAMES_SHIM = 'window.__name = (fn) => fn'

export interface SessionOptions {
  headed?: boolean
  /** Source of a built userscript to run on the page, as Tampermonkey does. */
  userscript?: string
  /** The accounts to try, in order of preference. See `credentials`. */
  accounts?: Account[]
}

export interface Session {
  browser: Browser
  context: BrowserContext
  page: Page
  consoleErrors: string[]
  pageErrors: string[]
}

export async function openSession({
  headed = false,
  userscript,
  accounts,
}: SessionOptions = {}): Promise<Session> {
  const { username, password, account } = credentials(accounts)
  console.error(`logging in with ${account}_USERNAME`)

  const browser = await chromium.launch({ headless: !headed })
  const context = await browser.newContext({
    viewport: { width: 1760, height: 980 },
  })
  const page = await context.newPage()

  const consoleErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() !== 'error') return
    const text = message.text()
    if (text.includes('Failed to load resource')) return
    consoleErrors.push(text)
  })
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))

  await page.addInitScript(KEEP_NAMES_SHIM)
  if (userscript) {
    await page.addInitScript(TAMPERMONKEY_SHIM)
    await page.addInitScript({ content: userscript })
  }

  // Record the sign-in response status for the error message. Read only the
  // *response*: the request body carries the password.
  let signInStatus: number | null = null
  page.on('response', (response) => {
    if (!response.url().endsWith('/signIn')) return
    signInStatus = response.status()
  })

  await page.goto(SITE, { waitUntil: 'domcontentloaded' })

  /*
   * Wait for `login()`, not only for the field.
   *
   * `#loginUsername` is in the served HTML, so `waitForSelector` resolves
   * before `loginPage.js` has run, and its init can then clear a filled
   * value. `login()` starts with
   * `if (!username.length || !password.length) return`, so an empty field
   * sends no request and shows no message.
   */
  await page.waitForFunction(
    () => typeof (window as any).login === 'function',
    undefined,
    { timeout: LOGIN_TIMEOUT_MS }
  )

  await page.fill('#loginUsername', username)
  await page.fill('#loginPassword', password)

  // Check that the fields kept their values, without reading the values.
  const filled = await page.evaluate(() => ({
    username:
      (document.querySelector<HTMLInputElement>('#loginUsername')?.value
        .length ?? 0) > 0,
    password:
      (document.querySelector<HTMLInputElement>('#loginPassword')?.value
        .length ?? 0) > 0,
  }))
  if (!filled.username || !filled.password) {
    await browser.close()
    throw new Error(
      'The login fields did not keep their value — the page cleared them after filling.'
    )
  }

  await page.click('#loginButton')

  /*
   * AMQ allows one session per account. If one exists, it offers a takeover
   * through a SweetAlert with a Continue button (`displayAlreadyOnline`, then
   * a POST to `alreadyOnlineLogin` and a reload).
   *
   * A takeover **disconnects whoever is on that account**, so it is announced
   * on stderr.
   */
  const takeover = await page
    .waitForSelector('.swal2-confirm', { timeout: 8_000, state: 'visible' })
    .catch(() => null)
  if (takeover) {
    console.error(
      'the account already had a session — taking it over (that session is now disconnected)'
    )
    await takeover.click()
  }

  try {
    // `viewChanger` existing is not enough. `socket._socket` is undefined
    // until the socket connects, and `options` has the account's settings
    // only after `login complete` is handled. `viewChanger.hideLoadingScreen`
    // runs last, so wait for the loading screen to hide.
    await page.waitForFunction(
      () =>
        (window as any).socket?._socket?.connected &&
        document.querySelector('#loadingScreen')?.classList.contains('hidden'),
      undefined,
      { timeout: LOGIN_TIMEOUT_MS }
    )
  } catch {
    // Report why the login failed. Never include the credential.
    const diagnosis = await page
      .evaluate(() => {
        const box = document.querySelector('#lpLoginMessageContainer')
        const alreadyOnline = document.querySelector('#lpAlreadyOnlineContent')
        return {
          message:
            box && !box.classList.contains('hide')
              ? (box.textContent?.trim() ?? null)
              : null,
          alreadyOnline: Boolean(
            alreadyOnline && !alreadyOnline.classList.contains('hide')
          ),
        }
      })
      .catch(() => ({ message: null, alreadyOnline: false }))
    await browser.close()

    if (diagnosis.alreadyOnline) {
      throw new Error(
        'The account is already logged in elsewhere. Log it out, or use a ' +
          'separate account.'
      )
    }
    throw new Error(
      'Login did not reach the game page' +
        (diagnosis.message ? `: ${diagnosis.message}` : '') +
        (signInStatus
          ? ` (signIn returned ${signInStatus})`
          : ' (no signIn request was sent)') +
        '. Check the credentials in .env.'
    )
  }

  return { browser, context, page, consoleErrors, pageErrors }
}

export interface SocketRequest {
  type: string
  command: string
  /** The command name of the reply. */
  reply: string
  data?: unknown
  /** Accept only a reply whose `matchField` equals `matchValue`. */
  matchField?: string
  matchValue?: unknown
  timeout?: number
}

/**
 * Sends a socket command from the page and waits for one reply.
 *
 * AMQ's `Listener` pushes onto an array per command, so this listener never
 * displaces the client's handlers. Both fire.
 */
export async function request(
  page: Page,
  {
    type,
    command,
    reply,
    data,
    matchField,
    matchValue,
    timeout = 60_000,
  }: SocketRequest
): Promise<any> {
  // The reply filter is a field and a value, not a function. Everything
  // passed to `page.evaluate` must be serialisable, and a stringified
  // predicate would have to be `eval`ed in the page.
  return page.evaluate(
    ([type, command, reply, data, matchField, matchValue, timeout]) =>
      new Promise((resolve, reject) => {
        const listener = new Listener(reply, (payload: any) => {
          if (matchField !== null && payload?.[matchField] !== matchValue) {
            return
          }
          clearTimeout(timer)
          listener.unbindListener()
          resolve(payload)
        })
        const timer = setTimeout(() => {
          listener.unbindListener()
          reject(new Error(`timed out waiting for "${reply}"`))
        }, timeout)
        listener.bindListener()
        socket.sendCommand(
          data === undefined ? { type, command } : { type, command, data }
        )
      }),
    [
      type,
      command,
      reply,
      data,
      matchField ?? null,
      matchValue ?? null,
      timeout,
    ] as const
  )
}
