/**
 * Typed wrapper around AMQ's `Listener` and socket commands.
 *
 * `socket.addListerner` (sic) pushes onto an array per command, so our
 * listeners never displace AMQ's. Both fire.
 */

export interface AnswerResultsData {
  songInfo: {
    animeNames: {
      english: string
      romaji: string
    }
    animeType: string
    animeScore: number
    /** A localization key and data on newer payloads, a string on older ones. */
    vintage: string | { key: string; data: object }
    altAnimeNames: string[]
    altAnimeNamesAnswers: string[]
    animeDifficulty?: number | null
    songName: string
    artist: string
    type: number
    typeNumber: number | null
    rebroadcast?: boolean
    dub?: boolean
    siteIds?: { annId?: number }
    videoTargetMap: {
      catbox: {
        0?: string | null
        480?: string | null
        720?: string | null
      }
    }
  }
  players: {
    correct: boolean
    gamePlayerId: number
    listStatus?: number
  }[]
}

export interface ChatMessageData {
  message: string
  sender: string
}

export interface PlayerAnsweredData {
  gamePlayerIds: number[]
  answerTime: number
}

export interface PlayerAnswersData {
  answers: {
    answer: string
    gamePlayerId: number
  }[]
}

export interface JamVoteResultData {
  themeResult: {
    option: { id: number; name: string }
    vote: { profileInfo: { name: string } }
  }
  typeDistribution: { typeId: number; amount: number }[]
}

/**
 * The events every project can listen to. A project adds its own events by
 * augmenting this interface (see `ui/src/amq/events.ts`).
 */
export interface AMQEventMap {
  'New Rooms': NewRoomsData
  'Room Change': RoomChangeData
  'Join Game': { error?: boolean; errorMsg?: string; [key: string]: any }
  'Spectate Game': { error?: boolean; errorMsg?: string; [key: string]: any }
  'Host Game': any
  'friend state change': { name: string; online: boolean }
  'game invite': { sender: string; gameId: number }

  'answer results': AnswerResultsData
  'Change To Player': any
  'chat message response': any
  'chat message': ChatMessageData
  'game chat update': { messages: ChatMessageData[] }
  'get all song names': any
  'get current master list id': { masterListId: string }
  'Host Promotion': any
  'Jam Vote Result': JamVoteResultData
  'Jam Vote Started': { modifierOptions: { id: number; name: string }[] }
  'nexus game events': any
  'play next song': string
  'player answered': PlayerAnsweredData[]
  'player answers': PlayerAnswersData
  'player name change': { gamePlayerId: number; newName: string }
  'quiz over': null
  'quiz player hint used': any
  'quiz ready': null
  'quiz song hint': any
  'return lobby vote start': any
  'Room Settings Changed': any
  'team member answer': { answer: string; gamePlayerId: number }
  'update all song names': any
}

export type AMQEvent = keyof AMQEventMap
export type AMQEventData<T extends AMQEvent> = AMQEventMap[T]

/**
 * Returns the unbind function. A screen that binds on `openView` must unbind
 * on `closeView`, or its listeners keep running after it closes.
 */
export function addListener<T extends AMQEvent>(
  event: T,
  callback: (data: AMQEventData<T>) => void
): () => void {
  const listener = new Listener(event, callback)
  listener.bindListener()
  return () => listener.unbindListener()
}

export function addListeners(bindings: {
  [K in AMQEvent]?: (data: AMQEventData<K>) => void
}): () => void {
  const unbinds = Object.entries(bindings).map(([event, cb]) =>
    addListener(event as AMQEvent, cb as (data: any) => void)
  )
  return () => unbinds.forEach((unbind) => unbind())
}

export function sendCommand(type: string, command: string, data?: unknown) {
  socket.sendCommand(
    data === undefined ? { type, command } : { type, command, data }
  )
}
