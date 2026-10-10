const options = {
  themes: ['Music'],
  types: ['Openings', 'Endings', 'Inserts'],
}

/** Votes for the themes and song types in `options` in a Jam quiz. */
export default async function setup() {
  const getLabel = (el: HTMLElement) =>
    el.innerText.split('\n')[0].toLocaleLowerCase()

  const cb: MutationCallback = (mutationsList) => {
    mutationsList.forEach((mutation) => {
      if (mutation.type !== 'attributes' || mutation.attributeName !== 'class')
        return
      if (
        mutation.target instanceof HTMLElement &&
        !mutation.target.classList.contains('hide') &&
        !mutation.target.classList.contains('votesDisbaled') // AMQ's spelling (sic)
      ) {
        document
          .querySelectorAll('.qpJamVoteCategoryOptionTextContainer')
          .forEach((el) => {
            if (!(el instanceof HTMLElement)) return
            if (
              options.themes
                .concat(options.types)
                .some((label) => label.toLocaleLowerCase() === getLabel(el))
            ) {
              el.click()
            }
          })
      }
    })
  }

  const target = document.getElementById('qpJamVoteContainer')

  if (!target) throw new Error('Could not find target')

  new MutationObserver(cb).observe(target, { attributes: true })
}
