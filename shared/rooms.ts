/**
 * The room browser's data model: a `Room` built from AMQ's `New Rooms` and
 * `Room Change` payloads.
 *
 * Everything here is pure. It reads no AMQ global, so it runs both in the
 * game page (`ui/`) and in Node (`local/`), where a script receives the
 * payloads from a headless page.
 */

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

export interface GuessTime {
  /** Null in community rooms, which have no single guess time. */
  range: { min: number; max: number } | null
  extra: { min: number; max: number } | null
}

export interface RoomPlayer {
  name: string
  level: number
}

export interface Room {
  id: number
  name: string
  host: string
  hostAvatar: RoomHostAvatar
  isPrivate: boolean
  inLobby: boolean
  mode: GameMode
  playerCount: number
  roomSize: number
  spectatorCount: number
  players: RoomPlayer[]
  spectators: RoomPlayer[]
  /** The player's friends in this room, among players and spectators. */
  friendNames: string[]
  songCount: number
  songsLeft: number
  guessTime: GuessTime
  songSelection: SongSelection
  songTypes: SongTypes
  settings: RoomSettings
}

// --- mode / types / selection ---------------------------------------------

export function isCommunityMode(settings: RoomSettings) {
  return settings.gameMode === 'Community' || settings.gameMode === 'Themed'
}

/** roomTile.js:54-71. The first match wins, so the order matters. */
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

/** The locale key under `room_browser.room_tile.game_mode` and the English. */
export const MODE_NAMES: Record<GameMode, [key: string, english: string]> = {
  standard: ['standard', 'Standard'],
  community: ['community', 'Community'],
  'battle-royale': ['battle_royale', 'Battle Royale'],
  hint: ['hint', 'Hint'],
  'last-man-standing': ['last_man_standing', 'Last Man'],
  'quick-draw': ['quick_draw', 'Quick Draw'],
  'boss-fight': ['boss_fight', 'Boss Fight'],
  'amq-awards': ['amq_awards', 'AMQ Awards'],
}

/**
 * roomTile.js:37-52. A type is enabled only when the standard toggle is on
 * and the advanced value allows it, or advanced random is on.
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

/** English names. The key under `room_browser.room_tile.song_selection` is the selection itself. */
export const SONG_SELECTION_NAMES: Record<SongSelection, string> = {
  random: 'Random',
  mix: 'Mixed',
  watched: 'Watched',
  custom: 'Custom',
}

// --- guess time -----------------------------------------------------------

export function guessTimeOf(settings: RoomSettings): GuessTime {
  if (isCommunityMode(settings)) return { range: null, extra: null }
  return {
    range: rangeOf(settings.guessTime),
    extra: positiveRange(settings.extraGuessTime),
  }
}

export function rangeOf(setting: RoomRandomRange | undefined) {
  if (!setting) return null
  return setting.randomOn
    ? { min: setting.randomValue[0], max: setting.randomValue[1] }
    : { min: setting.standardValue, max: setting.standardValue }
}

function positiveRange(setting: RoomRandomRange | undefined) {
  const range = rangeOf(setting)
  return range && range.max > 0 ? range : null
}

/** `20` or `25–30`. The caller adds the unit. */
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
 * From `convertDifficulityToText()` in customQuizAlgorithmBlock.js. A lower %
 * correct is harder, so the scale runs from hard to easy.
 *
 * SPEC §3: use this five-tier map everywhere. `roomFilter.js` still ships a
 * three-tier map (hard 0-20, medium 20-60, easy 60-100); do not use it.
 */
export const DIFFICULTY_TIERS: DifficultyTier[] = [
  { key: 'expert', min: 0, max: 15, colour: '#e5658a' },
  { key: 'hard', min: 15, max: 25, colour: '#ef8a5a' },
  { key: 'medium', min: 25, max: 50, colour: '#e8b84d' },
  { key: 'easy', min: 50, max: 70, colour: '#93c96b' },
  { key: 'beginner', min: 70, max: 100, colour: '#34c9a3' },
]

/** English names. The locale key is `game_settings.song_difficulty.<key>`. */
export const TIER_NAMES: Record<DifficultyTier['key'], string> = {
  expert: 'Expert',
  hard: 'Hard',
  medium: 'Medium',
  easy: 'Easy',
  beginner: 'Beginner',
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
  // The host modal cannot produce "no tier selected", but the server sends the
  // payload. Fall back to the full range so that min never exceeds max.
  return min > max ? { min: 0, max: 100 } : { min, max }
}

