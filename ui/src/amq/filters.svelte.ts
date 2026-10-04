/**
 * Room filter state, predicate and persistence.
 *
 * The control set is exactly `roomFilter.js`'s — SPEC §4 adds and removes
 * nothing. Two deliberate deviations from AMQ:
 *
 *   - Difficulty uses the five-tier map (SPEC §3). `roomFilter.js` still ships
 *     a legacy three-tier mapping that ignores `beginner` and `expert` and can
 *     leave its bounds `undefined`.
 *   - Defaults for "Show only" are Public on, the rest off (SPEC §4). AMQ has
 *     no defaults there at all — it restores four cookies.
 *
 * Persistence is one localStorage key with a version, replacing AMQ's four
 * cookies (SPEC §5).
 */

import { difficultyRange, isDefaultSetting, t } from './derive'
import type { Room } from './rooms.svelte'

export const STORAGE_KEY = 'amq-room-filters'
const STORAGE_VERSION = 1

// --- shape ----------------------------------------------------------------

export type ToggleGroupKey =
  | 'only'
  | 'scoring'
  | 'showSelection'
  | 'answering'
  | 'animeType'
  | 'songTypes'
  | 'songSelection'
  | 'nonDefault'

export type RangeKey = 'roomSize' | 'songCount' | 'guessTime' | 'difficulty'

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

export interface RangeSpec {
  key: RangeKey
  label: () => string
  min: number
  max: number
  /** The difficulty slider paints the five tier bands behind its track. */
  tiers?: boolean
  /** Room size's top stop means "unlimited", not literally 40. */
  maxIsUnbounded?: boolean
}

function group(
  key: ToggleGroupKey,
  label: () => string,
  options: ToggleOption[],
  on: boolean | string[]
): ToggleGroup {
  const defaults: Record<string, boolean> = {}
  for (const option of options) {
    defaults[option.key] =
      typeof on === 'boolean' ? on : on.includes(option.key)
  }
  return { key, label, options, defaults }
}

function option(key: string, i18n: string, fallback: string): ToggleOption {
  return { key, label: () => t(i18n, fallback) }
}

/**
 * Group order is the panel's reading order: SPEC §4 puts Show only, Scoring,
 * Show selection, Answering mode and Anime type in the left column, and Song
 * types, Song selection, the ranges and Only non-default in the right.
 */
export const TOGGLE_GROUPS: ToggleGroup[] = [
  group(
    'only',
    () => t('room_browser.filters.only.title', 'Show only'),
    [
      option('public', 'room_browser.filters.only.public', 'Public'),
      option('inLobby', 'room_browser.filters.only.in_lobby', 'In lobby'),
      option('open', 'room_browser.filters.only.open', 'Open slots'),
      option('friends', 'room_browser.filters.only.friends', 'Friends'),
    ],
    ['public']
  ),
  group(
    'scoring',
    () => t('room_browser.filters.scoring.title', 'Scoring'),
    [
      option('count', 'room_browser.filters.scoring.count', 'Count'),
      option('hint', 'room_browser.filters.scoring.hint', 'Hint'),
      option('speed', 'room_browser.filters.scoring.speed', 'Speed'),
      option('lives', 'room_browser.filters.scoring.lives', 'Lives'),
      option('boss', 'room_browser.filters.scoring.boss', 'Boss'),
    ],
    true
  ),
  group(
    'showSelection',
    () => t('room_browser.filters.show_selection.title', 'Show selection'),
    [
      option('auto', 'room_browser.filters.show_selection.auto', 'Auto'),
      option(
        'looting',
        'room_browser.filters.show_selection.looting',
        'Looting'
      ),
    ],
    true
  ),
  group(
    'answering',
    () => t('room_browser.filters.answering_mode.title', 'Answering mode'),
    [
      option('typing', 'room_browser.filters.answering_mode.typing', 'Typing'),
      option(
        'multipleChoice',
        'room_browser.filters.answering_mode.multiple_choice',
        'Multiple choice'
      ),
    ],
    true
  ),
  group(
    'animeType',
    () => t('room_browser.filters.anime_type.title', 'Anime type'),
    [
      option('tv', 'room_browser.filters.anime_type.tv', 'TV'),
      option('movie', 'room_browser.filters.anime_type.movie', 'Movie'),
      option('ova', 'room_browser.filters.anime_type.ova', 'OVA'),
      option('ona', 'room_browser.filters.anime_type.ona', 'ONA'),
      option('special', 'room_browser.filters.anime_type.special', 'Special'),
    ],
    true
  ),
  group(
    'songTypes',
    () => t('room_browser.filters.song_type.title', 'Song types'),
    [
      option('openings', 'room_browser.filters.song_type.openings', 'Openings'),
      option('endings', 'room_browser.filters.song_type.endings', 'Endings'),
      option('inserts', 'room_browser.filters.song_type.inserts', 'Inserts'),
    ],
    true
  ),
  group(
    'songSelection',
    () => t('room_browser.filters.song_selection.title', 'Song selection'),
    [
      option(
        'watched',
        'room_browser.filters.song_selection.watched',
        'Watched'
      ),
      option(
        'unwatched',
        'room_browser.filters.song_selection.unwatched',
        'Unwatched'
      ),
      option('random', 'room_browser.filters.song_selection.random', 'Random'),
    ],
    true
  ),
  group(
    'nonDefault',
    () => t('room_browser.filters.only_non_default.title', 'Only non-default'),
    [
      option(
        'samplePoint',
        'room_browser.filters.only_non_default.sample_point',
        'Sample point'
      ),
      option(
        'playbackSpeed',
        'room_browser.filters.only_non_default.playback_speed',
        'Playback speed'
      ),
      option(
        'animeScore',
        'room_browser.filters.only_non_default.anime_score',
        'Anime score'
      ),
      option(
        'vintage',
        'room_browser.filters.only_non_default.vintage',
        'Vintage'
      ),
      option('genre', 'room_browser.filters.only_non_default.genre', 'Genre'),
      option('tags', 'room_browser.filters.only_non_default.tag', 'Tag'),
      option(
        'songPopularity',
        'room_browser.filters.only_non_default.popularity',
        'Popularity'
      ),
    ],
    false
  ),
]

