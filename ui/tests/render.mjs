/*
 * Renders the built userscript against the AMQ stubs and asserts the things a
 * typecheck cannot see: that styles actually crossed into the shadow root, that
 * the columns line up, and that the interactive bits do what the spec says.
 *
 *   node ui/tests/render.mjs            # assert, write screenshots
 *   node ui/tests/render.mjs --headed   # watch it run
 */

import { chromium } from 'playwright'
import { fileURLToPath } from 'node:url'
import http from 'node:http'
import path from 'node:path'
import fs from 'node:fs'

const here = path.dirname(fileURLToPath(import.meta.url))
const repo = path.join(here, '..', '..')
const shots = path.join(here, 'screenshots')
fs.mkdirSync(shots, { recursive: true })

/*
 * Served over http rather than opened as a file:// URL — Chromium gives
 * file:// pages an opaque origin with no localStorage, and filter persistence
 * is part of what needs testing.
 */
const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
}
const server = http.createServer((request, response) => {
  const target = path.join(repo, decodeURIComponent(request.url.split('?')[0]))
  if (!target.startsWith(repo) || !fs.existsSync(target)) {
    response.writeHead(404).end()
    return
  }
  response.writeHead(200, {
    'Content-Type': TYPES[path.extname(target)] ?? 'application/octet-stream',
  })
  fs.createReadStream(target).pipe(response)
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const origin = `http://127.0.0.1:${server.address().port}`

const results = []
const check = (label, pass, detail = '') =>
  results.push({ label, pass, detail })

/*
 * Prints what has been collected so far.
 *
 * Also wired to an uncaught exception: a single timed-out selector used to
 * abort the run and discard every result with it, which turns "one thing
 * broke" into "no information at all" — exactly when the results matter most.
 */
function printResults() {
  let failed = 0
  for (const { label, pass, detail } of results) {
    if (!pass) failed++
    console.log(
      `${pass ? 'OK  ' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`
    )
  }
  console.log(`\n${results.length - failed}/${results.length} passed`)
  return failed
}

process.on('uncaughtException', (error) => {
  console.log('\n--- crashed mid-suite; results so far ---\n')
  printResults()
  console.log(`\nthen: ${error.message}`)
  process.exit(1)
})

const browser = await chromium.launch({
  headless: !process.argv.includes('--headed'),
})
const page = await browser.newPage({ viewport: { width: 1760, height: 980 } })

page.on('console', (msg) => {
  // Avatar and font requests are deliberately aborted below; don't report them.
  if (
    msg.type() === 'error' &&
    !msg.text().includes('Failed to load resource')
  ) {
    console.log('  [page error]', msg.text())
  }
})
page.on('pageerror', (error) =>
  console.log('  [page exception]', error.message)
)

// Avatar art lives on AMQ's CDN; the point here is layout, not asset fetching.
await page.route('**/cdn/v1/**', (route) => route.abort())
await page.route('**fonts.googleapis.com**', (route) => route.abort())

await page.goto(`${origin}/ui/tests/harness.html`)
await page.waitForFunction(() => document.fonts.ready.then(() => true), {
  timeout: 10000,
})
await page.evaluate(() => window.viewChanger.changeView('roomBrowser'))
await page.waitForFunction(
  () =>
    document
      .querySelector('[data-amq-ui]')
      ?.shadowRoot?.querySelectorAll('.row').length > 0,
  { timeout: 5000 }
)
// A webfont is only fetched once something uses it, so this has to come after
// the screen renders. Measuring fallback metrics would quietly weaken every
// layout assertion below.
const fontsReady = await page.evaluate(async () => {
  await Promise.all([
    document.fonts.load("500 13px 'IBM Plex Mono'"),
    document.fonts.load("600 15px 'IBM Plex Sans'"),
  ])
  return (
    document.fonts.check("500 13px 'IBM Plex Mono'") &&
    document.fonts.check("600 15px 'IBM Plex Sans'")
  )
})
check('real IBM Plex faces are loaded', fontsReady === true)
await page.waitForTimeout(250)

const root = page.locator('[data-amq-ui]').locator('.amq-ui-root')

// --- the bug that started this: did CSS reach the shadow root? -------------

const styling = await page.evaluate(() => {
  const shadow = document.querySelector('[data-amq-ui]').shadowRoot
  const row = shadow.querySelector('.row')
  const screen = shadow.querySelector('.screen')
  return {
    styleTags: shadow.querySelectorAll('style').length,
    adopted: shadow.adoptedStyleSheets.length,
    rowDisplay: getComputedStyle(row).display,
    rowHeight: getComputedStyle(row).height,
    tipsOpen: shadow.querySelectorAll('.floating').length,
    screenPosition: getComputedStyle(screen).position,
    listBg: getComputedStyle(shadow.querySelector('.list')).backgroundColor,
  }
})

// One <style> per mounted component. The filter panel and the roster popover
// mount lazily, so the initial list is the floor, not the total.
check(
  'component styles reach the shadow root',
  styling.styleTags >= 10,
  `${styling.styleTags} <style> tags`
)
check('app.css tokens adopted', styling.adopted === 1)
check(
  'rows are flex, 56px',
  styling.rowDisplay === 'flex' && styling.rowHeight === '56px',
  `${styling.rowDisplay} ${styling.rowHeight}`
)
check(
  'nothing floats until hovered',
  styling.tipsOpen === 0,
  `${styling.tipsOpen} open`
)
check('screen is fixed', styling.screenPosition === 'fixed')
check(
  'list body is translucent, not opaque',
  /^rgba\(/.test(styling.listBg),
  styling.listBg
)

// --- layout: columns must line up down the list ---------------------------

const alignment = await page.evaluate(() => {
  const shadow = document.querySelector('[data-amq-ui]').shadowRoot
  const rows = [...shadow.querySelectorAll('.row')]
  const xs = (selector) =>
    rows.map((row) =>
      Math.round(
        row.querySelector(selector)?.getBoundingClientRect().left ?? -1
      )
    )
  const unique = (list) => [...new Set(list)]
  return {
    id: unique(xs('.id')),
    mode: unique(xs('.mode-cell')),
    time: unique(xs('.time')),
    actions: unique(xs('.actions')),
    rowCount: rows.length,
    bodyScrollsSideways: document.body.scrollWidth > document.body.clientWidth,
  }
})

// One short of the total: the private room is hidden by the default
// "Public only" filter.
check(
  'every public room renders',
  alignment.rowCount === 17,
  `${alignment.rowCount} rows`
)
check(
  'Mode column aligns',
  alignment.mode.length === 1,
  JSON.stringify(alignment.mode)
)
check(
  'Time column aligns',
  alignment.time.length === 1,
  JSON.stringify(alignment.time)
)
check(
  'Action column aligns',
  alignment.actions.length === 1,
  JSON.stringify(alignment.actions)
)
check('page never scrolls sideways', !alignment.bodyScrollsSideways)

const overlap = await page.evaluate(() => {
  const shadow = document.querySelector('[data-amq-ui]').shadowRoot
  return [...shadow.querySelectorAll('.row')].every((row) => {
    const pill = row.querySelector('.pill')?.getBoundingClientRect()
    const players = row.querySelector('.counts')?.getBoundingClientRect()
    return !pill || !players || pill.right <= players.left
  })
})
check('Mode never overlaps Players', overlap)

const headerAlignment = await page.evaluate(() => {
  const shadow = document.querySelector('[data-amq-ui]').shadowRoot
  const row = shadow.querySelector('.row')
  const headers = [...shadow.querySelectorAll('.header .col')]
  const cells = [
    row.querySelector('.id'),
    row.querySelector('.identity'),
    row.querySelector('.mode-cell'),
  ]
  return cells.map((cell, index) =>
    Math.round(
      cell.getBoundingClientRect().left -
        headers[index].getBoundingClientRect().left
    )
  )
})
check(
  'headers line up with their columns',
  headerAlignment.every((offset) => Math.abs(offset) <= 1),
  `offsets ${headerAlignment.join(', ')}px`
)

const columnWidths = await page.evaluate(() => {
  const shadow = document.querySelector('[data-amq-ui]').shadowRoot
  const width = (element) => Math.round(element.getBoundingClientRect().width)
  const headers = [...shadow.querySelectorAll('.header > *')].map(width)
  const cells = [...shadow.querySelector('.row').children].map(width)
  return headers.map((value, index) => value - cells[index])
})
// A cell wider than its token (flex `min-width: auto` raising it to
// min-content) pushes every column after it out of step.
check(
  'every column is the same width in the header and the rows',
  columnWidths.every((delta) => Math.abs(delta) <= 1),
  `deltas ${columnWidths.join(', ')}`
)

const actionHeading = await page.evaluate(() => {
  const shadow = document.querySelector('[data-amq-ui]').shadowRoot
  return [...shadow.querySelectorAll('.header .col')]
    .map((col) => col.textContent.trim())
    .filter(Boolean)
})
check(
  'Action column has no heading',
  !actionHeading.includes('Action'),
  actionHeading.join(' | ')
)
check('ID column has a heading', actionHeading[0] === 'ID', actionHeading[0])

const modeFit = await page.evaluate(() => {
  const shadow = document.querySelector('[data-amq-ui]').shadowRoot
  const pills = [...shadow.querySelectorAll('.row .pill')]
  const truncated = pills.filter(
    (pill) => pill.scrollWidth > pill.clientWidth + 1
  )
  return {
    labels: [...new Set(pills.map((pill) => pill.textContent.trim()))],
    truncated: truncated.map((pill) => pill.textContent.trim()),
  }
})
// "Last Man Standing" is the longest label AMQ ships and it was overflowing.
check(
  'Mode labels are the real localised strings',
  modeFit.labels.some((label) => label === 'Last Man Standing'),
  modeFit.labels.join(', ')
)
check(
  'no Mode label is truncated',
  modeFit.truncated.length === 0,
  modeFit.truncated.join(', ')
)

const buttons = await page.evaluate(() => {
  const shadow = document.querySelector('[data-amq-ui]').shadowRoot
  const spec = shadow.querySelector('.row .spec')
  const actions = shadow.querySelector('.row .actions').getBoundingClientRect()
  const box = spec.getBoundingClientRect()
  return {
    label: spec.textContent.trim(),
    // A clipped button is narrower than the text it holds.
    clipped: spec.scrollWidth > Math.ceil(box.width) + 1,
    insideActions: box.right <= Math.ceil(actions.right) + 1,
    hasSettings: Boolean(shadow.querySelector('.row .settings')),
  }
})
check(
  'Spectate button is not clipped',
  !buttons.clipped && buttons.insideActions,
  buttons.label
)
check('each row has a settings button', buttons.hasSettings)

const buttonStability = await page.evaluate(() => {
  const shadow = document.querySelector('[data-amq-ui]').shadowRoot
  const lefts = [...shadow.querySelectorAll('.row')].map((row) => [
    Math.round(row.querySelector('.settings').getBoundingClientRect().left),
    Math.round(row.querySelector('.join').getBoundingClientRect().left),
    Math.round(row.querySelector('.spec').getBoundingClientRect().left),
  ])
  const labels = [
    ...new Set(
      [...shadow.querySelectorAll('.row .join')].map((b) =>
        b.textContent.trim()
      )
    ),
  ]
  return { unique: [...new Set(lefts.map((entry) => entry.join(',')))], labels }
})
// Rows in lobby say "Join", playing ones say "Playing", full ones "Full" —
// all three have to sit in the same place.
check(
  'action buttons never move between lobby and playing',
  buttonStability.unique.length === 1,
  `${buttonStability.labels.join('/')} → ${buttonStability.unique.length} position(s)`
)

// --- the menu bar is not ours ---------------------------------------------

const menuBar = await page.evaluate(() => {
  const shadow = document.querySelector('[data-amq-ui]').shadowRoot
  const screen = shadow.querySelector('.screen').getBoundingClientRect()
  const bar = document.querySelector('#mainMenuBar').getBoundingClientRect()
  return {
    screenBottom: Math.round(screen.bottom),
    barTop: Math.round(bar.top),
  }
})
check(
  'screen stops above AMQ’s menu bar',
  menuBar.screenBottom <= menuBar.barTop,
  `screen ${menuBar.screenBottom} vs bar ${menuBar.barTop}`
)

// --- content correctness ---------------------------------------------------

const content = await page.evaluate(() => {
  const shadow = document.querySelector('[data-amq-ui]').shadowRoot
  const rows = [...shadow.querySelectorAll('.row')]
  const byName = (name) =>
    rows.find((row) => row.querySelector('.name')?.textContent.trim() === name)
  const text = (row, selector) =>
    row?.querySelector(selector)?.textContent.trim()
  return {
    // The counts moved out of the top bar; the strip still reports them.
    counts: shadow.querySelector('.bar .counts')?.textContent.trim() ?? null,
    ids: rows.map((row) => row.querySelector('.id')?.textContent.trim()),
    playerOrder: rows.map((row) => text(row, '.count')),
    vanillaChips: byName('Mostazabra Kadabra').querySelectorAll('.chip').length,
    playingLocked: byName('Aurum').querySelector('.join').disabled,
    fullLocked: byName('AAAAAAAA').querySelector('.join').disabled,
    openJoinable: byName('Song/Artist only').querySelector('.join').disabled,
    expertDifficulty: text(byName('expert only no mercy'), '.label'),
    randomTime: text(byName('AAAAAAAA'), '.time'),
    extraTime: text(byName('chill vibes only'), '.time'),
    playingSongs: text(byName('Aurum'), '.progress'),
    lobbySongs: text(byName('GENSHIN!!!'), '.total'),
    friendTinted: getComputedStyle(
      byName('Song/Artist only').querySelector('.count')
    ).color,
    modChips: [...byName('expert only no mercy').querySelectorAll('.chip')].map(
      (chip) => chip.textContent.trim()
    ),
    strip: shadow
      .querySelector('.strip')
      .textContent.replace(/\s+/g, ' ')
      .trim(),
  }
})

check(
  'top bar no longer carries room counts',
  content.counts === null,
  content.counts ?? 'none'
)
check(
  'every row shows its room id',
  content.ids.every((id) => /^\d+$/.test(id ?? '')),
  content.ids.slice(0, 4).join(' ')
)
check(
  'sorted by players descending',
  content.playerOrder[0] === '12/40',
  content.playerOrder.slice(0, 3).join(' ')
)
check(
  'a vanilla room shows no chips',
  content.vanillaChips === 0,
  `${content.vanillaChips} chips`
)
check('playing room cannot be joined', content.playingLocked === true)
check('full room cannot be joined', content.fullLocked === true)
check('open room can be joined', content.openJoinable === false)
check(
  'expert-only reads 0–15%',
  content.expertDifficulty === '0–15%',
  content.expertDifficulty
)
check(
  'randomised guess time shows a range',
  content.randomTime === '25–30s',
  content.randomTime
)
check(
  'extra guess time renders separately',
  content.extraTime === '25s + 5s',
  content.extraTime
)
check(
  'playing room shows progress',
  content.playingSongs === '31 / 36',
  content.playingSongs
)
check(
  'lobby room shows the song total',
  content.lobbySongs === '50',
  content.lobbySongs
)
check(
  'friend in room tints the count teal',
  content.friendTinted === 'rgb(111, 220, 189)',
  content.friendTinted
)
check(
  'default-on modifier renders as NO RBC',
  content.modChips.includes('NO RBC'),
  content.modChips.join(' ')
)
check(
  'default-off modifier renders as DUB',
  content.modChips.includes('DUB'),
  content.modChips.join(' ')
)
check(
  'strip reports the filtered total',
  content.strip.includes('17 of 18 rooms shown'),
  content.strip
)

await page.screenshot({ path: path.join(shots, 'list.png') })

// --- roster popover --------------------------------------------------------

await root.locator('.row').first().locator('.cell.players').hover()
await page.waitForTimeout(250)
const roster = await page.evaluate(() => {
  const shadow = document.querySelector('[data-amq-ui]').shadowRoot
  const popover = shadow.querySelector('.floating')
  if (!popover) return null
  const box = popover.getBoundingClientRect()
  return {
    players: popover.querySelectorAll('.name:not(.spectator)').length,
    spectators: popover.querySelectorAll('.name.spectator').length,
    hasLevels: popover.querySelectorAll('.level').length > 0,
    friendNames: [...popover.querySelectorAll('.name.friend')].map((n) =>
      n.textContent.trim()
    ),
    visible: getComputedStyle(popover).visibility,
    onScreen:
      box.top >= 0 &&
      box.bottom <= window.innerHeight &&
      box.right <= window.innerWidth,
  }
})
check('roster popover opens on hover', roster !== null)
check(
  'roster lists players and spectators',
  roster?.players === 12 && roster?.spectators === 2,
  `${roster?.players} players, ${roster?.spectators} spectators`
)
check('roster shows levels', roster?.hasLevels === true)
check(
  'friends are tinted in the roster',
  roster?.friendNames.length === 2,
  JSON.stringify(roster?.friendNames)
)
check(
  'popover is visible and fully on screen',
  roster?.visible === 'visible' && roster?.onScreen === true,
  `${roster?.visible}, onScreen ${roster?.onScreen}`
)

await page.screenshot({ path: path.join(shots, 'roster.png') })
await page.mouse.move(1400, 700)
await page.waitForTimeout(300)

// --- filter panel ----------------------------------------------------------

await root.locator('.filters').click()
await page.waitForTimeout(200)
const panel = await page.evaluate(() => {
  const shadow = document.querySelector('[data-amq-ui]').shadowRoot
  const element = shadow.querySelector('.panel')
  const box = element.getBoundingClientRect()
  return {
    width: Math.round(box.width),
    withinViewport:
      box.right <= window.innerWidth &&
      box.top >= 0 &&
      box.bottom <= window.innerHeight,
    groups: shadow.querySelectorAll('.group-title').length,
    rangeTitles: shadow.querySelectorAll('.track-host').length,
    sliders: shadow.querySelectorAll('.rng').length,
    resets: shadow.querySelectorAll('.reset').length,
    scrolls: element.scrollHeight > element.clientHeight,
    styleTags: shadow.querySelectorAll('style').length,
  }
})
check('filter panel is 680px', panel.width === 680, `${panel.width}px`)
check('filter panel fits on screen', panel.withinViewport)
check(
  'all eight toggle groups render',
  panel.groups === 8,
  `${panel.groups} groups`
)
check(
  'all four ranges render',
  panel.rangeTitles === 4,
  `${panel.rangeTitles} ranges`
)
check(
  'four dual-handle ranges',
  panel.sliders === 8,
  `${panel.sliders} range inputs`
)
check(
  'no reset markers at defaults',
  panel.resets === 0,
  `${panel.resets} shown`
)
check('filter panel does not scroll', !panel.scrolls)
check(
  'lazily-mounted components bring their own styles',
  panel.styleTags > styling.styleTags,
  `${styling.styleTags} → ${panel.styleTags} <style> tags`
)

// --- filtering actually filters -------------------------------------------

// The private room is hidden by default; turning Public off must reveal it,
// with its lock, and it must be unjoinable because it is mid-game.
await root.locator('.group').first().locator('.chip').first().click()
await page.waitForTimeout(150)
const withPrivate = await page.evaluate(() => {
  const shadow = document.querySelector('[data-amq-ui]').shadowRoot
  const rows = [...shadow.querySelectorAll('.row')]
  const row = rows.find(
    (entry) =>
      entry.querySelector('.name')?.textContent.trim() === 'weekly tourney rd2'
  )
  return {
    total: rows.length,
    found: Boolean(row),
    locked: Boolean(row?.querySelector('.lock')),
    difficulty: row?.querySelector('.label')?.textContent.trim(),
    joinDisabled: row?.querySelector('.join')?.disabled,
  }
})
check(
  'turning Public off reveals the private room',
  withPrivate.total === 18 && withPrivate.found,
  `${withPrivate.total} rows`
)
check('private room shows the lock', withPrivate.locked === true)
check(
  'expert+hard reads 0–25%',
  withPrivate.difficulty === '0–25%',
  withPrivate.difficulty
)
check('private playing room is unjoinable', withPrivate.joinDisabled === true)
await page.screenshot({ path: path.join(shots, 'filters.png') })
await root.locator('.group').first().locator('.chip').first().click()
await page.waitForTimeout(150)

const before = await root.locator('.row').count()
// "Show only: Open slots" — the third chip in the first group.
await root.locator('.group').first().locator('.chip').nth(2).click()
await page.waitForTimeout(150)
const after = await root.locator('.row').count()
const badge = await root.locator('.badge').first().textContent()
check('toggling a filter drops rooms', after < before, `${before} → ${after}`)
check('badge counts the changed group', badge.trim() === '1', badge)

// The store debounces writes by 300ms so dragging a slider does not thrash.
await page.waitForTimeout(500)
const persisted = await page.evaluate(() =>
  localStorage.getItem('amq-room-filters')
)
check(
  'filters persist to localStorage',
  Boolean(persisted) &&
    JSON.parse(persisted).version === 1 &&
    JSON.parse(persisted).toggles.only.open === true,
  persisted ? 'stored' : 'nothing written'
)

// Anime type must really filter — the mock's known gap (SPEC §8).
await root.locator('.group').first().locator('.chip').nth(2).click()
await page.waitForTimeout(100)
const animeGroup = root.locator('.group').nth(4)
await animeGroup.locator('.chip').first().click() // TV off
await page.waitForTimeout(150)
const afterAnime = await root.locator('.row').count()
check(
  'anime-type filter really filters',
  afterAnime < 13,
  `${afterAnime} rooms with TV off`
)
await animeGroup.locator('.chip').first().click()
await page.waitForTimeout(150)

await root.locator('.close').click()
await page.waitForTimeout(150)

// --- sorting ---------------------------------------------------------------

// First column is now ID.
await root.locator('.col').first().click()
await page.waitForTimeout(150)
const byId = (await root.locator('.row .id').allTextContents()).map(Number)
check(
  'clicking ID sorts by room id',
  JSON.stringify(byId) === JSON.stringify([...byId].sort((a, b) => b - a)),
  byId.slice(0, 4).join(' ')
)
await root.locator('.col').first().click()
await page.waitForTimeout(150)
const byIdAsc = (await root.locator('.row .id').allTextContents()).map(Number)
check(
  'clicking ID again reverses it',
  JSON.stringify(byIdAsc) ===
    JSON.stringify([...byIdAsc].sort((a, b) => a - b)),
  byIdAsc.slice(0, 4).join(' ')
)

await root.locator('.col').nth(1).click() // Room / Host
await page.waitForTimeout(150)
const sorted = await root.locator('.row .name').allTextContents()
const descending = [...sorted].sort((a, b) =>
  b.toLowerCase().localeCompare(a.toLowerCase())
)
check(
  'clicking Room / Host sorts by name',
  JSON.stringify(sorted) === JSON.stringify(descending),
  sorted.slice(0, 3).join(' | ')
)

// --- actions delegate to AMQ ----------------------------------------------

await root.locator('.row').first().locator('.spec').click()
await page.waitForTimeout(100)
const log = await page.evaluate(() => window.__log)
check(
  'spectate delegates to roomBrowser',
  log.some((entry) => entry[0].startsWith('spectate')),
  JSON.stringify(log)
)

// --- chips: alignment, wording, and what counts as default ----------------

const chipDetail = await page.evaluate(() => {
  const shadow = document.querySelector('[data-amq-ui]').shadowRoot
  const rows = [...shadow.querySelectorAll('.row')]
  const byName = (name) =>
    rows.find((row) => row.querySelector('.name')?.textContent.trim() === name)

  /*
   * Where a run of text actually sits its baseline.
   *
   * A zero-height inline-block's own baseline is its bottom margin edge, so
   * once it is aligned into the parent's text it reports the parent's
   * baseline. Comparing line-box rects instead does not work here: the two
   * spans are different sizes, so their boxes differ by the descent even when
   * the baselines match perfectly.
   */
  const baselineOf = (element) => {
    const probe = document.createElement('span')
    probe.style.cssText =
      'display:inline-block;width:0;height:0;overflow:hidden'
    element.appendChild(probe)
    const y = probe.getBoundingClientRect().bottom
    probe.remove()
    return y
  }

  const withSpectators = rows.find((row) => row.querySelector('.specs'))
  const bar = withSpectators.querySelector('.bar').getBoundingClientRect()
  const count = withSpectators.querySelector('.count')
  const specs = withSpectators.querySelector('.specs')
  const lastMan = rows.find(
    (row) =>
      row.querySelector('.pill')?.textContent.trim() === 'Last Man Standing'
  )
  const fullCount = rows.find((row) => row.querySelector('.count.full'))

  return {
    baselineGap: Math.abs(baselineOf(count) - baselineOf(specs)),
    countAtBarStart: Math.abs(count.getBoundingClientRect().left - bar.left),
    specsAtBarEnd: Math.abs(specs.getBoundingClientRect().right - bar.right),
    inertSampleChips: [
      ...byName('inert sample point').querySelectorAll('.chip'),
    ].map((chip) => chip.textContent.trim()),
    liveSampleChips: [
      ...byName('category limits').querySelectorAll('.chip'),
    ].map((chip) => chip.textContent.trim()),
    lastManColour: getComputedStyle(lastMan.querySelector('.pill')).color,
    fullColour: fullCount ? getComputedStyle(fullCount).color : null,
  }
})

check(
  'spectator count shares a baseline with the player count',
  chipDetail.baselineGap <= 0.5,
  `off by ${chipDetail.baselineGap.toFixed(2)}px`
)
check(
  'player count sits under the start of the bar',
  chipDetail.countAtBarStart <= 1,
  `${chipDetail.countAtBarStart.toFixed(1)}px off`
)
check(
  'spectator count sits under the end of the bar',
  chipDetail.specsAtBarEnd <= 1,
  `${chipDetail.specsAtBarEnd.toFixed(1)}px off`
)
// randomOn is set, so a differing standardValue is inert and changes nothing.
check(
  'an inert sample point produces no chip',
  chipDetail.inertSampleChips.length === 0,
  chipDetail.inertSampleChips.join(' ')
)
check(
  'a live sample point still produces one',
  chipDetail.liveSampleChips.some((label) => label.startsWith('SMP')),
  chipDetail.liveSampleChips.join(' ')
)
check(
  'Last Man Standing is not drawn in the "full/excluded" rose',
  chipDetail.lastManColour !== chipDetail.fullColour,
  `${chipDetail.lastManColour} vs full ${chipDetail.fullColour}`
)

await root
  .locator('.row')
  .filter({ hasText: 'category limits' })
  .locator('.chip')
  .first()
  .hover()
await page.waitForTimeout(250)
const categoryTip = await page.evaluate(() => {
  const shadow = document.querySelector('[data-amq-ui]').shadowRoot
  return shadow.querySelector('.floating')?.textContent.trim() ?? null
})
// The label is an abbreviation, so repeating it in the tooltip explains nothing.
check(
  'category tooltip spells the abbreviations out',
  categoryTip?.includes('Instrumental') &&
    categoryTip?.includes('Character') &&
    !categoryTip?.includes('INS'),
  categoryTip
)
await page.mouse.move(1600, 900)
await page.waitForTimeout(250)

// --- chips wrap to two lines without growing the row ----------------------

const wrapping = await page.evaluate(() => {
  const shadow = document.querySelector('[data-amq-ui]').shadowRoot
  const rows = [...shadow.querySelectorAll('.row')]
  const busy = rows.find(
    (row) =>
      row.querySelector('.name')?.textContent.trim() === 'everything room'
  )
  const lineCount = (row) => {
    const tops = [...row.querySelectorAll('.chip, .more')].map((chip) =>
      Math.round(chip.getBoundingClientRect().top)
    )
    return new Set(tops).size
  }
  const cell = busy.querySelector('.chip').closest('.cell')
  const cellBox = cell.getBoundingClientRect()
  const rowBox = busy.getBoundingClientRect()
  return {
    busyLines: lineCount(busy),
    maxLines: Math.max(
      ...rows.filter((r) => r.querySelector('.chip')).map(lineCount)
    ),
    hasOverflow: Boolean(busy.querySelector('.more')),
    rowHeights: [
      ...new Set(
        rows.map((row) => Math.round(row.getBoundingClientRect().height))
      ),
    ],
    cellFitsRow: cellBox.top >= rowBox.top && cellBox.bottom <= rowBox.bottom,
    chipsInsideCell: [...busy.querySelectorAll('.chip, .more')].every(
      (chip) =>
        chip.getBoundingClientRect().bottom <= cellBox.bottom + 0.5 &&
        chip.getBoundingClientRect().top >= cellBox.top - 0.5
    ),
  }
})

check(
  'a busy room wraps its chips onto two lines',
  wrapping.busyLines === 2,
  `${wrapping.busyLines} lines`
)
check(
  'no row ever uses more than two lines',
  wrapping.maxLines <= 2,
  `${wrapping.maxLines} lines`
)
check('the remainder still collapses to +N', wrapping.hasOverflow === true)
// The whole point: two lines, same row height.
check(
  'row height is unchanged by wrapping',
  wrapping.rowHeights.length === 1 && wrapping.rowHeights[0] === 56,
  wrapping.rowHeights.join(', ')
)
check(
  'every chip stays inside the cell',
  wrapping.chipsInsideCell && wrapping.cellFitsRow
)

// --- song-type chips: wording and optical centring ------------------------

const typeChips = await page.evaluate(() => {
  const shadow = document.querySelector('[data-amq-ui]').shadowRoot
  const row = shadow.querySelector('.row')
  return [...row.querySelectorAll('.type')].map((chip) =>
    chip.textContent.trim()
  )
})
check(
  'song types read OP / ED / IN',
  JSON.stringify(typeChips) === JSON.stringify(['OP', 'ED', 'IN']),
  typeChips.join(' ')
)

/*
 * Optical centring can only be judged from the rendered pixels: the glyphs are
 * all capitals, so their ink stops at the baseline while the line box still
 * reserves descender room, and every box-based measurement says "centred"
 * while the letters visibly sit high.
 */
const chipBox = await page.evaluate(() => {
  const shadow = document.querySelector('[data-amq-ui]').shadowRoot
  const chip = shadow.querySelector('.row .type.on')
  const box = chip.getBoundingClientRect()
  return { x: box.x, y: box.y, width: box.width, height: box.height }
})
const SCALE = 8
const zoom = await browser.newPage({
  viewport: { width: 1760, height: 980 },
  deviceScaleFactor: SCALE,
})
await zoom.route('**/cdn/v1/**', (route) => route.abort())
await zoom.route('**fonts.googleapis.com**', (route) => route.abort())
await zoom.goto(`${origin}/ui/tests/harness.html`)
await zoom.evaluate(() => window.viewChanger.changeView('roomBrowser'))
await zoom.waitForTimeout(400)
await zoom.evaluate(() => document.fonts.load("600 12px 'IBM Plex Mono'"))
await zoom.waitForTimeout(300)
const shot = (await zoom.screenshot({ clip: chipBox, type: 'png' })).toString(
  'base64'
)
const ink = await zoom.evaluate(
  async ([data, scale]) => {
    const image = new Image()
    image.src = 'data:image/png;base64,' + data
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = image.width
    canvas.height = image.height
    const context = canvas.getContext('2d')
    context.drawImage(image, 0, 0)
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
    // The glyphs are the lightest thing in the chip; the fill and border are
    // both far darker.
    const rows = []
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const i = (y * canvas.width + x) * 4
        if (pixels[i] > 120 && pixels[i + 2] > 200) {
          rows.push(y)
          break
        }
      }
    }
    if (!rows.length) return null
    const top = rows[0]
    const bottom = rows[rows.length - 1]
    return {
      above: top / scale,
      below: (canvas.height - 1 - bottom) / scale,
    }
  },
  [shot, SCALE]
)
await zoom.close()
check(
  'song-type letters are optically centred',
  ink !== null && Math.abs(ink.above - ink.below) <= 1.2,
  ink
    ? `${ink.above.toFixed(2)}px above, ${ink.below.toFixed(2)}px below`
    : 'no ink found'
)

// --- team size is visible without opening the settings --------------------

const teamChip = await page.evaluate(() => {
  const shadow = document.querySelector('[data-amq-ui]').shadowRoot
  const row = [...shadow.querySelectorAll('.row')].find(
    (entry) =>
      entry.querySelector('.name')?.textContent.trim() === 'teams of two'
  )
  const solo = [...shadow.querySelectorAll('.row')].find(
    (entry) =>
      entry.querySelector('.name')?.textContent.trim() === 'Song/Artist only'
  )
  return {
    team: [...row.querySelectorAll('.chip')].map((chip) =>
      chip.textContent.trim()
    ),
    solo: [...solo.querySelectorAll('.chip')].map((chip) =>
      chip.textContent.trim()
    ),
  }
})
check(
  'a team room shows its team size',
  teamChip.team.includes('TEAM 2'),
  teamChip.team.join(' ')
)
// Solo is the default, and defaults render nothing.
check(
  'a solo room shows no team chip',
  !teamChip.solo.some((label) => label.startsWith('TEAM')),
  teamChip.solo.join(' ')
)

// --- the search box must accept Backspace ---------------------------------

// AMQ blocks Backspace document-wide unless the event target is an input, and
// shadow events are retargeted to the host — so this key was being swallowed.
await page.evaluate(() => (window.__log.length = 0))
const searchBox = root.locator('#amq-ui-search')
await searchBox.fill('abcd')
await searchBox.press('Backspace')
await page.waitForTimeout(100)
const afterBackspace = await searchBox.inputValue()
const blocked = await page.evaluate(() =>
  window.__log.filter((entry) => entry[0] === 'backspace blocked')
)
check(
  'backspace works in the search box',
  afterBackspace === 'abc',
  `value "${afterBackspace}"`
)
check(
  "AMQ's global guard never sees our keys",
  blocked.length === 0,
  JSON.stringify(blocked)
)
await searchBox.fill('')
await page.waitForTimeout(400)

// --- room names fit their column -----------------------------------------

const names = await page.evaluate(() => {
  const shadow = document.querySelector('[data-amq-ui]').shadowRoot
  const cells = [...shadow.querySelectorAll('.row .name')]
  return {
    longest: Math.max(...cells.map((cell) => cell.textContent.trim().length)),
    truncated: cells
      .filter((cell) => cell.scrollWidth > cell.clientWidth + 1)
      .map((cell) => cell.textContent.trim()),
  }
})
// hostModal.js:2055 caps a room name at 20 characters; the column is sized for
// that, so nothing should ellipsise.
check(
  'fixtures respect the 20-character name cap',
  names.longest <= 20,
  `longest ${names.longest}`
)
check(
  'no room name is truncated',
  names.truncated.length === 0,
  names.truncated.join(' | ')
)

// --- modifier tooltips must escape the row's clipping ---------------------

await page.evaluate(() => (window.__log.length = 0))
const chip = root.locator('.row').first().locator('.chip').first()
await chip.hover()
await page.waitForTimeout(250)
const tooltip = await page.evaluate(() => {
  const shadow = document.querySelector('[data-amq-ui]').shadowRoot
  const floating = shadow.querySelector('.floating')
  if (!floating) return null
  const box = floating.getBoundingClientRect()
  // The chips cell, reached through a chip — `:last-of-type` matches on tag,
  // not class, so it picks the wrong div.
  const cell = shadow
    .querySelector('.row .chip')
    .closest('.cell')
    .getBoundingClientRect()
  const list = shadow.querySelector('.list').getBoundingClientRect()
  return {
    text: floating.textContent.trim(),
    visible: getComputedStyle(floating).visibility === 'visible',
    positioning: getComputedStyle(floating).position,
    // The bug was the tooltip being clipped by the chips cell and the list.
    escapesCell: box.bottom > cell.bottom || box.right > cell.right,
    onScreen:
      box.left >= 0 &&
      box.right <= window.innerWidth &&
      box.bottom <= window.innerHeight,
    withinList: box.top >= list.top && box.bottom <= list.bottom,
  }
})
check(
  'modifier chip shows a tooltip',
  tooltip !== null && tooltip.text.length > 10,
  tooltip?.text
)
check(
  'tooltip is viewport-positioned',
  tooltip?.positioning === 'fixed',
  tooltip?.positioning
)
check(
  'tooltip escapes the cell that clips its row',
  tooltip?.escapesCell === true
)
check('tooltip stays on screen', tooltip?.onScreen === true)
await page.screenshot({ path: path.join(shots, 'tooltip.png') })
await page.mouse.move(1400, 820)
await page.waitForTimeout(250)

// --- profiles open from every player name ---------------------------------

await page.evaluate(() => (window.__log.length = 0))
await root.locator('.row').first().locator('.host').click()
await page.waitForTimeout(150)
const hostProfile = await page.evaluate(() => window.__log.slice())
check(
  'clicking the host opens their profile',
  hostProfile[0]?.[0] === 'profile',
  JSON.stringify(hostProfile)
)
check(
  'profile is given a close handler',
  hostProfile[0]?.[2] === 'function',
  `closeHandler was ${hostProfile[0]?.[2]}`
)

await page.evaluate(() => (window.__log.length = 0))
await root.locator('.row').first().locator('.cell.players').hover()
await page.waitForTimeout(250)
await page.locator('[data-amq-ui]').locator('.floating .name').first().click()
await page.waitForTimeout(150)
const rosterProfile = await page.evaluate(() => window.__log.slice())
check(
  'clicking a roster name opens their profile',
  rosterProfile[0]?.[0] === 'profile',
  JSON.stringify(rosterProfile)
)
await page.mouse.move(1400, 820)
await page.waitForTimeout(250)

// --- the per-row settings preview -----------------------------------------

await page.evaluate(() => (window.__log.length = 0))
await root.locator('.row').first().locator('.settings').click()
await page.waitForTimeout(150)
const preview = await page.evaluate(() => ({
  log: window.__log.map((entry) => entry[0]),
  tile: window.__previewTile ? Object.keys(window.__previewTile).sort() : null,
}))
// roomTile.js `previewSettings` order: changeSettings sets hostModal.gameMode,
// which setModePreviewGame then reads for the modal title.
check(
  'settings button drives AMQ’s host modal in order',
  JSON.stringify(preview.log) ===
    JSON.stringify([
      'changeSettings',
      'setModePreviewGame',
      'showSettings',
      'showModal',
    ]),
  preview.log.join(' → ')
)
check(
  'preview target satisfies the tile contract',
  JSON.stringify(preview.tile) ===
    JSON.stringify(['joinGame', 'settingPreviewClosed', 'spectateGame']),
  JSON.stringify(preview.tile)
)

// --- the quest drawer must stay reachable ---------------------------------

const layers = await page.evaluate(() => ({
  quest: Number(
    getComputedStyle(document.querySelector('#questContainer')).zIndex
  ),
  host: Number(
    getComputedStyle(document.querySelector('[data-amq-ui]')).zIndex
  ),
}))
check(
  'quest drawer sits above our screen',
  layers.quest > layers.host,
  `quest ${layers.quest} vs host ${layers.host}`
)

// --- the escape hatch ------------------------------------------------------

await page.evaluate(() => (window.__log.length = 0))
await page.evaluate(() => window.__amqUI.useLegacy())
await page.waitForTimeout(250)
const handover = await page.evaluate(() => ({
  ours: document.querySelector('[data-amq-ui]').style.display,
  // `changeView` early-returns on the current view, so the handover has to
  // drive the restored controller itself — this is what left a blank page.
  legacyVisible: !document
    .querySelector('#roomBrowserPage')
    .classList.contains('hidden'),
  log: window.__log.map((entry) => entry[0]),
}))
check(
  'useLegacy() hides our screen',
  handover.ours === 'none',
  `display: ${handover.ours}`
)
check(
  'useLegacy() actually opens AMQ’s screen',
  handover.legacyVisible === true,
  handover.log.join(' → ')
)

await page.evaluate(() => window.__amqUI.useNew())
await page.waitForTimeout(300)
const back = await page.evaluate(() => ({
  ours: document.querySelector('[data-amq-ui]').style.display,
  legacyVisible: !document
    .querySelector('#roomBrowserPage')
    .classList.contains('hidden'),
  rows: document
    .querySelector('[data-amq-ui]')
    .shadowRoot.querySelectorAll('.row').length,
}))
check(
  'useNew() brings ours back',
  back.ours !== 'none' && back.rows > 0,
  `${back.rows} rows`
)
check('useNew() closes AMQ’s screen', back.legacyVisible === false)

// --- quiz builder: the serializer round-trip ------------------------------

/*
 * The load-bearing assertion for the quiz builder. Everything else on that
 * screen can look wrong and be fixed; a serializer bug corrupts a quiz the
 * player already saved, and they find out when it will not load.
 *
 * Driven through `__amqUI.quizBuilder` because the repo has no unit-test
 * runner and two pure functions do not justify adding one.
 */

const roundTrip = await page.evaluate(() => {
  const api = window.__amqUI.quizBuilder
  const deepEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b)

  // Key order differs between our output and AMQ's (message blocks spread the
  // base last), so compare structurally rather than as text.
  const sortKeys = (value) => {
    if (Array.isArray(value)) return value.map(sortKeys)
    if (value && typeof value === 'object') {
      return Object.keys(value)
        .sort()
        .reduce((out, key) => {
          out[key] = sortKeys(value[key])
          return out
        }, {})
    }
    return value
  }
  const same = (a, b) => deepEqual(sortKeys(a), sortKeys(b))

  const results = {}

  const base = window.__quizRoundTrip
  results.exact = same(api.roundTrip(base), base)

  const unknown = window.__quizWithUnknownFields
  const unknownOut = api.roundTrip(unknown)
  results.unknownPreserved = same(unknownOut, unknown)
  results.unknownFieldNames = [
    unknownOut.someFutureQuizField,
    unknownOut.ruleBlocks[0].someFutureBlockField,
    JSON.stringify(unknownOut.ruleBlocks[0].blocks[0].someFutureEntryField),
  ]

  // `annSongIds` arrives on load and is deleted by the client, so dropping it
  // is correct — everything else must still match.
  const loaded = window.__quizAsLoaded
  const loadedOut = api.roundTrip(loaded)
  results.annSongIdsDropped =
    loadedOut.ruleBlocks[1].blocks[0].annSongIds === undefined
  results.serverFieldsDropped =
    loadedOut.version === undefined &&
    loadedOut.ruleBlocks[0].matchSongCount === undefined
  const expected = JSON.parse(JSON.stringify(loaded))
  delete expected.ruleBlocks[1].blocks[0].annSongIds
  delete expected.version
  delete expected.ruleBlocks[0].matchSongCount
  results.loadedOtherwiseIntact = same(loadedOut, expected)

  // The model's view of the same quiz — what the UI will actually read.
  const model = api.fromSave(base)
  const first = model.blocks[0]
  results.kinds = model.blocks.flatMap((block) =>
    block.entries.map((entry) => entry.kind)
  )
  // Three consecutive entries chained together are two `connectUp` flags.
  results.chained = first.entries.filter((entry) => entry.connectUp).length
  results.locked = first.entries.filter((entry) => entry.locked).length
  // An entry with no overrides must produce an empty object, not four
  // `undefined` keys — the emptiness is what "follows the block" means.
  results.noOverrideKeys = Object.keys(first.entries[0].overrides).length
  results.allOverrideKeys = Object.keys(first.entries[3].overrides).sort()
  results.oneOverrideKeys = Object.keys(first.entries[4].overrides)
  results.randomGuessTime = JSON.stringify(
    first.entries[3].overrides.guessTime.guessTime
  )
  results.opaqueSettings = same(
    model.blocks[1].entries[0].settings,
    base.ruleBlocks[1].blocks[0].settings
  )
  results.emptyTitleKept = model.blocks[1].entries[2].kind === 'title'
  results.quizLevel = [
    model.name,
    model.tags.join('/'),
    model.ruleBlockRandomOrder,
  ]

  // A leading `connectUp` cannot mean anything and must not survive a save.
  const stray = JSON.parse(JSON.stringify(base))
  stray.ruleBlocks[0].blocks[0].connectUp = true
  results.strayConnectCleared =
    api.roundTrip(stray).ruleBlocks[0].blocks[0].connectUp === false

  // An unclassifiable block is refused rather than silently dropped.
  try {
    api.fromSave({
      name: 'x',
      description: '',
      tags: [],
      ruleBlockRandomOrder: false,
      ruleBlocks: [
        {
          ...base.ruleBlocks[0],
          blocks: [{ connectUp: false, locked: false }],
        },
      ],
    })
    results.refusesUnknownBlock = false
  } catch {
    results.refusesUnknownBlock = true
  }

  return results
})

