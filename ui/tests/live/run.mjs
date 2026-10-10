/*
 * The live suite: the built userscript, running on animemusicquiz.com, against
 * a real account's real library and real saved quizzes.
 *
 *   npm run test:live            # assert, headless
 *   npm run test:live -- --headed
 *
 * **Read-only.** Nothing here saves, deletes, publishes or hosts anything.
 * Every question worth asking — does the library payload still match our
 * typings, do real quizzes round-trip byte-for-byte — is answerable without a
 * single write, and a quiz saved by a test is one the account owner has to go
 * and clean up. Writes are gated behind AMQ_LIVE_ALLOW_WRITES=1 and, for now,
 * nothing uses it.
 *
 * This is deliberately *not* part of `npm test`. That suite has to stay fast,
 * offline and deterministic; this one needs the network, a login and patience.
 */

import fs from 'node:fs'
import path from 'node:path'
import { repo } from '../../../shared/node/env.ts'
import {
  LIBRARY_TIMEOUT_MS,
  openSession,
  request,
} from '../../../shared/node/session.ts'

/**
 * Whether the run may change anything on the account.
 *
 * Off unless asked for, and deliberately awkward to turn on. Everything these
 * tests need — the library payload, the serializer round-trip against real
 * quizzes — is answerable without a single write, and a quiz saved by a test
 * is a quiz the account owner then has to clean up.
 */
const allowWrites = process.env.AMQ_LIVE_ALLOW_WRITES === '1'

const headed = process.argv.includes('--headed')
const shots = path.join(repo, 'ui', 'tests', 'screenshots', 'live')
fs.mkdirSync(shots, { recursive: true })

const userscriptPath = path.join(repo, 'dist', 'amq-ui.user.js')
if (!fs.existsSync(userscriptPath)) {
  console.error('dist/amq-ui.user.js is missing — run `npm run build` first.')
  process.exit(1)
}
const userscript = fs.readFileSync(userscriptPath, 'utf8')

const results = []
const check = (label, pass, detail = '') =>
  results.push({ label, pass, detail })

/**
 * A check that could not run because a precondition was missing.
 *
 * Distinct from a failure — nothing is broken — but loud, because a skipped
 * check verifies nothing and the quiet ones are how a suite ends up green and
 * meaningless.
 */
const skip = (label, why) => results.push({ label, skipped: true, detail: why })

function printResults() {
  let failed = 0
  let skipped = 0
  for (const { label, pass, detail, skipped: wasSkipped } of results) {
    if (wasSkipped) skipped++
    else if (!pass) failed++
    const tag = wasSkipped ? 'SKIP' : pass ? 'OK  ' : 'FAIL'
    console.log(`${tag} ${label}${detail ? ` — ${detail}` : ''}`)
  }
  const ran = results.length - skipped
  console.log(
    `\n${ran - failed}/${ran} passed${skipped ? `, ${skipped} skipped` : ''}`
  )
  if (skipped) {
    console.log('\nSkipped checks verified nothing — see the reasons above.')
  }
  return failed
}

let session
process.on('uncaughtException', async (error) => {
  console.log('\n--- crashed mid-suite; results so far ---\n')
  printResults()
  console.log(`\nthen: ${error.message}`)
  await session?.browser.close().catch(() => {})
  process.exit(1)
})

console.log('logging in to animemusicquiz.com…')
// The test account only: this suite can write, and takes the session over.
session = await openSession({
  headed,
  userscript,
  accounts: ['AMQ_TEST_ACCOUNT'],
})
const { page, pageErrors } = session
console.log('logged in')

if (allowWrites) {
  console.log('AMQ_LIVE_ALLOW_WRITES is set, but no test writes anything.')
}

// --- the script boots on the real page ------------------------------------

