/**
 * Library filter state, predicate and persistence for the quiz builder
 * (SPEC §10), modelled on `filters.svelte.ts`.
 *
 * The control set is **exactly what the library payload can actually answer**,
 * which is narrower than the spec drew. Verified against
 * `library/libraryFilterApplier.js` and `libraryCacheHandler.js`:
 *
 *   - **Difficulty is gone.** It is not in the bulk library at all — it exists
 *     only per song behind `get song extended info`, so filtering on it would
 *     mean one round-trip per song.
 *   - **Genres and tags are gone.** Per-anime, on demand, same problem.
 *
 * Both were in SPEC §10, and the spec's own instruction is to drop a control
 * rather than fake it. Two additions the spec asked for and the payload does
 * support are here: **anime type** (`category`) and **vintage** (`year`).
 *
 * One deviation from AMQ worth knowing: its custom-quiz library forces
 * `uploadedButtonSelected = true` (`customQuizLibrary.js:202`), because a song
 * with no video cannot be played. We do the same, and it is not a control —
 * offering an unplayable song is a bug, not a preference.
 */

import { t } from './derive'
import { animeTypeKey } from './library.svelte'

export const STORAGE_KEY = 'amq-quiz-library-filters'
// Bumped when a default changed: stored toggles would otherwise keep the old
// one forever, since persistence records the whole group once anything moves.
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
 * `on` defaults to every option enabled — a filter panel that hides things
 * before it is touched is the behaviour people report as "the library is
 * missing songs". Pass a list to enable only those.
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
  // Watched only. The builder is for picking songs you know, and the full
  // library is ~9,500 anime against a watch list an order of magnitude smaller
  // — starting unfiltered buries the shows you actually recognise.
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
   * The real set, not the five the spec listed. `anime_types_base` ships ten,
   * and a type with no chip can never be filtered out — so listing only five
   * would quietly make Music Videos and Doujin unfilterable. Keys match what
   * `convertCategoryToKey` derives from `category.name`, and the labels come
   * from `anime_types_base` because they carry no `_NUMBER_` slot.
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

/** Merged **over** the defaults, so a control added later gets a sane value. */
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
  // Search and tab are deliberately not restored: both are things you are
  // doing right now, not preferences.
  return state
}

const SAVE_DELAY_MS = 300

/**
 * How long to wait after a keystroke before re-filtering.
 *
 * The room browser searches ~20 rooms and needs none of this; this pane filters
 * tens of thousands of anime, which costs tens of milliseconds a pass. Typing
 * stays instant because the field is bound to the draft, and the expensive
 * derivation runs once the typing stops.
 */
const SEARCH_DEBOUNCE_MS = 120

export class LibraryFilterStore {
  state = $state<LibraryFilterState>(load())
  /** What the field shows — updated on every keystroke. */
  draft = $state('')

  #saveTimer: ReturnType<typeof setTimeout> | null = null
  #searchTimer: ReturnType<typeof setTimeout> | null = null
  #defaults = defaultState()

  /** What the filters actually use; trails `draft` by the debounce. */
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

  /** Drives the Filters badge, as the room browser's does. */
  readonly changedCount = $derived(
    TOGGLE_GROUPS.filter((entry) => this.groupChanged(entry.key)).length +
      (this.vintageChanged ? 1 : 0)
  )

  setSearch(value: string) {
    this.draft = value
    if (this.#searchTimer) clearTimeout(this.#searchTimer)
    // An empty box is the one case worth applying at once: clearing a search
    // should feel like undoing it, not like waiting for it.
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
    // Pushing rather than rejecting, same rule as the room browser's ranges.
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
        // Private browsing, quota, a blocked origin — filters still work for
        // this session, they just do not survive a reload.
      }
    }, SAVE_DELAY_MS)
  }

  // --- predicates ----------------------------------------------------------

  /**
   * Predicates closed over a **plain** snapshot of the filter state.
   *
   * Reading `this.state` inside a loop is what made searching a real library
   * slow: it is a deep `$state` proxy, so every property access in the hot path
   * goes through a proxy trap, and the pane makes ~80k of them per keystroke
   * over 20k anime. Taking one snapshot up front and testing against plain
   * objects removes all of it, while still registering the dependency so the
   * derivation re-runs when a filter changes.
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

  /** Anime-level tests: everything that does not depend on a specific song. */
  matchesAnime(anime: LibraryAnimeEntry): boolean {
    return animeMatches(
      anime,
      $state.snapshot(this.state.toggles) as Toggles,
      $state.snapshot(this.state.vintage) as [number, number]
    )
  }

  /** Song-level tests. */
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

  // `category` is `{ name, number }`, not a string — see LibraryAnimeCategory.
  // An unrecognised type is shown rather than hidden: a library entry the
  // filter does not understand is not a reason to make it unreachable.
  const key = animeTypeKey(anime.category)
  if (key && key in toggles.animeType && !toggles.animeType[key]) return false

  const year = anime.year ?? 0
  if (year && (year < vintage[0] || year > vintage[1])) return false

  return true
}

function songMatches(song: LibraryAnimeSongEntry, toggles: Toggles): boolean {
  // AMQ's custom-quiz library only offers uploaded songs, because an
  // un-uploaded one cannot be played. Not a control — a correctness rule.
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
