/**
 * Adapter over AMQ's library cache.
 *
 * Quiz entries store only ids — `annId` for an anime, `annSongId` for a song —
 * so every name, title, artist and count on the screen is resolved through here
 * at render time. That is AMQ's own arrangement, not a choice: the client does
 * the same, and a quiz saved with the names baked in would go stale the moment
 * the library changed.
 *
 * Everything degrades rather than throws. A quiz can legitimately reference an
 * anime that is not in the cache (AMQ's own loader silently drops those
 * entries), and the list must still render — showing the id is far more useful
 * to someone diagnosing it than an empty row.
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
 * Bumped whenever AMQ's cache changes under us.
 *
 * `libraryCacheHandler.animeCache` is a plain object built outside Svelte, so
 * nothing that reads it is reactive on its own — the screen would render every
 * entry as "Anime #4591" and never re-render once the real cache arrived.
 * Every reader below calls `trackCache()` so a bump re-runs it.
 */
let cacheRevision = $state(0)

function trackCache() {
  return cacheRevision
}

/**
 * Library entries whose shape we could not read at all.
 *
 * Deliberately a plain counter, not `$state`: it is written from inside a
 * derivation, which may not touch reactive state. It exists for diagnosis via
 * `__amqUI.quizBuilder.unreadable()` — if this is ever non-zero the payload has
 * changed shape and the typings in `amq.d.ts` need revisiting.
 */
let unreadableAnime = 0

export function unreadableAnimeCount() {
  return unreadableAnime
}

/**
 * Set when a whole filter pass threw; the pane says the library is unusable.
 *
 * A plain variable, **not `$state`** — this is written from inside a
 * derivation, and Svelte forbids mutating reactive state there
 * (`state_unsafe_mutation`). Making it reactive turned a caught error into an
 * uncaught one and blanked the screen anyway, which rather defeated the guard.
 * It needs no reactivity of its own: it only ever changes in the same pass that
 * changes `rows`, and that is what re-renders the pane.
 */
let passFailed = false

export function libraryPassFailed() {
  return passFailed
}

/**
 * Runs a library pass, degrading to `fallback` if it throws outright.
 *
 * The per-entry guards catch a bad *record*; this catches a bad *assumption* —
 * a field that changed shape breaks every record at once, and no per-entry
 * guard helps. Either way a throw inside a `$derived` aborts the render and
 * blanks the whole screen, which has now happened twice, so the library pane
 * fails to "unavailable" rather than taking the quiz pane down with it.
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

/** How long to wait for the cache before giving up and saying so. */
const LOAD_TIMEOUT_MS = 45_000

let loadPromise: Promise<boolean> | null = null

/**
 * Loads AMQ's library cache, resolving true once it is populated.
 *
 * `getCache` is the only entry point (`libraryCacheHandler.js:94`): it asks for
 * the current master list id and then fetches whatever is stale — the master
 * list over HTTP, then the watched, rated, uploaded and recently-wrong overlays
 * over the socket. Reading `animeCache` without calling it gets you `{}`.
 *
 * It keeps **one** callback slot, so a second concurrent call orphans the
 * first. Hence the shared promise rather than a call per caller.
 */
/** Test seam: forces the re-read a real cache load would trigger. */
export function bumpCache() {
  cacheRevision += 1
}

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

    // A cache that never arrives must not leave the screen saying "Loading…"
    // forever; the player needs to be told so they can fall back.
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
 * Inserts are deliberately unnumbered — `quiz_builder.song_block.song_types`
 * has a `_NUMBER_` slot for openings and endings and none for inserts, and
 * `customQuizBuilder.js:427` skips the suffix for them.
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
 * Normalises an anime type to the key its locale entry uses: `TV Special`
 * becomes `tv_special`. Exactly what `convertCategoryToKey` does before
 * looking the key up, so filter options and display can never disagree.
 */
export function animeTypeKey(
  category: LibraryAnimeCategory | undefined
): string {
  return (category?.name ?? '').toLowerCase().replace(/ /g, '_')
}

