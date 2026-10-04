/**
 * Typed wrapper around AMQ's `Listener` / socket event system.
 *
 * `socket.addListerner` (sic) pushes onto an array per command, so binding our
 * own listeners never displaces AMQ's — both fire.
 */

export type AMQEventMap = {
  'New Rooms': NewRoomsData
  'Room Change': RoomChangeData
  'Join Game': { error?: boolean; errorMsg?: string; [key: string]: any }
  'Spectate Game': { error?: boolean; errorMsg?: string; [key: string]: any }
  'Host Game': any
  'friend state change': { name: string; online: boolean }
  'game invite': { sender: string; gameId: number }
  // --- quiz builder ---
  'load custom quiz': {
    quizId: number
    failed?: boolean
    quizSave?: import('./quizSave').QuizSave
  }
  'save custom quiz': {
    success?: boolean
    quizId?: number
    quizSave?: import('./quizSave').QuizSave
  }
  /** Reply to `get algorithm songs`, keyed by the block id we sent. */
  'get algorithm songs': { blockId: number; annSongIds: number[] }
}

export type AMQEvent = keyof AMQEventMap
export type AMQEventData<T extends AMQEvent> = AMQEventMap[T]

/**
 * Binds a listener and returns an unbind function. Unlike the tampermonkey
 * repo's `addListener`, the handle is required here: screens bind on
 * `openView` and must unbind on `closeView`, or stale rooms accumulate.
 */
export function addListener<T extends AMQEvent>(
  event: T,
  callback: (data: AMQEventData<T>) => void
): () => void {
  const listener = new Listener(event, callback)
  listener.bindListener()
  return () => listener.unbindListener()
}

/** Binds several listeners, returning a single unbind for all of them. */
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
