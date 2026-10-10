/**
 * Client-local ids for quiz blocks and entries.
 *
 * The whole app must share this one counter. Selection and lookups go by id,
 * so two counters would hand the same id to two rows.
 *
 * The ids are never serialized: AMQ identifies blocks and entries by position.
 */

let counter = 0

export function nextId(prefix: string): string {
  counter += 1
  return `${prefix}-${counter}`
}

/** For tests: keeps ids stable across a round-trip assertion. */
export function resetIds() {
  counter = 0
}