/** The type as it should read on a row: `TV`, `OVA 2`, `Music Video`. */
export function animeTypeLabel(
  category: LibraryAnimeCategory | undefined
): string {
  if (!category?.name) return ''
  const number = category.number
  // Prefer AMQ's own key resolution, so a type we have never seen still reads
  // correctly rather than falling back to a raw field.
  try {
    const { key, parameters } =
      localizationHandler.convertCategoryToKey(category)
    const label = localizationHandler.translate(key, parameters)
    if (label && label !== key) return label.trim()
  } catch {
    // Falls through to the plain name below.
  }
  return number ? `${category.name} ${number}` : category.name
}

export interface AnimeDisplay {
  annId: number
  name: string
  /** Anime type, ready to render: `TV`, `OVA 2`. */
  category: string
  year: number
  seasonId: number
  watched: boolean
  opCount: number
  edCount: number
  insCount: number
  /** False when the anime is not in the cache; the row says so. */
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
    // `mainName` honours the player's romaji preference, so the builder agrees
    // with every other screen about what a show is called.
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
    // `artist` is resolved onto the song entry from whichever of the artist or
    // group map applies (`libraryCacheHandler.js:541`).
    artist: song?.artist?.name ?? '',
    badge: songTypeBadge(entry.type, entry.number),
    known: true,
  }
}

/** The song ids an anime row lists, in AMQ's order: OP, then ED, then insert. */
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

/**
 * What the derived counts need. Kept to this narrow shape so the counts stay
 * testable against a fixture rather than a cached library.
 */
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
 * Three tabs, matching AMQ's own (`library/library.js:97-115`): the whole
 * library by anime, the newest 200 songs, and songs you recently got wrong.
 * The latter two are song lists rather than anime lists, which is why a row can
 * be either shape.
 *
 * **The rendered list is capped.** The real library is tens of thousands of
 * anime; AMQ virtualises it with clusterize. Rendering every match would hang
 * the page, and a virtual scroller is a lot of machinery for a pane you search
 * in — so this renders the first `PAGE` matches and reports the total, which
 * keeps the honest number in front of the player.
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
  /** Set on a song row that stands alone, i.e. in the New / Wrong tabs. */
  animeName?: string
}

export type LibraryRow = LibraryAnimeRow | LibrarySongRow

/** An anime with its name, keys and songs resolved once per cache load. */
interface SortedAnime {
  anime: LibraryAnimeEntry
  /**
   * `mainName`, read here rather than at sort time. It is a getter over
   * `mainNames` and the romaji option, so a malformed record throws on read —
   * inside the per-entry guard below that costs one row, in the comparator it
   * would cost the pane.
   */
  name: string
  search: string[]
  songs: LibraryAnimeSongEntry[]
}

/** The drawn page plus the totals for the whole match set. */
interface MatchedAnime {
  page: { anime: LibraryAnimeEntry; songs: LibraryAnimeSongEntry[] }[]
  animeTotal: number
  songTotal: number
}

/** `libraryAnimeEntry.js:296` — the same four keys AMQ's own rows use. */
const SEASON_KEYS = ['winter', 'spring', 'summer', 'fall'] as const

