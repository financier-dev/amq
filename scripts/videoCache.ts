/**
 * Plays song videos from the local cache (`npm run video-cache`), and the mp3
 * for every other song.
 *
 * The game sends the next song's files a round early, through
 * `quizVideoController.nextVideoInfo`. The script asks the cache about the
 * song's file right then, and the server queues a download on a miss.
 * The player picks its file later and synchronously, in `getNextVideoId`, so
 * the answer is usually ready by then. When it is not, `loadNextVideo` waits
 * for it, at most `CHECK_TIMEOUT_MS`.
 *
 * A miss always plays the mp3, even if the download finishes during the
 * round, so a slow download never costs a song. The cache keeps the 720p file,
 * else the 480p one. Encrypted games and songs with neither always play the
 * mp3. When the cache server is not
 * running, every song plays the mp3. When a song plays the mp3, the video box
 * shows why under AMQ's "Sound Only" text, during the reveal only.
 *
 * The script does nothing, and AMQ plays as usual, when the game's quality
 * setting is mp3 or when `/videocache off` turned it off.
 */

import {
  type CachedFile,
  VIDEO_CACHE_ORIGIN,
  cachedFile,
  videoCacheUrl,
} from '@shared/videoCache'
import { registerCommand } from './commands'

const CHECK_TIMEOUT_MS = 300
const MP3_RESOLUTION = 0
const DISABLED_KEY = 'amq-video-cache-disabled'

let disabled = readDisabled()

function readDisabled(): boolean {
  try {
    return localStorage.getItem(DISABLED_KEY) === '1'
  } catch {
    return false
  }
}

function setDisabled(value: boolean) {
  disabled = value
  try {
    if (value) localStorage.setItem(DISABLED_KEY, '1')
    else localStorage.removeItem(DISABLED_KEY)
  } catch {
    // The setting then lasts until the page reloads.
  }
}

function isActive(): boolean {
  return !disabled && qualityController.targetResolution !== MP3_RESOLUTION
}

function statusText(): string {
  if (disabled) return 'off (AMQ default playback)'
  if (!isActive()) return 'on, but paused: the quality setting is mp3'
  return 'on'
}

type CheckResult = 'cached' | 'miss' | 'offline' | 'timeout' | 'failed'

const MP3_REASONS: Record<Exclude<CheckResult, 'cached'>, string> = {
  miss: 'Cache miss: downloading the video for next time',
  offline: 'Cache server offline',
  timeout: 'Cache server did not answer in time',
  failed: 'The cached video did not play',
}
const NO_VIDEO_REASON = 'This song has no 720p or 480p video'
const ENCRYPTED_REASON = 'Encrypted song: the cache is not used'
const UNCHECKED_REASON = 'The cache was not checked for this song'

interface CacheTarget extends CachedFile {
  hostKey: string
}

/** Cache answers by file ID. */
const answers = new Map<string, CheckResult>()
const checks = new Map<string, Promise<CheckResult>>()
/** Why each player plays the mp3, or null when it does not. */
const mp3Reasons = new WeakMap<MoeVideoPlayer, string | null>()

function cacheTarget(
  videoMap: VideoMap | undefined,
  hostKeys: string[]
): CacheTarget | null {
  if (!videoMap) return null
  for (const hostKey of hostKeys) {
    const file = cachedFile(videoMap[hostKey])
    if (file) return { ...file, hostKey }
  }
  return null
}

function songTarget(songInfo: SongVideoInfo | undefined): CacheTarget | null {
  if (!songInfo || songInfo.encrypted) return null
  return cacheTarget(songInfo.videoMap, options.getHostPriorityList())
}

async function askCache(fileId: string): Promise<CheckResult> {
  try {
    const res = await fetch(videoCacheUrl(fileId, videoResolver.targetHost), {
      method: 'HEAD',
      signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
    })
    return res.ok ? 'cached' : 'miss'
  } catch (error) {
    return (error as Error).name === 'TimeoutError' ? 'timeout' : 'offline'
  }
}

/** A new check every time: a file that missed before may be cached now. */
function startCheck(fileId: string): Promise<CheckResult> {
  answers.delete(fileId)
  const check = askCache(fileId).then((result) => {
    answers.set(fileId, result)
    checks.delete(fileId)
    return result
  })
  checks.set(fileId, check)
  // A game has at most a few hundred songs; drop answers from old games.
  if (answers.size > 500) answers.delete(answers.keys().next().value!)
  return check
}

function mp3Reason(player: MoeVideoPlayer): string {
  if (player.encrypted) return ENCRYPTED_REASON
  const target = cacheTarget(player.videoMap, player.hostOrder)
  if (!target) return NO_VIDEO_REASON
  const answer = answers.get(target.fileId)
  if (!answer || answer === 'cached') return UNCHECKED_REASON
  return MP3_REASONS[answer]
}

