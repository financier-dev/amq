/**
 * Adapter over AMQ's library cache.
 *
 * Quiz entries store only ids: `annId` for an anime, `annSongId` for a song.
 * Every name, title, artist and count on the screen resolves through this
 * file at render time, as in AMQ's client.
 *
 * Nothing here throws on a missing entry. A quiz can reference an anime that
 * is not in the cache, and the list must still render. The row then shows the
 * id.
 */

import { SvelteSet } from 'svelte/reactivity'

import { t } from './derive'
import {
  animeSearchNames,
  matchesSearchNames,
  needle,
  songMatchesSearch,
} from './librarySearch'
import type { LibraryLookup } from './quizCounts'
import { libraryFilters } from './quizFilters.svelte'
import type { IncludeSongTypesSave } from './quizSave'

/**
 * Increased whenever AMQ's cache changes.
 *
 * `libraryCacheHandler.animeCache` is a plain object built outside Svelte, so
 * reading it creates no dependency. Every reader below calls `trackCache()`,
 * which makes it re-run after a change.
 */
let cacheRevision = $state(0)

function trackCache() {
  return cacheRevision
}

/**
 * Library entries we could not read.
 *
 * A plain counter, not `$state`: a derivation writes it, and a derivation may
 * not write reactive state. `__amqUI.quizBuilder.unreadable()` exposes it.
 * Non-zero means the payload changed shape and `shared/globals.d.ts` is out of date.
 */
let unreadableAnime = 0

export function unreadableAnimeCount() {
  return unreadableAnime
}

/**
 * Set when a whole filter pass threw. The pane then reports the library as
 * unavailable.
 *
 * A plain variable, **not `$state`**: a derivation writes it, and Svelte
 * forbids that for reactive state (`state_unsafe_mutation`). It needs no
 * reactivity, because it changes only in the pass that also changes `rows`.
 */
let passFailed = false

export function libraryPassFailed() {
  return passFailed
}

/**
 * Runs a library pass and returns `fallback` if it throws.
 *
 * The per-entry guards catch one bad record. This catches a field that
 * changed shape in every record. A throw inside a `$derived` aborts the
 * render of the whole screen, so the library pane fails alone and the quiz
 * pane stays usable.
 */
function guardPass<T>(label: string, run: () => T, fallback: T): T {
  try {
    const value = run()
    passFailed = false
    return value
  } catch (error) {
    console.error(
      `[amq-ui] the song library could not be read (${label})`,
      error
    )
    passFailed = true
    return fallback
  }
}

const LOAD_TIMEOUT_MS = 45_000

let loadPromise: Promise<boolean> | null = null

/** For tests: makes every reader re-run, as a cache load does. */
export function bumpCache() {
  cacheRevision += 1
}

/**
 * Loads AMQ's library cache. Resolves true once it is populated.
 *
 * `getCache` is the only way in (`libraryCacheHandler.js:94`). It requests the
 * current master list id and then fetches what is stale: the master list over
 * HTTP, then the watched, rated, uploaded and recently-wrong overlays over the
 * socket. Until it is called, `animeCache` is `{}`.
 *
 * `getCache` keeps **one** callback slot, so a second concurrent call
 * replaces the first callback. All callers therefore share one promise.
 */
export function loadLibraryCache(): Promise<boolean> {
  if (loadPromise) return loadPromise

  loadPromise = new Promise<boolean>((resolve) => {
    let settled = false
    const finish = (ok: boolean) => {
      if (settled) return
      settled = true
      cacheRevision += 1
      resolve(ok)
    }

    // Resolve false after the timeout so the screen can report the failure
    // and stop showing "Loading…".
    const timer = setTimeout(() => {
      loadPromise = null
      finish(false)
    }, LOAD_TIMEOUT_MS)

    try {
      libraryCacheHandler.getCache(() => {
        clearTimeout(timer)
        finish(true)
      })
    } catch (error) {
      clearTimeout(timer)
      console.error('[amq-ui] could not load the song library', error)
      loadPromise = null
      finish(false)
    }
  })

  return loadPromise
}

/** `customQuizBuilder.js:421-430` */
export const SONG_TYPE_OPENING = 1
export const SONG_TYPE_ENDING = 2
export const SONG_TYPE_INSERT = 3

