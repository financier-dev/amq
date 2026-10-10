import { GM_addStyle } from 'vite-plugin-monkey/dist/client'
import { registerCommand } from './commands'
import {
  createLobbyPageMutationObserver,
  createQuizPageMutationObserver,
} from '@shared/pages'
import { getAllAnimeNames } from '@shared/anime'
import { DROPDOWN_HIDDEN_CLASS } from './lib/elements'
import { addListener } from '@shared/events'

function startReturnToLobbyVote() {
  socket.sendCommand({
    type: 'quiz',
    command: 'start return lobby vote',
  })
}

/** Registers the chat commands for the lobby and the quiz. */
export default async function setup() {
  ;(function setupAutoThrow() {
    let autoAnswer = ''
    registerCommand(
      'at',
      () => ({
        shortHelp: 'Toggle auto throw answer',
        longHelp: `Usage: /at [answer]</br>Toggles automatic answer throwing.</br>Current value: ${autoAnswer ? '"' + autoAnswer + '"' : 'disabled'}`,
      }),
      (args) => {
        autoAnswer = args.trim()
        if (autoAnswer === '' && !!autoAnswer) {
          gameChat.systemMessage('Auto throw disabled')
        } else {
          gameChat.systemMessage('Auto throw answer: ' + (autoAnswer || ' '))
        }
      }
    )

    addListener('play next song', () => {
      if (autoAnswer) {
        socket.sendCommand({
          type: 'quiz',
          command: 'quiz answer',
          data: { answer: autoAnswer },
        })
      }
    })
  })()
  ;(function setupAutoReady() {
    let active = true

    function maybeReady() {
      setTimeout(() => {
        if (
          active &&
          lobby.inLobby &&
          !lobby.isReady &&
          !lobby.isHost &&
          !lobby.isSpectator &&
          lobby.settings.gameMode !== 'Themed' &&
          lobby.settings.gameMode !== 'Standard'
        ) {
          lobby.fireMainButtonEvent()
        }
      })
    }

    registerCommand(
      'autoready',
      () => ({
        shortHelp: 'Toggle auto ready',
        longHelp: `Usage: /autoready</br>Toggles automatic readying when in the lobby.</br>Current value: ${active ? 'enabled' : 'disabled'}`,
      }),
      () => {
        active = !active
        if (active) maybeReady()
        gameChat.systemMessage(
          'Auto ready: ' + (active ? 'enabled' : 'disabled')
        )
      }
    )

    createLobbyPageMutationObserver(({ visible }) => visible && maybeReady())
    addListener('Room Settings Changed', maybeReady)
    addListener('Host Promotion', maybeReady)
    addListener('Change To Player', maybeReady)
  })()
  const autoStart = (function setupAutoStart() {
    let startTimeout: ReturnType<typeof setTimeout> | null = null

    const maybeStart = (options: { verbose: boolean }) => {
      const conditions = [
        [lobby.isHost, 'You are not the host'],
        [lobby.inLobby, 'You are not in the lobby'],
        [
          lobby.numberOfPlayersReady === Object.keys(lobby.players).length,
          'Not all players are ready',
        ],
        [
          lobby.settings.gameMode !== 'Themed' &&
            lobby.settings.gameMode !== 'Standard',
          'Invalid game mode',
        ],
      ]

      const failedCond = conditions.find((cond) => !cond[0])
      if (failedCond) {
        if (options.verbose) {
          gameChat.systemMessage(`Failed to auto start: ${failedCond[1]}`)
        }
        return false
      }

      socket.sendCommand({
        type: 'lobby',
        command: 'start game',
      })

      return true
    }

    const abortAutoStart = () => {
      if (!startTimeout) return false
      clearTimeout(startTimeout)
      startTimeout = null
      return true
    }

    const startReady = () => {
      abortAutoStart()

      gameChat.systemMessage(`Auto starting when all players are ready`)

      startTimeout = setTimeout(function fn() {
        startTimeout = null
        if (!maybeStart({ verbose: false })) {
          startTimeout = setTimeout(fn, 500)
        }
      }, 500)
    }

    registerCommand(
      'start',
      () => ({
        shortHelp: 'Auto start the game',
        longHelp:
          'Usage: /start [seconds|ready|abort]</br>Automatically starts the game after a delay in seconds, when all players are ready, or aborts a pending auto start.',
      }),
      (args) => {
        if (!lobby.isHost) {
          gameChat.systemMessage('You must be the host to use this command')
          return
        }

        const delay = Number(args.split(' ').pop())

        if (Number.isFinite(delay) && delay >= 0) {
          abortAutoStart()

          gameChat.systemMessage(`Auto starting in ${delay} seconds`)

          startTimeout = setTimeout(() => {
            startTimeout = null
            maybeStart({ verbose: true })
          }, 1000 * delay)

          return
        } else if (args === 'abort') {
          if (!abortAutoStart()) {
            gameChat.systemMessage('Auto start is not set, nothing to abort')
          }
        } else if (args === 'ready') {
          startReady()
        }
      }
    )

    return { startReady, abort: abortAutoStart }
  })()
  ;(function setupAutoStartOnQuizEnd() {
    let active = false

    registerCommand(
      'autostart',
      () => ({
        shortHelp: 'Toggle auto start when quiz ends',
        longHelp: `Usage: /autostart</br>Toggles automatically running "/start ready" every time the quiz ends.</br>Current value: ${active ? 'enabled' : 'disabled'}`,
      }),
      () => {
        active = !active
        gameChat.systemMessage(
          `Auto start on quiz end: ${active ? 'enabled' : 'disabled'}`
        )
      }
    )

    let quizOverSeen = false

    addListener('quiz over', () => {
      quizOverSeen = true
      if (active && lobby.isHost) {
        autoStart.startReady()
      }
    })

    createQuizPageMutationObserver(({ visible }) => {
      if (visible) return
      if (!quizOverSeen) {
        autoStart.abort()
      }
      quizOverSeen = false
    })
  })()
  ;(function setupAutoSpectate() {
    let specTimeout: ReturnType<typeof setTimeout> | null = null

    const maybeSpec = () => {
      if (
        !lobby.inLobby ||
        lobby.settings.gameMode === 'Themed' ||
        lobby.settings.gameMode === 'Standard'
      ) {
        return false
      }

      socket.sendCommand({
        type: 'lobby',
        command: 'change player to spectator',
        data: {
          playerName: selfName,
        },
      })
      return true
    }

    registerCommand(
      'spec',
      () => ({
        shortHelp: 'Goes into spectator mode once the current game ends',
        longHelp:
          'Usage: /spec [abort]</br>Goes into spectator mode once the current game ends, or aborts a pending auto spectate.',
      }),
      (args) => {
        if (args === '') {
          if (specTimeout) {
            gameChat.systemMessage('Auto spectate is already set')
            return
          }

          gameChat.systemMessage('Will auto spectate after current game ends')

          specTimeout = setTimeout(function fn() {
            specTimeout = null
            if (!maybeSpec()) {
              specTimeout = setTimeout(fn, 500)
            }
          }, 500)
        } else if (args === 'abort') {
          if (!specTimeout) {
            gameChat.systemMessage('Auto spectate is not set, nothing to abort')
            return
          }

          clearTimeout(specTimeout)
          specTimeout = null
          gameChat.systemMessage('Auto spectate aborted')
        } else {
          gameChat.systemMessage(`Invalid argument: ${args}`)
        }
      }
    )
  })()
  ;(function setupHostPromotion() {
    let promoteTimeout: ReturnType<typeof setTimeout> | null = null

    const abort = () => {
      if (!promoteTimeout) return false
      clearTimeout(promoteTimeout)
      promoteTimeout = null
      return true
    }

    // Uses the room's spelling of a player's name. A name that is not among
    // the players is sent as typed, because it can belong to a spectator.
    const resolveName = (typed: string) =>
      Object.values(lobby.players)
        .map((player) => player.name)
        .find(
          (name) => name.toLocaleLowerCase() === typed.toLocaleLowerCase()
        ) ?? typed

    const promoteWhenInLobby = (typed: string) => {
      promoteTimeout = setTimeout(function fn() {
        promoteTimeout = null
        if (!lobby.inLobby) {
          promoteTimeout = setTimeout(fn, 500)
          return
        }
        if (!lobby.isHost) {
          gameChat.systemMessage(
            `Did not promote ${typed}: you are no longer the host`
          )
          return
        }
        lobby.promoteHost(resolveName(typed))
      }, 0)
    }

    registerCommand(
      'host',
      () => ({
        shortHelp: 'Promote a player to host in the lobby',
        longHelp:
          'Usage: /host [username]</br>Promotes [username] to host the next time the game is in the lobby. You must be the host. Without a username, cancels a pending promotion.',
      }),
      (args) => {
        const username = args.trim()

        if (username === '') {
          gameChat.systemMessage(
            abort() ? 'Host promotion cancelled' : 'Usage: /host [username]'
          )
          return
        }

        if (!lobby.isHost) {
          gameChat.systemMessage('You must be the host to use this command')
          return
        }

        abort()
        if (!lobby.inLobby) {
          gameChat.systemMessage(
            `Will promote ${username} to host when the game returns to the lobby`
          )
        }
        promoteWhenInLobby(username)
      }
    )
  })()
  ;(function setupDropdownHider() {
    let active: boolean = true

    const allAnimeNames = getAllAnimeNames({ lowercase: true })

    const dropdownCss = `
      @keyframes horizontal-shaking {
        0% { transform: translateX(0) }
        25% { transform: translateX(5px) }
        50% { transform: translateX(-5px) }
        75% { transform: translateX(5px) }
        100% { transform: translateX(0) }
      }
      .amq-custom-commands-invalid-answer {
        animation: horizontal-shaking 0.3s forwards;
      }
      #qpAnswerInputContainer.${DROPDOWN_HIDDEN_CLASS} .awesomplete > ul {
        display: none !important;
      }`
    GM_addStyle(dropdownCss)

    const preventSkipOnInvalidAnswer = (event: KeyboardEvent) => {
      if (event.key.toLocaleLowerCase() !== 'enter') return

      const inputEl = document.getElementById('qpAnswerInput')
      if (!(inputEl instanceof HTMLInputElement)) return

      const answer = inputEl.value.trim().toLocaleLowerCase()
      if (!allAnimeNames.current.includes(answer)) {
        inputEl.classList.add('amq-custom-commands-invalid-answer')
        setTimeout(() => {
          inputEl.classList.remove('amq-custom-commands-invalid-answer')
        }, 300)
        event.preventDefault()
        event.stopPropagation()
      }
    }

    registerCommand(
      'dd',
      () => ({
        shortHelp: 'Toggle dropdown',
        longHelp: `Usage: /dd</br>Toggles the answer dropdown visibility.</br>Current value: ${active ? 'enabled' : 'disabled'}`,
      }),
      () => {
        const containerEl = document.getElementById('qpAnswerInputContainer')

        if (!(containerEl instanceof HTMLElement)) {
          gameChat.systemMessage(
            'Error: Unable to toggle dropdown: Answer input container not found'
          )
          console.error('Unable to find answer input container element')
          return
        }

        containerEl.classList.toggle(DROPDOWN_HIDDEN_CLASS, active)
        gameChat.systemMessage(`Dropdown ${active ? 'disabled' : 'enabled'}`)
        active = !active

        const inputEl = document.getElementById('qpAnswerInput')
        if (!(inputEl instanceof HTMLInputElement)) {
          console.error('custom-commands: Unable to find input element')
          return
        }

        if (active) {
          inputEl.removeEventListener('keydown', preventSkipOnInvalidAnswer)
        } else {
          inputEl.addEventListener('keydown', preventSkipOnInvalidAnswer)
        }
      }
    )
  })()
  ;(function setupAutoVoteYesOnReturnToLobby() {
    let active: boolean = true

    registerCommand(
      'autovoteyes',
      () => ({
        shortHelp: 'Toggle auto vote yes',
        longHelp: `Usage: /autovoteyes</br>Toggles automatic voting yes on return to lobby.</br>Current value: ${active ? 'enabled' : 'disabled'}`,
      }),
      () => {
        active = !active
        gameChat.systemMessage(
          `Auto vote yes on return to lobby: ${active ? 'enabled' : 'disabled'}`
        )
      }
    )

    addListener('return lobby vote start', () => {
      if (!active) return

      function voteYes(counter = 0) {
        if (counter > 100) {
          console.error('Failed to auto vote yes: Button not found')
          return
        }

        const yesButton = document.querySelector(
          '#qpReturnLobbyVoteContainer .leftVoteButtonYes'
        )
        if (!(yesButton instanceof HTMLElement)) {
          setTimeout(() => voteYes(counter + 1), 100)
          return
        }
        yesButton.click()
      }

      setTimeout(voteYes, 500)
    })
  })()
  ;(function setupAutoReturnToLobbyOnTeamDeath() {
    let active: boolean = true
    const animeNames = getAllAnimeNames({ lowercase: true })

    registerCommand(
      'autoreturnlobby',
      () => ({
        shortHelp: 'Toggle auto return to lobby on team death',
        longHelp: `Usage: /autoreturnlobby</br>Toggles automatic return to lobby vote when an invalid answers causes the team to die in a 1T game.</br>Current value: ${active ? 'enabled' : 'disabled'}`,
      }),
      () => {
        active = !active
        gameChat.systemMessage(
          `Auto return to lobby on team death: ${active ? 'enabled' : 'disabled'}`
        )
      }
    )

    const isOneTeamGame = () => {
      return (
        lobby.isHost &&
        lobby.settings.gameMode !== 'Themed' &&
        lobby.settings.gameMode !== 'Standard' &&
        Object.keys(quiz.scoreboard.teamMap).length === 1
      )
    }

    addListener('player answers', (data) => {
      if (!active || !isOneTeamGame()) return
      const isLastLife =
        Object.values(quiz.players)[0].avatarSlot.lifeCounterController
          .currentLives === 1
      const isValidAnswer = animeNames.current.includes(
        data.answers[0].answer.toLocaleLowerCase().trim()
      )
      if (isLastLife && !isValidAnswer) {
        startReturnToLobbyVote()
      }
    })
  })()
  ;(function setupReturnToLobbyVoteCommand() {
    registerCommand(
      'lobby',
      () => ({
        shortHelp: 'Start return to lobby vote',
        longHelp: 'Usage: /lobby</br>Starts a vote to return to the lobby.',
      }),
      () => {
        gameChat.systemMessage('Starting return to lobby vote')
        startReturnToLobbyVote()
      }
    )
  })()
  ;(function setupPauseCommand() {
    registerCommand(
      'p',
      () => ({
        shortHelp: 'Pause the quiz',
        longHelp: 'Usage: /pause</br>Pauses the current quiz.',
      }),
      () => {
        if (!lobby.isHost) {
          gameChat.systemMessage('You must be the host to use this command')
          return
        }

        if (quiz.pauseButton.pauseOn) {
          gameChat.systemMessage('Resuming game')
          socket.sendCommand({
            type: 'quiz',
            command: 'quiz unpause',
          })
        } else {
          gameChat.systemMessage('Pausing game')
          socket.sendCommand({
            type: 'quiz',
            command: 'quiz pause',
          })
        }
      }
    )
  })()
}
