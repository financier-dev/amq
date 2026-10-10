type CommandCallback = (args: string) => void

export interface HelpObject {
  /** Shown in the `/help` summary. */
  shortHelp: string
  /** Shown by `/help <command>`. */
  longHelp: string
}

const commands: Record<
  string,
  { callback: CommandCallback; getHelpObject: () => HelpObject }
> = {}

/**
 * Registers the chat command `/<command>`. `getHelpObject` runs on each
 * `/help`, so its text can show the current state.
 */
export function registerCommand(
  command: string,
  getHelpObject: () => HelpObject,
  callback: CommandCallback
) {
  commands[command] = { callback, getHelpObject }
}

registerCommand(
  'help',
  () => ({
    shortHelp: 'Displays this help message',
    longHelp:
      'Usage: /help [command]</br>Without arguments, displays a summary of all commands. With a command name, displays detailed help for that command.',
  }),
  (args) => {
    const cmd = args.trim()

    if (cmd) {
      if (cmd in commands) {
        gameChat.systemMessage(commands[cmd].getHelpObject().longHelp)
      } else {
        gameChat.systemMessage(`Unknown command: ${cmd}`)
      }
    } else {
      const summary = Object.entries(commands)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(
          ([cmdName, cmdObj]) =>
            `/${cmdName}: ${cmdObj.getHelpObject().shortHelp}`
        )
        .join('</br>')
      gameChat.systemMessage(
        `Available commands:</br>${summary}</br>Type /help [command] for detailed help on a command.`
      )
    }
  }
)

/**
 * Makes chat messages that start with `/` run a registered command. Wraps
 * `gameChat.sendMessage`, because AMQ has no event for an outgoing message.
 */
export default async function setup() {
  const sendMessageFn = gameChat.sendMessage
  gameChat.sendMessage = function () {
    const inputEl = document.getElementById('gcInput') as
      HTMLInputElement | undefined
    const msg = inputEl?.value
    const [head, ...rest] = msg?.split(' ') ?? []
    const cmd = head?.slice(1)

    if (inputEl && head?.startsWith('/')) {
      if (!(cmd in commands)) {
        gameChat.systemMessage(`Unknown command: ${cmd}`)
        inputEl.value = ''
        return
      }
      const args = rest.join(' ')
      commands[cmd].callback(args)
      inputEl.value = ''
    } else {
      sendMessageFn.apply(this)
    }
  }
}