/**
 * The badge on a song row: `OP 2`, `ED 1`, `IN`.
 *
 * Inserts have no number. `quiz_builder.song_block.song_types` has a
 * `_NUMBER_` placeholder for openings and endings only, and
 * `customQuizBuilder.js:427` adds no suffix for inserts.
 */
export function songTypeBadge(type: number, number: number): string {
  if (type === SONG_TYPE_OPENING) {
    return t('quiz_builder.song_block.song_types.opening', `OP${number}`, {
      number,
    })
  }
  if (type === SONG_TYPE_ENDING) {
    return t('quiz_builder.song_block.song_types.ending', `ED${number}`, {
      number,
    })
  }
  return t('quiz_builder.song_block.song_types.insert', 'IN')
}

/**
 * The key an anime type's locale entry uses: `TV Special` becomes
 * `tv_special`. `convertCategoryToKey` does the same before its lookup, so
 * filter options and row labels agree.
 */
export function animeTypeKey(
  category: LibraryAnimeCategory | undefined
): string {
  return (category?.name ?? '').toLowerCase().replace(/ /g, '_')
}

/** The type as a row shows it: `TV`, `OVA 2`, `Music Video`. */
export function animeTypeLabel(
  category: LibraryAnimeCategory | undefined
): string {
  if (!category?.name) return ''
  const number = category.number
  // Use AMQ's own key resolution first, so a type we do not know still gets
  // its translated name.
  try {
    const { key, parameters } =
      localizationHandler.convertCategoryToKey(category)
    const label = localizationHandler.translate(key, parameters)
    if (label && label !== key) return label.trim()
  } catch {
    // Fall back to the plain name below.
  }
  return number ? `${category.name} ${number}` : category.name
}

export interface AnimeDisplay {
  annId: number
  name: string
  /** Ready to render: `TV`, `OVA 2`. */
  category: string
  year: number
  seasonId: number
  watched: boolean
  opCount: number
  edCount: number
  insCount: number
  /** False when the anime is not in the cache. */
  known: boolean
}

export interface SongDisplay {
  annSongId: number
  animeName: string
  title: string
  artist: string
  badge: string
  known: boolean
}

function unknownAnime(annId: number): AnimeDisplay {
  return {
    annId,
    name: t('quiz_builder.unknown_anime', `Anime #${annId}`),
    category: '',
    year: 0,
    seasonId: 0,
    watched: false,
    opCount: 0,
    edCount: 0,
    insCount: 0,
    known: false,
  }
}

export function describeAnime(annId: number): AnimeDisplay {
  trackCache()
  let anime: LibraryAnimeEntry | undefined
  try {
    anime = libraryCacheHandler?.getCachedAnime(annId)
  } catch {
    anime = undefined
  }
  if (!anime) return unknownAnime(annId)

  return {
    annId,
    // `mainName` follows the player's romaji setting, as on AMQ's screens.
    name: anime.mainName ?? unknownAnime(annId).name,
    category: animeTypeLabel(anime.category),
    year: anime.year ?? 0,
    seasonId: anime.seasonId ?? 0,
    watched: anime.watched === true,
    opCount: anime.songs?.OP?.length ?? 0,
    edCount: anime.songs?.ED?.length ?? 0,
    insCount: anime.songs?.INS?.length ?? 0,
    known: true,
  }
}

export function describeSong(annSongId: number): SongDisplay {
  trackCache()
  let entry: LibraryAnimeSongEntry | undefined
  try {
    entry = libraryCacheHandler?.getCachedAnnSongEntry(annSongId)
  } catch {
    entry = undefined
  }
  if (!entry) {
    return {
      annSongId,
      animeName: '',
      title: t('quiz_builder.unknown_song', `Song #${annSongId}`),
      artist: '',
      badge: '',
      known: false,
    }
  }

  const song = entry.songEntry as LibrarySongEntry | undefined
  return {
    annSongId,
    animeName: describeAnime(entry.annId).name,
    title: song?.name ?? '',
    // The cache sets `artist` from the artist map or the group map
    // (`libraryCacheHandler.js:541`).
    artist: song?.artist?.name ?? '',
    badge: songTypeBadge(entry.type, entry.number),
    known: true,
  }
}

