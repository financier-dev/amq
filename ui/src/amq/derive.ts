/**
 * Pure derivations from a room's `settings`.
 *
 * Everything the row, the filter predicate and the tooltips read lives here, so
 * the three can never disagree about what a room is. Nothing in this file
 * touches the DOM; the only AMQ globals it reads are lookup tables
 * (`idTranslator`, `localizationHandler`, `cdnFormater`, `hostModal`).
 */

import { pageGlobal } from './pageGlobal'

export type GameMode =
  | 'standard'
  | 'community'
  | 'battle-royale'
  | 'hint'
  | 'last-man-standing'
  | 'quick-draw'
  | 'boss-fight'
  | 'amq-awards'

export type SongSelection = 'random' | 'mix' | 'watched' | 'custom'

export interface SongTypes {
  openings: boolean
  endings: boolean
  inserts: boolean
}

// --- localisation ---------------------------------------------------------

/**
 * AMQ's globals are not all present at every point in the boot sequence, and a
 * missing key throws inside i18next. Falling back to the supplied text keeps a
 * single missing string from taking the whole list down.
 */
export function t(key: string, fallback: string, data?: object): string {
  try {
    const translated = localizationHandler.translate(key, data)
    return translated && translated !== key ? translated : fallback
  } catch {
    return fallback
  }
}

// --- mode / types / selection ---------------------------------------------

export function isCommunityMode(settings: RoomSettings) {
  return settings.gameMode === 'Community' || settings.gameMode === 'Themed'
}

/** roomTile.js:54-71 — first match wins, order matters. */
export function modeOf(settings: RoomSettings): GameMode {
  if (isCommunityMode(settings)) return 'community'
  if (settings.showSelection === 2) return 'battle-royale'
  if (settings.scoreType === 2) return 'hint'
  if (settings.scoreType === 4) return 'last-man-standing'
  if (settings.scoreType === 3) return 'quick-draw'
  if (settings.scoreType === 5) return 'boss-fight'
  if (settings.gameMode === 'event-hosted') return 'amq-awards'
  return 'standard'
}

const MODE_KEYS: Record<GameMode, [string, string]> = {
  standard: ['standard', 'Standard'],
  community: ['community', 'Community'],
  'battle-royale': ['battle_royale', 'Battle Royale'],
  hint: ['hint', 'Hint'],
  'last-man-standing': ['last_man_standing', 'Last Man'],
  'quick-draw': ['quick_draw', 'Quick Draw'],
  'boss-fight': ['boss_fight', 'Boss Fight'],
  'amq-awards': ['amq_awards', 'AMQ Awards'],
}

export function modeLabel(mode: GameMode) {
  const [key, fallback] = MODE_KEYS[mode]
  return t(`room_browser.room_tile.game_mode.${key}`, fallback)
}

/**
 * Colour family for the Mode pill.
 *
 * Rose already means "room full" in the Players cell and "excluded" in the
 * chips, so it is reserved here for the rare modes. Last Man Standing is one
 * of the most common modes in public rooms and was reading as a warning on
 * every other row; it takes teal.
 */
export function modeTone(mode: GameMode) {
  switch (mode) {
    case 'last-man-standing':
      return 'teal'
    case 'quick-draw':
      return 'amber'
    case 'hint':
    case 'amq-awards':
      return 'violet'
    case 'battle-royale':
    case 'community':
      return 'cyan'
    case 'boss-fight':
      return 'rose'
    default:
      return 'blue'
  }
}

/**
 * roomTile.js:37-52 — a type counts as enabled only when the standard toggle is
 * on AND the advanced value allows it (or advanced random is on).
 */
export function songTypesOf(settings: RoomSettings): SongTypes {
  if (isCommunityMode(settings)) {
    return { openings: true, endings: true, inserts: true }
  }
  const { standardValue: std, advancedValue: adv } = settings.songType
  return {
    openings: Boolean(std.openings && (adv.openings || adv.random)),
    endings: Boolean(std.endings && (adv.endings || adv.random)),
    inserts: Boolean(std.inserts && (adv.inserts || adv.random)),
  }
}

export function songSelectionOf(settings: RoomSettings): SongSelection {
  if (isCommunityMode(settings)) return 'custom'
  const selection = settings.songSelection
  if (selection?.advancedOn) return 'custom'
  switch (selection?.standardValue) {
    case 1:
      return 'random'
    case 2:
      return 'mix'
    case 3:
      return 'watched'
    default:
      return 'custom'
  }
}