check('a real quiz round-trips exactly', roundTrip.exact)
check(
  'unknown fields survive a round-trip',
  roundTrip.unknownPreserved,
  roundTrip.unknownFieldNames.join(' | ')
)
check(
  'server-supplied annSongIds are dropped, as AMQ drops them',
  roundTrip.annSongIdsDropped && roundTrip.loadedOtherwiseIntact
)
// `version` and `matchSongCount` are added by the server on load and appear in
// no save AMQ's own client makes — echoing them back would send the server
// something its client never sends.
check(
  'server-added version and matchSongCount are not echoed back',
  roundTrip.serverFieldsDropped
)
check(
  'every block kind is recognised',
  JSON.stringify(roundTrip.kinds) ===
    JSON.stringify([
      'anime',
      'song',
      'song',
      'anime',
      'song',
      'algorithm',
      'message',
      'title',
    ]),
  roundTrip.kinds.join(' ')
)
check(
  'a three-entry chain is two connectUp flags',
  roundTrip.chained === 2,
  `${roundTrip.chained} flags`
)
check('locked entries survive', roundTrip.locked === 1)
check(
  'an entry with no overrides carries no override keys',
  roundTrip.noOverrideKeys === 0,
  `${roundTrip.noOverrideKeys} keys`
)
check(
  'all four overrides are read back',
  JSON.stringify(roundTrip.allOverrideKeys) ===
    JSON.stringify(
      ['guessTime', 'guessModes', 'playBackSpeed', 'samplePoint'].sort()
    ),
  roundTrip.allOverrideKeys.join(' ')
)
check(
  'a single override stays single',
  JSON.stringify(roundTrip.oneOverrideKeys) === JSON.stringify(['samplePoint']),
  roundTrip.oneOverrideKeys.join(' ')
)
check(
  'a random guess-time range survives as a range',
  roundTrip.randomGuessTime === '[20,30]',
  roundTrip.randomGuessTime
)
check('the algorithm settings blob is untouched', roundTrip.opaqueSettings)
check('an empty title block is kept, not skipped', roundTrip.emptyTitleKept)
check(
  'quiz-level fields survive',
  JSON.stringify(roundTrip.quizLevel) ===
    JSON.stringify(['round trip', '3/11', true]),
  JSON.stringify(roundTrip.quizLevel)
)
check('a stray leading connectUp is cleared', roundTrip.strayConnectCleared)
check(
  'an unclassifiable block is refused, not dropped',
  roundTrip.refusesUnknownBlock
)