await page.waitForFunction(() => window.__amqUI !== undefined, {
  timeout: 60_000,
})
const boot = await page.evaluate(() => ({
  api: typeof window.__amqUI === 'object',
  failed: window.__amqUIFailed ? String(window.__amqUIFailed) : null,
  quizBuilder: typeof window.__amqUI?.quizBuilder === 'object',
  controllerIsOurs: Object.prototype.hasOwnProperty.call(
    window.viewChanger.__controllers.customQuizCreator,
    'openView'
  ),
}))
check(
  'the userscript boots on the real site',
  boot.api && !boot.failed,
  boot.failed ?? ''
)
check('the quiz builder devtools are exposed', boot.quizBuilder)
// Replacing the controller leaves the original on the prototype chain, so the
// own-property check is what distinguishes ours from AMQ's.
check('the quiz builder screen is installed', boot.controllerIsOurs)

// --- the library: does the real payload still match our typings? ----------

console.log('loading the song library (this is the slow part)…')
const libraryStart = Date.now()
await page.evaluate(
  (timeout) =>
    Promise.race([
      window.__amqUI.quizBuilder.libraryStore.load(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('library load timed out')), timeout)
      ),
    ]),
  LIBRARY_TIMEOUT_MS
)
const librarySeconds = ((Date.now() - libraryStart) / 1000).toFixed(1)

const library = await page.evaluate(() => {
  const api = window.__amqUI.quizBuilder
  const cache = window.libraryCacheHandler.animeCache
  const entries = Object.values(cache)
  const sample = entries.slice(0, 400)

  const shape = {
    categoryObjects: 0,
    categoryOther: 0,
    yearNumbers: 0,
    seasonNumbers: 0,
    withSongs: 0,
    uploadedSongs: 0,
    artistNames: 0,
    songsChecked: 0,
    animeSearchNames: 0,
    songEntries: 0,
    songSearchNames: 0,
    memberLists: 0,
    composers: 0,
    arrangers: 0,
  }
  for (const anime of sample) {
    const category = anime.category
    if (category && typeof category === 'object' && 'name' in category) {
      shape.categoryObjects += 1
    } else if (category !== undefined) {
      shape.categoryOther += 1
    }
    if (typeof anime.year === 'number') shape.yearNumbers += 1
    if (typeof anime.seasonId === 'number') shape.seasonNumbers += 1
    if (Array.isArray(anime.searchNames) && anime.searchNames.length) {
      shape.animeSearchNames += 1
    }
    const songs = [
      ...(anime.songs?.OP ?? []),
      ...(anime.songs?.ED ?? []),
      ...(anime.songs?.INS ?? []),
    ]
    if (songs.length) shape.withSongs += 1
    for (const song of songs) {
      shape.songsChecked += 1
      if (song.uploaded) shape.uploadedSongs += 1
      const entry = song.songEntry
      if (entry) shape.songEntries += 1
      if (entry?.artist?.name) shape.artistNames += 1
      if (Array.isArray(entry?.searchNames) && entry.searchNames.length) {
        shape.songSearchNames += 1
      }
      if (typeof entry?.artist?.getFullMemberEntryList === 'function') {
        shape.memberLists += 1
      }
      if (entry?.composer?.name) shape.composers += 1
      if (entry?.arranger?.name) shape.arrangers += 1
    }
  }

  shape.sampleSize = sample.length

  return {
    animeCount: entries.length,
    loaded: api.libraryStore.loaded,
    broken: api.libraryStore.broken,
    unreadable: api.unreadable(),
    shape,
    rows: api.libraryStore.rows.length,
    total: api.libraryStore.total,
    animeTotal: api.libraryStore.animeTotal,
    songTotal: api.libraryStore.songTotal,
  }
})

check(
  'the song library loads from the real server',
  library.loaded && library.animeCount > 1000,
  `${library.animeCount} anime in ${librarySeconds}s`
)
/*
 * The single most valuable assertion here. `unreadable` counts entries whose
 * shape our code could not read at all; a non-zero value means the payload has
 * moved and `src/typings/amq.d.ts` is out of date. No offline stub can tell us
 * this, because an offline stub is just our own assumptions played back.
 */