export function songSelectionLabel(selection: SongSelection) {
  const fallbacks: Record<SongSelection, string> = {
    random: 'Random',
    mix: 'Mixed',
    watched: 'Watched',
    custom: 'Custom',
  }
  return t(
    `room_browser.room_tile.song_selection.${selection}`,
    fallbacks[selection]
  )
}

export function songSelectionTone(selection: SongSelection) {
  switch (selection) {
    case 'watched':
      return 'teal'
    case 'random':
      return 'violet'
    case 'mix':
      return 'amber'
    default:
      // Custom takes the blue that random vacated, so all four stay distinct.
      return 'blue'
  }
}

// --- guess time -----------------------------------------------------------

export interface GuessTime {
  /** Null in community/custom-song rooms, where the number is meaningless. */
  range: { min: number; max: number } | null
  extra: { min: number; max: number } | null
}

export function guessTimeOf(settings: RoomSettings): GuessTime {
  if (isCommunityMode(settings)) return { range: null, extra: null }
  return {
    range: rangeOf(settings.guessTime),
    extra: positiveRange(settings.extraGuessTime),
  }
}

function rangeOf(setting: RoomRandomRange | undefined) {
  if (!setting) return null
  return setting.randomOn
    ? { min: setting.randomValue[0], max: setting.randomValue[1] }
    : { min: setting.standardValue, max: setting.standardValue }
}

function positiveRange(setting: RoomRandomRange | undefined) {
  const range = rangeOf(setting)
  return range && range.max > 0 ? range : null
}

/** `20`, `25–30` — the unit is added by the cell so it can size the suffix. */
export function rangeLabel(range: { min: number; max: number }) {
  return range.min === range.max ? `${range.min}` : `${range.min}–${range.max}`
}

// --- difficulty -----------------------------------------------------------

export interface DifficultyTier {
  key: 'expert' | 'hard' | 'medium' | 'easy' | 'beginner'
  min: number
  max: number
  colour: string
}

/**
 * customQuizAlgorithmBlock.js `convertDifficulityToText()`. Lower % correct is
 * harder, so the scale runs hard→easy left to right.
 *
 * SPEC §3: use this five-tier map everywhere. `roomFilter.js` still ships a
 * legacy three-tier mapping (hard 0-20, medium 20-60, easy 60-100) — overridden.
 */
export const DIFFICULTY_TIERS: DifficultyTier[] = [
  { key: 'expert', min: 0, max: 15, colour: '#e5658a' },
  { key: 'hard', min: 15, max: 25, colour: '#ef8a5a' },
  { key: 'medium', min: 25, max: 50, colour: '#e8b84d' },
  { key: 'easy', min: 50, max: 70, colour: '#93c96b' },
  { key: 'beginner', min: 70, max: 100, colour: '#34c9a3' },
]

const TIER_FALLBACKS: Record<DifficultyTier['key'], string> = {
  expert: 'Expert',
  hard: 'Hard',
  medium: 'Medium',
  easy: 'Easy',
  beginner: 'Beginner',
}

export function tierLabel(tier: DifficultyTier) {
  return t(
    `game_settings.song_difficulty.${tier.key}`,
    TIER_FALLBACKS[tier.key]
  )
}

export function difficultyRange(settings: RoomSettings) {
  const difficulty = settings.songDifficulity
  if (!difficulty) return { min: 0, max: 100 }
  if (difficulty.advancedOn) {
    const [min, max] = difficulty.advancedValue
    return { min, max }
  }
  let min = 100
  let max = 0
  for (const tier of DIFFICULTY_TIERS) {
    if (difficulty.standardValue?.[tier.key]) {
      min = Math.min(min, tier.min)
      max = Math.max(max, tier.max)
    }
  }
  // No tier selected at all is not a state the host modal can produce, but the
  // payload is the server's — fall back to the full range rather than min > max.
  return min > max ? { min: 0, max: 100 } : { min, max }
}

export function tiersTouched(range: { min: number; max: number }) {
  return DIFFICULTY_TIERS.filter(
    (tier) => tier.max > range.min && tier.min < range.max
  )
}

// --- chips ----------------------------------------------------------------

export type ChipTone = 'teal' | 'amber' | 'violet' | 'rose' | 'blue' | 'off'

export interface Chip {
  /** Stable identity for keyed `{#each}`. */
  id: string
  label: string
  tone: ChipTone
  tooltip: string
  /** Optional entries render with a dashed border (SPEC §3). */
  dashed?: boolean
}

