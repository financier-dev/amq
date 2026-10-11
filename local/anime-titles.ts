/*
 * Prints the Japanese (romaji) title of every anime the account uses in
 * games, one per line. The output is typing practice text for MonkeyType.
 *
 *   npm run anime-titles                      # lowercase titles on stdout
 *   npm run anime-titles -- --keep-case
 *   npm run anime-titles -- --out titles.txt
 *   npm run anime-titles -- --pipe            # title|title|…, for MonkeyType
 *   npm run anime-titles -- --candidates      # every name, to choose overrides
 *
 * It always logs in with `AMQ_ACCOUNT_*`. The test account's list is not
 * useful here, so there is no fallback to it.
 *
 * "Uses in games" follows Settings → Anime List:
 *   - anime whose list status is one of the ticked Included Entries (what the
 *     Song Library's Watched filter shows), and
 *   - the AMQ Custom List selected there, applied in its mode: Custom List
 *     replaces the anime list, Include adds to it, Exclude removes from it.
 * Songs are not considered, so an anime with no uploaded song is included.
 *
 * The server picks the songs, so the custom list rule is not client code. It
 * is written from the mode descriptions in `en.json`
 * (`setting_window.anime_list.custom_list_mode`).
 *
 * AMQ registers several names per anime and marks one as the Japanese main
 * name. That one is sometimes wrong. The overrides file replaces it; see
 * `anime-titles.overrides.example.json`.
 */

import fs from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { repo } from '@shared/node/env'
import { LIBRARY_TIMEOUT_MS, openSession } from '@shared/node/session'

const DEFAULT_OVERRIDES = path.join(
  repo,
  'local',
  'anime-titles.overrides.json'
)