// --- quiz builder: the model's mutations ----------------------------------

/*
 * The mutations every later phase of the screen sits on. A fake library is
 * injected so these exercise the model alone — what the counts do with a real
 * cache is a separate concern.
 */

const model = await page.evaluate(() => {
  const api = window.__amqUI.quizBuilder

  // Two anime: 3312 has 2 OP / 1 ED / 3 IN, 4521 has 1 OP / 1 ED / 0 IN.
  const CATALOGUE = {
    3312: { op: [11, 12], ed: [13], in: [14, 15, 16] },
    4521: { op: [21], ed: [22], in: [] },
  }
  const library = {
    animeSongIds(annId, types) {
      const anime = CATALOGUE[annId]
      if (!anime) return []
      return [
        ...(types.op ? anime.op : []),
        ...(types.ed ? anime.ed : []),
        ...(types.in ? anime.in : []),
      ]
    },
    annIdFromAnnSongId(annSongId) {
      for (const [annId, anime] of Object.entries(CATALOGUE)) {
        if ([...anime.op, ...anime.ed, ...anime.in].includes(annSongId)) {
          return Number(annId)
        }
      }
      return undefined
    },
  }

  const store = api.makeStore(library)
  const results = {}
  const firstBlock = () => store.quiz.blocks[0]

  // Adds land in the "Adds to" block.
  const first = store.addEntry({
    kind: 'anime',
    connectUp: false,
    locked: false,
    annId: 3312,
    includeSongTypes: { op: true, ed: false, in: false },
    numberOfSongs: 2,
    overrides: {},
  })
  results.addedToTarget = firstBlock().entries.length === 1
  results.poolFromTypes = store.pool(first)

  // Turning a type on widens the pool; the pick count is free to stay.
  store.toggleSongType(first.id, 'in')
  results.poolAfterOn = store.pool(first)

  // Turning both off leaves a pool of 0, and the pick count must re-clamp to 1
  // rather than point past what it draws from.
  store.setNumberOfSongs(first.id, 5)
  results.pickAfterSet = first.numberOfSongs
  store.toggleSongType(first.id, 'op')
  store.toggleSongType(first.id, 'in')
  results.poolEmpty = store.pool(first)
  results.pickReclamped = first.numberOfSongs

  // Any mutation marks the quiz dirty, which is what lights up Undo. This was
  // a `$derived` over a plain array and so never invalidated — the button
  // stayed greyed out no matter what you did.
  results.dirtyAfterEdit = store.dirty

  // Revert throws away everything since the last save. It replaces the whole
  // document, so a reference held across it is stale by design.
  const beforeRevert = firstBlock().entries.length
  store.revert()
  results.revertedToEmpty =
    firstBlock().entries.length === 0 && beforeRevert > 0
  results.cleanAfterRevert = store.dirty === false

  // Rebuild what the rest of this section works on.
  const anime = store.addEntry({
    kind: 'anime',
    connectUp: false,
    locked: false,
    annId: 3312,
    includeSongTypes: { op: true, ed: false, in: true },
    numberOfSongs: 1,
    overrides: {},
  })
  const afterUndo = anime

  // Everything below works from the live entry, not the pre-undo reference.
  const liveAnime = afterUndo

  // Chaining: the first entry of a block has nothing above it.
  const song = store.addEntry({
    kind: 'song',
    connectUp: false,
    locked: false,
    annSongId: 21,
    overrides: {},
  })
  store.toggleChain(firstBlock().entries[0].id)
  results.firstCannotChain = firstBlock().entries[0].connectUp === false
  store.toggleChain(song.id)
  results.secondCanChain = song.connectUp === true

  // Removing the entry above a chained one must not leave it chained to
  // whatever slides into that slot.
  store.removeEntries([liveAnime.id])
  results.leadingChainCleared = firstBlock().entries[0].connectUp === false

  // Guess modes: the last one on cannot be turned off.
  const modes = { song: true, tinyVideo: false, blurVideo: false }
  results.lastModeHeld =
    api.QuizStore.toggleGuessMode(modes, 'song').song === true
  const two = { song: true, tinyVideo: true, blurVideo: false }
  results.modeTogglesWhenSafe =
    api.QuizStore.toggleGuessMode(two, 'song').song === false

  // A second rule block, and a move that preserves overrides.
  const second = store.addRuleBlock()
  results.twoBlocks = store.quiz.blocks.length === 2
  store.setOverride([song.id], 'samplePoint', { samplePoint: 42 })
  store.moveEntries([song.id], second.id)
  const moved = second.entries[0]
  results.moved =
    second.entries.length === 1 && firstBlock().entries.length === 0
  results.overridesPreserved = moved.overrides.samplePoint.samplePoint === 42
  results.movedChainCleared = moved.connectUp === false

  // Duplicating a rule block deep-copies it and lands directly after.
  store.setSongCount(second.id, 10)
  const copy = store.duplicateRuleBlock(second.id)
  results.duplicateIsAfter = store.quiz.blocks[2].id === copy.id
  results.duplicateHasEntries = copy.entries.length === 1
  results.duplicateIsDeep =
    copy.entries[0].id !== moved.id &&
    copy.entries[0].overrides.samplePoint.samplePoint === 42
  copy.entries[0].overrides.samplePoint.samplePoint = 99
  results.duplicateIndependent = moved.overrides.samplePoint.samplePoint === 42

  // The 250-song budget is quiz-wide, and a block's slider stops at what is
  // left for it.
  results.budgetLeft = store.songBudgetLeft
  store.setSongCount(second.id, 999)
  results.songCountClamped = second.songCount === store.ceiling(second)
  results.neverOver250 =
    store.quiz.blocks.reduce((total, block) => total + block.songCount, 0) <=
    250

  // Selection spans blocks.
  store.addEntry(
    {
      kind: 'song',
      connectUp: false,
      locked: false,
      annSongId: 22,
      overrides: {},
    },
    store.quiz.blocks[0].id
  )
  const ids = store.flatIds
  store.selectRange(ids[0], ids[ids.length - 1])
  results.rangeSpansBlocks = store.selection.size === ids.length

  // Counts: two OPs from one anime, duplicates on.
  const counting = api.makeStore(library)
  const target = counting.quiz.blocks[0]
  counting.addEntry({
    kind: 'anime',
    connectUp: false,
    locked: false,
    annId: 3312,
    includeSongTypes: { op: true, ed: true, in: true },
    numberOfSongs: 2,
    overrides: {},
  })
  counting.addEntry({
    kind: 'song',
    connectUp: false,
    locked: false,
    annSongId: 21,
    overrides: {},
  })
  const info = counting.info(target)
  results.infoDuplicatesOn = [
    info.songCount,
    info.uniqueAnime,
    info.uniqueSongs,
  ]
  counting.updateBlock(target.id, { duplicates: false })
  const off = counting.info(target)
  results.infoDuplicatesOff = [off.songCount, off.uniqueAnime, off.uniqueSongs]

  return results
})

