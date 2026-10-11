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
    const pendingTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

    const cancel = (username: string) => {
      clearTimeout(pendingTimeouts.get(username))
      pendingTimeouts.delete(username)
    }

    const cancelAll = () => {
      pendingTimeouts.forEach((timeout) => clearTimeout(timeout))
      pendingTimeouts.clear()
    }

    const schedule = (username: string, shouldVote: () => boolean) => {
      cancel(username)
      pendingTimeouts.set(
        username,
        setTimeout(() => {
          pendingTimeouts.delete(username)
          if (active && shouldVote()) voteSkip()
        }, delayS * 1000)
      )
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
        if (!active) cancelAll()
        gameChat.systemMessage(`${label}: ${status()}`)
      }
    )

    return {
      isActive: () => active,
      schedule,
      cancel,
      cancelAll,
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
      autoSkip.cancel(selfName)
      if (!autoSkip.isActive()) return

      const value = answerInput.value
      if (!isValidAnime(value)) return

      autoSkip.schedule(selfName, () => answerInput.value === value)
    })
  } else {
    console.error('amq-auto-skip: answer input not found')
  }

  addListener('team member answer', (data) => {
    if (!autoVoteSkip.isActive()) return

    const player = quiz.players?.[data.gamePlayerId]
    if (!player || player.isSelf) return

    if (isValidAnime(data.answer)) {
      autoVoteSkip.schedule(player._name, () => true)
    } else {
      autoVoteSkip.cancel(player._name)
    }
  })

  addListener('play next song', () => {
    autoSkip.cancelAll()
    autoVoteSkip.cancelAll()
  })
}