const { values: flags } = parseArgs({
  options: {
    'keep-case': { type: 'boolean', default: false },
    overrides: { type: 'string' },
    out: { type: 'string', short: 'o' },
    pipe: { type: 'boolean', default: false },
    candidates: { type: 'boolean', default: false },
    headed: { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
})

if (flags.help) {
  console.log(`Usage: npm run anime-titles -- [options]

  --keep-case         keep AMQ's capitalisation (default: all lowercase)
  --overrides <file>  title overrides (default: local/anime-titles.overrides.json)
  -o, --out <file>    write to a file instead of stdout
  --pipe              separate the titles with | instead of a new line, as
                      MonkeyType's custom text expects
  --candidates        print annId, chosen title and every registered name,
                      tab-separated, instead of the plain list
  --headed            show the browser`)
  process.exit(0)
}

if (flags.pipe && flags.candidates) {
  throw new Error('--pipe does not apply to --candidates')
}

interface ListedAnime {
  annId: number
  /** AMQ's choice. The English main name when there is no Japanese one. */
  title: string
  names: string[]
}

/**
 * A key is an annId or the title AMQ chose (case-insensitive). The value is
 * the title to print, or `null` to leave the anime out.
 */
type Overrides = Record<string, string | null>

function loadOverrides(): Overrides {
  const file = flags.overrides ?? DEFAULT_OVERRIDES
  if (!fs.existsSync(file)) {
    if (flags.overrides) throw new Error(`No overrides file at ${file}`)
    return {}
  }
  const parsed: unknown = JSON.parse(fs.readFileSync(file, 'utf8'))
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${file} must be a JSON object of key → title`)
  }
  for (const [key, value] of Object.entries(parsed)) {
    if (value !== null && typeof value !== 'string') {
      throw new Error(`${file}: "${key}" must map to a string or null`)
    }
  }
  return parsed as Overrides
}

interface ListedResult {
  anime: ListedAnime[]
  /** The custom list in use and its mode, or `null` when there is none. */
  customList: { name: string; mode: string; animeCount: number } | null
}

async function fetchListedAnime(): Promise<ListedResult> {
  const { browser, page } = await openSession({
    headed: flags.headed,
    accounts: ['AMQ_ACCOUNT'],
  })
  try {
    // `animeCache` is `{}` until `getCache` is called. `getCache` fetches the
    // master list and the list-status overlay that sets `watched`.
    return await page.evaluate(
      (timeout) =>
        new Promise<ListedResult>((resolve, reject) => {
          const timer = setTimeout(
            () => reject(new Error('timed out waiting for the library')),
            timeout
          )

          const { customListAnimeList, customListMap } = customListHandler
          const modes = customListAnimeList.CUSTOM_LIST_MODES
          const active = [...customListMap.values()].find((list) =>
            list.$entryAnimeList.hasClass('selected')
          )
          const mode = active ? customListAnimeList.currentMode : modes.DISABLE
          const used = (anime: LibraryAnimeEntry) => {
            const watched = Boolean(anime.watched)
            const inCustomList = active?.animeMap.has(anime.annId) ?? false
            if (mode === modes.LIST) return inCustomList
            if (mode === modes.INCLUDE) return watched || inCustomList
            if (mode === modes.EXCLUDE) return watched && !inCustomList
            return watched
          }

          libraryCacheHandler.getCache(
            (cache: Record<string, LibraryAnimeEntry>) => {
              clearTimeout(timer)
              resolve({
                anime: Object.values(cache)
                  .filter(used)
                  .map((anime) => ({
                    annId: anime.annId,
                    title: anime.mainNames.JA ?? anime.mainNames.EN ?? '',
                    names: anime.names.map(({ name }) => name),
                  })),
                customList:
                  active && mode !== modes.DISABLE
                    ? {
                        name: active.name,
                        mode:
                          Object.entries(modes).find(
                            ([, value]) => value === mode
                          )?.[0] ?? String(mode),
                        animeCount: active.animeMap.size,
                      }
                    : null,
              })
            }
          )
        }),
      LIBRARY_TIMEOUT_MS
    )
  } finally {
    await browser.close()
  }
}

const overrides = loadOverrides()
const { anime, customList } = await fetchListedAnime()

console.error(
  customList
    ? `custom list "${customList.name}" (${customList.animeCount} anime), mode ${customList.mode}`
    : 'no custom list in use'
)

if (anime.length === 0) {
  console.error(
    'No anime is in use. Under Settings → Anime List, check that an anime ' +
      'list is linked with at least one status ticked, or that a custom ' +
      'list is selected.'
  )
}

const byLowerKey = new Map(
  Object.keys(overrides).map((key) => [key.toLowerCase(), key])
)
const usedKeys = new Set<string>()

const rows: { anime: ListedAnime; title: string }[] = []
for (const entry of anime) {
  const key =
    byLowerKey.get(String(entry.annId)) ??
    byLowerKey.get(entry.title.toLowerCase())
  let title: string | null = entry.title
  if (key !== undefined) {
    usedKeys.add(key)
    title = overrides[key]
  }
  if (title) rows.push({ anime: entry, title })
}
rows.sort((a, b) => a.title.localeCompare(b.title, 'en'))

const format = (title: string) =>
  flags['keep-case'] ? title : title.toLowerCase()

const lines = flags.candidates
  ? rows.map(({ anime, title }) =>
      [anime.annId, format(title), anime.names.join(' | ')].join('\t')
    )
  : // Several seasons can share a title. Print it once.
    [...new Set(rows.map(({ title }) => format(title)))]

const output = lines.join(flags.pipe ? '|' : '\n') + '\n'
if (flags.out) fs.writeFileSync(flags.out, output)
else process.stdout.write(output)

const unused = Object.keys(overrides).filter((key) => !usedKeys.has(key))
if (unused.length) {
  console.error(
    `${unused.length} override(s) matched no anime on the list:\n` +
      unused.map((key) => `  ${key}`).join('\n')
  )
}
console.error(
  `${lines.length} titles from ${anime.length} anime, ${usedKeys.size} overridden`
)
