/**
 * Client-local ids for quiz blocks and entries.
 *
 * One counter for the whole app, deliberately. The serializer and the store
 * each used to have their own, so a quiz loaded from the server produced
 * `anime-5` and the next entry you added produced `anime-5` as well — two rows
 * sharing an id. Selection is by id, so the settings panel opened on "2
 * entries" when you had clicked one, and every later lookup could find the
 * wrong row.
 *
 * These are never serialized: AMQ identifies blocks and entries by position.
 */

let counter = 0

export function nextId(prefix: string): string {
  counter += 1
  return `${prefix}-${counter}`
}

/** Test seam — keeps ids stable across a round-trip assertion. */
export function resetIds() {
  counter = 0
}