check('an add lands in the target block', model.addedToTarget)
check(
  'the pool follows the enabled song types',
  model.poolFromTypes === 2 && model.poolAfterOn === 5,
  `OP only ${model.poolFromTypes}, OP+IN ${model.poolAfterOn}`
)
check(
  'the pick count re-clamps when its types are turned off',
  model.pickAfterSet === 5 &&
    model.poolEmpty === 0 &&
    model.pickReclamped === 1,
  `set ${model.pickAfterSet} → pool ${model.poolEmpty} → pick ${model.pickReclamped}`
)
check(
  'an edit marks the quiz dirty, which is what enables Undo',
  model.dirtyAfterEdit === true
)
check(
  'reverting throws away every change since the last save',
  model.revertedToEmpty && model.cleanAfterRevert,
  `reverted=${model.revertedToEmpty}, clean=${model.cleanAfterRevert}`
)
check(
  'the first entry of a block cannot be chained',
  model.firstCannotChain && model.secondCanChain
)
check(
  'removing an entry clears a chain that would dangle',
  model.leadingChainCleared
)
check(
  'the last guess mode cannot be turned off',
  model.lastModeHeld && model.modeTogglesWhenSafe
)
check(
  'a move carries the entry and its overrides',
  model.twoBlocks &&
    model.moved &&
    model.overridesPreserved &&
    model.movedChainCleared
)
check(
  'duplicating a rule block deep-copies it, directly after the original',
  model.duplicateIsAfter &&
    model.duplicateHasEntries &&
    model.duplicateIsDeep &&
    model.duplicateIndependent
)
check(
  'a block’s song count is capped by what the 250 budget leaves it',
  model.songCountClamped && model.neverOver250,
  `budget was ${model.budgetLeft}`
)
check('shift-range selection spans blocks', model.rangeSpansBlocks)
// 6 songs available, block wants 2 from the anime + 1 song = 3; one anime, six
// unique songs. With duplicates off the anime contributes 1, the loose song is
// from a different show, so 2.
check(
  'block info matches AMQ’s own computation, duplicates on',
  JSON.stringify(model.infoDuplicatesOn) === JSON.stringify([3, 2, 7]),
  JSON.stringify(model.infoDuplicatesOn)
)
check(
  'duplicates off counts one song per distinct anime',
  JSON.stringify(model.infoDuplicatesOff) === JSON.stringify([2, 2, 7]),
  JSON.stringify(model.infoDuplicatesOff)
)

// --- quiz builder: the screen ---------------------------------------------

await page.evaluate(() => window.viewChanger.changeView('customQuizCreator'))
await page.waitForTimeout(300)

// The quiz builder mounts its own shadow host, so it is the second one.
const qb = page.locator('[data-amq-ui]').last().locator('.amq-ui-root')

/*
 * The library has to be *requested*. `libraryCacheHandler.animeCache` is `{}`
 * until `getCache` asks the server for it, and reading it without asking gets
 * you a screen where every entry is "Anime #4591" with a song count of zero —
 * which is how this shipped the first time.
 */
const libraryLoad = await page.evaluate(() => ({
  requested: window.__libraryLoadCalls,
  cached: Object.keys(window.libraryCacheHandler.animeCache).length,
  storeLoaded: window.__amqUI.quizBuilder.libraryStore.loaded,
  failed: window.__amqUI.quizBuilder.libraryStore.failed,
}))
check(
  'opening the builder requests the song library',
  libraryLoad.requested === 1,
  `${libraryLoad.requested} getCache calls`
)
check(
  'the cache is populated and the store knows it',
  libraryLoad.cached > 0 && libraryLoad.storeLoaded && !libraryLoad.failed,
  `${libraryLoad.cached} anime cached`
)

// Build something with every row kind in it.
await page.evaluate(() => {
  const store = window.__amqUI.quizBuilder.store
  const ids = window.__libraryIds
  store.quiz.name = 'Saturday night'
  store.addEntry({
    kind: 'anime',
    connectUp: false,
    locked: false,
    annId: 3312,
    includeSongTypes: { op: true, ed: true, in: false },
    numberOfSongs: 2,
    overrides: {},
  })
  store.addEntry({
    kind: 'song',
    connectUp: false,
    locked: false,
    annSongId: ids.annSongIds[2],
    overrides: {},
  })
  store.addEntry({
    kind: 'song',
    connectUp: false,
    locked: false,
    annSongId: ids.annSongIds[3],
    overrides: {},
  })
  store.addEntry({
    kind: 'anime',
    connectUp: false,
    locked: false,
    annId: 7781,
    includeSongTypes: { op: true, ed: false, in: true },
    numberOfSongs: 1,
    overrides: {
      guessTime: { guessTime: 25, extraGuessTime: 0 },
      samplePoint: { samplePoint: [40, 70] },
    },
  })
  const second = store.addRuleBlock()
  store.addEntry(
    {
      kind: 'algorithm',
      connectUp: false,
      locked: false,
      settings: {
        numberOfSongs: 5,
        songSelection: {
          advancedValue: { watched: 5, unwatched: 0, random: 0 },
        },
        songType: {
          standardValue: { openings: true, endings: true, inserts: false },
        },
        songDifficulity: { advancedOn: true, advancedValue: [0, 60] },
        vintage: {
          standardValue: { years: [1944, 2026] },
          advancedValueList: [],
        },
        genre: [],
        tags: [],
      },
      overrides: {},
    },
    second.id
  )
  store.addEntry(
    {
      kind: 'message',
      connectUp: false,
      locked: false,
      message: 'Halfway there!',
      avatar: null,
      videoDisplay: false,
      delay: 0,
      time: 5,
    },
    second.id
  )
  store.addEntry(
    {
      kind: 'title',
      connectUp: false,
      locked: false,
      title: 'Round 2',
    },
    second.id
  )
  const first = store.quiz.blocks[0]
  store.toggleChain(first.entries[2].id)
  store.toggleLock(first.entries[1].id)
})
await page.waitForTimeout(300)

const qbLayout = await page.evaluate(() => {
  const shadow = document.querySelectorAll('[data-amq-ui]')[1].shadowRoot
  const rows = [...shadow.querySelectorAll('.row')]
  const xs = (selector) =>
    rows.map((row) =>
      Math.round(
        row.querySelector(selector)?.getBoundingClientRect().left ?? -1
      )
    )
  const unique = (list) => [...new Set(list.filter((value) => value !== -1))]
  const screen = shadow.querySelector('.screen').getBoundingClientRect()
  const bar = document.querySelector('#mainMenuBar').getBoundingClientRect()
  return {
    rowCount: rows.length,
    anime: unique(xs('.anime')),
    types: unique(xs('.types')),
    actions: unique(xs('.actions')),
    // Every entry row is the same height whatever it holds.
    heights: [
      ...new Set(
        rows.map((row) => Math.round(row.getBoundingClientRect().height))
      ),
    ],
    screenBottom: Math.round(screen.bottom),
    barTop: Math.round(bar.top),
    bodyScrollsSideways: document.body.scrollWidth > document.body.clientWidth,
    entryToken: Math.round(
      parseFloat(
        getComputedStyle(
          shadow.querySelector('.amq-ui-root') ?? shadow.host
        ).getPropertyValue('--qb-entry-h')
      )
    ),
    blockHeaders: shadow.querySelectorAll('.head').length,
    nested: shadow.querySelectorAll('.nested').length,
    footers: shadow.querySelectorAll('.footer').length,
  }
})

// Four entries in the first block; the second holds only nested blocks, which
// are not entry rows.
check(
  'every entry row renders',
  qbLayout.rowCount === 4,
  `${qbLayout.rowCount} rows`
)
check(
  'the anime column aligns down the list',
  qbLayout.anime.length === 1,
  JSON.stringify(qbLayout.anime)
)
check(
  'the types column aligns down the list',
  qbLayout.types.length === 1,
  JSON.stringify(qbLayout.types)
)
// The pick cell is present on anime rows and spaced on song rows; if the
// spacer were missing, the actions column would shift between the two.
check(
  'the action column aligns across anime and song rows',
  qbLayout.actions.length === 1,
  JSON.stringify(qbLayout.actions)
)
// Read from the token rather than hardcoded: the point is that every row is
// the *same* height whatever it holds, not what that height happens to be.
check(
  'every entry row is exactly one --qb-entry-h tall',
  qbLayout.heights.length === 1 && qbLayout.heights[0] === qbLayout.entryToken,
  `${qbLayout.heights.join(', ')} vs token ${qbLayout.entryToken}`
)
check(
  'the builder stops above AMQ’s menu bar',
  qbLayout.screenBottom <= qbLayout.barTop,
  `screen ${qbLayout.screenBottom} vs bar ${qbLayout.barTop}`
)
check('the builder never scrolls sideways', !qbLayout.bodyScrollsSideways)
check(
  'both rule blocks and all three nested kinds render',
  qbLayout.blockHeaders === 2 &&
    qbLayout.nested === 3 &&
    qbLayout.footers === 2,
  `${qbLayout.blockHeaders} headers, ${qbLayout.nested} nested, ${qbLayout.footers} footers`
)

