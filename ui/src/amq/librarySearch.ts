/**
 * The library search, matching AMQ's own.
 *
 * `applySearchFilter` (`libraryFilterApplier.js:302`) searches five targets:
 * anime names, song title, artist, composer and arranger. Its target dropdown
 * defaults to "All". Two rules follow from it:
 *
 *   - **An anime-name hit keeps all of the anime's songs**
 *     (`searchFilterSongs = filterSongs`).
 *   - **Any other hit keeps only the songs that matched.** The anime stays
 *     only if at least one song did.
 *
 * Nothing lowercases per keystroke. The cache precomputes `searchNames` per
 * entry: lowercased, plus a character-folded variant when folding changes the
 * string. Per-song names are flattened once per song entry and cached,
 * because `getFullMemberEntryList()` walks a group's members and allocates on
 * every call, and a search runs over tens of thousands of songs.
 *
 * Not implemented: the target dropdown and the **Strict** toggle
 * (`song_library.strict`, "do not include groups that artists belong to").
 * Both only narrow a search, so without them we can return more results than
 * AMQ, never fewer.
 *
 * Also not implemented: AMQ's `entry.searchIndex` prefilter, a first-char →
 * second-char map built in a worker. That worker
 * (`librarySearchIndexCalculator.js`) is not in the client capture, so we
 * cannot check what it indexes. A prefilter narrower than assumed would drop
 * results silently. It would save a few milliseconds at most.
 */

/**
 * Null for a blank query, so callers can skip the search.
 *
 * Only trimmed and lowercased. AMQ folds characters when it stores a name,
 * never when it reads the query (`applySearchFilter` only calls
 * `toLowerCase`), so the folded variants live on the stored side.
 */
export function needle(raw: string): string | null {
  return raw.trim().toLowerCase() || null
}

/**
 * Name variants for an anime. Called once per anime per cache load; see
 * `SortedAnime`.
 *
 * The cache builds `searchNames`; the server does not send it. If a later
 * client renames it, the fallback lowercases `names`. That search has no
 * character folding, but it still returns results.
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
 * `getFullMemberEntryList()` makes the search non-strict, AMQ's default: a
 * group also matches on its members' names, recursively through groups of
 * groups. An artist's alt names are already in its `searchNames`
 * (`addAltName` pushes them there).
 */
function creditSearchNames(entry: LibraryArtistEntry | undefined): string[] {
  if (!entry) return []
  let entries: LibraryArtistEntry[] = [entry]
  if (typeof entry.getFullMemberEntryList === 'function') {
    try {
      entries = entry.getFullMemberEntryList() ?? [entry]
    } catch {
      // If the member list cannot be read, match on the entry's own names.
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
 * Keyed on the shared `songEntry`, not the per-anime song, so a song used by
 * several anime is flattened once. A `WeakMap`, so entries are collected when
 * AMQ replaces the cache.
 */
const songNameCache = new WeakMap<LibrarySongEntry, string[]>()

/**
 * Every name a non-anime target can match, as one list. One list is enough
 * while all four targets are always on. A target dropdown would need one list
 * per target, as `applySearchFilter` tests them.
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
  // A set, so a person credited in several roles is tested once.
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
 * `testEntryAgainstSearch` (`libraryFilterApplier.js:378`).
 *
 * Takes names, not an entry: the caller resolves an anime's names once per
 * cache load.
 */
export function matchesSearchNames(names: string[], query: string): boolean {
  return names.some((name) => name.includes(query))
}

/** `searchTargets.song`, `.artist`, `.composer` and `.arranger` together. */
export function songMatchesSearch(
  song: LibraryAnimeSongEntry,
  query: string
): boolean {
  const entry = song.songEntry
  if (!entry) return false
  return songSearchNames(entry).some((name) => name.includes(query))
}
