/**
 * The three numbers every rule block reports, and the quiz totals built from
 * them.
 *
 * This is a faithful port of `CustomQuizRuleBlock.updateBlockInfo()`
 * (`customQuizRuleBlock.js:547-621`), which is the only definition of these
 * numbers that matters — it is what AMQ's own Block Info tooltip shows, and
 * SPEC §5.2 puts that tooltip inline and always visible. Reimplementing it
 * "more sensibly" would mean our header and AMQ's tooltip disagree about the
 * same quiz.
 *
 * The subtlety worth knowing: **`duplicates` changes what is being counted.**
 * With duplicates on, a block contributes songs; with it off, it contributes
 * one song per distinct anime, because the same show may not appear twice.
 * That is why the algorithm and anime branches below look asymmetric — they are
 * asymmetric in the client too.
 *
 * Pure: the library is passed in, so this is testable without AMQ.
 */

import type { IncludeSongTypesSave } from './quizSave'
import type { Entry, Quiz, RuleBlock } from './quizModel'

/**
 * What the counts need from AMQ's library cache. Narrow on purpose — a store
 * can satisfy it, and so can a fixture.
 */
export interface LibraryLookup {
  /**
   * The annSongIds an anime entry can draw from, given which types are on.
   * Mirrors `CustomQuizAnimeBlock.targetSongAnnSongIds` — OP, then ED, then
   * insert, and an anime missing from the cache yields nothing.
   */
  animeSongIds(annId: number, types: IncludeSongTypesSave): number[]
  /** `libraryCacheHandler.getAnnIdFromAnnSongId`; undefined when uncached. */
  annIdFromAnnSongId(annSongId: number): number | undefined
}

export interface BlockInfo {
  /** Songs this block can supply — AMQ's `number`. */
  songCount: number
  /** Distinct anime — AMQ's `number2`. */
  uniqueAnime: number
  /** Distinct songs — AMQ's `number3`. */
  uniqueSongs: number
}

export function blockInfo(block: RuleBlock, library: LibraryLookup): BlockInfo {
  let songCount = 0
  const animeSeen = new Set<number>()
  const songsSeen = new Set<number>()
  const { duplicates } = block

  for (const entry of block.entries) {
    if (entry.kind === 'algorithm') {
      const numberOfSongs = Number(entry.settings.numberOfSongs ?? 0)
      const matched = entry.matchedAnnSongIds ?? []

      if (duplicates) {
        // A block that matched fewer songs than it wants can only give what it
        // matched; zero matches means the count is not known yet, so the
        // requested figure stands.
        songCount +=
          matched.length > 0 && matched.length < numberOfSongs
            ? matched.length
            : numberOfSongs
      }

      for (const annSongId of matched) {
        songsSeen.add(annSongId)
        const annId = library.annIdFromAnnSongId(annSongId)
        if (annId !== undefined && !animeSeen.has(annId)) {
          animeSeen.add(annId)
          if (!duplicates) songCount += 1
        }
      }
      continue
    }

    if (entry.kind === 'anime') {
      const available = library.animeSongIds(
        entry.annId,
        entry.includeSongTypes
      )

      if (duplicates) {
        songCount +=
          available.length < entry.numberOfSongs
            ? available.length
            : entry.numberOfSongs
      } else if (!animeSeen.has(entry.annId) && available.length > 0) {
        songCount += 1
      }

      if (available.length > 0) animeSeen.add(entry.annId)
      for (const annSongId of available) songsSeen.add(annSongId)
      continue
    }

    if (entry.kind === 'song') {
      songsSeen.add(entry.annSongId)
      const annId = library.annIdFromAnnSongId(entry.annSongId)

      if (duplicates) {
        songCount += 1
      } else if (annId !== undefined && !animeSeen.has(annId)) {
        songCount += 1
      }

      if (annId !== undefined) animeSeen.add(annId)
    }
    // Message and title blocks play no song and count for nothing.
  }

  return {
    songCount,
    uniqueAnime: animeSeen.size,
    uniqueSongs: songsSeen.size,
  }
}

/**
 * How many songs the block will actually play: its configured `songCount`,
 * limited by what it can supply. SPEC §3 calls this "chosen".
 */
export function blockChosen(block: RuleBlock, library: LibraryLookup): number {
  return Math.min(block.songCount, blockInfo(block, library).songCount)
}

export interface QuizTotals {
  chosen: number
  uniqueSongs: number
  uniqueAnime: number
  blocks: number
}

/**
 * Quiz-wide totals — the summary SPEC §1 puts in the top bar.
 *
 * Unique songs and anime are counted across the whole quiz rather than summed
 * per block, so a show used in two blocks counts once. Summing the per-block
 * figures would double-count it and make the headline number wrong in exactly
 * the case a builder cares about.
 */
export function quizTotals(quiz: Quiz, library: LibraryLookup): QuizTotals {
  const animeSeen = new Set<number>()
  const songsSeen = new Set<number>()
  let chosen = 0

  for (const block of quiz.blocks) {
    chosen += blockChosen(block, library)
    for (const entry of block.entries) {
      collectIds(entry, library, animeSeen, songsSeen)
    }
  }

  return {
    chosen,
    uniqueSongs: songsSeen.size,
    uniqueAnime: animeSeen.size,
    blocks: quiz.blocks.length,
  }
}

function collectIds(
  entry: Entry,
  library: LibraryLookup,
  animeSeen: Set<number>,
  songsSeen: Set<number>
) {
  if (entry.kind === 'anime') {
    const available = library.animeSongIds(entry.annId, entry.includeSongTypes)
    if (available.length > 0) animeSeen.add(entry.annId)
    for (const id of available) songsSeen.add(id)
    return
  }
  if (entry.kind === 'song') {
    songsSeen.add(entry.annSongId)
    const annId = library.annIdFromAnnSongId(entry.annSongId)
    if (annId !== undefined) animeSeen.add(annId)
    return
  }
  if (entry.kind === 'algorithm') {
    for (const id of entry.matchedAnnSongIds ?? []) {
      songsSeen.add(id)
      const annId = library.annIdFromAnnSongId(id)
      if (annId !== undefined) animeSeen.add(annId)
    }
  }
}