const qbContent = await page.evaluate(() => {
  const shadow = document.querySelectorAll('[data-amq-ui]')[1].shadowRoot
  const rows = [...shadow.querySelectorAll('.row')]
  const text = (element) => element?.textContent.replace(/\s+/g, ' ').trim()
  return {
    // Rule blocks are numbered by position, not named.
    blockNames: [...shadow.querySelectorAll('.head .name')].map(text),
    // Adjacent blocks must not share a rail colour.
    tones: [...shadow.querySelectorAll('.head')].map((head) =>
      [...head.classList].find((name) => name.startsWith('tone-'))
    ),
    animeNames: rows.map((row) => text(row.querySelector('.anime'))),
    songTitles: rows.map((row) => text(row.querySelector('.title'))),
    overrideChips: rows.flatMap((row) =>
      [...row.querySelectorAll('.chip')].map(text)
    ),
    // Two chained rows means two rails drawn downward and two upward.
    chainRails: shadow.querySelectorAll('.rail.up').length,
    chainRailsDown: shadow.querySelectorAll('.rail.down').length,
    lockedRows: shadow.querySelectorAll('.act.lock.on').length,
    // An insert badge carries no number; openings and endings do.
    typeBadges: rows
      .map((row) => text(row.querySelector('.badge')))
      .filter(Boolean),
    infoLines: [...shadow.querySelectorAll('.head .info')].map(text),
    targetBadge: text(shadow.querySelector('.head .target')),
    algorithmChips: [...shadow.querySelectorAll('.nested .chip')].map(text),
    matchLine: text(shadow.querySelector('.nested .match')),
    nestedContent: [...shadow.querySelectorAll('.nested .content')].map(text),
    totals: text(shadow.querySelector('.headline')),
  }
})

check(
  'rule blocks are numbered by position',
  JSON.stringify(qbContent.blockNames) ===
    JSON.stringify(['Rule Block 1', 'Rule Block 2']),
  qbContent.blockNames.join(' | ')
)
check(
  'adjacent rule blocks never share a rail colour',
  qbContent.tones[0] !== qbContent.tones[1],
  qbContent.tones.join(' ')
)
/*
 * The three symptoms of an unloaded library, asserted directly: ids instead of
 * names, and every song count zero. Counting elements would not have caught
 * any of them — the rows rendered fine, they just said nothing true.
 */
const resolved = await page.evaluate(() => {
  const shadow = document.querySelectorAll('[data-amq-ui]')[1].shadowRoot
  const rows = [...shadow.querySelectorAll('.row')]
  const text = (element) =>
    element?.textContent.replace(/\s+/g, ' ').trim() ?? ''
  const libRows = [...shadow.querySelectorAll('.lib-row')]
  return {
    animeNames: rows.map((row) => text(row.querySelector('.anime'))),
    songTitles: rows
      .map((row) => text(row.querySelector('.title')))
      .filter(Boolean),
    // `OP 1` / `ED 1` — the count beside each type toggle comes from the cache.
    typeCounts: rows.flatMap((row) =>
      [...row.querySelectorAll('.type .n')].map((element) =>
        Number(text(element))
      )
    ),
    // `2/2` — the pick control's pool.
    pools: rows.map((row) => text(row.querySelector('.count'))).filter(Boolean),
    libraryNames: libRows.map((row) => text(row.querySelector('.name'))),
    librarySubs: libRows.map((row) => text(row.querySelector('.sub'))),
  }
})

