export const getAnswerInputEl = () =>
  document.getElementById('qpAnswerInput') as HTMLInputElement | undefined

// The `/dd` command in customCommands.ts sets it on #qpAnswerInputContainer.
export const DROPDOWN_HIDDEN_CLASS = 'amq-custom-commands-dd-hidden'

export const isDropdownDisabled = () =>
  document
    .getElementById('qpAnswerInputContainer')
    ?.classList.contains(DROPDOWN_HIDDEN_CLASS) ?? false