/** An anime's songs in AMQ's order: OP, ED, insert. */
export function animeSongEntries(annId: number): LibraryAnimeSongEntry[] {
  trackCache()
  const anime = libraryCacheHandler?.getCachedAnime(annId)
  if (!anime) return []
  return [
    ...(anime.songs?.OP ?? []),
    ...(anime.songs?.ED ?? []),
    ...(anime.songs?.INS ?? []),
  ]
}

/** The cache as the counts read it. Tests pass a fixture instead. */
export const amqLibrary: LibraryLookup = {
  animeSongIds(annId: number, types: IncludeSongTypesSave) {
    trackCache()
    const anime = libraryCacheHandler?.getCachedAnime(annId)
    if (!anime) return []
    const ids: number[] = []
    // Order matches `CustomQuizAnimeBlock.targetSongAnnSongIds`.
    if (types.op) ids.push(...(anime.songs?.OP ?? []).map((s) => s.annSongId))
    if (types.ed) ids.push(...(anime.songs?.ED ?? []).map((s) => s.annSongId))
    if (types.in) ids.push(...(anime.songs?.INS ?? []).map((s) => s.annSongId))
    return ids
  },
  annIdFromAnnSongId(annSongId: number) {
    trackCache()
    try {
      return libraryCacheHandler?.getAnnIdFromAnnSongId(annSongId)
    } catch {
      return undefined
    }
  },
}

// --- the library list ------------------------------------------------------

/**
 * The left pane's list (SPEC §4).
 *
 * Three tabs, as in AMQ (`library/library.js:97-115`): the whole library by
 * anime, the newest 200 songs, and recently wrong songs. The last two are
 * song lists, so a row can be an anime or a song.
 *
 * **The rendered list is limited to `PAGE` rows.** The real library has
 * thousands of anime and AMQ virtualises it with clusterize. We render the
 * first `PAGE` matches and report the total.
 */

/** `library.js:252` */
const NEW_SONG_DISPLAY_AMOUNT = 200
const PAGE = 300

export interface LibraryAnimeRow {
  kind: 'anime'
  id: string
  annId: number
  name: string
  /** `TV · 2010 · OP 1 · ED 1 · IN 9` */
  sub: string
  songCount: number
  songs: LibraryAnimeSongEntry[]
}

export interface LibrarySongRow {
  kind: 'song'
  id: string
  annSongId: number
  annId: number
  title: string
  artist: string
  badge: string
  /** Set on a song row in the New and Wrong tabs, which show no anime row. */
  animeName?: string
}

export type LibraryRow = LibraryAnimeRow | LibrarySongRow

/** An anime with its name, search names and songs, resolved once per load. */
interface SortedAnime {
  anime: LibraryAnimeEntry
  /**
   * `mainName`, read once here. It is a getter over `mainNames` and the
   * romaji option and can throw on a malformed record. The per-entry guard
   * below catches that; the sort comparator would not.
   */
  name: string
  search: string[]
  songs: LibraryAnimeSongEntry[]
}

/** The rendered page and the totals for all matches. */
interface MatchedAnime {
  page: { anime: LibraryAnimeEntry; songs: LibraryAnimeSongEntry[] }[]
  animeTotal: number
  songTotal: number
}

/** `libraryAnimeEntry.js:296`. */
const SEASON_KEYS = ['winter', 'spring', 'summer', 'fall'] as const

/**
 * An anime's vintage: `Winter 2006`.
 *
 * The locale entry is `"Winter _YEAR_"`, so pass the year as the lowercase
 * `year` parameter. Do not translate without it and append the year: that
 * renders `Winter _YEAR_ 2006`.
 */
function vintageLabel(year: number, seasonId: number): string {
  const key = SEASON_KEYS[seasonId]
  if (!key) return year ? String(year) : ''
  const season = key[0].toUpperCase() + key.slice(1)
  if (!year) return season
  return t(`song_library.anime_entry.vintage.${key}`, `${season} ${year}`, {
    year,
  })
}

function allAnime(): LibraryAnimeEntry[] {
  trackCache()
  try {
    const cache = libraryCacheHandler?.animeCache
    return cache ? (Object.values(cache) as LibraryAnimeEntry[]) : []
  } catch {
    return []
  }
}