let reasonLabel: HTMLElement | null = null
/** True from the reveal until the next song's player takes over. */
let revealed = false

function createReasonLabel() {
  const soundOnly = document.getElementById('qpVideoSoundOnly')
  if (!soundOnly) return
  reasonLabel = document.createElement('div')
  // The same layer as "Sound Only": behind the player, visible only when the
  // player shows no picture.
  Object.assign(reasonLabel.style, {
    position: 'absolute',
    left: '0',
    right: '0',
    top: 'calc(50% + 45px)',
    textAlign: 'center',
    fontSize: '18px',
    opacity: '0.8',
    zIndex: '-1',
  })
  soundOnly.after(reasonLabel)
}

function showReason() {
  if (!reasonLabel) return
  const player = quizVideoController.getCurrentPlayer()
  const reason = revealed && player ? mp3Reasons.get(player) : null
  reasonLabel.textContent = reason ?? ''
}

export default async function setup() {
  createReasonLabel()

  const originalNextVideoInfo = quizVideoController.nextVideoInfo
  quizVideoController.nextVideoInfo = function (songInfo, ...rest) {
    const target = isActive() ? songTarget(songInfo) : null
    if (target) void startCheck(target.fileId)
    return originalNextVideoInfo.call(this, songInfo, ...rest)
  }

  // A `startTime` means the player joined during a song. AMQ then loads and
  // plays at once, and reads the current player right after this call, so
  // waiting here throws inside `setupQuiz` and the quiz screen never opens.
  const originalLoadNextVideo = quizVideoController.loadNextVideo
  quizVideoController.loadNextVideo = function () {
    const next = this._nextVideoInfo
    if (next?.startTime != undefined) return originalLoadNextVideo.call(this)
    const target = isActive() ? songTarget(next?.songInfo) : null
    const check = target && checks.get(target.fileId)
    if (!check) return originalLoadNextVideo.call(this)
    void check.then(() => originalLoadNextVideo.call(this))
  }

  const originalChangeToNextPlayer = quizVideoController.changeToNextPlayer
  quizVideoController.changeToNextPlayer = function () {
    originalChangeToNextPlayer.call(this)
    revealed = false
    showReason()
  }

  const originalReplayVideo = quizVideoController.replayVideo
  quizVideoController.replayVideo = function () {
    originalReplayVideo.call(this)
    revealed = true
    showReason()
  }

  const proto = MoeVideoPlayer.prototype
  const originalGetNextVideoId = proto.getNextVideoId
  proto.getNextVideoId = function () {
    const url = pickVideo(this)
    if (this === quizVideoController.getCurrentPlayer()) showReason()
    return url
  }

  function pickVideo(player: MoeVideoPlayer): string {
    mp3Reasons.set(player, null)
    if (!isActive()) return originalGetNextVideoId.call(player)
    const target = player.encrypted
      ? null
      : cacheTarget(player.videoMap, player.hostOrder)
    if (target && answers.get(target.fileId) === 'cached') {
      player.host = target.hostKey
      player.resolution = target.resolution
      return videoCacheUrl(target.fileId)
    }

    const mp3Host = player.hostOrder.find(
      (hostKey) => player.videoMap[hostKey]?.[MP3_RESOLUTION] !== undefined
    )
    if (mp3Host === undefined) return originalGetNextVideoId.call(player)
    player.host = mp3Host
    player.resolution = MP3_RESOLUTION
    mp3Reasons.set(player, mp3Reason(player))
    return videoResolver.formatUrl(
      player.videoMap[mp3Host]![MP3_RESOLUTION],
      player.encrypted
    )
  }

  // AMQ's handleError reports a `video error` to the server for the file it
  // tried. A local file that fails is not AMQ's problem: mark it as failed
  // and load again, which picks the mp3.
  const originalHandleError = proto.handleError
  proto.handleError = function () {
    if (!this.currentVideoUrl?.startsWith(VIDEO_CACHE_ORIGIN)) {
      return originalHandleError.call(this)
    }
    const target = cacheTarget(this.videoMap, this.hostOrder)
    if (target) answers.set(target.fileId, 'failed')
    console.warn('[videoCache] Local file failed, playing the mp3')
    this.startLoading()
  }

  registerCommand(
    'videocache',
    () => ({
      shortHelp: 'Turn the local video cache on or off',
      longHelp: `Usage: /videocache [on|off]</br>On: songs in the local cache play the video from your disk, and other songs play the mp3. Off: AMQ plays songs as usual. The change starts with the next song. When the quality setting is mp3, the cache is paused.</br>Current value: ${statusText()}`,
    }),
    (args) => {
      const value = args.trim().toLowerCase()
      if (value === 'on' || value === 'off') {
        setDisabled(value === 'off')
      } else if (value) {
        gameChat.systemMessage('Usage: /videocache [on|off]')
        return
      }
      gameChat.systemMessage(`Video cache: ${statusText()}`)
    }
  )
}
