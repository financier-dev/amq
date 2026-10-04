/**
 * The algorithm block's summary line and pool chips (SPEC §5.3).
 *
 * Its settings blob is AMQ's and stays opaque to us — we never edit it, we open
 * AMQ's own dialog for that. But the block still has to *say* what it selects,
 * so these are faithful ports of `CustomQuizAlgorithmBlock`'s own three
 * formatters (`customQuizAlgorithmBlock.js:265-325`). Porting rather than
 * inventing matters here: the chips are the only summary of a filter set the
 * player configured somewhere else, and a number that disagrees with AMQ's own
 * block face is worse than no number.
 *
 * Note `convertDifficulityToText`'s quirk, reproduced deliberately: with no
 * difficulty band selected the seeds never move and it returns the inverted
 * `100-0`. That is what AMQ shows, so it is what we show.
 */

import { t } from '../../amq/derive'

type Settings = Record<string, any>

export function songSelectionLabel(settings: Settings): string {
  const advanced = settings?.songSelection?.advancedValue
  if (!advanced) return ''
  const { watched = 0, unwatched = 0, random = 0 } = advanced

  if (watched === 0 && unwatched === 0) {
    return t('quiz_builder.algorithm_block.song_selection.random', 'Random')
  }
  if (unwatched === 0 && random === 0) {
    return t('quiz_builder.algorithm_block.song_selection.watched', 'Watched')
  }
  if (watched === 0 && random === 0) {
    return t(
      'quiz_builder.algorithm_block.song_selection.unwatched',
      'Unwatched'
    )
  }
  return t('quiz_builder.algorithm_block.song_selection.mixed', 'Mixed')
}

export function difficultyLabel(settings: Settings): string {
  const difficulty = settings?.songDifficulity
  if (!difficulty) return ''
  const { advancedOn, standardValue, advancedValue } = difficulty

  if (advancedOn) return `${advancedValue[0]}-${advancedValue[1]}`

  // Seeded inverted, exactly as AMQ seeds them.
  let min = 100
  let max = 0
  const bands: [string, number, number][] = [
    ['beginner', 70, 100],
    ['easy', 50, 70],
    ['medium', 25, 50],
    ['hard', 15, 25],
    ['expert', 0, 15],
  ]
  for (const [key, low, high] of bands) {
    if (standardValue?.[key]) {
      min = Math.min(min, low)
      max = Math.max(max, high)
    }
  }
  return `${min}-${max}`
}

export function vintageLabel(settings: Settings): string {
  const vintage = settings?.vintage
  if (!vintage) return ''
  const { standardValue, advancedValueList = [] } = vintage

  if (advancedValueList.length === 0) {
    return `${standardValue?.years?.[0]}-${standardValue?.years?.[1]}`
  }
  let min = 9999
  let max = 0
  for (const { years } of advancedValueList) {
    min = Math.min(min, years[0])
    max = Math.max(max, years[1])
  }
  return `${min}-${max}`
}

/** `OP · ED · IN`, only the types the block actually draws. */
export function songTypesLabel(settings: Settings): string {
  const type = settings?.songType
  if (!type) return ''
  // Advanced mode counts songs per type; standard mode is three booleans.
  const on = type.advancedOn
    ? {
        op: (type.advancedValue?.openings ?? 0) > 0,
        ed: (type.advancedValue?.endings ?? 0) > 0,
        in: (type.advancedValue?.inserts ?? 0) > 0,
      }
    : {
        op: Boolean(type.standardValue?.openings),
        ed: Boolean(type.standardValue?.endings),
        in: Boolean(type.standardValue?.inserts),
      }

  const parts: string[] = []
  if (on.op)
    parts.push(t('quiz_builder.algorithm_block.song_type.opening', 'OP'))
  if (on.ed)
    parts.push(t('quiz_builder.algorithm_block.song_type.ending', 'ED'))
  if (on.in)
    parts.push(t('quiz_builder.algorithm_block.song_type.insert', 'IN'))
  return parts.join(' · ')
}

export interface AlgorithmChip {
  key: string
  label: string
  tooltip: string
}

export function algorithmChips(settings: Settings): AlgorithmChip[] {
  const chips: AlgorithmChip[] = []
  const add = (key: string, label: string, tooltip: string) => {
    if (label) chips.push({ key, label, tooltip })
  }

  add(
    'selection',
    songSelectionLabel(settings),
    t('quiz_builder.algorithm_block.popovers.song_selection', 'Song Selection')
  )
  add(
    'types',
    songTypesLabel(settings),
    t('quiz_builder.algorithm_block.popovers.song_types', 'Song Types')
  )
  add(
    'vintage',
    vintageLabel(settings),
    t('quiz_builder.algorithm_block.popovers.vintage', 'Vintage')
  )
  add(
    'difficulty',
    difficultyLabel(settings),
    t(
      'quiz_builder.algorithm_block.popovers.song_difficulty',
      'Song Difficulty'
    )
  )

  // Only when there are some: `0 Genres` and `0 Tags` are the common case, and
  // a chip that always reads zero is noise on an already dense row.
  const genres = settings?.genre?.length ?? 0
  const tags = settings?.tags?.length ?? 0
  if (genres > 0) {
    add(
      'genres',
      `${genres} ${genres === 1 ? 'Genre' : 'Genres'}`,
      t(
        'quiz_builder.algorithm_block.popovers.genre_count',
        'Number of selected genres'
      )
    )
  }
  if (tags > 0) {
    add(
      'tags',
      `${tags} ${tags === 1 ? 'Tag' : 'Tags'}`,
      t(
        'quiz_builder.algorithm_block.popovers.tag_count',
        'Number of selected tags'
      )
    )
  }

  return chips
}
