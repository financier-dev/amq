/*
 * Makes name hints readable with a custom font.
 *
 * AMQ sends a name hint with a non-breaking space between letters and four
 * spaces between words, for example `_ _ A _    _ 2 _`. The width of those
 * gaps depends on the font, and a custom font can make the hint hard to read.
 *
 * This script removes the spaces between letters, keeps one space between
 * words, and sets the gap between letters with CSS `letter-spacing`. The gap
 * is then the same in every font, and you can still count the hidden letters.
 */

const WORD_SEP = '    ' // 4 spaces
const LETTER_SEP = ' ' // &nbsp;

function fixTitle(title: string) {
  return title
    .split(WORD_SEP)
    .map((x) => x.replaceAll(LETTER_SEP, ''))
    .join(' ')
}

/** Restyles the anime title while a name hint shows. */
export default async function setup() {
  const target = document.getElementById('qpAnimeName')

  if (!target) {
    throw new Error('qpAnimeName element not found')
  }

  const displayAnimeName = QuizInfoContainer.prototype.displayAnimeName

  // AMQ gives a name hint to `displayAnimeName` as the only argument. The
  // answer reveal also gives `altNames` and `altAnswers`. The letter spacing
  // must change before the original runs, because the original fits the font
  // size to the text.
  QuizInfoContainer.prototype.displayAnimeName = function (
    name: string,
    ...altLists: string[][]
  ) {
    const isHint = altLists.length === 0
    target.style.letterSpacing = isHint ? '.3em' : ''
    return displayAnimeName.call(
      this,
      isHint ? fixTitle(name) : name,
      ...altLists
    )
  }
}
