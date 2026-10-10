import { registerCommand } from './commands'
import { getAllAnimeNames } from '@shared/anime'
import { getAnswerInputEl } from './lib/elements'
import { addListener } from '@shared/events'

const DEFAULT_DELAY_S = 1

const parseDelay = (args: string): number | null => {
  const trimmed = args.trim()
  if (trimmed === '') return DEFAULT_DELAY_S
  const value = Number(trimmed)
  return Number.isFinite(value) && value >= 0 ? value : null
}

/**
 * Votes to skip after a delay once your answer (`/autoskip`) or a
 * teammate's answer (`/avs`) is a valid anime name.
 */
export default async function setup() {
  const animeNames = getAllAnimeNames({ lowercase: true })
  const isValidAnime = (s: string) =>
    animeNames.current.includes(s.toLocaleLowerCase())

  const voteSkip = () => {
    if (quiz.skipController._toggled) return
    quiz.skipController.highlight = true
    quiz.skipClicked()
  }

  const createAutoSkip = (
    command: string,
    label: string,
    description: string,
    defaultActive: boolean
  ) => {
    let active = defaultActive
    let delayS = DEFAULT_DELAY_S
    let pendingTimeout: ReturnType<typeof setTimeout> | null = null

    const cancel = () => {
      if (pendingTimeout === null) return
      clearTimeout(pendingTimeout)
      pendingTimeout = null
    }

    const schedule = (shouldVote: () => boolean) => {
      cancel()
      pendingTimeout = setTimeout(() => {
        pendingTimeout = null
        if (active && shouldVote()) voteSkip()
      }, delayS * 1000)
    }

    const status = () => (active ? `enabled (${delayS}s delay)` : 'disabled')
    const usage = `/${command} [delay in seconds, defaults to ${DEFAULT_DELAY_S}]`

    registerCommand(
      command,
      () => ({
        shortHelp: `Toggle ${label.toLowerCase()}`,
        longHelp: `Usage: ${usage}</br>${description} With a delay argument, enables it with that delay; without one, toggles it.</br>Current value: ${status()}`,
      }),
      (args) => {
        const delay = parseDelay(args)
        if (delay === null) {
          gameChat.systemMessage(`Usage: ${usage}`)
          return
        }
        active = args.trim() !== '' || !active
        delayS = delay
        if (!active) cancel()
        gameChat.systemMessage(`${label}: ${status()}`)
      }
    )

    return {
      isActive: () => active,
      schedule,
      cancel,
    }
  }

  const autoSkip = createAutoSkip(
    'autoskip',
    'Auto skip',
    'Votes to skip once the answer input contains a valid anime name.',
    true
  )
  const autoVoteSkip = createAutoSkip(
    'avs',
    'Auto vote skip',
    'Votes to skip whenever another player on your team writes a valid anime name.',
    false
  )

  const answerInput = getAnswerInputEl()
  if (answerInput) {
    answerInput.addEventListener('input', () => {
      autoSkip.cancel()
      if (!autoSkip.isActive()) return

      const value = answerInput.value
      if (!isValidAnime(value)) return

      autoSkip.schedule(() => answerInput.value === value)
    })
  } else {
    console.error('amq-auto-skip: answer input not found')
  }

  let avsPendingPlayerId: number | null = null
  addListener('team member answer', (data) => {
    if (!autoVoteSkip.isActive()) return

    const player = quiz.players?.[data.gamePlayerId]
    if (!player || player.isSelf) return

    const valid = isValidAnime(data.answer)
    if (avsPendingPlayerId === data.gamePlayerId && !valid) {
      autoVoteSkip.cancel()
      avsPendingPlayerId = null
    }
    if (!valid) return

    avsPendingPlayerId = data.gamePlayerId
    autoVoteSkip.schedule(() => true)
  })

  addListener('play next song', () => {
    autoSkip.cancel()
    autoVoteSkip.cancel()
    avsPendingPlayerId = null
  })
}
