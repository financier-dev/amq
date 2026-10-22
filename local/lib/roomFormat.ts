import {
  MODE_NAMES,
  SONG_SELECTION_NAMES,
  difficultyRange,
  rangeLabel,
} from '@shared/rooms'
import type { CachedRoom } from './roomCache'

export function playersLabel(room: CachedRoom) {
  const spectators = room.spectatorCount ? ` +${room.spectatorCount}` : ''
  return `${room.playerCount}/${room.roomSize}${spectators}`
}

export function statusLabel(room: CachedRoom) {
  return room.inLobby ? 'Lobby' : `Playing, ${room.songsLeft} left`
}

export function modeLabel(room: CachedRoom) {
  return MODE_NAMES[room.mode][1]
}

export function guessTimeLabel(room: CachedRoom) {
  const { range, extra } = room.guessTime
  if (!range) return '-'
  return `${rangeLabel(range)}s` + (extra ? ` +${rangeLabel(extra)}s` : '')
}

export function songTypesLabel(room: CachedRoom) {
  const { openings, endings, inserts } = room.songTypes
  return (
    [openings && 'OP', endings && 'ED', inserts && 'IN']
      .filter(Boolean)
      .join('/') || '-'
  )
}

export function selectionLabel(room: CachedRoom) {
  return SONG_SELECTION_NAMES[room.songSelection]
}

export function difficultyLabel(room: CachedRoom) {
  const { min, max } = difficultyRange(room.settings)
  return min === 0 && max === 100 ? 'Any' : `${min}–${max}%`
}

/** One line, for a notification or a log. */
export function roomSummary(room: CachedRoom) {
  return [
    `${room.host}'s room`,
    room.isPrivate ? 'private' : 'public',
    `${playersLabel(room)} players`,
    statusLabel(room),
    modeLabel(room),
    `${room.songCount} songs`,
    songTypesLabel(room),
  ].join(' · ')
}
