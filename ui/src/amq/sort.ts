/** Room browser column sorting (SPEC §3). */

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

/** Enabled types as a bitfield, which gives O/E/I a fixed order. */
function typeWeight(room: Room) {
  const { openings, endings, inserts } = room.songTypes
  return (openings ? 4 : 0) + (endings ? 2 : 0) + (inserts ? 1 : 0)
}

export const COMPARATORS: Record<SortKey, Comparator> = {
  // Room ids ascend with creation order: oldest first.
  id: by((room) => room.id),
  room: by((room) => room.name.toLowerCase()),
  mode: by((room) => modeLabel(room.mode)),
  players: by((room) => room.playerCount),
  songs: by((room) => room.songCount),
  // A random range sorts by its minimum, the value the cell shows first.
  time: by((room) => room.guessTime.range?.min ?? -1),
  types: by(typeWeight),
  selection: by((room) => songSelectionLabel(room.songSelection)),
  // A lower % correct is harder, so ascending puts the hardest first.
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
  // Break ties by room id so the order stays fixed as rooms update.
  return [...rooms].sort((a, b) => {
    const result = compare(a, b)
    return result !== 0 ? result * sign : a.id - b.id
  })
}
