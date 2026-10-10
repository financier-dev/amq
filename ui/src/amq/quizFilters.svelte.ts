/**
 * Library filter state, predicate and persistence for the quiz builder
 * (SPEC §10). Follows the structure of `filters.svelte.ts`.
 *
 * The controls cover only what the library payload contains, checked against
 * `library/libraryFilterApplier.js` and `libraryCacheHandler.js`. That is less
 * than SPEC §10 lists:
 *
 *   - **No difficulty.** The bulk library does not carry it. It is available
 *     only per song through `get song extended info`, one request per song.
 *   - **No genres or tags.** They are also fetched per anime, on demand.
 *
 * The payload does support two controls the spec asks for: **anime type**
 * (`category`) and **vintage** (`year`).
 *
 * Songs without an upload are always hidden, with no control for it. AMQ's
 * custom-quiz library forces `uploadedButtonSelected = true`
 * (`customQuizLibrary.js:202`) because such a song cannot be played.
 */

import { t } from './derive'
import { animeTypeKey } from './library.svelte'

export const STORAGE_KEY = 'amq-quiz-library-filters'
// Increase when a default changes. Stored toggles keep the old default
// otherwise, because a group is stored whole.
const STORAGE_VERSION = 2

/** `libraryFilterApplier.js:396` */
export const LIKE_NONE = 0
export const LIKE_LIKED = 1
export const LIKE_DISLIKED = 2

/** `libraryFilterApplier.js:404` */
export const CATEGORY_INSTRUMENTAL = 1
export const CATEGORY_CHANTING = 2
export const CATEGORY_CHARACTER = 3
export const CATEGORY_STANDARD = 4

/** `libraryFilterApplier.js:402` */
export const YEAR_MIN = 1924
export const YEAR_MAX = 2026

export type LibraryTab = 'library' | 'new' | 'wrong'

export type ToggleGroupKey =
  'watchStatus' | 'songTypes' | 'playerState' | 'categories' | 'animeType'

export interface ToggleOption {
  key: string
  label: () => string
}

export interface ToggleGroup {
  key: ToggleGroupKey
  label: () => string
  options: ToggleOption[]
  defaults: Record<string, boolean>
}

function option(key: string, i18n: string, fallback: string): ToggleOption {
  return { key, label: () => t(i18n, fallback) }
}

/**
 * `on` defaults to every option enabled, so an untouched panel hides nothing.
 * Pass a list to enable only those options.
 */
function group(
  key: ToggleGroupKey,
  label: () => string,
  options: ToggleOption[],
  on: true | string[] = true
): ToggleGroup {
  const defaults: Record<string, boolean> = {}
  for (const entry of options) {
    defaults[entry.key] = on === true || on.includes(entry.key)
  }
  return { key, label, options, defaults }
}

export const TOGGLE_GROUPS: ToggleGroup[] = [
  // Defaults to watched only. The full library has about ten times as many
  // anime as a typical watch list, which hides the ones the player knows.
  group(
    'watchStatus',
    () => t('song_library.filters.watch_status', 'Watch status'),
    [
      option('watched', 'song_library.filters.watched', 'Watched'),
      option('unwatched', 'song_library.filters.unwatched', 'Unwatched'),
    ],
    ['watched']
  ),
  group(
    'songTypes',
    () => t('room_browser.filters.song_type.title', 'Song types'),
    [
      option('op', 'quiz_builder.algorithm_block.song_type.opening', 'OP'),
      option('ed', 'quiz_builder.algorithm_block.song_type.ending', 'ED'),
      option('in', 'quiz_builder.algorithm_block.song_type.insert', 'IN'),
    ]
  ),
  group(
    'playerState',
    () => t('song_library.filters.player_state', 'Player state'),
    [
      option('liked', 'song_library.filters.liked', 'Liked'),
      option('unrated', 'song_library.filters.unrated', 'Unrated'),
      option('disliked', 'song_library.filters.disliked', 'Disliked'),
    ]
  ),
  group('categories', () => t('song_catagory.title', 'Song categories'), [
    option('standard', 'song_catagory.standard', 'Standard'),
    option('instrumental', 'song_catagory.instrumental', 'Instrumental'),
    option('chanting', 'song_catagory.chanting', 'Chanting'),
    option('character', 'song_catagory.character', 'Character'),
  ]),
  /*
   * All ten types from `anime_types_base`, not the five SPEC lists. A type
   * with no option could never be filtered out. Keys match what
   * `convertCategoryToKey` derives from `category.name`. Labels come from
   * `anime_types_base` because those strings have no `_NUMBER_` placeholder.
   */
  group(
    'animeType',
    () => t('room_browser.filters.anime_type.title', 'Anime type'),
    [
      option('tv', 'anime_types_base.tv', 'TV'),
      option('season', 'anime_types_base.season', 'Season'),
      option('movie', 'anime_types_base.movie', 'Movie'),
      option('ova', 'anime_types_base.ova', 'OVA'),
      option('ona', 'anime_types_base.ona', 'ONA'),
      option('tv_special', 'anime_types_base.tv_special', 'TV Special'),
      option('special', 'anime_types_base.special', 'Special'),
      option('music_video', 'anime_types_base.music_video', 'Music Video'),
      option('doujin', 'anime_types_base.doujin', 'Doujin'),
      option(
        'game_cutscene_compilation',
        'anime_types_base.game_cutscene_compilation',
        'Game Cutscene'
      ),
    ]
  ),
]