/**
 * An anime's vintage, as one string: `Winter 2006`.
 *
 * The locale entry is `"Winter _YEAR_"` — the season and the year are one
 * phrase, not a season to which a year gets appended. Translating without the
 * parameter and gluing the year on afterwards produces `Winter _YEAR_ 2006`,
 * which is exactly what shipped. The parameter is lowercase `year`.
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
  /** Anime whose songs are showing. Expanding lists exactly its songs. */
  readonly expanded = new SvelteSet<number>()
  /** True once AMQ's cache is populated. */
  loaded = $state(false)
  /** True while the request is in flight, so the pane can say so. */
  loading = $state(false)
  /** The cache did not arrive; the pane offers the escape hatch. */
  failed = $state(false)

  /**
   * Asks AMQ for the library and resolves when it is usable.
   *
   * Everything on this screen resolves ids through the cache, so this is not a
   * nicety: without it every entry renders as `Anime #4591` with a song count
   * of zero, which is exactly what shipping it unloaded looked like.
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
   * The sort is the expensive part of this pane: `localeCompare` over ~20k
   * anime costs a few hundred milliseconds, and doing it inside the filter
   * derivation meant paying it again on every keystroke. Keeping it in its own
   * `$derived` — which depends only on `trackCache()` — means a search re-runs
   * the cheap predicate over an already-ordered list.
   */
  readonly #sortedAnime = $derived.by((): SortedAnime[] => {
    const prepared: SortedAnime[] = []
    let unreadable = 0

    for (const anime of allAnime()) {
      // Guarded per entry, not around the whole pass. This reads a payload we
      // do not control, and one odd record throwing inside a `$derived` takes
      // the entire screen down — which is exactly what `category` being an
      // object rather than a string did.
      try {
        prepared.push({
          anime,
          name: anime.mainName ?? '',
          // AMQ precomputes these at cache load; resolved once here so a
          // keystroke is `includes` over strings already in the right shape.
          search: animeSearchNames(anime),
          // Flattened once rather than per keystroke — the spread allocated
          // three arrays per anime and threw them away.
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
   * Anime matching the filters, each with the songs that survive them.
   * An anime whose every song is filtered out is dropped — showing a row that
   * expands to nothing is worse than not showing it.
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
    // One snapshot, then a hot loop over plain objects — see `predicates`.
    const { matchesAnime, matchesSong } = libraryFilters.predicates
    const page: { anime: LibraryAnimeEntry; songs: LibraryAnimeSongEntry[] }[] =
      []
    let animeTotal = 0
    let songTotal = 0

    for (const entry of this.#sortedAnime) {
      if (!matchesAnime(entry.anime)) continue

      /*
       * AMQ's two search rules, in its own order (`applySearchFilter`): an
       * anime whose name matches keeps every one of its songs; otherwise only
       * the songs that match themselves — title, artist, composer or arranger
       * — are kept, and the anime survives only if one did.
       */
      const wholeAnime = !query || matchesSearchNames(entry.search, query)

      // Counted in a loop rather than built and measured: the totals in the
      // header need every match, but only the page that is drawn needs an
      // actual array, and allocating 20k of them per keystroke was the rest of
      // the cost.
      const keep = (song: LibraryAnimeSongEntry) =>
        matchesSong(song) &&
        (wholeAnime || (query !== null && songMatchesSearch(song, query)))
      let matching = 0
      for (const song of entry.songs) {
        if (keep(song)) matching += 1
      }
      // An anime whose every song is filtered out is dropped — a row that
      // expands to nothing is worse than no row. With a search on, that now
      // also covers an anime no part of which matched.
      if (matching === 0) continue

      animeTotal += 1
      songTotal += matching

      if (page.length < PAGE) {
        page.push({ anime: entry.anime, songs: entry.songs.filter(keep) })
      }
    }

    // Already in display order: `#sortedAnime` was iterated in it.
    return { page, animeTotal, songTotal }
  }

  /** Songs matching the filters, for the two song-shaped tabs. */
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
      // These two tabs are song lists, so AMQ's anime target is tested per row
      // against the song's own anime (`LibrarySongSoloEntry.searchNames`
      // delegates to it) rather than deciding a group of them.
      const animeHit = query ? matchesSearchNames(entry.search, query) : false
      for (const song of entry.songs) {
        if (!matchesSong(song)) continue
        if (tab === 'wrong' && !song.wrongIndex) continue
        if (query && !animeHit && !songMatchesSearch(song, query)) continue
        out.push(song)
      }
    }

    if (tab === 'new') {
      // Newest first, then AMQ's own cap of 200.
      out.sort((a, b) => b.annSongId - a.annSongId)
      return out.slice(0, NEW_SONG_DISPLAY_AMOUNT)
    }
    // Recently wrong, most recent first.
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

  /** How many rows the pane is actually drawing, of how many matched. */
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
      // `category` is an object; `animeTypeLabel` is the only thing that may
      // render it, or the row reads "[object Object]".
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
   * True when a whole pass failed — the payload has moved under us.
   *
   * A getter rather than a `$derived`: it reads a non-reactive flag, so a
   * derived would cache `false` forever. Templates re-read it each render, and
   * the render that sets it is the one that empties `rows`.
   */
  get broken() {
    return libraryPassFailed()
  }
}

export const libraryStore = new LibraryStore()
