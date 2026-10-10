import { GM_addStyle } from 'vite-plugin-monkey/dist/client'
import { getAllAnimeNames } from '@shared/anime'
import { addListener } from '@shared/events'
import { getPlayerAvatarContainer, getPlayerName } from '@shared/game'
import { createQuizPageMutationObserver } from '@shared/pages'

/** The page background. Change it to any image URL. */
const BACKGROUND_URL = 'https://images8.alphacoders.com/695/695848.png'

export default async function setup() {
  // Extracted from https://github.com/amq-script-project/AMQ-Scripts/blob/master/design/amqSimpleBackground.css
  const backgroundCss = `
  :root {
	--bg: url("${BACKGROUND_URL}");
	/* Optional: if you want a different background for chat. Phone wallpapers tend to work best. */
	--chatbg: rgba(0,0,0,0.5);
  }

  #gameContainer {
	background-image: var(--bg);
	background-size: 100% auto;
  }

  #startPage {
	background-image: var(--bg);
	background-size: 100% auto;
  }

  #awMainView {
	background-image: var(--bg);
	background-size: 100% auto;
  }

  #loadingScreen {
	background-image: none;
	background-color: transparent;
  }

  #gameChatPage > .col-xs-9 {
	background-image: none;
	background-color: transparent;
  }

  #gameChatContainer {
	background: var(--chatbg);
  }

  .leftShadowBorder {
	box-shadow: none;
	  -webkit-box-shadow: none;
  }

  .gcList > li:nth-child(2n) {
	background: none;
  }

  .gcInputContainer {
	background: none;
  }

  #gcEmojiPickerButton > i {
	color: #d9d9d9;
  }

  #nexusCityContainer {
    height: 100vh !important;
  }

  .nexusFullCanvas {
    height: 100vh !important;
  }
`

  const generalCss = `
  /* Invisible footer */
  #footerMenuBarBackground, #rightMenuBarPartContainer::before {
    background-color: rgba(0, 0, 0, 0)
  }

  /* Hides menus with invisible footer */
  #optionsContainer:not(.open), #socialTab:not(.open) {
    position: relative;
    top: 30px;
  }

  /* Transparent components */
  #currencyContainer,
  #menuBarOptionContainer,
  #mainMenuSocailButton {
    background-color: rgba(27, 27, 27, 0.7)
  }

  #xpBarOuter {
    opacity: 0.95
  }

  .qpAvatarImgContainer {
    box-shadow: none;
    background-color: rgba(27, 27, 27, 0)
  }

  .chatBox::before {
    opacity: 0;
  }

  .chatBox {
    width: 250px !important;
  }

  #chatContainer {
    height: 400px !important;
  }

  #activeChatScrollContainer {
    margin-top: 355px !important;
  }

  .chatBoxContainer {
    height: 300px !important;
    background-color: rgba(68, 68, 68, 0.8) !important;
  }

  .chatContent {
    height: 232px !important;
  }
`

  const gameCss = `
  #qpStandingContainer,
  #qpAnimeNameContainer,
  #qpAnimeNameHider,
  #qpCounter,
  .qpSideContainer,
  .qpAvatarNameContainer,
  .qpAvatarNumberContainer,
  .qpAvatarInfoContainer > div,
  .qpAvatarAnswerContainer,
  #qpVideoOverflowContainer,
  .awesomplete > ul {
    background-color: rgba(27, 27, 27, 0.7);
  }

  #qpVideoHider {
    background-color: rgba(27, 27, 27, 0);
  }

  #qpAnimeNameHider {
    border-radius: 5px;
  }

  #qpAnimeNameContainer {
    font-family: monospace;
    box-shadow: none;
    border-radius: 5px;
  }

  .qpAnimeNameContainer {
    width: 60rem !important;
    max-width: 100%;
  }

  #qpInfoHider,
  #qpReportContainer,
  #qpUpvoteContainer,
  #qpDownvoteContainer {
    background-color: rgba(27, 27, 27, 0);
  }

  .qpAvatarImgContainer {
    box-shadow: none;
    background-color: rgba(27, 27, 27, 0)
  }

  #qpVideoTroubleshootingContainer {
    display: none;
  }

  // #qpAvatarRowEnemyContainer,
  // #qpAvatarRowAvatarContainer {
  //   height: 80% !important;
  // }

  .awesomplete > ul {
    max-height: 100px !important;
  }

  .nexusView #qpVideoContainerOuter {
    max-width: 75% !important;
  }

  .qpSideContainer {
    margin-top: 20% !important;
    max-width: 300px !important;
  }

  /* AMQ ships 5px here, which runs the avatars into the edges and the chat */
  #qpAvatarRow {
    padding: 0 25px !important;
  }

  /* Frees up horizontal space for the song history panel */
  #gameChatPage > .col-xs-9 {
    width: calc(100% - min(25%, 500px)) !important;
  }

  #gameChatContainer {
    width: min(25%, 500px) !important;
    max-width: 500px !important;
  }

  /*
   * The video sizes itself with padding-top: 56.25%, which resolves against the
   * parent's width, so capping the video's own width would break the aspect
   * ratio. Cap the height too and let min() keep it 16:9.
   */
  #qpVideoContainer {
    width: min(100%, 800px) !important;
    padding-top: min(56.25%, 450px) !important;
    margin: 12px auto 0 !important;
  }

  /* Mirrors AMQ's own short-window shrink, with the same 800px cap */
  @media screen and (max-height: 749px) {
    #qpVideoContainer {
      width: min(80%, 800px) !important;
      padding-top: min(45.1%, 450px) !important;
    }
  }
  
  /* Fixes lag for long answers */
  .qpAvatarAnswerText.rightAnswer {
    text-shadow: none !important;
    color: #b6ff00;
  }
  .qpAvatarAnswerText.wrongAnswer {
    text-shadow: none !important;
    color: #fb1212;
  }

  .teamValidNameGuess {
    color: orange;
  }

  /* Fixes chat on iPad */
  #gameChatPage {
    height: calc(100dvh - 45px);
  }

  .awesomplete {
    font-size: 18px !important;
  }
`

  // Extracted from https://github.com/amq-script-project/AMQ-Scripts/blob/master/design/amqBackground.user.js
  function extend(func: any, method: any, ext: any) {
    const old = (func.fn ? func.fn : func.prototype)[method]
    func.prototype[method] = function (...args: unknown[]) {
      const result = old.apply(this, args)
      ext.apply(this, args)
      return result
    }
  }

  function hideVideoOnRejoin() {
    const hideVideo = () => {
      $('#qpMoePlayer-0').css('display', 'none')
      $('#qpMoePlayer-1').css('display', 'none')
    }

    addListener('answer results', () => {
      $('#qpMoePlayer-0').css('display', '')
      $('#qpMoePlayer-1').css('display', '')
    })

    createQuizPageMutationObserver(({ visible }) => {
      if (visible) hideVideo()
    })
  }

  GM_addStyle(backgroundCss)
  GM_addStyle(generalCss)
  GM_addStyle(gameCss)
  hideVideoOnRejoin()

  // Makes song info box not push players down when info is long
  ;(() => {
    const target = document.getElementById('qpSongInfoContainer')?.parentElement
    if (!target) {
      throw new Error('Could not find target element')
    }
    Object.assign(target.style, {
      position: 'absolute',
      right: '0',
    })
  })()

  // Highlights valid answers in team games
  ;(function highlightValidAnswers() {
    const animeNames = getAllAnimeNames({ lowercase: true })

    addListener('team member answer', (data) => {
      const playerName = getPlayerName(data.gamePlayerId)
      const playerAnswerEl = getPlayerAvatarContainer(
        playerName
      )?.querySelector('.qpAvatarAnswerText')

      if (!(playerAnswerEl instanceof HTMLElement)) {
        return
      }

      const isValidGuess = animeNames.current.includes(
        data.answer.toLocaleLowerCase()
      )

      if (isValidGuess) {
        playerAnswerEl.classList.add('teamValidNameGuess')
      } else {
        playerAnswerEl.classList.remove('teamValidNameGuess')
      }
    })
  })()

  const nameHiderObserver = new MutationObserver((list) => {
    const mutation = list[0]

    if (!mutation) {
      return
    }

    if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
      if (
        mutation.target instanceof HTMLElement &&
        mutation.target.classList?.contains('hide')
      ) {
        $('#qpAnimeNameContainer').css('visibility', 'visible')
      } else {
        $('#qpAnimeNameContainer').css('visibility', 'hidden')
      }
    }
  })

  extend(QuizInfoContainer, 'showContent', function () {
    $('#qpInfoHider').prevAll().css('visibility', 'visible')
    $('#qpVideoSoundOnly').css('visibility', 'visible')
  })

  extend(QuizInfoContainer, 'displayInfoBoxHint', function () {
    $('#qpInfoHider').prevAll().css('visibility', 'visible')
    $('#qpVideoSoundOnly').css('visibility', 'visible')
  })

  extend(QuizInfoContainer, 'hideContent', function () {
    $('#qpInfoHider').prevAll().css('visibility', 'hidden')
    $('#qpVideoSoundOnly').css('visibility', 'hidden')
  })

  const isNexusMode = () => quiz?.gameMode === 'Nexus'

  createQuizPageMutationObserver(({ visible }) => {
    if (visible) {
      $('#qpSongInfoContainer').css(
        'transform',
        isNexusMode() ? 'translateY(-6rem)' : ''
      )

      const animeNameHiderEl = document.getElementById('qpAnimeNameHider')

      if (!animeNameHiderEl) {
        throw new Error('animeNameHider element not found')
      }

      nameHiderObserver.observe(animeNameHiderEl, { attributes: true })
    } else {
      nameHiderObserver.disconnect()
    }
  })
}
