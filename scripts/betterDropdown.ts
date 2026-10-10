import { registerCommand } from './commands'
import { GM_addStyle } from 'vite-plugin-monkey/dist/client'
import { loadAllAnime } from '@shared/anime'

/** Improves the answer dropdown: match highlighting, quick answer, no delay. */
export default async function setup() {
  const options = {
    // Highlights exact matches in dropdown items
    highlightMatches: true,

    // Removes the delay before the dropdown items are computed. Can cause lag
    // on slow devices.
    removeDropdownDelay: true,
  }

  function setupStyles() {
    const dropdownCss = `
  .awesomplete li.exact-match mark {
    color: lime !important
  }
  
  .awesomplete li.exact-prefix mark {
    color: yellow !important
  }

  @keyframes horizontal-shaking {
    0% { transform: translateX(0) }
    25% { transform: translateX(5px) }
    50% { transform: translateX(-5px) }
    75% { transform: translateX(5px) }
    100% { transform: translateX(0) }
  }
  .amq-better-dropdown-invalid-answer {
    animation: horizontal-shaking 0.3s forwards;
  }
  `

    function getMatchType(answer: string, title: string) {
      if (typeof answer !== 'string' || typeof title !== 'string') {
        return 'none'
      }

      const lcAnswer = answer.toLocaleLowerCase()
      const lcTitle = title.toLocaleLowerCase()

      if (lcAnswer === lcTitle) return 'exact-match'

      if (lcTitle.startsWith(lcAnswer)) return 'exact-prefix'

      return 'none'
    }

    const parent = document.getElementById('qpAnswerInputContainer')
    const target = parent?.querySelector('.awesomplete')

    if (!target || !parent) {
      setTimeout(setupStyles, 1000)
      return
    }

    GM_addStyle(dropdownCss)

    const setupQuickAnswer = () => {
      const inputEl = document.getElementById('qpAnswerInput')
      let toggle: boolean = true
      registerCommand(
        'qa',
        () => ({
          shortHelp: 'Toggle quick answer mode',
          longHelp: `Usage: /qa</br>Toggles quick answer mode. In quick answer mode, pressing Enter without Ctrl will select the top dropdown option if there is no exact match selected.</br>Current value: ${toggle ? 'auto' : 'ctrl'}`,
        }),
        () => {
          toggle = !toggle
          gameChat.systemMessage('Quick answer: ' + (toggle ? 'auto' : 'ctrl'))
        }
      )

      if (!(inputEl instanceof HTMLInputElement)) return

      inputEl.addEventListener('keydown', (event) => {
        if (event.key.toLocaleLowerCase() !== 'enter') return

        const hasSelectedTitleInDropdown = !!document.querySelector(
          `.awesomplete ul li[aria-selected='true']`
        )
        const hasExactMatchInDropdown = !!document.querySelector(
          '.awesomplete ul li.exact-match'
        )

        if (hasSelectedTitleInDropdown || hasExactMatchInDropdown) return

        if ((!toggle && event.ctrlKey) || (toggle && !event.ctrlKey)) {
          const option = (
            document.querySelector(
              '#qpAnswerInputContainer #awesomplete_list_undefined_item_0'
            ) as HTMLElement | undefined
          )?.innerText
          if (!option) {
            inputEl.classList.add('amq-better-dropdown-invalid-answer')
            setTimeout(() => {
              inputEl.classList.remove('amq-better-dropdown-invalid-answer')
            }, 300)
            event.preventDefault()
          } else {
            inputEl.value = option
          }
        }
      })
    }

    const mutationCallback: MutationCallback = (mutations) => {
      const answerInput = document.querySelector('#qpAnswerInput') as
        HTMLInputElement | undefined
      if (!answerInput) return

      for (const mutation of mutations) {
        if (mutation.type !== 'childList') continue
        for (const addedNode of mutation.addedNodes) {
          if (!(addedNode instanceof HTMLLIElement)) {
            continue
          }

          const matchType = getMatchType(answerInput.value, addedNode.innerText)
          if (matchType !== 'none') {
            addedNode.classList.add(matchType)
          }
        }
      }
    }

    // Observe the container with `subtree: true`, not `.awesomplete` itself.
    // AMQ recreates `.awesomplete` and its `ul` whenever the song list updates
    // (`AutoCompleteController.newList`), and the container stays.
    new MutationObserver(mutationCallback).observe(parent, {
      subtree: true,
      childList: true,
    })
    setupQuickAnswer()
  }

  async function removeDropdownDelay() {
    const shouldIncludeENNames = (
      anime: Awaited<ReturnType<typeof loadAllAnime>>[number]
    ) => {
      // No JP names
      if (!anime.names.some((name) => name.language === 'JA')) return true

      // JP and EN differ only in punctuation
      const jpName = anime.mainNames['JA']
      const enName = anime.mainNames['EN']
      if (jpName && enName) {
        const jpNameLetters = jpName.replace(/[^\p{L}]+/gu, '')
        const enNameLetters = enName.replace(/[^\p{L}]+/gu, '')
        if (jpNameLetters === enNameLetters) return true
      }

      return false
    }
    const allJPNames = await loadAllAnime().then((animeList) =>
      animeList
        .map((anime) =>
          (shouldIncludeENNames(anime)
            ? Object.values(anime.mainNames)
            : [anime.mainNames['JA']]
          ).filter(Boolean)
        )
        .flat()
    )
    const jpNamesSet = new Set(allJPNames)
    // Based on `evaluate` in AMQ's
    // scripts/pages/gamePage/game/quiz/amqAwesomeplete.js, without its delay.
    AmqAwesomeplete.prototype.evaluate = function (this: any) {
      // eslint-disable-next-line @typescript-eslint/no-this-alias -- as in AMQ's source
      const me = this
      const unescapedValue = this.input.value
      const value = createAnimeSearchRegexQuery(unescapedValue)
      let inputList
      if (
        this.currentQuery &&
        new RegExp(this.currentQuery, 'i').test(unescapedValue) &&
        this.currentSubList
      ) {
        inputList = this.currentSubList
      } else if (unescapedValue.length > 0) {
        const letterList = this.letterLists[unescapedValue[0].toLowerCase()]
        if (letterList) {
          inputList = letterList
        } else {
          inputList = []
        }
        this.currentSubList = inputList
      } else {
        inputList = this._list
        this.currentSubList = null
      }
      this.currentQuery = value
      if (value.length >= this.minChars && inputList.length > 0) {
        this.searchId++
        const currentSearchId = this.searchId
        $('#qpAnswerInputLoadingContainer').removeClass('hide')
        this.index = -1
        // Populate list with options that match
        this.$ul.children('li').remove()
        const suggestions: any[] = []
        const selectedItems: any[] = []
        const handlePassedSuggestions = function (this: any, me: any) {
          if (this.sort !== false) {
            this.suggestions = this.suggestions.sort(this.sort)
          }
          const jpNames = this.suggestions.filter((suggestion: Suggestion) =>
            jpNamesSet.has(suggestion.value)
          )
          const otherNames = this.suggestions.filter(
            (suggestion: Suggestion) => !jpNamesSet.has(suggestion.value)
          )
          this.suggestions = [...jpNames, ...otherNames]
          this.currentSubList = selectedItems
          this.suggestions = this.suggestions.slice(0, this.maxItems)
          for (let i = this.suggestions.length - 1; i >= 0; i--) {
            const text = this.suggestions[i]
            me.ul.insertBefore(me.item(text, value, i), me.ul.firstChild)
          }
          if (this.ul.children.length === 0) {
            this.status.textContent = 'No results found'
            this.close({ reason: 'nomatches' })
          } else {
            this.open()
            this.status.textContent = this.ul.children.length + ' results found'
          }
          $('#qpAnswerInputLoadingContainer').addClass('hide')
        }.bind(this)
        const timeoutLoop = function (
          this: any,
          index: any,
          me: any,
          handlePassedSuggestions: any,
          currentSearchId: any
        ) {
          if (currentSearchId !== this.searchId) {
            return
          }
          for (let i = index; i < inputList.length; i++) {
            const item = inputList[i]
            const suggestion = new Suggestion(me.data(item, value))
            if (me.filter(suggestion, value)) {
              selectedItems.push(item)
              suggestions.push(suggestion)
            }
          }
          this.suggestions = suggestions
          handlePassedSuggestions(me)
        }.bind(this)
        timeoutLoop(0, me, handlePassedSuggestions, currentSearchId)
      } else {
        this.close({ reason: 'nomatches' })
        this.status.textContent = 'No results found'
      }
    }
  }

  if (options.highlightMatches) setupStyles()
  if (options.removeDropdownDelay) await removeDropdownDelay()
}
