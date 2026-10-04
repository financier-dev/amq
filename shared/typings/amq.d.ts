/**
 * Ambient types for AMQ's runtime globals.
 *
 * Reverse-engineered and partial, seeded from the older userscripts' own
 * typings and from the mirrored client source at
 * `~/amq-source/<YYYY-MM-DD>/animemusicquiz.com` (use the latest dated
 * capture). Only the surface actually touched here is typed; extend it as more
 * of the game gets reimplemented.
 *
 * Shared by every project in this repo — reach it as `@shared/typings/amq`,
 * though the declarations are global and need no import.
 */

declare global {
  // --- room browser -------------------------------------------------------

  /** `quiz.SCORE_TYPE_IDS` */
  type ScoreTypeId = 1 | 2 | 3 | 4 | 5
  /** `quiz.SHOW_SELECTION_IDS` — 2 (LOOTING) means battle royale */
  type ShowSelectionId = 1 | 2
  /** `lobby.ANSWERING_MODES` */
  type AnsweringModeId = 1 | 2 | 3

  interface RoomSongTypeSetting {
    standardValue: { openings: boolean; endings: boolean; inserts: boolean }
    advancedValue: {
      openings: number
      endings: number
      inserts: number
      random: number
    }
    advancedOn?: boolean
  }

  interface RoomRandomRange<T = number> {
    randomOn: boolean
    randomValue: [T, T]
    standardValue: number
  }

  interface RoomAdvancedRange<Standard> {
    advancedOn: boolean
    standardValue: Standard
    advancedValue: [number, number]
  }

  interface RoomSongCategories {
    instrumental: boolean
    chanting: boolean
    character: boolean
    standard: boolean
  }

  interface RoomModifiers {
    skipGuessing: boolean
    skipReplay: boolean
    queueing: boolean
    duplicates: boolean
    lootDropping: boolean
    rebroadcastSongs: boolean
    dubSongs: boolean
    fullSongRange: boolean
    quizJoin: boolean
  }

  interface RoomHintSetup {
    songPoints: number
    nameCost: number
    infoCost: number
    multipleChoiceCost: number
    audioCost: number
    tinyVideoCost: number
    blurVideoCost: number
  }

  interface RoomAnimeTypes {
    tv: boolean
    movie: boolean
    ova: boolean
    ona: boolean
    special: boolean
  }

  interface RoomVintage {
    allYears?: boolean
    standardValue: { years: [number, number]; seasons: [number, number] }
    advancedValueList: { years: [number, number]; seasons: [number, number] }[]
  }

  /** One entry of `settings.genre` / `settings.tags`. `state` is a filter type. */
  interface RoomGenreTagEntry {
    id: number
    /** 1 include, 2 exclude, 3 optional — `game_settings.filter_types.*` */
    state: number
  }

  /**
   * `room.settings` as it arrives on the `New Rooms` payload. Field set follows
   * schema v22 in `settingSerilizer.js`; `hostModal.DEFUALT_SETTINGS` (sic) is
   * the runtime default for every one of them.
   */
  interface RoomSettings {
    roomName: string
    roomSize: number
    privateRoom: boolean
    numberOfSongs: number
    teamSize?: number
    gameMode: string
    scoreType: ScoreTypeId
    showSelection: ShowSelectionId
    answeringMode?: AnsweringModeId

    modifiers?: RoomModifiers
    songPool?: number
    watchedDistribution?: number
    songType: RoomSongTypeSetting
    songSelection: {
      advancedOn?: boolean
      standardValue: number
      advancedValue: { watched: number; unwatched: number; random: number }
    }
    openingCategories?: RoomSongCategories
    endingCategories?: RoomSongCategories
    insertCategories?: RoomSongCategories

    guessTime: RoomRandomRange
    extraGuessTime?: RoomRandomRange
    hintSetup?: RoomHintSetup
    guessMode?: { song: boolean; tinyVideo: boolean; blurVideo: boolean }
    inventorySize?: RoomRandomRange
    lootingTime?: RoomRandomRange
    lives?: number
    bossLives?: number
    bossPowerUps?: number
    bossMaxSongs?: number
    samplePoint?: RoomRandomRange
    /** `randomValue` is four booleans (0.5×/1×/1.5×/2×), not a numeric pair. */
    playbackSpeed?: RoomRandomRange<boolean>

    /** sic, AMQ's spelling. `standardValue` is the five-tier map. */
    songDifficulity?: RoomAdvancedRange<{
      beginner: boolean
      easy: boolean
      medium: boolean
      hard: boolean
      expert: boolean
    }>
    songPopularity?: RoomAdvancedRange<{
      disliked: boolean
      mixed: boolean
      liked: boolean
    }>
    playerScore?: {
      advancedOn: boolean
      standardValue: [number, number]
      advancedValue: boolean[]
    }
    animeScore?: {
      advancedOn: boolean
      standardValue: [number, number]
      advancedValue: boolean[]
    }
    animePopularity?: {
      advancedOn: boolean
      standardValue: number
      advancedValue: [number, number]
    }

    vintage?: RoomVintage
    type?: RoomAnimeTypes
    genre?: RoomGenreTagEntry[]
    tags?: RoomGenreTagEntry[]

    [key: string]: unknown
  }

  interface RoomAvatar {
    avatarName: string
    outfitName: string
    optionName: string
    optionActive: boolean
    colorName: string
    /** 0 | 20 | 51 — a CSS crop concern, not part of the CDN url. */
    sizeModifier: string
    animated: boolean
  }

  interface RoomHostAvatar {
    avatar: RoomAvatar
    background: { backgroundHori: string; backgroundVert?: string }
  }

  /** An entry of `room.allPlayers.players` / `.spectators`. */
  interface RoomPlayerInfo {
    name: string
    level: number
  }

  /**
   * One entry of the `standard` array on the `New Rooms` payload.
   *
   * `friendNames` and `allPlayers` replaced the old flat `players: string[]`
   * in the 2026-09-19 client capture — see roomBrowser.js:28-42.
   */
  interface RoomInfo {
    id: number
    host: string
    hostAvatar: RoomHostAvatar
    settings: RoomSettings
    numberOfPlayers: number
    numberOfSpectators: number
    friendNames: string[]
    allPlayers: { players: RoomPlayerInfo[]; spectators: RoomPlayerInfo[] }
    inLobby: boolean
    songLeft: number
  }

  interface NewRoomsData {
    standard: RoomInfo[]
    nexus?: unknown[]
  }

  /**
   * `Room Change` payload. `changeType` drives a small state machine; see
   * roomTile.js:230-325. Anything other than the listed types means the room
   * closed.
   */
  interface RoomChangeData {
    roomId: number
    changeType:
      | 'settings'
      | 'players'
      | 'spectators'
      | 'songsLeft'
      | 'game start'
      | 'game over'
      | (string & {})
    change?: Partial<RoomSettings>
    /** Name of the player who joined or left; absent on count-only updates. */
    playerName?: string
    playerLevel?: number
    /** Set when the joining/leaving player is a friend of yours. */
    friend?: string
    playerCount?: number
    spectatorCount?: number
    songsLeft?: number
    newHost?: { name: string }
  }

  // --- globals ------------------------------------------------------------

  class Listener {
    constructor(event: string, callback: (...args: any) => any)
    command: string
    callback: (...args: any) => any
    bound: boolean
    bindListener(): void
    unbindListener(): void
  }

  const socket: {
    _disconnected: boolean
    _socket: any
    listners: Record<string, Listener[]> // sic
    sendCommand: (content: any, responseHandler?: (...args: any) => any) => any
  }

  /**
   * `viewChanger.__controllers` is a plain mutable object of
   * `{ openView(callback, arg), closeView(arg) }` pairs — the injection seam
   * for replacing a whole screen (viewChanger.js:17-41).
   */
  interface ViewController {
    openView: (callback: () => void, arg?: any) => void
    closeView: (arg?: any) => void
    [key: string]: any
  }

  const viewChanger: {
    currentView: string
    __controllers: Record<string, ViewController>
    changeView: (newView: string, arg?: any) => void
    getCurrentView: () => string
    hideLoadingScreen: () => void
  }

  const roomBrowser: {
    activeRooms: Record<number, any>
    openView: (callback: () => void) => void
    closeView: () => void
    fireJoinLobby: (gameId: number, password?: string) => void
    fireSpectateGame: (
      gameId: number,
      password?: string,
      gameInvite?: boolean
    ) => void
    spectateGameWithPassword: (gameId: number) => void
    openHostModal: () => void
    joinLobby: (data: any, isSpectator: boolean) => void
    applyTileFilterToRoom: (room: any) => void
    [key: string]: any
  }

  const quiz: {
    SCORE_TYPE_IDS: {
      COUNT: 1
      HINT: 2
      SPEED: 3
      LIVES: 4
      BOSS: 5
    }
    SHOW_SELECTION_IDS: { AUTO: 1; LOOTING: 2 }
    [key: string]: any
  }

  const lobby: {
    ANSWERING_MODES: { TYPING: 1; MIXED: 2; MULTIPLE_CHOICE: 3 }
    [key: string]: any
  }

  const socialTab: {
    onlineFriends: Record<string, unknown>
    isFriend: (name: string) => boolean
    isBlocked: (name: string) => boolean
    [key: string]: any
  }

  const localizationHandler: {
    translate: (key: string, data?: object, translateData?: boolean) => string
    convertAnimeGenreToKey: (name: string) => string
    convertAnimeTagToKey: (name: string) => string
    /** `{ key, parameters }` for an anime type; see `LibraryAnimeCategory`. */
    convertCategoryToKey: (category: LibraryAnimeCategory) => {
      key: string
      parameters: { number?: number | string }
    }
  }

  /** Populated from the login payload's `genreInfo` / `tagInfo`. */
  const idTranslator: {
    genreNames: Record<number, string>
    tagNames: Record<number, string>
  }

  /** Localised names and values for every setting key (lobby setting messages). */
  const settingMessageFormater: {
    translateSettingNameToText: (key: string) => string
    translateSettingValueToText: (key: string, value: any) => string
    [key: string]: any
  }

  const playerProfileController: {
    loadProfile: (...args: any[]) => void
    loadProfileIfClosed: (
      name: string,
      $requestObject: any,
      offsetCorrections?: { x?: number; y?: number },
      closeHandler?: () => void,
      offline?: boolean,
      inGame?: boolean
    ) => void
    [key: string]: any
  }

  /** The tile-shaped object `setModePreviewGame` drives its buttons through. */
  interface SettingPreviewTarget {
    joinGame: () => void
    spectateGame: () => void
    settingPreviewClosed: () => void
  }

  const hostModal: {
    /** sic — AMQ's spelling. The runtime default for every room setting. */
    DEFUALT_SETTINGS: RoomSettings
    openHostModal: () => void
    changeSettings: (changes: Partial<RoomSettings>) => void
    setModePreviewGame: (tile: SettingPreviewTarget) => void
    showSettings: () => void
    show: () => void
    hide: () => void
    [key: string]: any
  }

  const cdnFormater: {
    AVATAR_SIZES: number[]
    AVATAR_HEAD_SIZES: number[]
    AVATAR_HEAD_FILENAME: string
    AVATAR_POSE_IDS: {
      BASE: 1
      THINKING: 2
      WAITING: 3
      WRONG: 4
      RIGHT: 5
      CONFUSED: 6
    }
    newAvatarHeadSrc: (
      avatar: string,
      outfit: string,
      option: string,
      optionOn: boolean,
      color: string
    ) => string
    newAvatarHeadSrcSet: (
      avatar: string,
      outfit: string,
      option: string,
      optionOn: boolean,
      color: string
    ) => string
    newSizedAvatarSrc: (
      avatar: string,
      outfit: string,
      option: string,
      optionOn: boolean,
      color: string,
      poseId: number,
      size: number
    ) => string
    [key: string]: any
  }

  // --- quiz builder -------------------------------------------------------

  /** One song of an anime in the library cache (`libraryCacheHandler.js:452`). */
  interface LibraryAnimeSongEntry {
    annSongId: number
    annId: number
    /** 1 = OP, 2 = ED, 3 = insert. */
    type: number
    /** Ordinal within its type; inserts are not numbered in the UI. */
    number: number
    /** `{ NONE: 0, LIKED: 1, DISLIKED: 2 }` */
    playerLikeStatus: number
    /** 1-based recency among songs recently guessed wrong; null otherwise. */
    wrongIndex: number | null
    uploaded: boolean
    rebroadcast: boolean
    dub: boolean
    songEntry: LibrarySongEntry
  }

  /** `libraryCacheHandler.js:505` — the song itself, shared between anime. */
  interface LibrarySongEntry {
    songId: number
    name: string
    songArtistId: number
    groupId: number
    /** `{ instrumental: 1, chanting: 2, character: 3, standard: 4 }` */
    category: number
    dub: boolean
    rebroadcast: boolean
  }

  /**
   * `libraryCacheHandler.js:382`. Note there is **no difficulty and no song
   * length here or anywhere else client-side** — difficulty exists only per
   * song behind `get song extended info`, and length not at all.
   */
  /**
   * An anime's type, as the library stores it: `{ name: 'TV', number: 2 }`.
   *
   * **Not a string.** It goes through
   * `localizationHandler.convertCategoryToKey` (`localizationHandler.js:423`),
   * which lowercases `name` and swaps spaces for underscores to build an
   * `anime_types.*` key, then fills `_NUMBER_` from `number`.
   */
  interface LibraryAnimeCategory {
    name: string
    number?: number | null
  }

  interface LibraryAnimeEntry {
    annId: number
    category: LibraryAnimeCategory
    year: number
    seasonId: number
    mainNames: { EN?: string; JA?: string }
    names: { name: string }[]
    /** Null until the watched overlay lands. */
    watched: boolean | null
    songs: {
      OP: LibraryAnimeSongEntry[]
      ED: LibraryAnimeSongEntry[]
      INS: LibraryAnimeSongEntry[]
    }
    readonly mainName: string
    readonly opCount: number
    readonly edCount: number
    readonly insertCount: number
  }

  const libraryCacheHandler: {
    getCachedAnime: (annId: number) => LibraryAnimeEntry | undefined
    getCachedAnnSongEntry: (
      annSongId: number
    ) => LibraryAnimeSongEntry | undefined
    getAnnIdFromAnnSongId: (annSongId: number) => number | undefined
    [key: string]: any
  }

  /**
   * AMQ's own creator. We replace its view but still call into it — saving goes
   * through its path so validation and the save dialog stay AMQ's.
   */
  const customQuizCreator: {
    /** Set before `changeView('customQuizCreator')` to start a blank quiz. */
    setupNewQuiz: () => void
    /** Builds an algorithm block from the host modal's settings. */
    createAlgorithmBlock: (settings: Record<string, unknown>) => void
    currentQuizId: number | null
    [key: string]: any
  }

  const customQuizBuilder: {
    MAX_RULE_BLOCKS: number
    MAX_SONG_COUNT: number
    [key: string]: any
  }

  const selfName: string
  const messageDisplayer: any

  /** AMQ ships jQuery globally; the profile modal takes jQuery objects. */
  const $: any

  /** SweetAlert2, used for the private-room password prompt. */
  const Swal: {
    fire: (options: any) => Promise<{ isConfirmed: boolean; value?: string }>
  }
}

export {}
