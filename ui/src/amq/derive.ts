/**
 * Derivations from a room's `settings` that need the game page: labels in the
 * player's language, colours, chips, profiles and avatars. The pure model is
 * in `@shared/rooms`.
 *
 * The row, the filter predicate and the tooltips all read from here, so they
 * agree about a room. Nothing touches the DOM. The only AMQ globals read are
 * lookup tables (`idTranslator`, `localizationHandler`, `cdnFormater`,
 * `hostModal`).
 */

import {
  MODE_NAMES,
  SONG_SELECTION_NAMES,
  TIER_NAMES,
  rangeLabel,
  rangeOf,
  type DifficultyTier,
  type GameMode,
  type SongSelection,
} from '@shared/rooms'
import { pageGlobal } from './pageGlobal'

export {
  DIFFICULTY_TIERS,
  difficultyRange,
  guessTimeOf,
  isCommunityMode,
  modeOf,
  rangeLabel,
  songSelectionOf,
  songTypesOf,
  tiersTouched,
  type DifficultyTier,
  type GameMode,
  type GuessTime,
  type SongSelection,
  type SongTypes,
} from '@shared/rooms'

// --- localisation ---------------------------------------------------------

/**
 * Returns `fallback` when the translation is missing. Some AMQ globals are
 * absent early in boot, and i18next throws on a missing key.
 */
export function t(key: string, fallback: string, data?: object): string {
  try {
    const translated = localizationHandler.translate(key, data)
    return translated && translated !== key ? translated : fallback
  } catch {
    return fallback
  }
}

// --- mode / selection -----------------------------------------------------

export function modeLabel(mode: GameMode) {
  const [key, fallback] = MODE_NAMES[mode]
  return t(`room_browser.room_tile.game_mode.${key}`, fallback)
}

/**
 * Colour family for the Mode pill.
 *
 * Rose already means "room full" in the Players cell and "excluded" in the
 * chips, so only the rare boss-fight mode uses it. Last Man Standing is common
 * in public rooms and takes teal, so it does not read as a warning.
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

export function songSelectionLabel(selection: SongSelection) {
  return t(
    `room_browser.room_tile.song_selection.${selection}`,
    SONG_SELECTION_NAMES[selection]
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
      // Blue, so all four selections have distinct colours.
      return 'blue'
  }
}

// --- difficulty -----------------------------------------------------------

export function tierLabel(tier: DifficultyTier) {
  return t(`game_settings.song_difficulty.${tier.key}`, TIER_NAMES[tier.key])
}

// --- chips ----------------------------------------------------------------

export type ChipTone = 'teal' | 'amber' | 'violet' | 'rose' | 'blue' | 'off'

export interface Chip {
  /** Key for `{#each}`. */
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
 * Chip label and tooltip for each modifier.
 *
 * A modifier gets a chip only when it differs from
 * `hostModal.DEFUALT_SETTINGS` (SPEC §3). Four of the six default to on, so
 * for those the chip marks the off state and its label must say so.
 */
const MODIFIER_CHIPS: {
  key: keyof RoomModifiers
  /** `[label, tooltip]` for each state. Only the non-default state shows. */
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

/** The chip shows `short`; the tooltip spells out `name`. */
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
 * A chip for every non-default setting, in reading order: where songs come
 * from (teal), modifiers (amber), anime filters (violet, rose for exclusions),
 * then play rules (blue). Default settings produce no chip (SPEC §3).
 */
export function chipsFor(settings: RoomSettings): Chip[] {
  const chips: Chip[] = []
  const base = defaults()
  const push = (chip: Chip) => chips.push(chip)

  // Teal: where the songs come from.
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

  // Amber: modifiers that differ from the default, in either direction.
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

  // Violet and rose: anime filters.
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
              : `Optional — a show must match at least one optional entry. ${name} is one of them.`,
      })
    }
  }

  // Blue: play rules.
  // Team size changes how the player count reads (6/8 in teams of two is not
  // 6/8 solo), so any team size above 1 gets a chip.
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
 * Whether a setting still has its default value, by AMQ's rule
 * (`compareSettings` in `roomFilter.js`).
 *
 * Only the active branch counts. With `randomOn` set, `standardValue` is
 * unused, so compare `randomValue` only. A whole-object comparison would
 * report a default setting as changed when only the unused branch differs.
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
 * Opens AMQ's profile modal for a player, anchored to the clicked element.
 *
 *  - jQuery must come from the page, not `globalThis`. See `pageGlobal`.
 *  - Always pass a close handler. `loadProfileIfClosed` calls it
 *    unconditionally when the modal closes (playerProfileController.js:28).
 *    Without one, the close throws and leaves the `playerProfileOpen` class
 *    on the element, which blocks every later click on it.
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
  /** Full-body image, shown if the head crop returns a 404. */
  fallbackSrc: string
  /**
   * `object-position` that puts the face of the fallback inside the circular
   * mask. AMQ ships three avatar builds, with `sizeModifier` 0, 20 and 51.
   */
  fallbackPosition: string
}

/**
 * SPEC §3: show the host's head crop, not the full render. Some avatars and
 * outfits have no head crop, so `fallbackSrc` is the full `Basic.webp`,
 * positioned on the head with `object-position`.
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
