/**
 * Column sorting. Every column header is a button (SPEC §3), so every column
 * needs a comparator; `dir` flips on a second click.
 */

import { difficultyRange, modeLabel, songSelectionLabel } from './derive'
import type { Room } from './rooms.svelte'

export type SortKey =
  | 'id'
  | 'room'
  | 'mode'
  | 'players'
  | 'songs'
  | 'time'
  | 'types'
  | 'selection'
  | 'difficulty'

type Comparator = (a: Room, b: Room) => number

function by<T extends number | string>(pick: (room: Room) => T): Comparator {
  return (a, b) => {
    const left = pick(a)
    const right = pick(b)
    if (typeof left === 'string' && typeof right === 'string') {
      return left.localeCompare(right)
    }
    return (left as number) - (right as number)
  }
}

/** Enabled types as a bitfield, so O/E/I sorts in a stable, readable order. */
function typeWeight(room: Room) {
  const { openings, endings, inserts } = room.songTypes
  return (openings ? 4 : 0) + (endings ? 2 : 0) + (inserts ? 1 : 0)
}

export const COMPARATORS: Record<SortKey, Comparator> = {
  // Room ids ascend with creation order, so this is "oldest first".
  id: by((room) => room.id),
  room: by((room) => room.name.toLowerCase()),
  mode: by((room) => modeLabel(room.mode)),
  players: by((room) => room.playerCount),
  songs: by((room) => room.songCount),
  // A randomised range sorts by its floor, which is what the cell leads with.
  time: by((room) => room.guessTime.range?.min ?? -1),
  types: by(typeWeight),
  selection: by((room) => songSelectionLabel(room.songSelection)),
  // Lower % correct is harder; sorting on the floor puts the hardest first.
  difficulty: by((room) => difficultyRange(room.settings).min),
}

export function sortRooms(
  rooms: Room[],
  key: string,
  dir: 'asc' | 'desc'
): Room[] {
  const compare = COMPARATORS[key as SortKey]
  if (!compare) return rooms
  const sign = dir === 'desc' ? -1 : 1
  // Ties fall back to room id so the order never jitters as rooms update.
  return [...rooms].sort((a, b) => {
    const result = compare(a, b)
    return result !== 0 ? result * sign : a.id - b.id
  })
}