// "Anime #4591" and "Song #46015" are the unknown-entry fallbacks.
check(
  'entries resolve to real names, not ids',
  resolved.animeNames.every((name) => name && !/^Anime #\d+$/.test(name)) &&
    resolved.songTitles.every((title) => !/^Song #\d+$/.test(title)),
  resolved.animeNames.join(' | ')
)
check(
  'the library lists real names, not ids',
  resolved.libraryNames.length > 0 &&
    resolved.libraryNames.every((name) => name && !/^Anime #\d+$/.test(name)),
  resolved.libraryNames.slice(0, 3).join(' | ')
)
check(
  'song-type counts come from the cache, not zero',
  resolved.typeCounts.length > 0 &&
    resolved.typeCounts.some((count) => count > 0),
  resolved.typeCounts.join(',')
)
// `1/0` is what an uncached anime produces: a pool of nothing.
check(
  'no pick control shows an empty pool',
  resolved.pools.length > 0 &&
    !resolved.pools.some((label) => /\/0$/.test(label)),
  resolved.pools.join(' ')
)
check(
  'library rows report their per-type counts',
  resolved.librarySubs.some(
    (sub) => /OP \d/.test(sub) && !/OP 0 · ED 0 · IN 0/.test(sub)
  ),
  resolved.librarySubs[0]
)

check(
  'the anime column is filled for song entries too',
  qbContent.animeNames.every((name) => name && name.length > 0),
  qbContent.animeNames.join(' | ')
)
check(
  'song entries show their title, anime entries do not',
  qbContent.songTitles[0] === undefined &&
    qbContent.songTitles[1] === 'Crow Song',
  JSON.stringify(qbContent.songTitles)
)
check(
  'a random override range renders as a range, not a single value',
  qbContent.overrideChips.includes('40–70%') &&
    qbContent.overrideChips.includes('25s'),
  qbContent.overrideChips.join(' ')
)
check(
  'a chained pair draws a half-rail in each of its two rows',
  qbContent.chainRails === 1 && qbContent.chainRailsDown === 1,
  `${qbContent.chainRails} up, ${qbContent.chainRailsDown} down`
)
check('a locked entry shows its lock filled', qbContent.lockedRows === 1)
check(
  'insert badges carry no number, openings do',
  qbContent.typeBadges.includes('IN'),
  qbContent.typeBadges.join(' ')
)
check(
  'the block info line reports all three counts',
  /\d+ anime · \d+ unique songs · \d+ chosen/.test(qbContent.infoLines[0]),
  qbContent.infoLines[0]
)
check(
  'the target block is badged',
  qbContent.targetBadge === 'Adding here',
  qbContent.targetBadge
)
check(
  'the algorithm block summarises its pool',
  qbContent.algorithmChips.includes('Watched') &&
    qbContent.algorithmChips.includes('1944-2026') &&
    qbContent.algorithmChips.includes('0-60'),
  qbContent.algorithmChips.join(' | ')
)
// The count is server-supplied and has not arrived, so it must not read 0.
check(
  'an algorithm block with no match count yet says so',
  qbContent.matchLine.startsWith('…'),
  qbContent.matchLine
)
check(
  'message and title blocks show their content inline',
  qbContent.nestedContent.includes('Halfway there!') &&
    qbContent.nestedContent.includes('Round 2'),
  qbContent.nestedContent.join(' | ')
)
check(
  'the top bar reports the totals, with no estimated length',
  /unique songs · \d+ chosen/.test(qbContent.totals) &&
    !/min|length/i.test(qbContent.totals),
  qbContent.totals
)

// --- library: expansion, alignment, and one-click add ---------------------

await qb.locator('.lib-row').first().locator('.chev').click()
await page.waitForTimeout(200)

const expansion = await page.evaluate(() => {
  const shadow = document.querySelectorAll('[data-amq-ui]')[1].shadowRoot
  const rows = [...shadow.querySelectorAll('.lib-row')]
  const songRows = rows.filter((row) => row.classList.contains('song'))
  const chevron = rows[0].querySelector('.chev').getBoundingClientRect()
  const badge = songRows[0]?.querySelector('.badge').getBoundingClientRect()
  return {
    songRows: songRows.length,
    heights: [
      ...new Set(rows.map((r) => Math.round(r.getBoundingClientRect().height))),
    ],
    // SPEC §4.1: the chevron's *tip* lines up with the badge below it, which
    // is what the -5px nudge on the glyph buys.
    chevronToBadge: badge ? Math.round(badge.left - chevron.left) : null,
    badges: songRows.map((row) =>
      row.querySelector('.badge').textContent.trim()
    ),
  }
})
check(
  'expanding an anime lists exactly its songs',
  expansion.songRows === 6,
  `${expansion.songRows} song rows`
)
// A song row is shorter than the anime row it sits under — that difference is
// what makes an expanded anime read as a group.
check(
  'song rows are shorter than the anime row above them',
  expansion.heights.length === 2 &&
    Math.min(...expansion.heights) < Math.max(...expansion.heights),
  expansion.heights.join(', ')
)
check(
  'a song badge starts within a few px of the chevron’s tip',
  expansion.chevronToBadge !== null &&
    Math.abs(expansion.chevronToBadge - 10) <= 8,
  `${expansion.chevronToBadge}px apart`
)
check(
  'expanded songs are ordered OP, ED, then inserts',
  expansion.badges[0].startsWith('OP') &&
    expansion.badges[1].startsWith('ED') &&
    expansion.badges[2].startsWith('IN'),
  expansion.badges.join(' ')
)

// One click adds into the "Adds to" block.
await qb.locator('.lib-row').first().locator('.add').click()
await page.waitForTimeout(200)
const afterAdd = await page.evaluate(() => {
  const store = window.__amqUI.quizBuilder.store
  return {
    firstBlock: store.quiz.blocks[0].entries.length,
    secondBlock: store.quiz.blocks[1].entries.length,
  }
})
check(
  'a library add lands in the target block, not just the first',
  afterAdd.firstBlock === 5 && afterAdd.secondBlock === 3,
  `${afterAdd.firstBlock} / ${afterAdd.secondBlock}`
)

await page.screenshot({ path: path.join(shots, 'quiz-builder.png') })

// The whole anime row toggles, not just the 24px chevron.
const countSongRows = () =>
  page.evaluate(
    () =>
      document
        .querySelectorAll('[data-amq-ui]')[1]
        .shadowRoot.querySelectorAll('.lib-row.song').length
  )

await qb.locator('.lib-row').first().locator('.text').click()
await page.waitForTimeout(150)
const collapsedByBody = await countSongRows()
await qb.locator('.lib-row').first().locator('.count').click()
await page.waitForTimeout(150)
const expandedByBody = await countSongRows()
check(
  'clicking an anime row’s body collapses and re-expands its songs',
  collapsedByBody === 0 && expandedByBody === 6,
  `${collapsedByBody} then ${expandedByBody} song rows`
)

// The guard is the part most likely to regress: the row's buttons must keep
// doing their own thing without also toggling the row under them.
await qb.locator('.lib-row').first().locator('.add').click()
await page.waitForTimeout(200)
const afterGuardedAdd = await page.evaluate(() => {
  const shadow = document.querySelectorAll('[data-amq-ui]')[1].shadowRoot
  const store = window.__amqUI.quizBuilder.store
  const songRows = shadow.querySelectorAll('.lib-row.song').length
  // Put the entry count back where the checks above left it.
  store.undo()
  return { songRows }
})
check(
  '+ Add on an anime row adds without collapsing it',
  afterGuardedAdd.songRows === 6,
  `${afterGuardedAdd.songRows} song rows`
)

// --- selection, and the action island --------------------------------------

await qb.locator('.row').first().locator('.check input').click()
await qb
  .locator('.row')
  .nth(2)
  .locator('.check input')
  .click({ modifiers: ['Shift'] })
await page.waitForTimeout(150)
const selection = await page.evaluate(() => {
  const shadow = document.querySelectorAll('[data-amq-ui]')[1].shadowRoot
  const island = shadow.querySelector('.island')
  return {
    size: window.__amqUI.quizBuilder.store.selection.size,
    islandShown: Boolean(island),
    label: island?.querySelector('.count')?.textContent.trim(),
    // Every label is one word so the island can never wrap over the rows.
    wraps: island ? island.getBoundingClientRect().height > 44 : false,
    highlighted: shadow.querySelectorAll('.row.selected').length,
  }
})
check(
  'shift-click extends a selection',
  selection.size === 3,
  `${selection.size} selected`
)
check('the action island appears with a selection', selection.islandShown)
check(
  'the island reports the count',
  selection.label === '3 selected',
  selection.label
)
check('the island never wraps', !selection.wraps)
check(
  'selected rows are highlighted',
  selection.highlighted === 3,
  `${selection.highlighted} highlighted`
)

// Escape clears it — SPEC §11.
await page.keyboard.press('Escape')
await page.waitForTimeout(150)
check(
  'Escape clears the selection',
  (await page.evaluate(
    () => window.__amqUI.quizBuilder.store.selection.size
  )) === 0
)

// --- the algorithm dialog is AMQ's ----------------------------------------

await page.evaluate(() => (window.__log.length = 0))
await qb.locator('.nested').first().locator('.act').first().click()
await page.waitForTimeout(150)
const algorithm = await page.evaluate(() => ({
  log: window.__log.map((entry) => entry[0]),
  // AMQ calls `updateSettings` on whatever we hand it; that shim is how the
  // dialog's result gets back into our model.
  shimHasUpdate:
    typeof window.__quizBuilderTarget?.updateSettings === 'function',
}))
check(
  'an algorithm block opens AMQ’s own dialog',
  algorithm.log.includes('setModeQuizBuilder') &&
    algorithm.log.includes('showModal'),
  algorithm.log.join(' → ')
)
check('the dialog is given a write-back shim', algorithm.shimHasUpdate)

// Drive the dialog's confirm the way hostModal.js:401 does.
const written = await page.evaluate(() => {
  window.__quizBuilderTarget.updateSettings({
    numberOfSongs: 42,
    genre: [],
    tags: [],
  })
  const store = window.__amqUI.quizBuilder.store
  const entry = store.quiz.blocks[1].entries[0]
  return {
    numberOfSongs: entry.settings.numberOfSongs,
    // The old count described the old filters, so it must be cleared.
    matchesCleared: entry.matchedAnnSongIds === undefined,
  }
})
check(
  'confirming the dialog writes back into our model',
  written.numberOfSongs === 42 && written.matchesCleared,
  JSON.stringify(written)
)

// --- caps are enforced in the UI, not left to AMQ to reject ---------------

const caps = await page.evaluate(() => {
  const store = window.__amqUI.quizBuilder.store
  // Seven is the algorithm cap (`MAX_ALGORIHMN_BLOCKS`, sic).
  for (let index = 0; index < 8; index += 1) {
    store.addEntry({
      kind: 'algorithm',
      connectUp: false,
      locked: false,
      settings: { numberOfSongs: 1 },
      overrides: {},
    })
  }
  return {
    algorithmCount: store.quiz.blocks.reduce(
      (total, block) =>
        total +
        block.entries.filter((entry) => entry.kind === 'algorithm').length,
      0
    ),
    blocked: store.capReached('algorithm'),
  }
})
check(
  'the algorithm block cap is enforced at 7',
  caps.algorithmCount === 7 && caps.blocked !== null,
  `${caps.algorithmCount} blocks — ${caps.blocked}`
)

const capButton = await page.evaluate(() => {
  const shadow = document.querySelectorAll('[data-amq-ui]')[1].shadowRoot
  const button = [...shadow.querySelectorAll('.add-nested')].find((element) =>
    element.textContent.includes('Algorithm')
  )
  return { disabled: button?.disabled, title: button?.title }
})
check(
  'a capped control is disabled with the reason on it',
  capButton.disabled === true && /7/.test(capButton.title ?? ''),
  capButton.title
)

// --- Backspace must work in both search boxes -----------------------------

await page.evaluate(() => (window.__log.length = 0))
for (const id of ['#amq-ui-library-search', '#amq-ui-quiz-search']) {
  const field = qb.locator(id)
  await field.fill('abcd')
  await field.press('Backspace')
  await page.waitForTimeout(80)
  const value = await field.inputValue()
  check(
    `backspace works in ${id === '#amq-ui-quiz-search' ? 'the quiz' : 'the library'} search`,
    value === 'abc',
    `value "${value}"`
  )
  await field.fill('')
}
const blockedKeys = await page.evaluate(() =>
  window.__log.filter((entry) => entry[0] === 'backspace blocked')
)
check(
  'AMQ’s global key guard never sees the builder’s keys',
  blockedKeys.length === 0,
  JSON.stringify(blockedKeys)
)
await page.waitForTimeout(150)

// --- the escape hatch, independently of the room browser ------------------

await page.evaluate(() => window.__amqUI.quizBuilder.useLegacy())
await page.waitForTimeout(250)
const qbHandover = await page.evaluate(() => ({
  ours: document.querySelectorAll('[data-amq-ui]')[1].style.display,
  legacyVisible: !document
    .querySelector('#customQuizCreatorPage')
    .classList.contains('hidden'),
  // The room browser must be untouched by the quiz builder's handover.
  roomBrowserStillOurs: window.viewChanger.__controllers.roomBrowser.openView
    .toString()
    .includes('callback'),
}))
check(
  'useLegacy() hands the builder back to AMQ',
  qbHandover.ours === 'none' && qbHandover.legacyVisible === true,
  `display ${qbHandover.ours}, legacy shown ${qbHandover.legacyVisible}`
)
check(
  'handing back one screen leaves the other ours',
  qbHandover.roomBrowserStillOurs
)

await page.evaluate(() => window.__amqUI.quizBuilder.useNew())
await page.waitForTimeout(250)
const qbBack = await page.evaluate(() => ({
  ours: document.querySelectorAll('[data-amq-ui]')[1].style.display,
  legacyVisible: !document
    .querySelector('#customQuizCreatorPage')
    .classList.contains('hidden'),
  rows: document
    .querySelectorAll('[data-amq-ui]')[1]
    .shadowRoot.querySelectorAll('.row').length,
}))
check(
  'useNew() brings the builder back',
  qbBack.ours !== 'none' && qbBack.rows > 0 && !qbBack.legacyVisible,
  `${qbBack.rows} rows`
)

// --- the settings panels actually have a body -----------------------------

/*
 * `flex: 1 1 0` on a scrolling body inside an auto-height column flex container
 * contributes *zero* to the container's height, so the panel collapsed to its
 * header and rendered every control at zero height. It typechecked, it threw
 * nothing, and it was invisible to every assertion that only counted elements —
 * so these measure.
 */
await qb.locator('.head .act').first().click()
await page.waitForTimeout(250)
const blockPanel = await page.evaluate(() => {
  const shadow = document.querySelectorAll('[data-amq-ui]')[1].shadowRoot
  const panel = shadow.querySelector(
    '[role="dialog"][aria-label="Rule block settings"]'
  )
  const body = panel?.querySelector('.body')
  const sections = [...(body?.querySelectorAll('section') ?? [])]
  return {
    panelHeight: Math.round(panel?.getBoundingClientRect().height ?? 0),
    bodyHeight: Math.round(body?.getBoundingClientRect().height ?? 0),
    sections: sections.length,
    // Every section must be visible, not just present in the markup.
    allVisible: sections.every(
      (section) => section.getBoundingClientRect().height > 10
    ),
    headings: sections.map((section) =>
      section.querySelector('h3')?.textContent.trim()
    ),
    // The live cap, spelled out (SPEC §9).
    capNote: body
      ?.querySelector('.note')
      ?.textContent.replace(/\s+/g, ' ')
      .trim(),
    withinViewport:
      (panel?.getBoundingClientRect().bottom ?? 0) <= window.innerHeight &&
      (panel?.getBoundingClientRect().top ?? 0) >= 0,
  }
})

check(
  'the block settings panel has a real body, not just a header',
  blockPanel.bodyHeight > 200 && blockPanel.panelHeight > 260,
  `panel ${blockPanel.panelHeight}px, body ${blockPanel.bodyHeight}px`
)
check(
  'every block settings section renders and is visible',
  blockPanel.sections === 7 && blockPanel.allVisible,
  `${blockPanel.sections} sections, all visible ${blockPanel.allVisible}`
)
// No name field: AMQ's rule blocks have no names (SPEC §9).
check(
  'the block panel has no name field',
  !blockPanel.headings.some((heading) => /name/i.test(heading ?? '')),
  blockPanel.headings.join(' | ')
)
check(
  'the song-count cap is spelled out live',
  /250-song cap/.test(blockPanel.capNote ?? ''),
  blockPanel.capNote
)
check('the block panel stays on screen', blockPanel.withinViewport)

await page.keyboard.press('Escape')
await page.waitForTimeout(200)

// The entry panel, opened the way an override chip opens it. Found by the chip
// rather than by row index — earlier sections have already changed the quiz.
await qb.locator('.row .chip').first().click()
await page.waitForTimeout(250)
const entryPanel = await page.evaluate(() => {
  const shadow = document.querySelectorAll('[data-amq-ui]')[1].shadowRoot
  const panel = shadow.querySelector(
    '[role="dialog"][aria-label="Entry settings"]'
  )
  const body = panel?.querySelector('.body')
  const sections = [...(body?.querySelectorAll('section') ?? [])]
  return {
    bodyHeight: Math.round(body?.getBoundingClientRect().height ?? 0),
    sections: sections.length,
    allVisible: sections.every(
      (section) => section.getBoundingClientRect().height > 10
    ),
    // "Use block default" is how an override is cleared — absence, not zero.
    hasClear: [...(body?.querySelectorAll('button') ?? [])].some((button) =>
      /block default/i.test(button.textContent ?? '')
    ),
    hasResetAll: /reset to block/i.test(
      panel?.querySelector('.foot')?.textContent ?? ''
    ),
  }
})
check(
  'the entry settings panel has a real body',
  entryPanel.bodyHeight > 150 && entryPanel.allVisible,
  `body ${entryPanel.bodyHeight}px, ${entryPanel.sections} sections`
)
check(
  'an override can be cleared back to the block default',
  entryPanel.hasClear && entryPanel.hasResetAll
)

await page.keyboard.press('Escape')
await page.waitForTimeout(200)

// The library filter panel, and the controls that are deliberately absent.
await qb.locator('.filter-btn').click()
await page.waitForTimeout(250)
const filterPanel = await page.evaluate(() => {
  const shadow = document.querySelectorAll('[data-amq-ui]')[1].shadowRoot
  const panel = shadow.querySelector('.panel')
  const box = panel?.getBoundingClientRect()
  const text = panel?.textContent ?? ''
  return {
    height: Math.round(box?.height ?? 0),
    groups: panel?.querySelectorAll('.group-title').length ?? 0,
    scrolls: (panel?.scrollHeight ?? 0) > (panel?.clientHeight ?? 0),
    onScreen:
      (box?.right ?? 0) <= window.innerWidth &&
      (box?.top ?? 0) >= 0 &&
      (box?.bottom ?? 0) <= window.innerHeight,
    // Dropped on purpose: none of the three is in the library payload.
    mentionsAbsent: /Difficulty, genres and tags are not filterable/.test(text),
    hasDifficultySlider: /difficulty/i.test(
      [...(panel?.querySelectorAll('.group-title') ?? [])]
        .map((element) => element.textContent)
        .join(' ')
    ),
  }
})
check(
  'the filter panel renders its groups at a real height',
  filterPanel.height > 200 && filterPanel.groups === 6,
  `${filterPanel.height}px, ${filterPanel.groups} groups`
)
check('the filter panel does not scroll', !filterPanel.scrolls)
check('the filter panel fits on screen', filterPanel.onScreen)
check(
  'difficulty is not offered as a library filter',
  !filterPanel.hasDifficultySlider
)
check(
  'the panel says which controls are absent, and why',
  filterPanel.mentionsAbsent
)

await page.keyboard.press('Escape')
await page.waitForTimeout(200)

// --- drag and drop, and the save dialog ------------------------------------

/*
 * Drag is exercised through the store's own move, not a synthesised HTML5 drag:
 * Playwright cannot drive `dragstart`/`drop` across a shadow boundary reliably,
 * and what matters here is that a positional move lands where it says it will.
 * The gesture itself is luxury — everything it does is reachable through Move.
 */
const drag = await page.evaluate(() => {
  const fresh = window.__amqUI.quizBuilder.makeStore()
  const first = fresh.quiz.blocks[0]
  const names = ['a', 'b', 'c', 'd']
  for (const name of names) {
    fresh.addEntry({
      kind: 'title',
      connectUp: false,
      locked: false,
      title: name,
    })
  }
  const order = () => first.entries.map((entry) => entry.title).join('')

  // Move the last row to the front of its own block.
  const last = first.entries[3].id
  fresh.moveEntries([last], first.id, 0)
  const withinBlock = order()

  // Move two rows to a second block, at a position.
  const second = fresh.addRuleBlock()
  fresh.addEntry(
    { kind: 'title', connectUp: false, locked: false, title: 'x' },
    second.id
  )
  fresh.addEntry(
    { kind: 'title', connectUp: false, locked: false, title: 'y' },
    second.id
  )
  fresh.moveEntries([first.entries[0].id, first.entries[1].id], second.id, 1)
  const across = second.entries.map((entry) => entry.title).join('')

  // Dropping below a row you dragged out of must not shift the target.
  const shift = window.__amqUI.quizBuilder.makeStore()
  const block = shift.quiz.blocks[0]
  for (const name of ['1', '2', '3', '4']) {
    shift.addEntry({
      kind: 'title',
      connectUp: false,
      locked: false,
      title: name,
    })
  }
  // Take row 0 and drop it before index 3 — after removal that is index 2.
  shift.moveEntries([block.entries[0].id], block.id, 3)

  return {
    withinBlock,
    across,
    shifted: block.entries.map((entry) => entry.title).join(''),
  }
})

check(
  'a positional move reorders within a block',
  drag.withinBlock === 'dabc',
  drag.withinBlock
)
check(
  'a positional move across blocks inserts at the index',
  drag.across === 'xday',
  drag.across
)
// Removing rows above the drop point shifts it; the move has to account for
// that or a drag downward inside one block lands one row short.
check(
  'dropping below a dragged row lands where the pointer was',
  drag.shifted === '2314',
  drag.shifted
)

const dragGuards = await page.evaluate(() => {
  const { dragState } = window.__amqUI.quizBuilder
  const store = window.__amqUI.quizBuilder.store
  const id = store.quiz.blocks[0].entries[0].id
  const results = {}

  // A drop with nowhere to land changes nothing rather than throwing.
  dragState.start(id)
  const before = store.quiz.blocks
    .map((block) => block.entries.length)
    .join(',')
  dragState.drop()
  results.noTargetIsNoop =
    store.quiz.blocks.map((block) => block.entries.length).join(',') === before
  results.clearedAfterDrop = dragState.ids === null

  // Dragging a row inside the selection carries the whole selection.
  store.clearSelection()
  const ids = store.flatIds.slice(0, 3)
  for (const entryId of ids) store.toggleSelected(entryId)
  dragState.start(ids[1])
  results.carriesSelection = dragState.count === 3
  dragState.cancel()

  // Dragging a row outside it replaces the selection with just that row.
  dragState.start(store.flatIds[4])
  results.replacesSelection =
    dragState.count === 1 && store.selection.size === 1
  dragState.cancel()
  store.clearSelection()

  return results
})

check('a drop with no target changes nothing', dragGuards.noTargetIsNoop)
check('the drag clears itself after a drop', dragGuards.clearedAfterDrop)
check(
  'dragging a selected row carries the whole selection',
  dragGuards.carriesSelection
)
check(
  'dragging an unselected row drags only that row',
  dragGuards.replacesSelection
)

// --- the save dialog -------------------------------------------------------

await page.evaluate(() => {
  const store = window.__amqUI.quizBuilder.store
  store.quiz.name = ''
  store.saveState = 'idle'
})
await page.evaluate(() => (window.__log.length = 0))
await qb.locator('.save').click()
await page.waitForTimeout(200)
const noName = await page.evaluate(() => ({
  dialogOpen: Boolean(
    document
      .querySelectorAll('[data-amq-ui]')[1]
      .shadowRoot.querySelector('[role="dialog"][aria-label="Save quiz"]')
  ),
  warned: window.__log.some((entry) => entry[0] === 'message'),
}))
// AMQ refuses to open its dialog without a name; a dialog whose only button is
// disabled would explain nothing.
check(
  'saving without a name warns instead of opening the dialog',
  !noName.dialogOpen && noName.warned,
  `dialog ${noName.dialogOpen ? 'opened' : 'blocked'}, warned ${noName.warned}`
)

await page.evaluate(() => {
  window.__amqUI.quizBuilder.store.quiz.name = 'Saturday night'
})
await qb.locator('.save').click()
await page.waitForTimeout(200)
const dialog = await page.evaluate(() => {
  const shadow = document.querySelectorAll('[data-amq-ui]')[1].shadowRoot
  const panel = shadow.querySelector('[role="dialog"][aria-label="Save quiz"]')
  return {
    open: Boolean(panel),
    hasDescription: Boolean(panel?.querySelector('textarea')),
    saveEnabled: panel?.querySelector('.save')?.disabled === false,
  }
})
check(
  'the save dialog opens once the quiz has a name',
  dialog.open && dialog.hasDescription && dialog.saveEnabled,
  JSON.stringify(dialog)
)

await page.evaluate(() => (window.__log.length = 0))
await qb.locator('[role="dialog"][aria-label="Save quiz"] .save').click()
await page.waitForTimeout(200)
const sent = await page.evaluate(() => {
  const command = window.__log.find((entry) => entry[0] === 'sendCommand')
  return command ? command[1] : null
})
check(
  'saving sends AMQ’s own save command',
  sent?.command === 'save quiz' && sent?.type === 'quizCreator',
  JSON.stringify(sent?.command ?? window.__log.map((entry) => entry[0]))
)
check(
  'the payload is the real save shape, built by our serializer',
  Array.isArray(sent?.data?.quizSave?.ruleBlocks) &&
    typeof sent?.data?.quizSave?.ruleBlockRandomOrder === 'boolean' &&
    sent?.data?.quizSave?.name === 'Saturday night' &&
    // No `type` tag: AMQ discriminates blocks by field presence.
    sent?.data?.quizSave?.ruleBlocks[0]?.blocks?.every(
      (entry) => entry.type === undefined
    ),
  JSON.stringify(Object.keys(sent?.data?.quizSave ?? {}))
)

// --- the anime type is an object, not a string ----------------------------

/*
 * `category` is `{ name, number }` and goes through `convertCategoryToKey`.
 * Treating it as a string threw inside a `$derived`, which aborts the render —
 * so one wrong field blanked the entire screen rather than one cell. The stub
 * used to hand over a plain `'TV'`, which is exactly why this shipped.
 */
const animeTypes = await page.evaluate(() => {
  const api = window.__amqUI.quizBuilder
  const filters = api.libraryFilters
  filters.resetAll()
  filters.setSearch('')

  const labels = api.libraryStore.rows
    .filter((row) => row.kind === 'anime')
    .map((row) => row.sub)

  // Filtering has to work off the object's `name`, folded to its locale key.
  const before = api.libraryStore.rows.filter((r) => r.kind === 'anime').length
  filters.toggle('animeType', 'tv')
  const withoutTv = api.libraryStore.rows.filter(
    (r) => r.kind === 'anime'
  ).length
  filters.toggle('animeType', 'tv')

  // A multi-word type folds to an underscored key.
  filters.toggle('animeType', 'tv_special')
  const withoutTvSpecial = api.libraryStore.rows.filter(
    (r) => r.kind === 'anime'
  ).length
  filters.toggle('animeType', 'tv_special')

  return { labels, before, withoutTv, withoutTvSpecial }
})

check(
  'the anime type renders as text, not [object Object]',
  animeTypes.labels.length > 0 &&
    animeTypes.labels.every((sub) => !sub.includes('[object')),
  animeTypes.labels[0]
)
// "TV", "TV 2", "Movie", "TV Special" — the number only when there is one.
check(
  'the anime type is localised, with its number when it has one',
  animeTypes.labels.some((sub) => sub.startsWith('TV ·')) &&
    animeTypes.labels.some((sub) => sub.startsWith('TV 2 ·')) &&
    animeTypes.labels.some((sub) => sub.startsWith('TV Special ·')),
  animeTypes.labels.join(' | ')
)
check(
  'filtering by anime type matches on the object’s name',
  animeTypes.withoutTv < animeTypes.before,
  `${animeTypes.before} → ${animeTypes.withoutTv} with TV off`
)
check(
  'a multi-word anime type folds to its underscored key',
  animeTypes.withoutTvSpecial < animeTypes.before,
  `${animeTypes.before} → ${animeTypes.withoutTvSpecial} with TV Special off`
)

// Every type the library ships needs a chip, or it can never be filtered out.
const animeTypeChips = await page.evaluate(() =>
  Object.keys(window.__amqUI.quizBuilder.libraryFilters.toggles('animeType'))
)
check(
  'every anime type AMQ ships has a filter chip',
  [
    'tv',
    'season',
    'movie',
    'ova',
    'ona',
    'tv_special',
    'special',
    'music_video',
    'doujin',
    'game_cutscene_compilation',
  ].every((key) => animeTypeChips.includes(key)),
  animeTypeChips.join(' ')
)

/*
 * Locale strings carry `_UPPERCASE_` slots that the handler fills from the data
 * you pass it. Forget the data and the slot renders literally — `Fall _YEAR_
 * 2006` shipped exactly that way, because the season and the year are one
 * phrase and I treated them as two. One assertion covers the whole class.
 */
const placeholders = await page.evaluate(() => {
  const shadow = document.querySelectorAll('[data-amq-ui]')[1].shadowRoot
  const text = shadow.textContent ?? ''
  const leaks = text.match(/_[A-Z][A-Z0-9]*_/g) ?? []
  return { leaks: [...new Set(leaks)] }
})
check(
  'no locale placeholder leaks into the rendered screen',
  placeholders.leaks.length === 0,
  placeholders.leaks.join(' ')
)

// The vintage is one localised phrase, not a season with a year stuck on it.
const vintage = await page.evaluate(() => {
  const api = window.__amqUI.quizBuilder
  return api.libraryStore.rows
    .filter((row) => row.kind === 'anime')
    .map((row) => row.sub)
})
check(
  'the vintage renders as one phrase',
  vintage.length > 0 &&
    vintage.some((sub) => /(Winter|Spring|Summer|Fall) \d{4}/.test(sub)) &&
    !vintage.some((sub) => sub.includes('_YEAR_')),
  vintage[0]
)

// --- a malformed entry must not take the pane down ------------------------

/*
 * The library payload is not ours and has already moved once. A record we
 * cannot read should cost that record, not the screen.
 */
const hostile = await page.evaluate(() => {
  const api = window.__amqUI.quizBuilder
  const cache = window.libraryCacheHandler.animeCache
  const before = api.libraryStore.rows.length

  // Shapes that would each have thrown somewhere in the pass.
  cache[999001] = { annId: 999001 }
  cache[999002] = {
    annId: 999002,
    get mainName() {
      throw new Error('boom')
    },
    names: null,
    songs: null,
  }
  cache[999003] = {
    annId: 999003,
    mainName: 'Fine',
    category: 'a string',
    songs: {},
  }
  api.bumpCache()

  let threw = null
  let after = -1
  try {
    after = api.libraryStore.rows.length
  } catch (error) {
    threw = error.message
  }
  return { before, after, threw, unreadable: api.unreadable() }
})

check(
  'a malformed library entry does not blank the pane',
  hostile.threw === null && hostile.after > 0,
  hostile.threw ?? `${hostile.before} → ${hostile.after} rows`
)
check(
  'entries we cannot read are counted for diagnosis',
  hostile.unreadable >= 1,
  `${hostile.unreadable} unreadable`
)

// --- the adjustments ------------------------------------------------------

/*
 * Earlier sections leave a dialog open (the save dialog waits on a reply the
 * stub never sends), and its scrim swallows every pointer event after it.
 * Clear the decks rather than have the next twenty assertions fail on it.
 */
await page.keyboard.press('Escape')
await page.waitForTimeout(150)
check(
  'no dialog is left open before the next section',
  (await page.evaluate(
    () =>
      document
        .querySelectorAll('[data-amq-ui]')[1]
        .shadowRoot.querySelectorAll('.scrim').length
  )) === 0
)

const adjusted = await page.evaluate(() => {
  const shadow = document.querySelectorAll('[data-amq-ui]')[1].shadowRoot
  const api = window.__amqUI.quizBuilder
  const box = (selector, root = shadow) =>
    root.querySelector(selector)?.getBoundingClientRect() ?? null

  // Watch status: the builder is for picking songs you know.
  const watch = api.libraryFilters.toggles('watchStatus')

  // The nested block's checkbox must sit level with the entry rows', or the
  // entries read as being *inside* the algorithm block.
  const entryCheck = box('.row .check input')
  const nestedCheck = box('.nested .check input')

  // The chevron sits centred in its cell.
  const lead = box('.lib-row .lead')
  const chev = box('.lib-row .chev')

  return {
    watchedOn: watch.watched,
    unwatchedOff: watch.unwatched === false,
    checkboxDelta:
      entryCheck && nestedCheck
        ? Math.round(nestedCheck.left - entryCheck.left)
        : null,
    chevronOffset:
      lead && chev
        ? Math.round(chev.left + chev.width / 2 - (lead.left + lead.width / 2))
        : null,
    // A row is only draggable until a pointer lands on one of its controls.
    rowDraggable: shadow.querySelector('.row')?.getAttribute('draggable'),
  }
})

check(
  'Unwatched is off by default, Watched on',
  adjusted.watchedOn === true && adjusted.unwatchedOff,
  `watched=${adjusted.watchedOn}, unwatched=${!adjusted.unwatchedOff}`
)
check(
  'a nested block’s checkbox is level with the entry rows’',
  adjusted.checkboxDelta === 0,
  `${adjusted.checkboxDelta}px apart`
)
check(
  'the library chevron is centred in its cell',
  adjusted.chevronOffset !== null && Math.abs(adjusted.chevronOffset) <= 1,
  `${adjusted.chevronOffset}px off centre`
)

// An unwatched anime is hidden until the filter says otherwise.
const watchFilter = await page.evaluate(() => {
  const api = window.__amqUI.quizBuilder
  const names = () =>
    api.libraryStore.rows.filter((r) => r.kind === 'anime').map((r) => r.name)
  const hidden = names().includes('Unwatched Show')
  api.libraryFilters.toggle('watchStatus', 'unwatched')
  const shown = names().includes('Unwatched Show')
  api.libraryFilters.toggle('watchStatus', 'unwatched')
  return { hidden, shown }
})
check(
  'an unwatched anime is hidden by default and returns when asked for',
  !watchFilter.hidden && watchFilter.shown
)

// --- the search box searches what AMQ's does ------------------------------

/*
 * `applySearchFilter` searches five targets, not one: anime names, song title,
 * artist, composer and arranger, with the dropdown on its default "All". A
 * search that only read anime names shipped once — it looks like the library is
 * missing half the songs in it.
 */
const search = await page.evaluate(async () => {
  const api = window.__amqUI.quizBuilder
  const filters = api.libraryFilters

  const run = (term) => {
    // Committed directly: the debounce is covered by its own test below, and
    // what matters here is the pass it defers.
    filters.state.search = term
    const rows = api.libraryStore.rows
    return {
      anime: rows
        .filter((row) => row.kind === 'anime')
        .map((row) => `${row.name} (${row.songCount})`),
      songs: rows
        .filter((row) => row.kind === 'anime')
        .flatMap((row) => row.songs.map((song) => song.songEntry.name)),
    }
  }

  const result = {
    animeName: run('angel beats'),
    altAnimeName: run('Boku dake'),
    songTitle: run('Crow Song'),
    artist: run('RADWIMPS'),
    groupMember: run('LiSA'),
    composerAltName: run('Gabriela'),
    folded: run('re re'),
    miss: run('no such thing anywhere'),
  }
  filters.setSearch('')
  return result
})

// An anime-name hit keeps the whole show, songs included.
check(
  'searching an anime name keeps all of its songs',
  search.animeName.anime.length === 1 &&
    search.animeName.anime[0] === 'Angel Beats! (6)',
  search.animeName.anime.join(', ')
)
// `searchNames` covers every name, not only the one on screen.
check(
  'searching a secondary anime name finds the show',
  search.altAnimeName.anime.length === 1 &&
    search.altAnimeName.anime[0].startsWith('Erased'),
  search.altAnimeName.anime.join(', ')
)
// The reported bug: a song title matched nothing.
check(
  'searching a song title finds the song, and only it',
  search.songTitle.anime.join() === 'Angel Beats! (1)' &&
    search.songTitle.songs.join() === 'Crow Song',
  `${search.songTitle.anime.join(', ')} → ${search.songTitle.songs.join(', ')}`
)
check(
  'searching an artist finds their songs',
  search.artist.anime.join() === 'Your Name. (3)',
  search.artist.anime.join(', ')
)
/*
 * Non-strict artist search, AMQ's default (`strictSearch` off): a group is
 * matched on its members' names too. LiSA sang for Girls Dead Monster, which is
 * what Angel Beats!'s four inserts are credited to.
 */
check(
  'searching a group member finds the group’s songs',
  search.groupMember.anime.join() === 'Angel Beats! (4)',
  search.groupMember.anime.join(', ')
)
/*
 * Composer and arranger are targets of their own, and an artist's alt names are
 * inside its `searchNames` — so Yoko Kanno is findable as Gabriela Robin, which
 * is how the library credits half of Cowboy Bebop.
 */
check(
  'searching a composer’s alt name finds their songs',
  search.composerAltName.anime.join() === 'Cowboy Bebop (2)',
  search.composerAltName.anime.join(', ')
)
/*
 * The cache stores a character-folded variant of every name beside the raw one
 * (`replaceCharactersForSeachCharacters`), which is the only reason "re re"
 * finds "Re:Re:". Reading `searchNames` rather than lowercasing the title
 * ourselves is what gets this for free.
 */
check(
  'a folded name variant is searchable',
  search.folded.songs.join() === 'Re:Re:',
  `${search.folded.anime.join(', ')} → ${search.folded.songs.join(', ')}`
)
check(
  'a search that matches nothing shows nothing',
  search.miss.anime.length === 0,
  search.miss.anime.join(', ')
)

/*
 * The New and Wrong tabs are song lists rather than anime lists, and AMQ tests
 * the anime target on each row's own show (`LibrarySongSoloEntry.searchNames`
 * delegates to the anime entry) instead of letting it decide a group of rows.
 * Same five targets, so both of these must find the same two songs.
 */
const songTabSearch = await page.evaluate(async () => {
  const api = window.__amqUI.quizBuilder
  const filters = api.libraryFilters
  filters.setTab('new')

  const titles = (term) => {
    filters.state.search = term
    return api.libraryStore.rows
      .filter((row) => row.kind === 'song')
      .map((row) => `${row.animeName} · ${row.title}`)
      .sort()
  }

  const result = { byGroup: titles('Seatbelts'), byAnime: titles('Cowboy') }
  // Back to the library tab: everything after this asserts against anime rows.
  filters.setSearch('')
  filters.setTab('library')
  return result
})
check(
  'the song tabs search the same five targets',
  songTabSearch.byGroup.join() ===
    'Cowboy Bebop · Tank!,Cowboy Bebop · The Real Folk Blues' &&
    songTabSearch.byAnime.join() === songTabSearch.byGroup.join(),
  `artist ${songTabSearch.byGroup.length}, anime ${songTabSearch.byAnime.length}`
)

// Pressing the pick slider must move the handle, not drag the row away.
//
// Dispatched rather than clicked: the range input is `pointer-events: none`
// except for its thumb, so a synthetic hover cannot land on it — and it is the
// handler's reaction to the press that matters, not the pixel it lands on.
const dragArming = await page.evaluate(() => {
  const shadow = document.querySelectorAll('[data-amq-ui]')[1].shadowRoot
  const row = shadow.querySelector('.row')
  const press = (element) => {
    element.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, composed: true })
    )
    return row.getAttribute('draggable')
  }
  const release = () =>
    row.dispatchEvent(
      new PointerEvent('pointerup', { bubbles: true, composed: true })
    )

  const onSlider = press(row.querySelector('.pick .rng'))
  release()
  const onCheckbox = press(row.querySelector('.check input'))
  release()
  const onGrip = press(row.querySelector('.grip'))
  release()
  const afterRelease = row.getAttribute('draggable')
  return { onSlider, onCheckbox, onGrip, afterRelease }
})
check(
  'pressing the pick slider does not arm a row drag',
  dragArming.onSlider === 'false',
  `draggable=${dragArming.onSlider}`
)
check(
  'pressing a checkbox does not arm a row drag either',
  dragArming.onCheckbox === 'false',
  `draggable=${dragArming.onCheckbox}`
)
check(
  'the grip still drags the row',
  dragArming.onGrip === 'true' && dragArming.afterRelease === 'true',
  `grip=${dragArming.onGrip}, after release=${dragArming.afterRelease}`
)

