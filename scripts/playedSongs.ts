/**
 * Saves every song of every game in the song database, with the room
 * settings, the song's full information and each player's answer, answer
 * time, team, level and result.
 *
 * At each reveal, the script sends one record to the local server
 * (`npm run video-cache`), which saves it in `amq.played-songs`. When the
 * server is not running, the record waits in `localStorage` and goes with the
 * next one. A record sent twice is saved once.
 */

import { addListener } from '@shared/events'
import { type PlayedSong, PLAYED_SONG_PATH } from '@shared/playedSongs'
import { VIDEO_CACHE_ORIGIN } from '@shared/videoCache'

/** Also save the songs of games the player only watches. */
const RECORD_WHILE_SPECTATING = true

const OUTBOX_KEY = 'amq-played-songs-outbox'
// A record can be tens of KB, and localStorage holds about 5 MB.
const OUTBOX_LIMIT = 100

interface Game {
  key: string
  totalSongs: number | null
  multipleChoice: boolean
}

interface Round {
  startedAt: string | null
  guessTime: number | null
  extraGuessTime: number | null
  answers: Map<number, { answer: string; answerNumber: number | null }>
  teamAnswers: Map<number, string>
  answerTimes: Map<number, number>
  hints: Map<number, number[]>
}

function newRound(startedAt: string | null): Round {
  return {
    startedAt,
    guessTime: null,
    extraGuessTime: null,
    answers: new Map(),
    teamAnswers: new Map(),
    answerTimes: new Map(),
    hints: new Map(),
  }
}

let game: Game | null = null
let round = newRound(null)

function readOutbox(): PlayedSong[] {
  try {
    const saved = JSON.parse(localStorage.getItem(OUTBOX_KEY) ?? '[]')
    return Array.isArray(saved) ? saved : []
  } catch {
    return []
  }
}

function writeOutbox(records: PlayedSong[]) {
  try {
    if (records.length) {
      localStorage.setItem(
        OUTBOX_KEY,
        JSON.stringify(records.slice(-OUTBOX_LIMIT))
      )
    } else {
      localStorage.removeItem(OUTBOX_KEY)
    }
  } catch (error) {
    console.warn('[playedSongs] Cannot keep unsent songs', error)
  }
}

let sending = false

/** Sends the records in the outbox, oldest first, until one fails. */
async function flush() {
  if (sending) return
  sending = true
  try {
    let records = readOutbox()
    while (records.length) {
      const res = await fetch(VIDEO_CACHE_ORIGIN + PLAYED_SONG_PATH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(records[0]),
      }).catch(() => null)
      if (!res) break
      if (!res.ok) {
        console.warn(
          `[playedSongs] The server refused ${records[0].recordId} (HTTP ${res.status})`
        )
        if (res.status !== 400) break
      }
      // Read again: a reveal can add a record while this one is sent.
      records = readOutbox().filter((r) => r.recordId !== records[0].recordId)
      writeOutbox(records)
    }
  } finally {
    sending = false
  }
}

function withoutPassword(settings: any): Record<string, unknown> {
  const copy = structuredClone(settings ?? {})
  delete copy.password
  return copy
}