function defaults(): Partial<RoomSettings> {
  try {
    return hostModal?.DEFUALT_SETTINGS ?? {}
  } catch {
    return {}
  }
}

function genreTagName(id: number, kind: 'genre' | 'tag') {
  let name: string | undefined
  try {
    name =
      kind === 'genre' ? idTranslator.genreNames[id] : idTranslator.tagNames[id]
  } catch {
    name = undefined
  }
  if (!name) return `#${id}`
  try {
    const key =
      kind === 'genre'
        ? localizationHandler.convertAnimeGenreToKey(name)
        : localizationHandler.convertAnimeTagToKey(name)
    return t(key, name)
  } catch {
    return name
  }
}

/**
 * Abbreviation → long form. The short labels are ours, so the copy is too.
 *
 * Only a modifier that differs from `hostModal.DEFUALT_SETTINGS` earns a chip
 * (SPEC §3), and four of the six default to *on* — so for those the newsworthy
 * state is off, and the label has to say so. Rendering a bare `DUP` for the
 * default-on case would mark every vanilla room.
 */
const MODIFIER_CHIPS: {
  key: keyof RoomModifiers
  /** Label and tooltip for the non-default state, whichever way it points. */
  on: [string, string]
  off: [string, string]
}[] = [
  {
    key: 'dubSongs',
    on: ['DUB', 'Dub songs allowed (legacy setting, limited pool)'],
    off: ['NO DUB', 'Dub songs are excluded'],
  },
  {
    key: 'fullSongRange',
    on: ['FULL', 'Full song range — songs can play to the very end'],
    off: ['NO FULL', 'Songs do not play to the very end'],
  },
  {
    key: 'duplicates',
    on: ['DUP', 'Duplicate shows — one show can supply several songs'],
    off: ['NO DUP', 'No duplicate shows — each show supplies at most one song'],
  },
  {
    key: 'rebroadcastSongs',
    on: ['RBC', 'Rebroadcast songs allowed'],
    off: ['NO RBC', 'Rebroadcast songs are excluded'],
  },
  {
    key: 'quizJoin',
    on: ['JOIN', 'Quiz join — players may join after the quiz has started'],
    off: ['NO JOIN', 'Players cannot join once the quiz has started'],
  },
  {
    key: 'lootDropping',
    on: [
      'LOOT',
      'Loot dropping — players can drop collected shows while looting',
    ],
    off: ['NO LOOT', 'Players cannot drop collected shows while looting'],
  },
]

const SONG_POOL_LABELS: Record<number, [string, string]> = {
  1: ['POOL:ALL', 'Song pool — every song in the database'],
  2: ['POOL:LIST', 'Song pool — only songs from players’ lists'],
  3: ['POOL:COM', 'Song pool — community-uploaded songs'],
}

const DISTRIBUTION_LABELS: Record<number, [string, string]> = {
  1: ['DIST:RND', 'Watched distribution — random'],
  2: [
    'DIST:WGT',
    'Watched distribution — weighted by how many players watched',
  ],
  3: ['DIST:EQ', 'Watched distribution — equal per player'],
}

/** Chip label ↔ full name. The label is an abbreviation, so the tooltip has
    to spell it out — repeating "INS, CHR, STD" there explains nothing. */
const SONG_CATEGORIES: Record<string, { short: string; name: string }> = {
  standard: { short: 'STD', name: 'Standard' },
  instrumental: { short: 'INS', name: 'Instrumental' },
  chanting: { short: 'CHA', name: 'Chanting' },
  character: { short: 'CHR', name: 'Character' },
}

function categoryName(key: string) {
  const entry = SONG_CATEGORIES[key]
  return t(`game_settings.song_categories.${key}.title`, entry?.name ?? key)
}

const SONG_TYPE_NAMES: Record<string, [string, string]> = {
  OP: ['room_browser.room_tile.song_types.opening', 'Opening'],
  ED: ['room_browser.room_tile.song_types.ending', 'Ending'],
  IN: ['room_browser.room_tile.song_types.insert', 'Insert'],
}

const PLAYBACK_SPEEDS = ['0.5', '1', '1.5', '2']

/**
 * Every non-default setting worth a glance, in reading order: where songs come
 * from (teal), what widens the pool (amber), what narrows it (violet/rose),
 * then the play rules (blue). Defaults render nothing — an empty cell means a
 * vanilla room, which is itself information (SPEC §3).
 */
