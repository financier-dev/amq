/** The shared event wrapper, plus the quiz builder's own events. */

import type { QuizSave } from './quizSave'

declare module '@shared/events' {
  interface AMQEventMap {
    'load custom quiz': {
      quizId: number
      failed?: boolean
      quizSave?: QuizSave
    }
    'save custom quiz': {
      success?: boolean
      quizId?: number
      quizSave?: QuizSave
    }
    /** `blockId` is the id we sent with the request. */
    'get algorithm songs': { blockId: number; annSongIds: number[] }
  }
}

export * from '@shared/events'