check(
  'every library entry matches the shape we expect',
  library.unreadable === 0 && !library.broken,
  `${library.unreadable} unreadable, broken=${library.broken}`
)
check(
  'an anime type is the { name, number } object we type it as',
  library.shape.categoryObjects > 0 && library.shape.categoryOther === 0,
  `${library.shape.categoryObjects} objects, ${library.shape.categoryOther} other`
)
check(
  'year and seasonId are numbers',
  library.shape.yearNumbers > 0 && library.shape.seasonNumbers > 0,
  `${library.shape.yearNumbers} years, ${library.shape.seasonNumbers} seasons`
)
check(
  'songs carry an uploaded flag and a resolved artist',
  library.shape.uploadedSongs > 0 && library.shape.artistNames > 0,
  `${library.shape.uploadedSongs}/${library.shape.songsChecked} uploaded, ` +
    `${library.shape.artistNames} with an artist`
)
/*
 * Search reads `searchNames` rather than lowercasing names per keystroke, and
 * those arrays are built by the client, not sent by the server — so a rename
 * would cost the character folding that makes "re re" find "Re:Re:" and fall
 * back to a worse search without a word. There is no offline way to notice.
 */
check(
  'anime and songs carry the precomputed searchNames our search reads',
  library.shape.animeSearchNames === library.shape.sampleSize &&
    library.shape.songSearchNames === library.shape.songEntries,
  `${library.shape.animeSearchNames}/${library.shape.sampleSize} anime, ` +
    `${library.shape.songSearchNames}/${library.shape.songEntries} songs`
)
/*
 * The other three search targets. `getFullMemberEntryList` is what makes an
 * artist search non-strict — AMQ's default — so a group matches on its
 * members' names; composer and arranger are targets of their own.
 */
check(
  'credits expose their member list, and composers and arrangers exist',
  library.shape.memberLists > 0 &&
    library.shape.composers > 0 &&
    library.shape.arrangers > 0,
  `${library.shape.memberLists} member lists, ` +
    `${library.shape.composers} composers, ${library.shape.arrangers} arrangers`
)
check(
  'the library pane has rows to draw',
  library.rows > 0 && library.animeTotal > 0 && library.songTotal > 0,
  `${library.rows} rows of ${library.total}; ${library.animeTotal} anime, ${library.songTotal} songs`
)

// --- names, not ids -------------------------------------------------------