// The slider itself still changes the value.
const sliderMoves = await page.evaluate(() => {
  const shadow = document.querySelectorAll('[data-amq-ui]')[1].shadowRoot
  const input = shadow.querySelector('.row .pick .rng')
  if (!input) return null
  const before = Number(input.value)
  input.value = String(before === 1 ? 2 : 1)
  input.dispatchEvent(new Event('input', { bubbles: true }))
  const store = window.__amqUI.quizBuilder.store
  const entry = store.quiz.blocks[0].entries.find((e) => e.kind === 'anime')
  return { before, after: entry?.numberOfSongs }
})
check(
  'the pick slider writes through to the model',
  sliderMoves && sliderMoves.after !== sliderMoves.before,
  JSON.stringify(sliderMoves)
)

// Empty genre/tag chips are noise on an already dense row.
const emptyChips = await page.evaluate(() => {
  const shadow = document.querySelectorAll('[data-amq-ui]')[1].shadowRoot
  const labels = [...shadow.querySelectorAll('.nested .chip')].map((chip) =>
    chip.textContent.trim()
  )
  return { labels, zeroes: labels.filter((l) => /^0 (Genres?|Tags?)$/.test(l)) }
})
check(
  'an algorithm block with no genres or tags shows no chip for them',
  emptyChips.zeroes.length === 0,
  emptyChips.labels.join(' | ')
)

// Duplicating a nested block works — it was silently throwing on a state proxy.
const duplicated = await page.evaluate(() => {
  // A fresh store: the caps section above has already filled this quiz's
  // algorithm quota, and refusing to duplicate past a cap is correct.
  const store = window.__amqUI.quizBuilder.makeStore()
  store.addEntry({
    kind: 'algorithm',
    connectUp: false,
    locked: false,
    settings: { numberOfSongs: 5, genre: [], tags: [] },
    overrides: {},
  })
  const block = store.quiz.blocks.find((b) =>
    b.entries.some((e) => e.kind === 'algorithm')
  )
  const target = block.entries.find((e) => e.kind === 'algorithm')
  const before = block.entries.length
  store.duplicateEntries([target.id])
  const after = block.entries.length
  const copy = block.entries.filter((e) => e.kind === 'algorithm')
  return {
    before,
    after,
    distinctIds: new Set(copy.map((e) => e.id)).size === copy.length,
    settingsCopied:
      copy.length > 1 &&
      JSON.stringify(copy[0].settings) === JSON.stringify(copy[1].settings) &&
      copy[0].settings !== copy[1].settings,
  }
})
check(
  'duplicating an algorithm block adds a real, independent copy',
  duplicated.after === duplicated.before + 1 &&
    duplicated.distinctIds &&
    duplicated.settingsCopied,
  JSON.stringify(duplicated)
)

// --- menus close ----------------------------------------------------------

const floatingCount = () =>
  page.evaluate(
    () =>
      document
        .querySelectorAll('[data-amq-ui]')[1]
        .shadowRoot.querySelectorAll('.floating').length
  )

// A menu that never closes does not merely linger — it sits over the page
// swallowing every later click, so the whole screen reads as broken.
await qb.locator('.row .act.menu').first().click()
await page.waitForTimeout(150)
const menuOpened = await floatingCount()
await qb.locator('.row .act.menu').first().click()
await page.waitForTimeout(150)
const menuToggledShut = await floatingCount()
check(
  'the ⋯ menu opens, and its own button closes it again',
  menuOpened > 0 && menuToggledShut === 0,
  `${menuOpened} open → ${menuToggledShut}`
)

