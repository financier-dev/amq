import { GM_addStyle } from 'vite-plugin-monkey/dist/client'
import { getFixedAnimeNames } from '@shared/anime'
import { getAnswerInputEl } from './lib/elements'

const css = `
.amq-answer-input-valid-answer {
  color: orange;
}
`

/** Highlights the answer input when it holds a valid anime name. */
export default async function setup() {
  GM_addStyle(css)

  const animeNames = new Set(await getFixedAnimeNames({ lowercase: true }))
  const answerInput = getAnswerInputEl()

  if (!answerInput) return

  answerInput.addEventListener('input', (e: Event) => {
    if (!(e.target instanceof HTMLInputElement)) return
    const value = e.target.value
    if (animeNames.has(value.toLocaleLowerCase())) {
      answerInput.classList.add('amq-answer-input-valid-answer')
    } else {
      answerInput.classList.remove('amq-answer-input-valid-answer')
    }
  })

  answerInput.addEventListener('input', (e) => {
    if (!(e.target instanceof HTMLInputElement)) return
    const value = e.target.value
    const convertedValue = translateShortcodeToUnicode(value).text
    if (convertedValue !== value) {
      e.preventDefault()
      answerInput.value = convertedValue
      answerInput.dispatchEvent(new Event('input', { bubbles: true }))
      answerInput.dispatchEvent(new Event('change', { bubbles: true }))
    }
  })
}
