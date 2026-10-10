/**
 * The three numbers each rule block reports, and the quiz totals.
 *
 * This is a port of `CustomQuizRuleBlock.updateBlockInfo()`
 * (`customQuizRuleBlock.js:547-621`), which produces the numbers in AMQ's
 * Block Info tooltip. Keep it faithful, or our header and AMQ's tooltip
 * disagree about the same quiz.
 *
 * **`duplicates` changes what is counted.** With duplicates on, a block
 * contributes songs. With it off, a block contributes one song per distinct
 * anime, because an anime may not appear twice. The algorithm and anime
 * branches are asymmetric for that reason, as they are in the client.
 *
 * Pure: the caller passes the library.
 */

import type { IncludeSongTypesSave } from './quizSave'
import type { Entry, Quiz, RuleBlock } from './quizModel'

/** What the counts need from AMQ's library cache. */
export interface LibraryLookup {
  /**
   * The annSongIds an anime entry can draw from for the enabled types, in the
   * order OP, ED, insert. Empty for an anime missing from the cache. Follows
   * `CustomQuizAnimeBlock.targetSongAnnSongIds`.
   */
  animeSongIds(annId: number, types: IncludeSongTypesSave): number[]
  /** `libraryCacheHandler.getAnnIdFromAnnSongId`. Undefined when uncached. */
  annIdFromAnnSongId(annSongId: number): number | undefined
}

export interface BlockInfo {
  /** Songs this block can supply. AMQ's `number`. */
  songCount: number
  /** Distinct anime. AMQ's `number2`. */
  uniqueAnime: number
  /** Distinct songs. AMQ's `number3`. */
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
        // A block that matched fewer songs than it requests supplies only the
        // matches. Zero matches means the count is not known yet, so use the
        // requested number.
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
    // Message and title entries play no song.
  }

  return {
    songCount,
    uniqueAnime: animeSeen.size,
    uniqueSongs: songsSeen.size,
  }
}

/**
 * How many songs the block plays: its `songCount`, limited by what it can
 * supply. SPEC §3 calls this "chosen".
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
 * Totals for the top bar (SPEC §1).
 *
 * Unique songs and anime are counted across the whole quiz, so an anime used
 * in two blocks counts once. A sum of the per-block numbers would count it
 * twice.
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