export function chipsFor(settings: RoomSettings): Chip[] {
  const chips: Chip[] = []
  const base = defaults()
  const push = (chip: Chip) => chips.push(chip)

  // --- teal: where the songs come from
  if (settings.songPool != null && settings.songPool !== base.songPool) {
    const entry = SONG_POOL_LABELS[settings.songPool]
    if (entry) {
      push({ id: 'pool', label: entry[0], tone: 'teal', tooltip: entry[1] })
    }
  }

  if (
    settings.watchedDistribution != null &&
    settings.watchedDistribution !== base.watchedDistribution
  ) {
    const entry = DISTRIBUTION_LABELS[settings.watchedDistribution]
    if (entry) {
      push({ id: 'dist', label: entry[0], tone: 'teal', tooltip: entry[1] })
    }
  }

  for (const [prefix, key] of [
    ['OP', 'openingCategories'],
    ['ED', 'endingCategories'],
    ['IN', 'insertCategories'],
  ] as const) {
    const value = settings[key] as RoomSongCategories | undefined
    const fallback = base[key] as RoomSongCategories | undefined
    if (!value || !fallback) continue
    const off = Object.keys(fallback).filter(
      (name) =>
        fallback[name as keyof RoomSongCategories] &&
        !value[name as keyof RoomSongCategories]
    )
    if (!off.length) continue
    const kept = Object.keys(value).filter(
      (name) => value[name as keyof RoomSongCategories]
    )
    const [typeKey, typeFallback] = SONG_TYPE_NAMES[prefix]
    const songType = t(typeKey, typeFallback)
    push({
      id: `cat-${key}`,
      label: `${prefix}:${kept.map((name) => SONG_CATEGORIES[name]?.short ?? name.toUpperCase()).join('/') || 'NONE'}`,
      tone: 'teal',
      tooltip: kept.length
        ? `${songType} songs limited to ${kept.map(categoryName).join(', ')}`
        : `No ${songType.toLowerCase()} song categories are enabled`,
    })
  }

  // --- amber: modifiers, whichever way they deviate
  const modifiers = settings.modifiers
  const baseModifiers = base.modifiers
  if (modifiers && baseModifiers) {
    for (const entry of MODIFIER_CHIPS) {
      const on = modifiers[entry.key]
      if (on === baseModifiers[entry.key]) continue
      const [label, tooltip] = on ? entry.on : entry.off
      push({ id: `mod-${entry.key}`, label, tone: 'amber', tooltip })
    }
  }

  // --- violet / rose: anime filters that narrow it
  if (settings.vintage && changed(settings.vintage, base.vintage)) {
    push({
      id: 'vintage',
      label: vintageLabel(settings.vintage),
      tone: 'violet',
      tooltip: `Vintage — ${vintageTooltip(settings.vintage)}`,
    })
  }

  if (settings.type && changed(settings.type, base.type)) {
    const on = Object.keys(settings.type).filter(
      (key) => settings.type![key as keyof RoomAnimeTypes]
    )
    push({
      id: 'type',
      label: on.map((key) => key.toUpperCase()).join('/') || 'NONE',
      tone: 'violet',
      tooltip: `Anime type limited to: ${on.join(', ') || 'nothing'}`,
    })
  }

  if (settings.animeScore && changed(settings.animeScore, base.animeScore)) {
    const [min, max] = settings.animeScore.standardValue
    push({
      id: 'animeScore',
      label: `★${min}–${max}`,
      tone: 'violet',
      tooltip: `Anime score — shows rated ${min} to ${max}`,
    })
  }

  if (
    settings.songPopularity &&
    changed(settings.songPopularity, base.songPopularity)
  ) {
    const on = Object.keys(settings.songPopularity.standardValue).filter(
      (key) => (settings.songPopularity!.standardValue as any)[key]
    )
    push({
      id: 'popularity',
      label: `POP:${on.map((key) => key.slice(0, 3).toUpperCase()).join('/') || 'NONE'}`,
      tone: 'violet',
      tooltip: `Song popularity limited to: ${on.join(', ') || 'nothing'}`,
    })
  }

  for (const [key, kind] of [
    ['genre', 'genre'],
    ['tags', 'tag'],
  ] as const) {
    for (const entry of (settings[key] as RoomGenreTagEntry[] | undefined) ??
      []) {
      const name = genreTagName(entry.id, kind)
      const prefix = entry.state === 1 ? '+' : entry.state === 2 ? '−' : '~'
      push({
        id: `${key}-${entry.id}`,
        label: `${prefix}${name}`,
        tone: entry.state === 2 ? 'rose' : 'violet',
        dashed: entry.state === 3,
        tooltip:
          entry.state === 1
            ? `Include — the show must have the ${name} ${kind}`
            : entry.state === 2
              ? `Exclude — shows with the ${name} ${kind} are left out`
              : `Optional — a show must match at least one optional entry, of which ${name} is one`,
      })
    }
  }

  // --- blue: play rules
  // Team size changes how the player count reads — 6/8 in teams of two is a
  // different room from 6/8 solo — so it earns a chip whenever it is not solo.
  if (settings.teamSize != null && settings.teamSize > 1) {
    push({
      id: 'teamSize',
      label: `TEAM ${settings.teamSize}`,
      tone: 'blue',
      tooltip: `Team size — ${settings.teamSize} players per team`,
    })
  }

  if (settings.scoreType === 5) {
    if (settings.bossLives != null) {
      push({
        id: 'bossLives',
        label: `BOSS ${settings.bossLives}`,
        tone: 'blue',
        tooltip: `Boss lives — each boss starts with ${settings.bossLives}`,
      })
    }
    if (settings.bossPowerUps != null) {
      push({
        id: 'bossPowerUps',
        label: `PWR×${settings.bossPowerUps}`,
        tone: 'blue',
        tooltip: `Boss power-ups — ${settings.bossPowerUps} different ones available to the boss`,
      })
    }
  }

  if (
    settings.scoreType === 4 &&
    settings.lives != null &&
    settings.lives !== base.lives
  ) {
    push({
      id: 'lives',
      label: `♥${settings.lives}`,
      tone: 'blue',
      tooltip: `Lives — each player starts with ${settings.lives}`,
    })
  }

  if (settings.showSelection === 2 && settings.inventorySize) {
    const size = rangeOf(settings.inventorySize)
    if (size) {
      push({
        id: 'inventory',
        label: `INV ${rangeLabel(size)}`,
        tone: 'blue',
        tooltip: `Inventory size — ${rangeLabel(size)} shows carried during the looting phase`,
      })
    }
  }

  if (settings.hintSetup && changed(settings.hintSetup, base.hintSetup)) {
    push({
      id: 'hints',
      label: 'HINTS',
      tone: 'blue',
      tooltip: `Non-default hint costs — song ${settings.hintSetup.songPoints}pt, name ${settings.hintSetup.nameCost}, info ${settings.hintSetup.infoCost}, choice ${settings.hintSetup.multipleChoiceCost}, audio ${settings.hintSetup.audioCost}`,
    })
  }

  if (settings.samplePoint && changed(settings.samplePoint, base.samplePoint)) {
    const point = rangeOf(settings.samplePoint)
    push({
      id: 'samplePoint',
      label: `SMP ${point ? rangeLabel(point) : '?'}%`,
      tone: 'blue',
      tooltip: `Sample point — songs start ${point ? rangeLabel(point) : '?'}% of the way in`,
    })
  }

  if (
    settings.playbackSpeed &&
    changed(settings.playbackSpeed, base.playbackSpeed)
  ) {
    const speed = settings.playbackSpeed
    const label = speed.randomOn
      ? speed.randomValue
          .map((on, index) => (on ? PLAYBACK_SPEEDS[index] : null))
          .filter(Boolean)
          .join('/')
      : (PLAYBACK_SPEEDS[speed.standardValue - 1] ??
        String(speed.standardValue))
    push({
      id: 'playbackSpeed',
      label: `×${label}`,
      tone: 'blue',
      tooltip: `Playback speed — songs play at ×${label}`,
    })
  }

  return chips
}