export const RANGES: RangeSpec[] = [
  {
    key: 'roomSize',
    label: () =>
      t('room_browser.filters.number_of_players', 'Number of players'),
    min: 2,
    max: 40,
    maxIsUnbounded: true,
  },
  {
    key: 'songCount',
    label: () => t('room_browser.filters.number_of_songs', 'Number of songs'),
    min: 5,
    max: 100,
  },
  {
    key: 'guessTime',
    label: () => t('room_browser.filters.guess_time', 'Guess time'),
    min: 1,
    max: 60,
  },
  {
    key: 'difficulty',
    label: () => t('room_browser.filters.difficulty', 'Difficulty'),
    min: 0,
    max: 100,
    tiers: true,
  },
]

export const GROUPS_BY_KEY = new Map(
  TOGGLE_GROUPS.map((entry) => [entry.key, entry])
)
export const RANGES_BY_KEY = new Map(RANGES.map((entry) => [entry.key, entry]))

export type Toggles = Record<ToggleGroupKey, Record<string, boolean>>
export type Ranges = Record<RangeKey, [number, number]>

export interface FilterState {
  search: string
  toggles: Toggles
  ranges: Ranges
  sort: { key: string; dir: 'asc' | 'desc' }
}

export function defaultState(): FilterState {
  const toggles = {} as Toggles
  for (const entry of TOGGLE_GROUPS) {
    toggles[entry.key] = { ...entry.defaults }
  }
  const ranges = {} as Ranges
  for (const entry of RANGES) {
    ranges[entry.key] = [entry.min, entry.max]
  }
  // SPEC §3: default sort is Players descending.
  return { search: '', toggles, ranges, sort: { key: 'players', dir: 'desc' } }
}

// --- persistence ----------------------------------------------------------

/**
 * Stored object is merged **over** the defaults, so a filter added in a later
 * version gets a sane value rather than `undefined` (SPEC §5).
 */