await qb.locator('.row .act.menu').first().click()
await page.waitForTimeout(150)
// Click somewhere inert — the quiz pane's header.
await qb.locator('.band .title').last().click()
await page.waitForTimeout(150)
check(
  'clicking outside closes the ⋯ menu',
  (await floatingCount()) === 0,
  `${await floatingCount()} still open`
)

await qb.locator('.filter-btn').click()
await page.waitForTimeout(150)
const filtersOpened = await floatingCount()
await qb.locator('.filter-btn').click()
await page.waitForTimeout(150)
check(
  'the filter panel toggles from its own button',
  filtersOpened > 0 && (await floatingCount()) === 0,
  `${filtersOpened} open → ${await floatingCount()}`
)

await qb.locator('.adds-to .target').click()
await page.waitForTimeout(150)
const pickerOpened = await floatingCount()
await page.mouse.click(900, 940)
await page.waitForTimeout(150)
check(
  'clicking outside closes the block picker',
  pickerOpened > 0 && (await floatingCount()) === 0,
  `${pickerOpened} open → ${await floatingCount()}`
)

// --- Undo reverts to the last saved state ---------------------------------

const undoState = await page.evaluate(() => {
  const shadow = document.querySelectorAll('[data-amq-ui]')[1].shadowRoot
  const button = [...shadow.querySelectorAll('.quiet')].find(
    (element) => element.textContent.trim() === 'Undo'
  )
  return { present: Boolean(button), disabled: button?.disabled }
})
check(
  'Undo is enabled once the quiz has unsaved changes',
  undoState.present && undoState.disabled === false,
  `present=${undoState.present}, disabled=${undoState.disabled}`
)

// --- ids are unique across loaded and added entries ------------------------

/*
 * The serializer and the store used to have separate id counters, so a quiz
 * loaded from the server produced `anime-5` and the next entry you added
 * produced `anime-5` too. Selection is by id, so clicking one row's settings
 * opened the panel on "2 entries".
 */
const ids = await page.evaluate(() => {
  const api = window.__amqUI.quizBuilder
  const store = api.makeStore()
  // A loaded quiz, then entries added on top of it — the collision case.
  const loaded = api.fromSave(window.__quizRoundTrip)
  store.quiz = loaded
  const added = []
  for (let index = 0; index < 5; index += 1) {
    added.push(
      store.addEntry(
        { kind: 'title', connectUp: false, locked: false, title: `t${index}` },
        loaded.blocks[0].id
      ).id
    )
  }
  const all = [
    ...loaded.blocks.map((block) => block.id),
    ...loaded.blocks.flatMap((block) => block.entries.map((e) => e.id)),
  ]
  const duplicates = all.filter((id, index) => all.indexOf(id) !== index)
  return { total: all.length, unique: new Set(all).size, duplicates, added }
})
check(
  'ids are unique across loaded and newly added entries',
  ids.unique === ids.total && ids.duplicates.length === 0,
  ids.duplicates.length ? ids.duplicates.join(' ') : `${ids.total} ids`
)

// Opening one row's settings must say so, not report a phantom second row.
await page.keyboard.press('Escape')
await page.waitForTimeout(150)
await qb.locator('.row .act.settings').first().click()
await page.waitForTimeout(250)
const oneEntry = await page.evaluate(() => {
  const shadow = document.querySelectorAll('[data-amq-ui]')[1].shadowRoot
  const panel = shadow.querySelector(
    '[role="dialog"][aria-label="Entry settings"]'
  )
  return {
    open: Boolean(panel),
    heading: panel?.querySelector('h2')?.textContent.trim() ?? null,
    footer: panel?.querySelector('.done')?.textContent.trim() ?? null,
  }
})
check(
  'the settings panel for one row says so',
  oneEntry.open && oneEntry.heading === 'Entry settings',
  `heading "${oneEntry.heading}", footer "${oneEntry.footer}"`
)
await page.keyboard.press('Escape')
await page.waitForTimeout(150)

// --- Undo and Reset are both there, and differ -----------------------------

const topBarButtons = await page.evaluate(() => {
  const shadow = document.querySelectorAll('[data-amq-ui]')[1].shadowRoot
  const all = [...shadow.querySelectorAll('.bar .quiet')]
  return all.map((button) => ({
    label: button.textContent.trim(),
    disabled: button.disabled,
  }))
})
check(
  'the top bar carries both Undo and Reset',
  topBarButtons.some((b) => b.label === 'Undo') &&
    topBarButtons.some((b) => b.label === 'Reset'),
  topBarButtons.map((b) => b.label).join(' | ')
)

const undoVsReset = await page.evaluate(() => {
  const store = window.__amqUI.quizBuilder.makeStore()
  const block = store.quiz.blocks[0]
  const depths = []
  for (const title of ['one', 'two', 'three']) {
    store.addEntry({ kind: 'title', connectUp: false, locked: false, title })
    depths.push(store.undoDepth)
  }
  const afterAdds = block.entries.length

  store.undo()
  // Undo swaps the whole document, so the reference above now points into the
  // discarded tree — re-read from the store, as a component would.
  const afterOneUndo = store.quiz.blocks[0].entries.length
  const dirtyAfterUndo = store.dirty

  store.revert()
  const afterReset = store.quiz.blocks[0].entries.length

  return {
    depths,
    afterAdds,
    afterOneUndo,
    dirtyAfterUndo,
    afterReset,
    cleanAfterReset: store.dirty === false,
    depthAfterReset: store.undoDepth,
  }
})
// Undo steps back one change at a time; Reset throws the lot away.
check(
  'Undo steps back one change at a time',
  JSON.stringify(undoVsReset.depths) === JSON.stringify([1, 2, 3]) &&
    undoVsReset.afterAdds === 3 &&
    undoVsReset.afterOneUndo === 2 &&
    undoVsReset.dirtyAfterUndo === true,
  JSON.stringify(undoVsReset)
)
check(
  'Reset discards everything back to the saved state',
  undoVsReset.afterReset === 0 &&
    undoVsReset.cleanAfterReset &&
    undoVsReset.depthAfterReset === 0,
  JSON.stringify(undoVsReset)
)

// --- the adjustments, part two ---------------------------------------------

// Earlier sections replaced every algorithm block's settings with a bare
// `numberOfSongs`, which correctly produces no pool chips — give one back a
// real filter set so there is something to measure.
await page.evaluate(() => {
  const store = window.__amqUI.quizBuilder.store
  for (const block of store.quiz.blocks) {
    const algorithm = block.entries.find((entry) => entry.kind === 'algorithm')
    if (!algorithm) continue
    algorithm.settings = {
      numberOfSongs: 5,
      songSelection: { advancedValue: { watched: 5, unwatched: 0, random: 0 } },
      songType: {
        standardValue: { openings: true, endings: true, inserts: false },
      },
      songDifficulity: { advancedOn: true, advancedValue: [0, 60] },
      vintage: {
        standardValue: { years: [1944, 2026] },
        advancedValueList: [],
      },
      genre: [],
      tags: [],
    }
    break
  }
})
await page.waitForTimeout(200)

const layout2 = await page.evaluate(() => {
  const shadow = document.querySelectorAll('[data-amq-ui]')[1].shadowRoot
  const root = shadow.querySelector('.amq-ui-root')
  const style = getComputedStyle(root)
  const row = shadow.querySelector('.row')
  const anime = row?.querySelector('.anime')?.getBoundingClientRect()
  const song = row?.querySelector('.song')?.getBoundingClientRect()
  // The caps section above added bare algorithm blocks with no pool chips;
  // measure one that actually has them.
  const nested = [...shadow.querySelectorAll('.nested')].find((element) =>
    element.querySelector('.chips')
  )
  const nestedLine = nested?.querySelector('.line')?.getBoundingClientRect()
  const nestedChips = nested?.querySelector('.chips')?.getBoundingClientRect()
  const match = nested?.querySelector('.match')?.getBoundingClientRect()
  return {
    animeWidth: anime ? Math.round(anime.width) : null,
    songWidth: song ? Math.round(song.width) : null,
    // The chips sit on the summary line, not on a row of their own.
    chipsOnSameLine:
      nestedChips && match ? Math.abs(nestedChips.top - match.top) < 14 : null,
    nestedHeight: nested
      ? Math.round(nested.getBoundingClientRect().height)
      : null,
    lineHeight: nestedLine ? Math.round(nestedLine.height) : null,
    // Row text is set against AMQ's own creator, which uses 16px.
    rowText: style.getPropertyValue('--qb-text').trim(),
    scrollbarColor: style.scrollbarColor.trim(),
    scrollbarWidth: style.scrollbarWidth.trim(),
  }
})

// Both text columns flex, so neither truncates while the other sits empty.
check(
  'the anime and song columns share the slack',
  layout2.animeWidth > 0 &&
    layout2.songWidth > 0 &&
    Math.abs(layout2.animeWidth - layout2.songWidth) <= 2,
  `anime ${layout2.animeWidth}px, song ${layout2.songWidth}px`
)
// One line, not two: the chips take the slack between the summary and the
// action buttons rather than a row of their own.
check(
  'an algorithm block’s chips sit on its summary line',
  layout2.chipsOnSameLine === true &&
    layout2.nestedHeight === layout2.lineHeight,
  `same line ${layout2.chipsOnSameLine}, block ${layout2.nestedHeight}px, line ${layout2.lineHeight}px`
)
// AMQ's own creator sets its blocks in 16px; 11.5px read as cramped beside it.
check(
  'row text is scaled to sit beside the rest of the game',
  parseFloat(layout2.rowText) >= 14,
  layout2.rowText
)
check(
  'scrollbars are themed, not left as the browser default',
  layout2.scrollbarWidth === 'thin' && layout2.scrollbarColor.includes('rgba'),
  `${layout2.scrollbarWidth}, ${layout2.scrollbarColor}`
)

// --- the library at real scale --------------------------------------------

/*
 * The fixture library is four anime; the real one is tens of thousands, and
 * this pane filters it on every keystroke. Measured here rather than assumed,
 * because the failure mode is a search box that feels broken rather than one
 * that looks wrong — no screenshot or element count would show it.
 */
const scale = await page.evaluate(async () => {
  const cache = {}
  let nextSongId = 500000
  const WORDS = ['Steel', 'Moon', 'Garden', 'Blade', 'Echo', 'Prism', 'Vessel']
  for (let index = 0; index < 20000; index += 1) {
    const annId = 100000 + index
    const make = (type, number) => {
      nextSongId += 1
      return {
        annSongId: nextSongId,
        annId,
        type,
        number,
        playerLikeStatus: 0,
        wrongIndex: null,
        uploaded: true,
        rebroadcast: false,
        dub: false,
        songEntry: {
          songId: nextSongId,
          name: `Song ${nextSongId}`,
          category: 4,
          artist: { name: 'Artist' },
        },
      }
    }
    const name = `${WORDS[index % WORDS.length]} ${index}`
    cache[annId] = {
      annId,
      category: 'TV',
      year: 1990 + (index % 35),
      seasonId: index % 4,
      mainNames: { EN: name },
      names: [{ name }],
      watched: true,
      songs: { OP: [make(1, 1)], ED: [make(2, 1)], INS: [make(3, 1)] },
      get mainName() {
        return this.mainNames.EN
      },
    }
  }
  window.libraryCacheHandler.animeCache = cache

  const api = window.__amqUI.quizBuilder
  const store = api.libraryStore
  const filters = api.libraryFilters

  const time = (run) => {
    const start = performance.now()
    run()
    return performance.now() - start
  }

  // Count `localeCompare` rather than timing it: a count is the same on a
  // loaded machine as on an idle one, and it is the sort being *repeated*
  // that the hoist exists to prevent.
  //
  // Installed *before* the cache bump: the rendered pane reads `rows` as soon
  // as the bump invalidates it, so a counter installed afterwards measures an
  // already-cached derivation and reports a confident zero.
  const nativeCompare = String.prototype.localeCompare
  let comparisons = 0
  String.prototype.localeCompare = function (...args) {
    comparisons += 1
    return nativeCompare.apply(this, args)
  }

  // Force the cache-revision bump the real load would cause.
  window.__amqUI.quizBuilder.bumpCache()
  await new Promise((resolve) => setTimeout(resolve, 0))

  // The first read pays for the sort — that is expected, and proves the
  // counter is wired to something.
  const firstRead = time(() => store.rows.length)
  const sortsOnLoad = comparisons

  // Four distinct terms, so each genuinely re-runs the filter. None of them
  // should re-run the sort.
  comparisons = 0
  const searches = []
  for (const term of ['Steel', 'Moon 1', 'Garden 12', 'Blade 123']) {
    // Commit directly: the debounce is about typing latency, and what is being
    // measured here is the cost of the pass it defers.
    filters.state.search = term
    searches.push(time(() => store.rows.length))
  }
  const sortsDuringSearch = comparisons
  String.prototype.localeCompare = nativeCompare

  // Back to an unfiltered list for the cap assertions below.
  filters.setSearch('')
  const rows = store.rows.length
  const total = store.total
  return {
    firstRead,
    sortsOnLoad,
    sortsDuringSearch,
    worstSearch: Math.max(...searches),
    rows,
    total,
    capped: store.capped,
  }
})

/*
 * No absolute latency gate here. This runs in a browser that has already done a
 * lot of work, and the same code measured 120ms and 339ms on consecutive runs —
 * a threshold that loose catches nothing, and one that tight fails at random.
 * The wall-clock gate lives in the live suite, where it measures the real
 * library on a fresh page and sits steadily around 12ms.
 *
 * What is asserted here is the *structure* that made it fast, which is
 * deterministic: the sort is hoisted behind the cache revision, so a search
 * re-runs only the filter.
 */
console.log(
  `  (20k-anime search: ${scale.worstSearch.toFixed(0)}ms worst, ` +
    `${scale.firstRead.toFixed(0)}ms first read — indicative only)`
)
/*
 * The sort is the expensive part and it is hoisted behind the cache revision,
 * so it must run once for the load and not again per search. Asserted by
 * counting `localeCompare` calls rather than by timing them — a count is the
 * same on a loaded machine as on an idle one.
 */
check(
  'the library is sorted once, when it loads',
  scale.sortsOnLoad > 0,
  `${scale.sortsOnLoad} comparisons on first read`
)
check(
  'searching does not re-sort the whole library',
  scale.sortsDuringSearch === 0,
  `${scale.sortsDuringSearch} comparisons across four searches`
)
// Typing must stay responsive even though the pass behind it is expensive.
const debounce = await page.evaluate(async () => {
  const filters = window.__amqUI.quizBuilder.libraryFilters
  filters.setSearch('')
  filters.setSearch('Steel 99')
  const immediate = {
    draft: filters.draft,
    committed: filters.search,
  }
  await new Promise((resolve) => setTimeout(resolve, 250))
  const settled = filters.search
  filters.setSearch('')
  return { immediate, settled, clearedAtOnce: filters.search === '' }
})
check(
  'the search field updates at once but the filter waits',
  debounce.immediate.draft === 'Steel 99' &&
    debounce.immediate.committed === '' &&
    debounce.settled === 'Steel 99',
  `draft "${debounce.immediate.draft}", committed "${debounce.immediate.committed}" → "${debounce.settled}"`
)
// Clearing should feel like undoing, not like waiting.
check('clearing the search applies immediately', debounce.clearedAtOnce)

check(
  'the rendered list is capped, and says what it is capping',
  scale.rows <= 300 && scale.total === 20000 && scale.capped,
  `${scale.rows} of ${scale.total}`
)

// --- report ----------------------------------------------------------------

await browser.close()
server.close()

const failed = printResults()
console.log(`screenshots in ${path.relative(process.cwd(), shots)}/`)
process.exit(failed ? 1 : 0)