function songRow(
  song: LibraryAnimeSongEntry,
  animeName?: string
): LibrarySongRow {
  const entry = song.songEntry as LibrarySongEntry | undefined
  return {
    kind: 'song',
    id: `s${song.annSongId}`,
    annSongId: song.annSongId,
    annId: song.annId,
    title: entry?.name ?? '',
    artist: entry?.artist?.name ?? '',
    badge: songTypeBadge(song.type, song.number),
    animeName,
  }
}

export class LibraryStore {
  /** Anime whose songs are listed below their row. */
  readonly expanded = new SvelteSet<number>()
  /** True once AMQ's cache is populated. */
  loaded = $state(false)
  loading = $state(false)
  /** The cache did not arrive. */
  failed = $state(false)

  /**
   * Loads the library and resolves when it is usable.
   *
   * Everything on this screen resolves ids through the cache. Without it,
   * every entry renders as `Anime #4591` with zero songs.
   */
  async load(): Promise<boolean> {
    if (this.loaded) return true
    this.loading = true
    this.failed = false
    const ok = await loadLibraryCache()
    this.loading = false
    this.loaded = ok && allAnime().length > 0
    this.failed = !this.loaded
    return this.loaded
  }

  toggle(annId: number) {
    if (this.expanded.has(annId)) this.expanded.delete(annId)
    else this.expanded.add(annId)
  }

  /**
   * The whole library in display order, sorted once per cache load.
   *
   * The sort is the expensive step: `localeCompare` over the whole library
   * takes a few hundred milliseconds. This `$derived` depends only on
   * `trackCache()`, so a search re-runs only the cheap predicate over the
   * sorted list.
   */
  readonly #sortedAnime = $derived.by((): SortedAnime[] => {
    const prepared: SortedAnime[] = []
    let unreadable = 0

    for (const anime of allAnime()) {
      // Guard each entry, not the whole pass. The payload is not ours, and
      // one bad record that throws inside a `$derived` breaks the whole
      // screen.
      try {
        prepared.push({
          anime,
          name: anime.mainName ?? '',
          // Resolved once here, not per keystroke.
          search: animeSearchNames(anime),
          songs: [
            ...(anime.songs?.OP ?? []),
            ...(anime.songs?.ED ?? []),
            ...(anime.songs?.INS ?? []),
          ],
        })
      } catch {
        unreadable += 1
      }
    }