export function tiersTouched(range: { min: number; max: number }) {
  return DIFFICULTY_TIERS.filter(
    (tier) => tier.max > range.min && tier.min < range.max
  )
}

// --- payload → Room -------------------------------------------------------

export function toRoom(info: RoomInfo): Room {
  const { settings } = info
  return {
    id: info.id,
    name: settings.roomName,
    host: info.host,
    hostAvatar: info.hostAvatar,
    isPrivate: Boolean(settings.privateRoom),
    inLobby: info.inLobby,
    mode: modeOf(settings),
    playerCount: info.numberOfPlayers,
    roomSize: settings.roomSize,
    spectatorCount: info.numberOfSpectators,
    players: info.allPlayers?.players ?? [],
    spectators: info.allPlayers?.spectators ?? [],
    friendNames: info.friendNames ?? [],
    songCount: settings.numberOfSongs,
    songsLeft: info.songLeft,
    guessTime: guessTimeOf(settings),
    songSelection: songSelectionOf(settings),
    songTypes: songTypesOf(settings),
    settings,
  }
}

/** Recomputes the fields derived from `settings` after a patch. */
function applySettings(room: Room, settings: RoomSettings): Room {
  return {
    ...room,
    settings,
    name: settings.roomName,
    isPrivate: Boolean(settings.privateRoom),
    roomSize: settings.roomSize,
    songCount: settings.numberOfSongs,
    mode: modeOf(settings),
    guessTime: guessTimeOf(settings),
    songSelection: songSelectionOf(settings),
    songTypes: songTypesOf(settings),
  }
}

/**
 * roomTile.js:267-281. A name already in the roster leaves; a name not in it
 * joins. The player count does not tell the two apart: the payload sets it in
 * both cases.
 */
function toggleRosterEntry(
  roster: RoomPlayer[],
  name: string,
  level: number
): RoomPlayer[] {
  const index = roster.findIndex((entry) => entry.name === name)
  if (index !== -1) {
    return roster.filter((_, position) => position !== index)
  }
  return [...roster, { name, level }]
}

/** The server tracks friends. `friend` is set only when a friend moved. */
function toggleFriend(friends: string[], name: string, joined: boolean) {
  if (joined) {
    return friends.includes(name) ? friends : [...friends, name]
  }
  return friends.filter((friend) => friend !== name)
}

/**
 * Applies one `Room Change` to its room. Returns null when the room closed:
 * roomTile.js:325 treats any `changeType` it does not know as a close.
 */
export function applyRoomChange(
  room: Room,
  payload: RoomChangeData
): Room | null {
  switch (payload.changeType) {
    case 'settings':
      if (!payload.change) return room
      return applySettings(room, { ...room.settings, ...payload.change })

    case 'players': {
      const next: Room = { ...room }
      if (payload.friend) {
        next.friendNames = toggleFriend(
          room.friendNames,
          payload.friend,
          (payload.playerCount ?? 0) > room.playerCount
        )
      }
      next.playerCount = payload.playerCount ?? room.playerCount
      if (payload.playerName) {
        next.players = toggleRosterEntry(
          room.players,
          payload.playerName,
          payload.playerLevel ?? 0
        )
      }
      if (payload.newHost) next.host = payload.newHost.name
      return next
    }

    case 'spectators': {
      const next: Room = { ...room }
      if (payload.friend) {
        next.friendNames = toggleFriend(
          room.friendNames,
          payload.friend,
          (payload.spectatorCount ?? 0) > room.spectatorCount
        )
      }
      next.spectatorCount = payload.spectatorCount ?? room.spectatorCount
      if (payload.playerName) {
        next.spectators = toggleRosterEntry(
          room.spectators,
          payload.playerName,
          payload.playerLevel ?? 0
        )
      }
      return next
    }

    case 'songsLeft':
      return { ...room, songsLeft: payload.songsLeft ?? room.songsLeft }

    case 'game start':
      return { ...room, inLobby: false, songsLeft: room.songCount }

    case 'game over':
      return { ...room, inLobby: true }

    default:
      return null
  }
}
