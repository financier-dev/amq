/**
 * The algorithm block's summary line and pool chips (SPEC §5.3).
 *
 * The settings are AMQ's and opaque to us. We never edit them; AMQ's own
 * dialog does. These functions only describe what the block selects. They are
 * ports of the three formatters in `CustomQuizAlgorithmBlock`
 * (`customQuizAlgorithmBlock.js:265-325`), so the chips agree with AMQ's own
 * block.
 *
 * `convertDifficulityToText` has a quirk that is kept on purpose. With no
 * difficulty band selected, `min` and `max` keep their initial values and it
 * returns the inverted `100-0`, as AMQ shows.
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

  // Start inverted, as AMQ does.
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

/** `OP · ED · IN`, with only the types the block draws from. */
export function songTypesLabel(settings: Settings): string {
  const type = settings?.songType
  if (!type) return ''
  // Advanced mode has a song count per type. Standard mode has three booleans.
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

  // Skip zero counts. Most blocks have no genres or tags.
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