    prepared.sort((a, b) => a.name.localeCompare(b.name))
    unreadableAnime = unreadable
    return prepared
  })

  /**
   * Anime that match the filters, each with the songs that match. An anime
   * with no matching song is dropped.
   */
  readonly #matchingAnime = $derived.by((): MatchedAnime =>
    guardPass('anime', () => this.#computeMatchingAnime(), {
      page: [],
      animeTotal: 0,
      songTotal: 0,
    })
  )

  #computeMatchingAnime(): MatchedAnime {
    const query = needle(libraryFilters.search)
    // Take one snapshot for the loop. See `predicates`.
    const { matchesAnime, matchesSong } = libraryFilters.predicates
    const page: { anime: LibraryAnimeEntry; songs: LibraryAnimeSongEntry[] }[] =
      []
    let animeTotal = 0
    let songTotal = 0

    for (const entry of this.#sortedAnime) {
      if (!matchesAnime(entry.anime)) continue

      /*
       * AMQ's two search rules (`applySearchFilter`). An anime whose name
       * matches keeps all its songs. Otherwise only songs that match on
       * title, artist, composer or arranger stay, and the anime stays only if
       * one did.
       */
      const wholeAnime = !query || matchesSearchNames(entry.search, query)

      // Count matches without building arrays. The header totals need every
      // match, but only the rendered page needs the song arrays.
      const keep = (song: LibraryAnimeSongEntry) =>
        matchesSong(song) &&
        (wholeAnime || (query !== null && songMatchesSearch(song, query)))
      let matching = 0
      for (const song of entry.songs) {
        if (keep(song)) matching += 1
      }
      // Drop an anime with no matching song.
      if (matching === 0) continue

      animeTotal += 1
      songTotal += matching

      if (page.length < PAGE) {
        page.push({ anime: entry.anime, songs: entry.songs.filter(keep) })
      }
    }

    // `#sortedAnime` is in display order, so `page` is too.
    return { page, animeTotal, songTotal }
  }

  /** Songs that match the filters, for the New and Wrong tabs. */
  readonly #matchingSongs = $derived.by((): LibraryAnimeSongEntry[] =>
    guardPass('songs', () => this.#computeMatchingSongs(), [])
  )

  #computeMatchingSongs(): LibraryAnimeSongEntry[] {
    const query = needle(libraryFilters.search)
    const tab = libraryFilters.state.tab
    const { matchesAnime, matchesSong } = libraryFilters.predicates
    const out: LibraryAnimeSongEntry[] = []

    for (const entry of this.#sortedAnime) {
      const anime = entry.anime
      if (!matchesAnime(anime)) continue
      // These tabs list songs, so an anime-name hit applies to each song of
      // that anime (`LibrarySongSoloEntry.searchNames` delegates to the
      // anime).
      const animeHit = query ? matchesSearchNames(entry.search, query) : false
      for (const song of entry.songs) {
        if (!matchesSong(song)) continue
        if (tab === 'wrong' && !song.wrongIndex) continue
        if (query && !animeHit && !songMatchesSearch(song, query)) continue
        out.push(song)
      }
    }

    if (tab === 'new') {
      // Newest first, limited to 200 as in AMQ.
      out.sort((a, b) => b.annSongId - a.annSongId)
      return out.slice(0, NEW_SONG_DISPLAY_AMOUNT)
    }
    // Most recently wrong first.
    out.sort((a, b) => (a.wrongIndex ?? 0) - (b.wrongIndex ?? 0))
    return out
  }

  readonly animeTotal = $derived(
    libraryFilters.state.tab === 'library'
      ? this.#matchingAnime.animeTotal
      : new Set(this.#matchingSongs.map((song) => song.annId)).size
  )

  readonly songTotal = $derived(
    libraryFilters.state.tab === 'library'
      ? this.#matchingAnime.songTotal
      : this.#matchingSongs.length
  )

  /** How many of the matched rows the pane renders. */
  readonly shown = $derived(
    Math.min(
      libraryFilters.state.tab === 'library'
        ? this.#matchingAnime.animeTotal
        : this.#matchingSongs.length,
      PAGE
    )
  )

  readonly total = $derived(
    libraryFilters.state.tab === 'library'
      ? this.#matchingAnime.animeTotal
      : this.#matchingSongs.length
  )

  readonly capped = $derived(this.total > PAGE)

  readonly rows = $derived.by((): LibraryRow[] =>
    guardPass('rows', () => this.#computeRows(), [])
  )

  #computeRows(): LibraryRow[] {
    if (libraryFilters.state.tab !== 'library') {
      return this.#matchingSongs
        .slice(0, PAGE)
        .map((song) => songRow(song, describeAnime(song.annId).name))
    }

    const rows: LibraryRow[] = []
    for (const { anime, songs } of this.#matchingAnime.page) {
      // `category` is an object. Render it only through `animeTypeLabel`, or
      // the row reads "[object Object]".
      const parts = [
        animeTypeLabel(anime.category),
        vintageLabel(anime.year ?? 0, anime.seasonId ?? -1),
      ]
      const counts = [
        `OP ${anime.songs?.OP?.length ?? 0}`,
        `ED ${anime.songs?.ED?.length ?? 0}`,
        `IN ${anime.songs?.INS?.length ?? 0}`,
      ]
      rows.push({
        kind: 'anime',
        id: `a${anime.annId}`,
        annId: anime.annId,
        name: anime.mainName,
        sub: [...parts.filter(Boolean), ...counts].join(' · '),
        songCount: songs.length,
        songs,
      })

      if (this.expanded.has(anime.annId)) {
        for (const song of songs) rows.push(songRow(song))
      }
    }
    return rows
  }

  /**
   * True when a whole pass failed, which means the payload changed shape.
   *
   * A getter, not a `$derived`: it reads a non-reactive flag, and a derived
   * would cache `false`. The render that sets the flag also empties `rows`,
   * so templates re-read it.
   */
  get broken() {
    return libraryPassFailed()
  }
}

export const libraryStore = new LibraryStore()