export const GROUPS_BY_KEY = new Map(
  TOGGLE_GROUPS.map((entry) => [entry.key, entry])
)

export type Toggles = Record<ToggleGroupKey, Record<string, boolean>>

export interface LibraryFilterState {
  tab: LibraryTab
  search: string
  toggles: Toggles
  vintage: [number, number]
}

export function defaultState(): LibraryFilterState {
  const toggles = {} as Toggles
  for (const entry of TOGGLE_GROUPS) toggles[entry.key] = { ...entry.defaults }
  return {
    tab: 'library',
    search: '',
    toggles,
    vintage: [YEAR_MIN, YEAR_MAX],
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

/** Merges the stored object **over** the defaults. */
function load(): LibraryFilterState {
  const state = defaultState()
  let stored: any
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return state
    stored = JSON.parse(raw)
  } catch {
    return state
  }
  if (!stored || stored.version !== STORAGE_VERSION) return state

  for (const entry of TOGGLE_GROUPS) {
    const group = stored.toggles?.[entry.key]
    if (!group) continue
    for (const item of entry.options) {
      if (typeof group[item.key] === 'boolean') {
        state.toggles[entry.key][item.key] = group[item.key]
      }
    }
  }
  const pair = stored.vintage
  if (Array.isArray(pair) && pair.length === 2 && pair.every(Number.isFinite)) {
    state.vintage = [
      clamp(pair[0], YEAR_MIN, YEAR_MAX),
      clamp(pair[1], YEAR_MIN, YEAR_MAX),
    ]
  }
  // Search and tab are not restored. They belong to the current session.
  return state
}

const SAVE_DELAY_MS = 300

/**
 * Delay between a keystroke and the re-filter.
 *
 * A filter pass over the whole library takes tens of milliseconds. The field
 * is bound to `draft`, so typing stays instant, and the filter runs once
 * typing stops.
 */
const SEARCH_DEBOUNCE_MS = 120

export class LibraryFilterStore {
  state = $state<LibraryFilterState>(load())
  /** The field's text, updated on every keystroke. */
  draft = $state('')

  #saveTimer: ReturnType<typeof setTimeout> | null = null
  #searchTimer: ReturnType<typeof setTimeout> | null = null
  #defaults = defaultState()

  /** The query the filters use. Follows `draft` after the debounce. */
  get search() {
    return this.state.search
  }

  toggles(group: ToggleGroupKey) {
    return this.state.toggles[group]
  }

  groupChanged(key: ToggleGroupKey) {
    const current = this.state.toggles[key]
    const base = this.#defaults.toggles[key]
    return Object.keys(base).some((option) => current[option] !== base[option])
  }

  readonly vintageChanged = $derived(
    this.state.vintage[0] !== YEAR_MIN || this.state.vintage[1] !== YEAR_MAX
  )

  readonly changedCount = $derived(
    TOGGLE_GROUPS.filter((entry) => this.groupChanged(entry.key)).length +
      (this.vintageChanged ? 1 : 0)
  )

  setSearch(value: string) {
    this.draft = value
    if (this.#searchTimer) clearTimeout(this.#searchTimer)
    // Apply an empty query at once, so that clearing the search is instant.
    if (value === '') {
      this.state.search = ''
      return
    }
    this.#searchTimer = setTimeout(() => {
      this.#searchTimer = null
      this.state.search = value
    }, SEARCH_DEBOUNCE_MS)
  }

  setTab(tab: LibraryTab) {
    this.state.tab = tab
  }

  toggle(group: ToggleGroupKey, option: string) {
    const current = this.state.toggles[group]
    current[option] = !current[option]
    this.#save()
  }

  setVintage(index: 0 | 1, raw: number) {
    if (!Number.isFinite(raw)) return
    const value = clamp(Math.round(raw), YEAR_MIN, YEAR_MAX)
    const pair: [number, number] = [...this.state.vintage]
    pair[index] = value
    // A bound that crosses the other one pushes it along.
    if (index === 0 && value > pair[1]) pair[1] = value
    if (index === 1 && value < pair[0]) pair[0] = value
    this.state.vintage = pair
    this.#save()
  }

  resetGroup(key: ToggleGroupKey) {
    this.state.toggles[key] = { ...this.#defaults.toggles[key] }
    this.#save()
  }

  resetVintage() {
    this.state.vintage = [...this.#defaults.vintage]
    this.#save()
  }

  resetAll() {
    const base = defaultState()
    this.state.toggles = base.toggles
    this.state.vintage = base.vintage
    this.#save()
  }

  #save() {
    if (this.#saveTimer) clearTimeout(this.#saveTimer)
    this.#saveTimer = setTimeout(() => {
      this.#saveTimer = null
      const snapshot = $state.snapshot(this.state)
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            version: STORAGE_VERSION,
            toggles: snapshot.toggles,
            vintage: snapshot.vintage,
          })
        )
      } catch {
        // Storage can fail (private browsing, quota, blocked origin). The
        // filters still work; they are lost on reload.
      }
    }, SAVE_DELAY_MS)
  }

  // --- predicates ----------------------------------------------------------

  /**
   * Predicates over a **plain** snapshot of the filter state.
   *
   * `this.state` is a deep `$state` proxy, and reading it inside the filter
   * loop costs a proxy trap per property access, tens of thousands of times
   * per pass. One snapshot up front avoids that and still registers the
   * dependency, so the derivation re-runs when a filter changes.
   */
  get predicates() {
    const toggles = $state.snapshot(this.state.toggles) as Toggles
    const vintage = $state.snapshot(this.state.vintage) as [number, number]
    return {
      matchesAnime: (anime: LibraryAnimeEntry) =>
        animeMatches(anime, toggles, vintage),
      matchesSong: (song: LibraryAnimeSongEntry) => songMatches(song, toggles),
    }
  }

  /** Tests that do not depend on a specific song. */
  matchesAnime(anime: LibraryAnimeEntry): boolean {
    return animeMatches(
      anime,
      $state.snapshot(this.state.toggles) as Toggles,
      $state.snapshot(this.state.vintage) as [number, number]
    )
  }

  matchesSong(song: LibraryAnimeSongEntry): boolean {
    return songMatches(song, $state.snapshot(this.state.toggles) as Toggles)
  }
}