const naming = await page.evaluate(() => {
  const api = window.__amqUI.quizBuilder
  const rows = api.libraryStore.rows.slice(0, 200)
  const anime = rows.filter((row) => row.kind === 'anime')
  return {
    sampled: anime.length,
    idFallbacks: anime.filter((row) => /^Anime #\d+$/.test(row.name)).length,
    objectLabels: anime.filter((row) => row.sub.includes('[object')).length,
    allZeroCounts: anime.filter((row) => /OP 0 · ED 0 · IN 0/.test(row.sub))
      .length,
    examples: anime.slice(0, 3).map((row) => `${row.name} — ${row.sub}`),
  }
})
check(
  'library rows show real names, not id fallbacks',
  naming.sampled > 0 && naming.idFallbacks === 0,
  `${naming.idFallbacks} of ${naming.sampled} fell back`
)
check(
  'anime types render as text',
  naming.objectLabels === 0,
  naming.examples[0] ?? ''
)
check(
  'song counts are populated',
  naming.sampled > 0 && naming.allZeroCounts < naming.sampled,
  naming.examples.join(' | ')
)

// --- the serializer, against this account's real saved quizzes ------------

console.log("loading the account's quizzes…")
const quizList = await request(page, {
  type: 'quizCreator',
  command: 'load player quizzes',
  reply: 'load custom quizzes',
  data: { loadId: 1 },
  matchField: 'loadId',
  matchValue: 1,
  timeout: 60_000,
})

const quizIds = (quizList.quizzes ?? [])
  .map((quiz) => quiz.quizId ?? quiz.id)
  .filter((id) => typeof id === 'number')

check(
  "the account's quiz list loads",
  Array.isArray(quizList.quizzes),
  `${quizIds.length} quizzes`
)

if (quizIds.length === 0 && !allowWrites) {
  skip(
    'a real quiz round-trips through the serializer',
    'the account has no saved quizzes. Save one in AMQ, or run with ' +
      'AMQ_LIVE_ALLOW_WRITES=1 to have the suite create and delete a throwaway one'
  )
} else if (quizIds.length > 0) {
  const roundTrips = []
  for (const quizId of quizIds.slice(0, 10)) {
    const payload = await request(page, {
      type: 'quizCreator',
      command: 'load custom quiz',
      reply: 'load custom quiz',
      data: { quizId },
      matchField: 'quizId',
      matchValue: quizId,
      timeout: 60_000,
    })
    if (payload.failed || !payload.quizSave) {
      roundTrips.push({ quizId, ok: false, why: 'server refused the load' })
      continue
    }
    const result = await page.evaluate((save) => {
      const api = window.__amqUI.quizBuilder
      // The server enriches a load with fields no save carries — `annSongIds`,
      // `matchSongCount`, `version`. Dropping them is the correct behaviour,
      // so the comparison drops them too.
      const fields = api.serverOnlyFields
      const expected = JSON.parse(JSON.stringify(save))
      for (const key of fields.quiz) delete expected[key]
      for (const block of expected.ruleBlocks ?? []) {
        for (const key of fields.block) delete block[key]
        for (const entry of block.blocks ?? []) {
          for (const key of fields.entry) delete entry[key]
        }
      }
      const sortKeys = (value) => {
        if (Array.isArray(value)) return value.map(sortKeys)
        if (value && typeof value === 'object') {
          return Object.keys(value)
            .sort()
            .reduce((out, key) => ((out[key] = sortKeys(value[key])), out), {})
        }
        return value
      }
      try {
        const actual = api.roundTrip(save)
        const a = JSON.stringify(sortKeys(actual))
        const b = JSON.stringify(sortKeys(expected))
        if (a === b) return { ok: true }
        // Report a bounded slice rather than dumping two large payloads.
        return {
          ok: false,
          why: 'differs',
          actual: a.slice(0, 400),
          expected: b.slice(0, 400),
        }
      } catch (error) {
        return { ok: false, why: error.message }
      }
    }, payload.quizSave)
    roundTrips.push({ quizId, ...result })
  }

  const bad = roundTrips.filter((entry) => !entry.ok)
  check(
    'every real saved quiz round-trips byte-for-byte',
    bad.length === 0,
    bad.length
      ? bad.map((entry) => `#${entry.quizId}: ${entry.why}`).join('; ')
      : `${roundTrips.length} quizzes`
  )
  if (bad.length > 0) {
    console.log('\nfirst mismatch:')
    console.log('  ours:   ', bad[0].actual)
    console.log('  theirs: ', bad[0].expected)
  }
}

// --- end-to-end: save a quiz, read it back, delete it ---------------------

/*
 * The only check that proves the *whole* path — our model out through AMQ's
 * `save quiz`, into the server, and back through `load custom quiz`. Everything
 * above verifies one half or the other.
 *
 * It writes, so it is off unless AMQ_LIVE_ALLOW_WRITES=1, and it cleans up
 * after itself. The name is stamped so an abandoned one is obvious.
 */
if (!allowWrites) {
  skip(
    'a quiz survives a real save and reload',
    'writes are off; set AMQ_LIVE_ALLOW_WRITES=1 to enable (creates and then deletes one quiz)'
  )
} else {
  const stamp = new Date()
    .toISOString()
    .replace(/[^0-9]/g, '')
    .slice(0, 14)
  const name = `amq-ui test ${stamp}`
  let createdId = null
  try {
    const built = await page.evaluate((quizName) => {
      const api = window.__amqUI.quizBuilder
      const cache = window.libraryCacheHandler.animeCache
      // Two real anime from the account's own library, so the entries resolve.
      const [first, second] = Object.values(cache)
        .filter((anime) => (anime.songs?.OP?.length ?? 0) > 0)
        .slice(0, 2)
      const store = api.store
      store.startNew()
      store.quiz.name = quizName
      store.quiz.description =
        'Created by the amq-ui live test; safe to delete.'
      store.addEntry({
        kind: 'anime',
        connectUp: false,
        locked: false,
        annId: first.annId,
        includeSongTypes: { op: true, ed: true, in: false },
        numberOfSongs: 1,
        overrides: {},
      })
      store.addEntry({
        kind: 'anime',
        connectUp: false,
        locked: false,
        annId: second.annId,
        includeSongTypes: { op: true, ed: false, in: false },
        numberOfSongs: 1,
        // An override and a chain, so the round-trip has something to lose.
        overrides: { guessTime: { guessTime: 25, extraGuessTime: 2 } },
      })
      const block = store.quiz.blocks[0]
      block.entries[1].connectUp = true
      block.entries[0].locked = true
      store.addEntry({
        kind: 'title',
        connectUp: false,
        locked: false,
        title: 'Round 1',
      })
      return api.toSave(JSON.parse(JSON.stringify(store.quiz)))
    }, name)

    const saved = await request(page, {
      type: 'quizCreator',
      command: 'save quiz',
      reply: 'save custom quiz',
      data: { quizSave: built, quizId: null },
      timeout: 60_000,
    })
    createdId = saved.quizId ?? null
    check(
      'a quiz we built saves to the server',
      Boolean(saved.success) && typeof createdId === 'number',
      `quizId ${createdId}`
    )

    if (createdId !== null) {
      const reloaded = await request(page, {
        type: 'quizCreator',
        command: 'load custom quiz',
        reply: 'load custom quiz',
        data: { quizId: createdId },
        matchField: 'quizId',
        matchValue: createdId,
        timeout: 60_000,
      })
      const verdict = await page.evaluate(
        ([sent, back]) => {
          const api = window.__amqUI.quizBuilder
          const fields = api.serverOnlyFields
          const strip = (save) => {
            const copy = JSON.parse(JSON.stringify(save))
            for (const key of fields.quiz) delete copy[key]
            for (const block of copy.ruleBlocks ?? []) {
              for (const key of fields.block) delete block[key]
              for (const entry of block.blocks ?? []) {
                for (const key of fields.entry) delete entry[key]
              }
            }
            return copy
          }
          const sortKeys = (value) => {
            if (Array.isArray(value)) return value.map(sortKeys)
            if (value && typeof value === 'object') {
              return Object.keys(value)
                .sort()
                .reduce(
                  (out, key) => ((out[key] = sortKeys(value[key])), out),
                  {}
                )
            }
            return value
          }
          const same = (a, b) =>
            JSON.stringify(sortKeys(a)) === JSON.stringify(sortKeys(b))

          /*
           * Where two payloads differ, by path — dumping both is unreadable at
           * this size, and "they differ" is not a diagnosis.
           */
          const diff = (a, b, path = '', out = []) => {
            if (out.length > 12) return out
            const bothObjects =
              a && b && typeof a === 'object' && typeof b === 'object'
            if (!bothObjects) {
              if (JSON.stringify(a) !== JSON.stringify(b)) {
                out.push(
                  `${path || '<root>'}: ours=${JSON.stringify(a)} theirs=${JSON.stringify(b)}`
                )
              }
              return out
            }
            const keys = new Set([...Object.keys(a), ...Object.keys(b)])
            for (const key of keys) {
              const next = path ? `${path}.${key}` : key
              if (!(key in a))
                out.push(`${next}: added by server = ${JSON.stringify(b[key])}`)
              else if (!(key in b))
                out.push(
                  `${next}: dropped by server (ours = ${JSON.stringify(a[key])})`
                )
              else diff(a[key], b[key], next, out)
            }
            return out
          }

          const model = api.fromSave(back)
          return {
            serverKeptIt: same(strip(back), strip(sent)),
            differences: diff(strip(sent), strip(back)),
            reReadable: same(strip(api.roundTrip(back)), strip(back)),
            entries: model.blocks[0]?.entries.length ?? 0,
            chained:
              model.blocks[0]?.entries.filter((e) => e.connectUp).length ?? 0,
            locked:
              model.blocks[0]?.entries.filter((e) => e.locked).length ?? 0,
            override:
              model.blocks[0]?.entries[1]?.overrides?.guessTime?.guessTime ??
              null,
          }
        },
        [built, reloaded.quizSave]
      )

      check(
        'the server stores what we sent, unchanged',
        verdict.serverKeptIt,
        verdict.differences?.join(' | ') ?? ''
      )
      check(
        'the reloaded quiz round-trips through the serializer',
        verdict.reReadable
      )
      check(
        'chains, locks and overrides survive a real save',
        verdict.entries === 3 &&
          verdict.chained === 1 &&
          verdict.locked === 1 &&
          verdict.override === 25,
        `${verdict.entries} entries, ${verdict.chained} chained, ` +
          `${verdict.locked} locked, override ${verdict.override}`
      )
    }
  } finally {
    // Always clean up, even if an assertion above threw.
    if (createdId !== null) {
      await request(page, {
        type: 'quizCreator',
        command: 'delete quiz',
        reply: 'delete quiz',
        data: { quizId: createdId },
        matchField: 'quizId',
        matchValue: createdId,
        timeout: 30_000,
      }).catch(() => {
        console.log(
          `\nWARNING: could not delete the test quiz #${createdId} — delete it by hand.`
        )
      })
    }
  }
}

// --- the screen, rendered over the real client ----------------------------

await page.evaluate(() => {
  window.customQuizCreator.setupNewQuiz()
  window.viewChanger.changeView('customQuizCreator')
})
await page.waitForTimeout(1500)

const screen = await page.evaluate(() => {
  const hosts = [...document.querySelectorAll('[data-amq-ui]')]
  const host = hosts[hosts.length - 1]
  const shadow = host?.shadowRoot
  const screenBox = shadow?.querySelector('.screen')?.getBoundingClientRect()
  // `#footerMenuBar` is the real id — `#mainMenuBar` is what the offline
  // harness calls it, and a selector that matches nothing quietly turns this
  // assertion into a no-op.
  const menuBar = document
    .querySelector('#footerMenuBar')
    ?.getBoundingClientRect()
  return {
    mounted: Boolean(shadow),
    visible: host?.style.display !== 'none',
    panes: shadow?.querySelectorAll('.pane').length ?? 0,
    libraryRows: shadow?.querySelectorAll('.lib-row').length ?? 0,
    blockHeaders: shadow?.querySelectorAll('.head').length ?? 0,
    clearsMenuBar:
      screenBox && menuBar ? screenBox.bottom <= menuBar.top + 1 : null,
    screenBottom: screenBox ? Math.round(screenBox.bottom) : null,
    menuBarTop: menuBar ? Math.round(menuBar.top) : null,
    // Our layout reserves a fixed 45px for it; if the real bar is taller we
    // are covering it, and if it is shorter we are wasting a strip.
    menuBarHeight: menuBar ? Math.round(menuBar.height) : null,
    sidewaysScroll: document.body.scrollWidth > document.body.clientWidth,
  }
})

check(
  'the builder mounts over the real client',
  screen.mounted && screen.visible
)
check('both panes render', screen.panes === 2, `${screen.panes} panes`)
check(
  'the library pane has real rows',
  screen.libraryRows > 0,
  `${screen.libraryRows} rows`
)
check(
  'a new quiz starts with one rule block',
  screen.blockHeaders === 1,
  `${screen.blockHeaders} headers`
)
check(
  'the screen clears AMQ’s menu bar',
  screen.clearsMenuBar !== false,
  String(screen.clearsMenuBar)
)
check('the page never scrolls sideways', !screen.sidewaysScroll)
check(
  'the strip we reserve matches the real menu bar',
  screen.menuBarHeight !== null && Math.abs(screen.menuBarHeight - 45) <= 2,
  `reserved 45px, bar is ${screen.menuBarHeight}px`
)

await page.screenshot({ path: path.join(shots, 'quiz-builder.png') })

// --- the search box finds songs and artists, not just anime ---------------

/*
 * The offline suite asserts this against a fixture of five shows; this asserts
 * it against whatever is actually in the account's library, picked at runtime.
 * A real song title and a real artist name, each chosen so the show's own names
 * do **not** contain them — otherwise the anime target would carry the search
 * and a song-and-artist-blind implementation would pass.
 */
const searchTargets = await page.evaluate(() => {
  const api = window.__amqUI.quizBuilder
  const filters = api.libraryFilters
  const cache = window.libraryCacheHandler.animeCache

  // Candidates come from the rows the pane is already drawing, so they satisfy
  // every live filter — a candidate the filters hide would look like a miss.
  const rows = api.libraryStore.rows.filter((row) => row.kind === 'anime')
  const pick = (field) => {
    for (const row of rows) {
      const names = cache[row.annId]?.searchNames ?? []
      for (const song of row.songs) {
        const value =
          field === 'title'
            ? song.songEntry?.name
            : song.songEntry?.artist?.name
        if (!value || value.length < 4) continue
        const needle = value.toLowerCase()
        if (names.some((name) => name.includes(needle))) continue
        return { annId: row.annId, anime: row.name, needle, value }
      }
    }
    return null
  }

  const probe = (candidate) => {
    if (!candidate) return null
    filters.state.search = candidate.needle
    const hits = api.libraryStore.rows.filter(
      (row) => row.kind === 'anime' && row.annId === candidate.annId
    )
    return {
      ...candidate,
      found: hits.length === 1,
      total: api.libraryStore.total,
    }
  }

  const title = probe(pick('title'))
  const artist = probe(pick('artist'))
  filters.setSearch('')
  return { title, artist }
})

for (const [target, result] of Object.entries(searchTargets)) {
  const label = `searching a real ${target} finds its show`
  if (!result) {
    skip(
      label,
      `no ${target} in the library that its show's names do not contain`
    )
  } else {
    check(
      label,
      result.found,
      `"${result.value}" → ${result.anime}, ${result.total} shows matched`
    )
  }
}

// --- searching the real library stays responsive --------------------------

const perf = await page.evaluate(() => {
  const api = window.__amqUI.quizBuilder
  const time = (run) => {
    const start = performance.now()
    run()
    return performance.now() - start
  }
  const samples = []
  for (const term of ['a', 'gun', 'steins', 'monogatari']) {
    api.libraryFilters.state.search = term
    samples.push(time(() => api.libraryStore.rows.length))
  }
  api.libraryFilters.setSearch('')
  return { worst: Math.max(...samples), samples }
})
check(
  'searching the real library stays responsive',
  perf.worst < 250,
  `worst ${perf.worst.toFixed(0)}ms of ${perf.samples.map((n) => n.toFixed(0)).join('/')}`
)

// --- nothing threw --------------------------------------------------------

/*
 * AMQ's own login page throws `Cookies is not defined` — an inline script runs
 * before the bundle that defines it. Failing on the site's pre-existing errors
 * would make this assertion useless noise, so only errors that are plausibly
 * ours count.
 */
const KNOWN_SITE_ERRORS = [/Cookies is not defined/]
const ourErrors = pageErrors.filter(
  (message) => !KNOWN_SITE_ERRORS.some((pattern) => pattern.test(message))
)
check(
  'no uncaught page exceptions from our script',
  ourErrors.length === 0,
  ourErrors.slice(0, 3).join(' | ')
)
if (pageErrors.length > ourErrors.length) {
  console.log(
    `\n(ignored ${pageErrors.length - ourErrors.length} pre-existing site error(s))`
  )
}

await session.browser.close()

const failed = printResults()
console.log(`screenshots in ${path.relative(process.cwd(), shots)}/`)
process.exit(failed ? 1 : 0)