/**
 * Whether a setting still holds its default, by AMQ's own rule
 * (`roomFilter.js` `compareSettings`).
 *
 * Only the *active* branch counts: with `randomOn` set, `standardValue` is
 * inert and two rooms differing only there are both still default. Comparing
 * the whole object instead made a default sample point (`randomOn: true`,
 * range 0-100) render a chip, because its unused `standardValue` happened to
 * differ.
 */
export function isDefaultSetting(value: unknown, base: unknown): boolean {
  if (base === undefined || value === undefined) return false
  const current = value as any
  const fallback = base as any
  if (current?.randomOn !== undefined) {
    if (current.randomOn !== fallback.randomOn) return false
    return current.randomOn
      ? sameJson(current.randomValue, fallback.randomValue)
      : sameJson(current.standardValue, fallback.standardValue)
  }
  if (current?.advancedOn !== undefined) {
    if (current.advancedOn !== fallback.advancedOn) return false
    return current.advancedOn
      ? sameJson(current.advancedValue, fallback.advancedValue)
      : sameJson(current.standardValue, fallback.standardValue)
  }
  return sameJson(current, fallback)
}

function sameJson(a: unknown, b: unknown) {
  try {
    return JSON.stringify(a) === JSON.stringify(b)
  } catch {
    return false
  }
}