function animeMatches(
  anime: LibraryAnimeEntry,
  toggles: Toggles,
  vintage: [number, number]
): boolean {
  const watch = toggles.watchStatus
  const watched = anime.watched === true
  if (!watch.watched && watched) return false
  if (!watch.unwatched && !watched) return false

  // `category` is `{ name, number }`, not a string; see LibraryAnimeCategory.
  // An unrecognised type passes the filter, so the entry stays reachable.
  const key = animeTypeKey(anime.category)
  if (key && key in toggles.animeType && !toggles.animeType[key]) return false

  const year = anime.year ?? 0
  if (year && (year < vintage[0] || year > vintage[1])) return false

  return true
}

function songMatches(song: LibraryAnimeSongEntry, toggles: Toggles): boolean {
  // Always applied: a song without an upload cannot be played, so AMQ's
  // custom-quiz library never offers one.
  if (!song.uploaded) return false

  const types = toggles.songTypes
  if (song.type === 1 && !types.op) return false
  if (song.type === 2 && !types.ed) return false
  if (song.type === 3 && !types.in) return false

  const state = toggles.playerState
  const like = song.playerLikeStatus ?? LIKE_NONE
  if (like === LIKE_LIKED && !state.liked) return false
  if (like === LIKE_DISLIKED && !state.disliked) return false
  if (like === LIKE_NONE && !state.unrated) return false

  const categories = toggles.categories
  const category = song.songEntry?.category
  if (category === CATEGORY_STANDARD && !categories.standard) return false
  if (category === CATEGORY_INSTRUMENTAL && !categories.instrumental)
    return false
  if (category === CATEGORY_CHANTING && !categories.chanting) return false
  if (category === CATEGORY_CHARACTER && !categories.character) return false

  return true
}

export const libraryFilters = new LibraryFilterStore()
