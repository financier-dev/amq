/**
 * The library search box, as AMQ's own one actually works.
 *
 * `libraryFilterApplier.js:302` (`applySearchFilter`) searches **five** targets,
 * not one — anime names, song title, artist, composer and arranger — and the
 * dropdown beside the box defaults to "All", so that is the behaviour a player
 * arrives with. Two rules fall out of its shape, and both are load-bearing:
 *
 *   - **An anime-name hit keeps all of the anime's songs**
 *     (`searchFilterSongs = filterSongs`). Searching a show gives you the show.
 *   - **Otherwise only the songs that hit are kept**, and the anime survives
 *     only if one did. Searching an artist gives you their songs inside each
 *     show, not every song of every show they touched.
 *
 * Nothing here lowercases anything in the hot path. `searchNames` is
 * precomputed per entry at cache load — lowercased, and with a
 * character-folded variant alongside when folding changes the string — so a
 * keystroke is `includes` over strings that are already in the right shape.
 * Per-song names are flattened once per song entry and cached, because
 * `getFullMemberEntryList()` walks a group's members and allocates on every
 * call, and this runs over tens of thousands of songs per keystroke.
 *
 * Two of AMQ's controls are deliberately not here: the target dropdown and the
 * **Strict** toggle (`song_library.strict`, "do not include groups that
 * artists belong to"). Both narrow a search that this implements at its widest,
 * default setting, so their absence can only ever return *more* than AMQ
 * would — never less, which is the failure a player notices.
 *
 * AMQ also prefilters every test through `entry.searchIndex`, a first-char →
 * second-char map it builds in a worker. That worker
 * (`librarySearchIndexCalculator.js`) is **not in the client capture**, so what
 * it actually indexes cannot be checked — and a prefilter subtly narrower than
 * assumed drops results silently, which is the bug this file exists to fix.
 * Left out until the worker can be read: it buys a few milliseconds over keys
 * that are already lowercased and resolved.
 */

/**
 * Null for a blank query, so callers can skip the search pass entirely.
 *
 * Lowercased and trimmed, and otherwise left alone: AMQ folds characters when
 * it *stores* a name, never when it reads the query (`applySearchFilter` only
 * calls `toLowerCase`), so the folded variants have to be on the stored side.
 */
export function needle(raw: string): string | null {
  return raw.trim().toLowerCase() || null
}

/**
 * Name variants for an anime, preferring the cache's own precomputed set.
 *
 * Called once per anime per cache load, not per keystroke — see `SortedAnime`.
 * The fallback is not decoration: `searchNames` is built by the cache rather
 * than sent by the server, so a capture that renamed it would silently turn
 * every search into "no results". Lowercasing `names` here is a worse search —
 * no character folding — but it is a search.
 */
export function animeSearchNames(anime: LibraryAnimeEntry): string[] {
  const precomputed = anime.searchNames
  if (Array.isArray(precomputed) && precomputed.length > 0) return precomputed
  return [
    anime.mainName ?? '',
    ...(anime.names ?? []).map((entry) => entry?.name ?? ''),
  ]
    .filter(Boolean)
    .map((name) => String(name).toLowerCase())
}

/**
 * Every name one credit can match.
 *
 * `getFullMemberEntryList()` is what makes a search non-strict, AMQ's default:
 * a group is matched on its members' names as well as its own, recursively
 * through groups of groups. An artist's own alt names are already inside its
 * `searchNames` (`addAltName` pushes them there).
 */
function creditSearchNames(entry: LibraryArtistEntry | undefined): string[] {
  if (!entry) return []
  let entries: LibraryArtistEntry[] = [entry]
  if (typeof entry.getFullMemberEntryList === 'function') {
    try {
      entries = entry.getFullMemberEntryList() ?? [entry]
    } catch {
      // A member graph we cannot walk still has a name of its own.
      entries = [entry]
    }
  }
  const names: string[] = []
  for (const member of entries) {
    const precomputed = member?.searchNames
    if (Array.isArray(precomputed)) names.push(...precomputed)
    else if (member?.name) names.push(String(member.name).toLowerCase())
  }
  return names
}

/**
 * Flattened once per song entry, which is where the cost would otherwise be.
 *
 * Keyed on the shared `songEntry` rather than the per-anime song, so a group
 * credited across a franchise is walked once. A `WeakMap` so it goes with the
 * cache when AMQ replaces it.
 */
const songNameCache = new WeakMap<LibrarySongEntry, string[]>()

/**
 * Every name a non-anime target can match, as one list.
 *
 * Flat rather than one list per target because all four are on — see the note
 * on the dropdown above. If the dropdown ever arrives this splits back into the
 * groups `applySearchFilter` tests separately.
 */
function songSearchNames(songEntry: LibrarySongEntry): string[] {
  const cached = songNameCache.get(songEntry)
  if (cached) return cached

  const names = new Set<string>()
  const title = songEntry.searchNames
  if (Array.isArray(title) && title.length > 0) {
    for (const name of title) names.add(name)
  } else if (songEntry.name) {
    names.add(String(songEntry.name).toLowerCase())
  }
  // One set, so a song whose artist also composed and arranged it is tested
  // once rather than three times.
  for (const credit of [
    songEntry.artist,
    songEntry.composer,
    songEntry.arranger,
  ]) {
    for (const name of creditSearchNames(credit)) names.add(name)
  }

  const flat = [...names]
  songNameCache.set(songEntry, flat)
  return flat
}

/**
 * `libraryFilterApplier.js:378` — `testEntryAgainstSearch`.
 *
 * Takes the names rather than the entry because an anime's are resolved once
 * per cache load, inside the per-entry guard that keeps one unreadable record
 * from costing the whole pane.
 */
export function matchesSearchNames(names: string[], query: string): boolean {
  return names.some((name) => name.includes(query))
}

/** `searchTargets.song` / `.artist` / `.composer` / `.arranger`, together. */
export function songMatchesSearch(
  song: LibraryAnimeSongEntry,
  query: string
): boolean {
  const entry = song.songEntry
  if (!entry) return false
  return songSearchNames(entry).some((name) => name.includes(query))
}
