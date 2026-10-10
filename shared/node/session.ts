/*
 * Logging in to the real site from Node — the one login flow, shared by the
 * local scripts and the live tests.
 *
 * A headless browser rather than a hand-rolled socket client: the game page
 * boots AMQ's own globals (`socket`, `libraryCacheHandler`, `options`, …), so
 * a caller can ask them inside `page.evaluate` instead of reimplementing what
 * they do.
 *
 * Nothing here logs a credential.
 */

import {
  chromium,
  type Browser,
  type BrowserContext,
  type Page,
} from 'playwright'
import { credentials, type Account } from './env'

export const SITE = 'https://animemusicquiz.com/'

/** How long to wait for the game page after submitting the login form. */
const LOGIN_TIMEOUT_MS = 60_000
/** The library is megabytes and the account's first load is the slow one. */
export const LIBRARY_TIMEOUT_MS = 180_000

/**
 * Shims what Tampermonkey provides, for a session that injects a userscript.
 *
 * The bundle resolves `unsafeWindow` once at load and falls back to
 * `undefined`, so without this `_unsafeWindow.__amqUI = …` throws and the
 * script dies silently.
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
 * `__name()` helper that does not exist inside `page.evaluate`.
 */
const KEEP_NAMES_SHIM = 'window.__name = (fn) => fn'

export interface SessionOptions {
  headed?: boolean
  /** Source of a built userscript to run on the page, as Tampermonkey would. */
  userscript?: string
  /** Which accounts may be used, in order of preference — see `credentials`. */
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

  // Watch the sign-in response so a refusal can be reported precisely. The
  // request body carries the password, so only the *response* is ever read.
  let signInStatus: number | null = null
  page.on('response', (response) => {
    if (!response.url().endsWith('/signIn')) return
    signInStatus = response.status()
  })

  await page.goto(SITE, { waitUntil: 'domcontentloaded' })

  /*
   * Wait for the bundle, not just the field.
   *
   * `#loginUsername` exists in the served HTML, so `waitForSelector` resolves
   * long before `loginPage.js` has run — and filling then races its init.
   * `login()` starts with `if (!username.length || !password.length) return`,
   * so a value that has not stuck produces exactly nothing: no request, no
   * message, no clue. Waiting for the handler itself removes the race.
   */
  await page.waitForFunction(
    () => typeof (window as any).login === 'function',
    undefined,
    { timeout: LOGIN_TIMEOUT_MS }
  )

  await page.fill('#loginUsername', username)
  await page.fill('#loginPassword', password)

  // Confirm the values stuck without ever reading them back out.
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
   * The account may already have a live session — AMQ allows only one, and
   * offers to take it over through a SweetAlert with a Continue button
   * (`displayAlreadyOnline`, then a POST to `alreadyOnlineLogin` and a reload).
   *
   * Taking it over **disconnects whoever is on that account**, so it is
   * announced rather than done quietly.
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
    // The bundle defining `viewChanger` is not enough: `socket._socket` is
    // undefined until it connects, and `options` only reflects the account's
    // settings once `login complete` has been handled. The loading screen
    // coming down (`viewChanger.hideLoadingScreen`) is the end of all of it.
    await page.waitForFunction(
      () =>
        (window as any).socket?._socket?.connected &&
        document.querySelector('#loadingScreen')?.classList.contains('hidden'),
      undefined,
      { timeout: LOGIN_TIMEOUT_MS }
    )
  } catch {
    // Never surface the credential itself — only why it did not work.
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
  /** The command name of the reply to wait for. */
  reply: string
  data?: unknown
  /** Only accept a reply whose `matchField` equals `matchValue`. */
  matchField?: string
  matchValue?: unknown
  timeout?: number
}

/**
 * Sends a socket command and waits for one reply, in the page.
 *
 * `Listener` is AMQ's own dispatcher and pushes onto an array per command, so
 * binding here never displaces the client's handlers — both fire.
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
  // The reply filter is passed as a field/value pair rather than a function:
  // everything crossing into `page.evaluate` has to be serialisable, and
  // stringifying a predicate to `eval` it on the other side is both fragile
  // and a needless way to run arbitrary source.
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