/** True when `value` differs from its default and so deserves a chip. */
function changed(value: unknown, base: unknown) {
  return value !== undefined && !isDefaultSetting(value, base)
}

const SEASONS = ['Winter', 'Spring', 'Summer', 'Fall']

function vintageLabel(vintage: RoomVintage) {
  if (vintage.advancedValueList?.length) {
    const years = vintage.advancedValueList.flatMap((entry) => entry.years)
    return `${Math.min(...years)}–${Math.max(...years)}`
  }
  const [from, to] = vintage.standardValue.years
  return from === to ? `${from}` : `${from}–${to}`
}

function vintageTooltip(vintage: RoomVintage) {
  if (vintage.advancedValueList?.length) {
    return vintage.advancedValueList
      .map(
        (entry) =>
          `${SEASONS[entry.seasons[0]]} ${entry.years[0]} – ${SEASONS[entry.seasons[1]]} ${entry.years[1]}`
      )
      .join(', ')
  }
  const { years, seasons } = vintage.standardValue
  return `${SEASONS[seasons[0]]} ${years[0]} – ${SEASONS[seasons[1]]} ${years[1]}`
}

// --- player profile -------------------------------------------------------

/**
 * Opens AMQ's own profile modal for a player, anchored to the clicked element.
 *
 * Two things this has to get right, both of which silently did nothing before:
 *
 *  - jQuery must come from the page, not `globalThis` — see `pageGlobal`.
 *  - `loadProfileIfClosed` calls the close handler unconditionally when the
 *    modal closes (playerProfileController.js:28), so omitting one throws on
 *    close and leaves the `playerProfileOpen` class stuck on the element,
 *    which then blocks every later click on it.
 */
export function openProfile(target: HTMLElement, name: string) {
  const jquery = pageGlobal<(element: HTMLElement) => any>('$')
  if (typeof jquery !== 'function') {
    console.error(
      '[amq-ui] cannot open a profile: jQuery is not reachable from the page'
    )
    return
  }
  try {
    playerProfileController.loadProfileIfClosed(
      name,
      jquery(target),
      { x: 7 },
      () => {}
    )
  } catch (error) {
    console.error('[amq-ui] could not open profile for', name, error)
  }
}

// --- avatar ---------------------------------------------------------------

export interface AvatarImage {
  src: string
  srcset: string
  /** Full-body fallback, shown if the head crop 404s. */
  fallbackSrc: string
  /**
   * `object-position` for the fallback, so the face fills the circular mask.
   * `sizeModifier` 0 / 20 / 51 are the three avatar builds AMQ ships.
   */
  fallbackPosition: string
}

/**
 * SPEC §3: use the host's head crop, not the full render. Not every
 * avatar/outfit ships one, so `fallbackSrc` is the full `Basic.webp` cropped to
 * the head by `object-position`.
 */
export function avatarImage(hostAvatar: RoomHostAvatar): AvatarImage | null {
  const avatar = hostAvatar?.avatar
  if (!avatar) return null
  const { avatarName, outfitName, optionName, optionActive, colorName } = avatar
  try {
    return {
      src: cdnFormater.newAvatarHeadSrc(
        avatarName,
        outfitName,
        optionName,
        optionActive,
        colorName
      ),
      srcset: cdnFormater.newAvatarHeadSrcSet(
        avatarName,
        outfitName,
        optionName,
        optionActive,
        colorName
      ),
      fallbackSrc: cdnFormater.newSizedAvatarSrc(
        avatarName,
        outfitName,
        optionName,
        optionActive,
        colorName,
        1,
        250
      ),
      fallbackPosition: FALLBACK_POSITIONS[avatar.sizeModifier] ?? '50% 8%',
    }
  } catch {
    return null
  }
}

const FALLBACK_POSITIONS: Record<string, string> = {
  '0': '50% 6%',
  '20': '50% 9%',
  '51': '50% 12%',
}
