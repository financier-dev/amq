import { addListener } from '@shared/events'
import { createQuizPageMutationObserver } from '@shared/pages'

const KEYS = {
  ANSWER: 'a',
  CHAT: 'c',
  NAME_HINT: 'n',
  INFO_HINT: 'i',
  VOTE_SKIP: 's',
  NEXUS_ABILITY_SLOT_1: '1',
  NEXUS_ABILITY_SLOT_2: '2',
  NEXUS_ABILITY_SLOT_3: '3',
  NEXUS_ABILITY_SLOT_4: '4',
  NEXUS_TARGET_PREV_ENEMY: 'arrowleft',
  NEXUS_TARGET_NEXT_ENEMY: 'arrowright',
}

export default async function setup() {
  const focusAnswer = () => {
    const answerInput = $('#qpAnswerInput')
    answerInput.click()
    answerInput.focus()
    answerInput.select()
  }

  const focusChat = () => {
    const chatInput =
      quiz.gameMode === 'Nexus' ? $('#nexusCoopChatInput') : $('#gcInput')
    chatInput.click()
    chatInput.select()
  }

  const nameHint = () => {
    const hintButton = $('#qpAmqHintName')
    hintButton.click()
  }

  const infoHint = () => {
    const hintButton = $('#qpAmqHintInfo')
    hintButton.click()
  }

  const useAbilityInNexus = (slot: string) => {
    if (quiz.gameMode !== 'Nexus') return
    socket.sendCommand({
      type: 'nexus',
      command: 'use avatar ability',
      data: { slot: parseInt(slot) },
    })
  }

  const voteSkip = () => {
    quiz.skipController.highlight = true
    quiz.skipClicked()
  }

  const changeNexusTarget = (() => {
    let curTarget = 0

    addListener('nexus game events', ({ events }) => {
      events
        .filter((ev: any) => ev.type === 'newTurnAvatar')
        .forEach((ev: any) => {
          curTarget = ev.attackTarget
        })
    })

    createQuizPageMutationObserver(({ visible }) => {
      if (!visible || quiz.gameMode !== 'Nexus') return
      curTarget =
        [
          ...(document.getElementById('qpAvatarRowEnemyContainer')?.children ??
            []),
        ].length - 1
    })

    return (delta: number) => {
      if (quiz?.gameMode !== 'Nexus') return

      const validTargets = Object.values(quiz.enemyMap)
        .filter(
          (enemy): enemy is NonNullable<typeof enemy> => !!enemy && enemy.hp > 0
        )
        .map((enemy) => enemy.enemyPosition)
        .sort((a, b) => a - b)

      const nxtTarget =
        delta > 0
          ? (validTargets.find((pos) => pos > curTarget) ?? validTargets[0])
          : (validTargets.findLast((pos) => pos < curTarget) ??
            validTargets[validTargets.length - 1])

      socket.sendCommand({
        type: 'nexus',
        command: 'target enemy',
        data: { enemyPosition: nxtTarget },
      })

      curTarget = nxtTarget
    }
  })()

  document.addEventListener('keydown', (event) => {
    if (!event.ctrlKey) {
      switch (event.key.toLowerCase()) {
        case KEYS.NEXUS_TARGET_PREV_ENEMY:
          changeNexusTarget(-1)
          break
        case KEYS.NEXUS_TARGET_NEXT_ENEMY:
          changeNexusTarget(1)
          break
      }
    }

    if (event.ctrlKey) {
      switch (event.key.toLowerCase()) {
        case KEYS.ANSWER:
          focusAnswer()
          break
        case KEYS.CHAT:
          focusChat()
          break
        case KEYS.NAME_HINT:
          nameHint()
          break
        case KEYS.INFO_HINT:
          infoHint()
          break
        case KEYS.VOTE_SKIP:
          voteSkip()
          break
        case KEYS.NEXUS_ABILITY_SLOT_1:
        case KEYS.NEXUS_ABILITY_SLOT_2:
        case KEYS.NEXUS_ABILITY_SLOT_3:
        case KEYS.NEXUS_ABILITY_SLOT_4:
          useAbilityInNexus(event.key)
          break
      }
    }
  })
}
