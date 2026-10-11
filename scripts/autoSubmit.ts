import { registerCommand } from './commands'

/** Submits the answer whenever the answer input changes. */
export default async function setup() {
  const DEBOUNCE_THRESHOLD_MS = 50

  let lastSubmitTime: number = 0
  let curTimeout: number | null = null

  function getAccessorDescriptor(obj: any, prop: any) {
    if (obj === null) {
      // Needed only for a property that does not exist yet.
      return {
        get() {},
        set() {},
        enumerable: false,
        configurable: true,
      }
    }
    const desc = Object.getOwnPropertyDescriptor(obj, prop)
    if (!desc) {
      return getAccessorDescriptor(Object.getPrototypeOf(obj), prop)
    }
    if ('writable' in desc) {
      // Needed only for a data property, which has no setter.
      return {
        get() {
          return desc.value
        },
        set(v: any) {
          if (desc.writable) desc.value = v
          else throw new TypeError()
        },
        enumerable: desc.enumerable,
        configurable: true,
      }
    }
    return desc
  }

  function addSetLogic(obj: any, prop: any, logic: any) {
    const oldDescriptor = getAccessorDescriptor(obj, prop)
    Object.defineProperty(obj, prop, {
      ...oldDescriptor,
      set(newValue) {
        oldDescriptor.set?.call(this, newValue)
        logic(newValue)
      },
    })
  }

  const sendAnswer = (answer: string) =>
    socket.sendCommand({
      type: 'quiz',
      command: 'quiz answer',
      data: { answer },
    })

  const clear = () => {
    if (curTimeout !== null) {
      clearTimeout(curTimeout)
    }
  }

  const inputEl = document.getElementById('qpAnswerInput')
  if (!inputEl) return

  let active = true

  addSetLogic(
    inputEl,
    'value',
    (newValue: string) => active && sendAnswer(newValue)
  )

  inputEl.addEventListener('input', (event) => {
    if (!active) return

    const answer = (event.target as HTMLInputElement).value || ' '
    const curTime = Date.now()

    clear()
    if (curTime - lastSubmitTime > DEBOUNCE_THRESHOLD_MS) {
      lastSubmitTime = curTime
      sendAnswer(answer)
    } else {
      curTimeout = window.setTimeout(
        () => sendAnswer(answer),
        DEBOUNCE_THRESHOLD_MS - (curTime - lastSubmitTime)
      )
    }
  })

  registerCommand(
    'as',
    () => ({
      shortHelp: 'Toggle auto submit',
      longHelp: `Usage: /as</br>Toggles automatic answer submission in team games.</br>Current value: ${active ? 'enabled' : 'disabled'}`,
    }),
    () => {
      active = !active
      gameChat.systemMessage(`Auto submit ${active ? 'enabled' : 'disabled'}`)
    }
  )
}