function buildRecord(result: any): PlayedSong | null {
  if (!game) return null
  const spectator = Boolean(quiz.isSpectator)
  if (spectator && !RECORD_WHILE_SPECTATING) return null

  const songNumber = Number(quiz.infoContainer?.currentSongNumber) || null
  const { songInfo, players: playerResults, ...rest } = result
  const players = (playerResults as any[]).map((entry) => {
    const id: number = entry.gamePlayerId
    const player = quiz.players[id]
    const answer = round.answers.get(id)
    return {
      ...entry,
      gamePlayerId: id,
      name: player?.name ?? '',
      level: player?.level ?? null,
      teamNumber: quiz.teamMode ? (player?.teamNumber ?? null) : null,
      host: Boolean(player?.host),
      isSelf: Boolean(player?.isSelf),
      answer: answer?.answer ?? null,
      answerNumber: answer?.answerNumber ?? null,
      teamAnswer: round.teamAnswers.get(id) ?? null,
      answerTime: round.answerTimes.get(id) ?? null,
      hints: round.hints.get(id) ?? [],
    }
  })
  const self = players.find((player) => player.isSelf)

  return {
    recordId: `${game.key}:${songNumber ?? Date.now()}`,
    gameKey: game.key,
    playedAt: new Date().toISOString(),
    songStartedAt: round.startedAt,
    songNumber,
    totalSongs: game.totalSongs,
    self: {
      name: selfName,
      gamePlayerId: quiz.ownGamePlayerId ?? null,
      spectator,
      answer: self?.answer ?? null,
      correct: self ? Boolean(self.correct) : null,
    },
    room: {
      gameId: lobby.gameId ?? null,
      soloMode: Boolean(quiz.soloMode),
      champGame: Boolean(quiz.champGame),
      gameMode: quiz.gameMode ?? null,
      teamMode: Boolean(quiz.teamMode),
      multipleChoice: game.multipleChoice,
      quizDescription: quiz.quizDescription ?? null,
      settings: withoutPassword(quiz.quizSettings),
    },
    song: songInfo,
    video: {
      startPoint: quizVideoController.getCurrentVideoStartPoint(),
      length: quizVideoController.getCurrentVideoLength(),
      host: quizVideoController.getCurrentPlayer()?.host ?? null,
      resolution: quizVideoController.getCurrentPlayer()?.resolution ?? null,
      guessMode: quizVideoController.getCurrentVideoGuessMode() ?? null,
      guessTime: round.guessTime,
      extraGuessTime: round.extraGuessTime,
    },
    players,
    result: rest,
  }
}

export default async function setup() {
  // AMQ calls `setupQuiz` when a game starts, when the player joins one
  // in progress, and when a Jam game restarts.
  const originalSetupQuiz = quiz.setupQuiz
  quiz.setupQuiz = function (...args: any[]) {
    const result = originalSetupQuiz.apply(this, args)
    const quizState = args[2]
    game = {
      key: crypto.randomUUID(),
      totalSongs: quizState?.totalSongNumbers ?? null,
      multipleChoice: Boolean(args[10]),
    }
    round = newRound(null)
    return result
  }

  addListener('quiz ready', (data: any) => {
    if (game) game.totalSongs = data?.numberOfSongs ?? game.totalSongs
  })

  addListener('play next song', (data: any) => {
    round = newRound(new Date().toISOString())
    round.guessTime = data?.time ?? null
    round.extraGuessTime = data?.extraGuessTime ?? null
  })

  addListener('player answered', (data) => {
    for (const { gamePlayerIds, answerTime } of data) {
      for (const id of gamePlayerIds) round.answerTimes.set(id, answerTime)
    }
  })

  addListener('player answers', (data: any) => {
    for (const { gamePlayerId, answer, answerNumber } of data.answers) {
      round.answers.set(gamePlayerId, {
        answer,
        answerNumber: answerNumber ?? null,
      })
    }
  })

  addListener('team member answer', ({ gamePlayerId, answer }) => {
    round.teamAnswers.set(gamePlayerId, answer)
  })

  addListener('quiz player hint used', ({ gamePlayerIds, hintId }) => {
    for (const id of gamePlayerIds as number[]) {
      round.hints.set(id, [...(round.hints.get(id) ?? []), hintId])
    }
  })

  addListener('answer results', (result) => {
    let record: PlayedSong | null
    try {
      record = buildRecord(result)
    } catch (error) {
      console.error('[playedSongs] Cannot read the song', error)
      return
    }
    if (!record) return
    writeOutbox([...readOutbox(), record])
    void flush()
  })

  void flush()
}
