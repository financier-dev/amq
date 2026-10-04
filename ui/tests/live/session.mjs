/*
 * Logging in to the real site and injecting the built userscript.
 *
 * The offline suite (`tests/render.mjs`) asserts that the screen *renders*;
 * this one asserts that what it renders is *true* of the real game. That gap is
 * where both shipped bugs lived: a stub said `category: 'TV'` and the payload
 * said `{ name: 'TV' }`, and a stub handed over a pre-filled library cache the
 * real client never populates until you ask.
 *
 * Nothing here logs a credential.
 */

import { chromium } from 'playwright'
import { credentials } from './env.mjs'

export const SITE = 'https://animemusicquiz.com/'

/** How long to wait for the game page after submitting the login form. */
const LOGIN_TIMEOUT_MS = 60_000
/** The library is megabytes and the account's first load is the slow one. */
export const LIBRARY_TIMEOUT_MS = 180_000

/**
 * Shims what Tampermonkey provides.
 *
 * The bundle resolves `unsafeWindow` once at load and falls back to
 * `undefined`, so without this `_unsafeWindow.__amqUI = …` throws and the
 * script dies silently — which would make every assertion below fail for the
 * wrong reason.
 */
const TAMPERMONKEY_SHIM = `
  window.unsafeWindow = window
  window.GM_addStyle = (css) => {
    const style = document.createElement('style')
    style.textContent = css
    document.head.appendChild(style)
  }
`

export async function openSession({ headed = false, userscript } = {}) {
  const { username, password } = credentials()

  const browser = await chromium.launch({ headless: !headed })
  const context = await browser.newContext({
    viewport: { width: 1760, height: 980 },
  })
  const page = await context.newPage()

  const consoleErrors = []
  page.on('console', (message) => {
    if (message.type() !== 'error') return
    const text = message.text()
    if (text.includes('Failed to load resource')) return
    consoleErrors.push(text)
  })
  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))

  await page.addInitScript(TAMPERMONKEY_SHIM)
  if (userscript) await page.addInitScript({ content: userscript })

  // Watch the sign-in response so a refusal can be reported precisely. The
  // request body carries the password, so only the *response* is ever read.
  let signInStatus = null
  page.on('response', async (response) => {
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
  await page.waitForFunction(() => typeof window.login === 'function', {
    timeout: 60_000,
  })

  await page.fill('#loginUsername', username)
  await page.fill('#loginPassword', password)

  // Confirm the values stuck without ever reading them back out.
  const filled = await page.evaluate(() => ({
    username: document.querySelector('#loginUsername')?.value.length > 0,
    password: document.querySelector('#loginPassword')?.value.length > 0,
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
   * announced rather than done quietly. Use a dedicated test account.
   */
  const takeover = await page
    .waitForSelector('.swal2-confirm', { timeout: 8_000, state: 'visible' })
    .catch(() => null)
  if (takeover) {
    console.log(
      'the account already had a session — taking it over (that session is now disconnected)'
    )
    await takeover.click()
  }

  try {
    // `viewChanger` only exists once the game page's bundle has booted, which
    // is a better "logged in" signal than any DOM class.
    await page.waitForFunction(
      () => typeof window.viewChanger !== 'undefined',
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
              ? box.textContent.trim()
              : null,
          alreadyOnline: Boolean(
            alreadyOnline && !alreadyOnline.classList.contains('hide')
          ),
          stillOnLoginPage: Boolean(document.querySelector('#loginUsername')),
        }
      })
      .catch(() => ({}))
    await browser.close()

    if (diagnosis.alreadyOnline) {
      throw new Error(
        'The account is already logged in elsewhere. Log it out, or use a ' +
          'separate account for the live tests.'
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

/**
 * Sends a socket command and waits for one reply, in the page.
 *
 * `Listener` is AMQ's own dispatcher and pushes onto an array per command, so
 * binding here never displaces the client's handlers — both fire.
 */
export async function request(
  page,
  { type, command, reply, data, matchField, matchValue, timeout = 60_000 }
) {
  // The reply filter is passed as a field/value pair rather than a function:
  // everything crossing into `page.evaluate` has to be serialisable, and
  // stringifying a predicate to `eval` it on the other side is both fragile
  // and a needless way to run arbitrary source.
  return page.evaluate(
    ([type, command, reply, data, matchField, matchValue, timeout]) =>
      new Promise((resolve, reject) => {
        const matches = (payload) =>
          matchField === null || payload?.[matchField] === matchValue
        let listener
        const timer = setTimeout(() => {
          listener?.unbindListener()
          reject(new Error(`timed out waiting for "${reply}"`))
        }, timeout)

        listener = new window.Listener(reply, (payload) => {
          if (!matches(payload)) return
          clearTimeout(timer)
          listener.unbindListener()
          resolve(payload)
        })
        listener.bindListener()
        window.socket.sendCommand(
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
    ]
  )
}
