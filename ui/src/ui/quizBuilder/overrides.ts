/**
 * Builds the amber chips that show an entry's overrides on its row
 * (SPEC §5.4).
 *
 * Amber means "differs from its block". The chips are the only place an
 * entry's own settings show without opening a panel, so each chip spells out
 * its value. Colour is never the only signal (SPEC §11).
 *
 * Guess time, sample point and playback speed can each be a *range* the game
 * picks from at random, which the spec does not cover. A range renders as
 * `20–30s`. The editor of SPEC §8 cannot edit a range, so those chips are
 * read-only and their tooltip says so.
 */

import { t } from '../../amq/derive'
import type { GuessModesSave, MaybeRandom } from '../../amq/quizSave'
import type { EntryOverrides } from '../../amq/quizModel'

export interface OverrideChip {
  key: keyof EntryOverrides
  label: string
  tooltip: string
  /** A random range has no editor yet. The panel opens read-only. */
  readOnly: boolean
}

/** Uses an en dash for a range. */
export function formatMaybeRandom(value: MaybeRandom): string {
  return Array.isArray(value) ? `${value[0]}–${value[1]}` : String(value)
}

export function isRandom(value: MaybeRandom | number[] | undefined): boolean {
  return Array.isArray(value)
}

export function guessModeNames(modes: GuessModesSave): string[] {
  const names: string[] = []
  if (modes.song)
    names.push(t('quiz_builder.rule_block.guess_mode.song', 'Song'))
  if (modes.tinyVideo) {
    names.push(t('quiz_builder.rule_block.guess_mode.tiny_video', 'Tiny Video'))
  }
  if (modes.blurVideo) {
    names.push(t('quiz_builder.rule_block.guess_mode.blur_video', 'Blur Video'))
  }
  return names
}

/** True for the default "Song only", which needs no chip. */
export function isSongOnly(modes: GuessModesSave): boolean {
  return modes.song && !modes.tinyVideo && !modes.blurVideo
}

export function overrideChips(overrides: EntryOverrides): OverrideChip[] {
  const chips: OverrideChip[] = []

  if (overrides.guessTime) {
    const { guessTime, extraGuessTime } = overrides.guessTime
    // Extra time is usually 0. Omit it then.
    const extra =
      extraGuessTime === 0 ? '' : ` +${formatMaybeRandom(extraGuessTime)}s`
    chips.push({
      key: 'guessTime',
      label: `${formatMaybeRandom(guessTime)}s${extra}`,
      tooltip: `${t('quiz_builder.rule_labels.guess_time', 'Guess Time')} — ${t(
        'quiz_builder.rule_labels.override_guess_time',
        'Override the default guess time for this block'
      )}`,
      readOnly: isRandom(guessTime) || isRandom(extraGuessTime),
    })
  }

  if (overrides.samplePoint) {
    const { samplePoint } = overrides.samplePoint
    chips.push({
      key: 'samplePoint',
      // A percentage of the song, not seconds. AMQ has no song length to
      // convert with.
      label: `${formatMaybeRandom(samplePoint)}%`,
      tooltip: `${t('quiz_builder.rule_labels.sample_point', 'Sample Point')} — ${t(
        'quiz_builder.rule_labels.override_sample_point',
        'Override the default sample point for this block'
      )}`,
      readOnly: isRandom(samplePoint),
    })
  }

  if (overrides.playBackSpeed) {
    const { playBackSpeed } = overrides.playBackSpeed
    chips.push({
      key: 'playBackSpeed',
      label: Array.isArray(playBackSpeed)
        ? `${playBackSpeed.join('/')}×`
        : `${playBackSpeed}×`,
      tooltip: `${t(
        'quiz_builder.rule_labels.playback_speed',
        'Playback Speed'
      )} — ${t(
        'quiz_builder.rule_labels.override_playback_speed',
        'Override the default playback speed for this block'
      )}`,
      readOnly: Array.isArray(playBackSpeed),
    })
  }

  if (overrides.guessModes) {
    chips.push({
      key: 'guessModes',
      label: guessModeNames(overrides.guessModes).join(' · ') || '—',
      tooltip: t(
        'quiz_builder.rule_labels.override_guess_mode',
        'Override the default guess modes for this block'
      ),
      readOnly: false,
    })
  }

  return chips
}