function load(): FilterState {
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

  if (typeof stored.search === 'string') state.search = stored.search
  for (const entry of TOGGLE_GROUPS) {
    const group = stored.toggles?.[entry.key]
    if (!group) continue
    for (const option of entry.options) {
      if (typeof group[option.key] === 'boolean') {
        state.toggles[entry.key][option.key] = group[option.key]
      }
    }
  }
  for (const entry of RANGES) {
    const pair = stored.ranges?.[entry.key]
    if (
      Array.isArray(pair) &&
      pair.length === 2 &&
      pair.every(Number.isFinite)
    ) {
      state.ranges[entry.key] = [
        clamp(pair[0], entry.min, entry.max),
        clamp(pair[1], entry.min, entry.max),
      ]
    }
  }
  if (
    stored.sort?.key &&
    (stored.sort.dir === 'asc' || stored.sort.dir === 'desc')
  ) {
    state.sort = { key: stored.sort.key, dir: stored.sort.dir }
  }
  return state
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

// --- store ----------------------------------------------------------------

export interface ActiveChip {
  id: string
  label: string
  clear: () => void
}

const SAVE_DELAY_MS = 300

export class FilterStore {
  state = $state<FilterState>(load())

  #saveTimer: ReturnType<typeof setTimeout> | null = null
  #defaults = defaultState()

  // --- reads --------------------------------------------------------------

  get search() {
    return this.state.search
  }

  toggles(group: ToggleGroupKey) {
    return this.state.toggles[group]
  }

  range(key: RangeKey) {
    return this.state.ranges[key]
  }

  groupChanged(key: ToggleGroupKey) {
    const current = this.state.toggles[key]
    const base = this.#defaults.toggles[key]
    return Object.keys(base).some((option) => current[option] !== base[option])
  }

  rangeChanged(key: RangeKey) {
    const [low, high] = this.state.ranges[key]
    const [baseLow, baseHigh] = this.#defaults.ranges[key]
    return low !== baseLow || high !== baseHigh
  }

  /**
   * Count of groups and ranges that differ from default — the Filters badge and
   * the active strip show the same set, so they can never disagree (SPEC §4).
   * Search is deliberately excluded: it has its own visible input.
   */
  readonly changedCount = $derived(
    TOGGLE_GROUPS.filter((entry) => this.groupChanged(entry.key)).length +
      RANGES.filter((entry) => this.rangeChanged(entry.key)).length
  )

  readonly activeChips = $derived.by((): ActiveChip[] => {
    const chips: ActiveChip[] = []
    for (const entry of TOGGLE_GROUPS) {
      if (!this.groupChanged(entry.key)) continue
      const on = entry.options.filter(
        (item) => this.state.toggles[entry.key][item.key]
      )
      chips.push({
        id: `group-${entry.key}`,
        label: `${entry.label()}: ${
          on.length
            ? on.map((item) => item.label()).join(', ')
            : t('lobby.game_settings.none', 'none')
        }`,
        clear: () => this.resetGroup(entry.key),
      })
    }
    for (const entry of RANGES) {
      if (!this.rangeChanged(entry.key)) continue
      const [low, high] = this.state.ranges[entry.key]
      chips.push({
        id: `range-${entry.key}`,
        label: `${entry.label()} ${low}–${high}`,
        clear: () => this.resetRange(entry.key),
      })
    }
    return chips
  })

  // --- writes -------------------------------------------------------------

  setSearch(value: string) {
    this.state.search = value
    this.#save()
  }

  toggle(group: ToggleGroupKey, option: string) {
    const current = this.state.toggles[group]
    current[option] = !current[option]
    this.#save()
  }

  /**
   * Typing a low value above the high one pushes the other handle rather than
   * rejecting the input; values clamp to the spec's bounds (SPEC §4).
   */
  setBound(key: RangeKey, index: 0 | 1, raw: number) {
    const spec = RANGES_BY_KEY.get(key)!
    if (!Number.isFinite(raw)) return
    const value = clamp(Math.round(raw), spec.min, spec.max)
    const pair: [number, number] = [...this.state.ranges[key]]
    pair[index] = value
    if (index === 0 && value > pair[1]) pair[1] = value
    if (index === 1 && value < pair[0]) pair[0] = value
    this.state.ranges[key] = pair
    this.#save()
  }

  setSort(key: string) {
    const sort = this.state.sort
    if (sort.key === key) {
      sort.dir = sort.dir === 'desc' ? 'asc' : 'desc'
    } else {
      this.state.sort = { key, dir: 'desc' }
    }
    this.#save()
  }

  resetGroup(key: ToggleGroupKey) {
    this.state.toggles[key] = { ...this.#defaults.toggles[key] }
    this.#save()
  }

  resetRange(key: RangeKey) {
    this.state.ranges[key] = [...this.#defaults.ranges[key]]
    this.#save()
  }

  /** Leaves search and sort alone — neither is part of the "Active" set. */
  resetAll() {
    const base = defaultState()
    this.state.toggles = base.toggles
    this.state.ranges = base.ranges
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
          JSON.stringify({ version: STORAGE_VERSION, ...snapshot })
        )
      } catch {
        // Private browsing, quota, a blocked origin — filters still work for
        // this session, they just do not survive a reload.
      }
    }, SAVE_DELAY_MS)
  }

  // --- predicate ----------------------------------------------------------

  /** Order follows `roomFilter.js` testRoom, cheapest rejections first. */
  matches(room: Room): boolean {
    const { toggles, ranges } = this.state
    const settings = room.settings

    if (!this.#matchesSearch(room)) return false

    const only = toggles.only
    if (only.public && room.isPrivate) return false
    if (only.inLobby && !room.inLobby) return false
    if (only.open && room.playerCount >= room.roomSize) return false
    if (only.friends && room.friendNames.length === 0) return false

    // The top stop means "unlimited", so a room above it is not excluded.
    const [sizeLow, sizeHigh] = ranges.roomSize
    if (sizeLow > room.roomSize) return false
    if (sizeHigh !== 40 && sizeHigh < room.roomSize) return false

    const [songLow, songHigh] = ranges.songCount
    if (room.songCount < songLow || room.songCount > songHigh) return false

    // SPEC §3: the filter matches on base guess time only, as AMQ's does.
    const [timeLow, timeHigh] = ranges.guessTime
    const guess = settings.guessTime
    if (guess) {
      if (guess.randomOn) {
        if (timeLow > guess.randomValue[0] || timeHigh < guess.randomValue[1]) {
          return false
        }
      } else if (
        timeLow > guess.standardValue ||
        timeHigh < guess.standardValue
      ) {
        return false
      }
    }

    const [diffLow, diffHigh] = ranges.difficulty
    const difficulty = difficultyRange(settings)
    if (diffLow > difficulty.min || diffHigh < difficulty.max) return false

    const showSelection = toggles.showSelection
    if (!showSelection.auto && settings.showSelection === 1) return false
    if (!showSelection.looting && settings.showSelection === 2) return false

    const scoring = toggles.scoring
    if (!scoring.count && settings.scoreType === 1) return false
    if (!scoring.hint && settings.scoreType === 2) return false
    if (!scoring.speed && settings.scoreType === 3) return false
    if (!scoring.lives && settings.scoreType === 4) return false
    if (!scoring.boss && settings.scoreType === 5) return false

    // roomFilter.js uses a different inclusion rule here than the tile does:
    // advanced counts only count when random is off.
    const songType = settings.songType
    const inclusion =
      songType.advancedOn && songType.advancedValue.random === 0
        ? {
            openings: songType.advancedValue.openings > 0,
            endings: songType.advancedValue.endings > 0,
            inserts: songType.advancedValue.inserts > 0,
          }
        : songType.standardValue
    const types = toggles.songTypes
    if (!types.openings && inclusion.openings) return false
    if (!types.endings && inclusion.endings) return false
    if (!types.inserts && inclusion.inserts) return false

    const selection = settings.songSelection?.advancedValue
    const songSelection = toggles.songSelection
    if (selection) {
      if (!songSelection.watched && selection.watched > 0) return false
      if (!songSelection.unwatched && selection.unwatched > 0) return false
      if (!songSelection.random && selection.random > 0) return false
    }

    // MIXED (2) is not filterable, matching AMQ.
    const answering = toggles.answering
    if (!answering.typing && settings.answeringMode === 1) return false
    if (!answering.multipleChoice && settings.answeringMode === 3) return false

    const animeType = settings.type
    const typeFilter = toggles.animeType
    if (animeType) {
      if (!typeFilter.tv && animeType.tv) return false
      if (!typeFilter.movie && animeType.movie) return false
      if (!typeFilter.ova && animeType.ova) return false
      if (!typeFilter.ona && animeType.ona) return false
      if (!typeFilter.special && animeType.special) return false
    }

    // A checked box keeps only rooms where that setting is *not* default.
    for (const [key, on] of Object.entries(toggles.nonDefault)) {
      if (!on) continue
      if (isDefault(key, settings[key])) return false
    }

    return true
  }

  #matchesSearch(room: Room) {
    const query = this.state.search.trim()
    if (!query) return true
    const needle = query.toLowerCase()
    if (room.name.toLowerCase().includes(needle)) return true
    if (room.host.toLowerCase().includes(needle)) return true
    if (String(room.id).includes(needle)) return true
    return [...room.players, ...room.spectators].some((player) =>
      player.name.toLowerCase().includes(needle)
    )
  }
}

/** Looks the setting's live default up and defers to the shared comparison. */
function isDefault(key: string, value: unknown): boolean {
  let base: unknown
  try {
    base = hostModal?.DEFUALT_SETTINGS?.[key]
  } catch {
    base = undefined
  }
  return isDefaultSetting(value, base)
}

export const filterStore = new FilterStore()
