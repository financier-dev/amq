const WORD_SEP = '    ' // 4 spaces
const LETTER_SEP = ' ' // &nbsp;

function fixTitle(title: string) {
  return title
    .split(WORD_SEP)
    .map((x) => x.replaceAll(LETTER_SEP, ''))
    .join(' ')
}

function isHint(title: string) {
  return title.includes('_')
}

/** Restyles the anime title while a name hint shows. */
export default async function setup() {
  const target = document.getElementById('qpAnimeName')

  if (!target) {
    throw new Error('qpAnimeName element not found')
  }

  const mutationCallback: MutationCallback = () => {
    if (isHint(target.innerText)) {
      if (!target.style.letterSpacing) {
        target.innerText = fixTitle(target.innerText)
        target.style.letterSpacing = '.3em'
      }
    } else if (target.style.letterSpacing) {
      target.style.letterSpacing = ''
    }
  }

  const observer = new MutationObserver(mutationCallback)
  observer.observe(target, { childList: true })
}
