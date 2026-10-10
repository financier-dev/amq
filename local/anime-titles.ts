/*
 * Prints the Japanese (romaji) title of every anime on the account's list, one
 * per line — typing practice material for MonkeyType.
 *
 *   npm run anime-titles                      # lowercase titles on stdout
 *   npm run anime-titles -- --keep-case
 *   npm run anime-titles -- --out titles.txt
 *   npm run anime-titles -- --candidates      # every registered name, to pick overrides from
 *
 * "On the list" is what the Song Library's Watched filter means: the anime
 * whose list status is one of the types ticked under Settings → Anime List.
 * Songs play no part, so an anime with nothing uploaded yet is included.
 *
 * AMQ registers several names per anime and marks one as the Japanese main
 * name, which is sometimes the wrong one. The overrides file corrects that —
 * see `anime-titles.overrides.example.json`.
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
  --candidates        print annId, chosen title and every registered name,
                      tab-separated, instead of the plain list
  --headed            show the browser`)
  process.exit(0)
}

interface ListedAnime {
  annId: number
  /** AMQ's pick; the English main name when it has no Japanese one. */
  title: string
  names: string[]
}

/**
 * Keys are an annId or the title AMQ picked (case-insensitive); the value is
 * the title to print instead, or `null` to leave the anime out.
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

async function fetchListedAnime(): Promise<ListedAnime[]> {
  const { browser, page } = await openSession({ headed: flags.headed })
  try {
    // `animeCache` is `{}` until asked for; `getCache` fetches the master list
    // and the list-status overlay that sets `watched`, then calls back.
    return await page.evaluate(
      (timeout) =>
        new Promise<ListedAnime[]>((resolve, reject) => {
          const timer = setTimeout(
            () => reject(new Error('timed out waiting for the library')),
            timeout
          )
          libraryCacheHandler.getCache(
            (cache: Record<string, LibraryAnimeEntry>) => {
              clearTimeout(timer)
              resolve(
                Object.values(cache)
                  .filter((anime) => anime.watched)
                  .map((anime) => ({
                    annId: anime.annId,
                    title: anime.mainNames.JA ?? anime.mainNames.EN ?? '',
                    names: anime.names.map(({ name }) => name),
                  }))
              )
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
const anime = await fetchListedAnime()

if (anime.length === 0) {
  console.error(
    'No anime came back as on the list — is a list linked to this account, ' +
      'and is at least one status ticked under Settings → Anime List?'
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
  : // Sequels sometimes share a title; typing it twice teaches nothing.
    [...new Set(rows.map(({ title }) => format(title)))]

const output = lines.join('\n') + '\n'
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
