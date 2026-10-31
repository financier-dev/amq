/**
 * Ambient types for AMQ's runtime globals.
 *
 * Reverse-engineered and partial. The sources are the runtime objects and
 * the client source at `~/amq-source/<YYYY-MM-DD>/animemusicquiz.com` (use
 * the latest dated capture). Only what this repo uses is typed. Extend it as
 * needed.
 *
 * The declarations are global and need no import.
 */

declare global {
  // --- room browser -------------------------------------------------------

  /** `quiz.SCORE_TYPE_IDS` */
  type ScoreTypeId = 1 | 2 | 3 | 4 | 5
  /** `quiz.SHOW_SELECTION_IDS`. 2 (LOOTING) means battle royale. */
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

  /** One entry of `settings.genre` or `settings.tags`. */
  interface RoomGenreTagEntry {
    id: number
    /** 1 include, 2 exclude, 3 optional (`game_settings.filter_types.*`). */
    state: number
  }

  /**
   * `room.settings` as the `New Rooms` payload carries it. The fields follow
   * schema v22 in `settingSerilizer.js`. `hostModal.DEFUALT_SETTINGS` (sic)
   * holds the runtime default of each.
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
    /** `randomValue` is four booleans (0.5×, 1×, 1.5×, 2×), not a range. */
    playbackSpeed?: RoomRandomRange<boolean>

    /** AMQ's spelling (sic). `standardValue` is the five-tier map. */
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
    /** 0, 20 or 51. Used for CSS positioning; not part of the CDN url. */
    sizeModifier: string
    animated: boolean
  }

  interface RoomHostAvatar {
    avatar: RoomAvatar
    background: { backgroundHori: string; backgroundVert?: string }
  }

  /** An entry of `room.allPlayers.players` or `.spectators`. */
  interface RoomPlayerInfo {
    name: string
    level: number
  }

  /**
   * One entry of the `standard` array in the `New Rooms` payload.
   *
   * `friendNames` and `allPlayers` replaced the flat `players: string[]` in
   * the 2026-09-19 client capture. See roomBrowser.js:28-42.
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
   * `Room Change` payload. See roomTile.js:230-325 for how `changeType` is
   * handled. Any type not listed here means the room closed.
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
    /** The player who joined or left. Absent on count-only updates. */
    playerName?: string
    playerLevel?: number
    /** Set when the player who joined or left is a friend. */
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
   * `{ openView(callback, arg), closeView(arg) }` pairs. Swapping an entry
   * replaces a whole screen (viewChanger.js:17-41).
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
    gameMode: string
    teamMode: boolean
    isSpectator: boolean
    /** Keyed by `gamePlayerId`. */
    players: Record<
      number,
      {
        isSelf: boolean
        teamNumber: number | null
        _name: string
        name: string
        /** The level when the game started. */
        level: number
        host: boolean
        avatarSlot: { lifeCounterController: { currentLives: number } }
      }
    >
    /** Nexus only. */
    enemyMap: Record<
      number,
      { hp: number; enemyPosition: number } | null | undefined
    >
    scoreboard: { teamMap: Record<number, unknown> }
    pauseButton: { pauseOn: boolean }
    skipClicked: () => void
    skipController: {
      _toggled: boolean
      highlight: boolean
      sendSkipVote: () => void
    }
    [key: string]: any
  }

  /**
   * File IDs by host key and resolution, such as
   * `{ catbox: { 720: 'abc123.webm', 480: '…', 0: 'abc123.mp3' } }`.
   * The host key comes from `options.getHostPriorityList()`. It is not
   * the EU/NA1/NA2 endpoint, which `videoResolver` picks separately.
   */
  type VideoMap = Record<string, Record<number, string> | undefined>

  /** `videoInfo` of `quiz next video info`. */
  interface SongVideoInfo {
    id: number
    videoMap: VideoMap
    encrypted?: boolean
    [key: string]: any
  }

  const quizVideoController: {
    getCurrentVideoStartPoint: () => number | null
    getCurrentVideoLength: () => number | null
    getCurrentVideoGuessMode: () => unknown
    nextVideoInfo: (songInfo: SongVideoInfo, ...rest: any[]) => void
    loadNextVideo: () => void
    _nextVideoInfo: { songInfo: SongVideoInfo; [key: string]: any } | null
    /** Makes the buffered player the current one, before it plays. */
    changeToNextPlayer: () => void
    getCurrentPlayer: () => MoeVideoPlayer | undefined
    /** Called once per song, when `answer results` starts the reveal. */
    replayVideo: () => void
  }

  /** `targetResolution` is 0 when the quality setting is mp3. */
  const qualityController: {
    targetResolution: number
  }

  class MoeVideoPlayer {
    videoMap: VideoMap
    encrypted: boolean
    host: string
    resolution: number
    hostOrder: string[]
    currentVideoUrl: string | null
    /** The sample point of `quiz next video info` (0 to 100), divided by 100. */
    startPercent: number
    /** The second where the clip starts in the file. Null until it loads. */
    startPoint: number | null
    /** The guess time, in seconds. */
    playLength: number
    playbackRate: number
    forcedSamplePoint: boolean | null | undefined
    getNextVideoId(): string
    handleError(): void
    startLoading(): void
  }

  /** The fields of `lobby.settings` that scripts read are typed as present. */
  type LobbySettings = RoomSettings &
    Required<
      Pick<
        RoomSettings,
        | 'songDifficulity'
        | 'genre'
        | 'tags'
        | 'openingCategories'
        | 'endingCategories'
        | 'insertCategories'
        | 'modifiers'
        | 'extraGuessTime'
      >
    >

  const lobby: {
    ANSWERING_MODES: { TYPING: 1; MIXED: 2; MULTIPLE_CHOICE: 3 }
    inLobby: boolean
    isReady: boolean
    isHost: boolean
    isSpectator: boolean
    /**
     * Undefined at runtime until the player joins a room (`setupLobby`). Typed
     * as present because scripts read it only inside a room.
     */
    settings: LobbySettings
    numberOfPlayersReady: number
    /** Keyed by `gamePlayerId`. */
    players: Record<number, { name: string }>
    fireMainButtonEvent: () => void
    promoteHost: (playerName: string) => void
    [key: string]: any
  }

  const gameChat: any

  const AfkKicker: any
  const afkKicker: any
  const QuizInfoContainer: any

  /** AMQ's settings object. Do not confuse it with a script's own `options`. */
  const options: {
    useRomajiNames: boolean
    getHostPriorityList: () => string[]
    /** List statuses ticked under Settings → Anime List → Included Entries. */
    getIncludedListTypesMap: () => Record<string, boolean>
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
    /** `{ key, parameters }` for an anime type. See `LibraryAnimeCategory`. */
    convertCategoryToKey: (category: LibraryAnimeCategory) => {
      key: string
      parameters: { number?: number | string }
    }
  }

  /** Filled from `genreInfo` and `tagInfo` in the login payload. */
  const idTranslator: {
    genreNames: Record<number, string>
    tagNames: Record<number, string>
  }

  /** Localised names and values for every setting key. */
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

  /** The object whose methods `setModePreviewGame` calls from its buttons. */
  interface SettingPreviewTarget {
    joinGame: () => void
    spectateGame: () => void
    settingPreviewClosed: () => void
  }

  const hostModal: {
    /** AMQ's spelling (sic). The runtime default of every room setting. */
    DEFUALT_SETTINGS: RoomSettings
    openHostModal: () => void
    changeSettings: (changes: Partial<RoomSettings>) => void
    setModePreviewGame: (tile: SettingPreviewTarget) => void
    showSettings: () => void
    show: () => void
    hide: () => void
    genreFilter: SettingDropDownFilter
    tagFilter: SettingDropDownFilter
    [key: string]: any
  }

  interface SettingDropDownFilter {
    awesomepleteInstance: { _list: { id: number; name: string }[] }
  }

  const videoResolver: {
    hostOrder: string[]
    targetHost: string
    readonly targetEndpoint: string
    connectionTesterMap: Record<string, any>
    updateActiveHost: () => boolean
    testHost: (host: string) => void
    formatUrl: (fileId: string, encrypted: boolean) => string
  }

  const videoConnectionStatus: {
    targetHost: string | null
    /** `$body` is a jQuery object. */
    hostStatusRows: Record<
      string,
      {
        $body: ArrayLike<HTMLElement>
        testing: boolean
        status: string | null
      }
    >
    updateTargetHost: (hostName: string) => void
  }

  class AmqAwesomeplete {
    evaluate: () => any
  }

  class Suggestion {
    constructor(...args: any)
    label: string
    value: string
  }

  const createAnimeSearchRegexQuery: (...args: any) => any
  const translateShortcodeToUnicode: (text: string) => { text: string }
  const convertSecondsToTimeString: (totalSeconds: number) => string
  const convertTypeInfoToText: (
    type: number,
    typeNumber: number | null,
    rebroadcast?: boolean | null,
    dub?: boolean | null,
    baseKey?: string
  ) => { key: string; data: object }

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

  /** One song of an anime in the cache (`libraryCacheHandler.js:452`). */
  interface LibraryAnimeSongEntry {
    annSongId: number
    annId: number
    /** 1 = OP, 2 = ED, 3 = insert. */
    type: number
    /** Position within its type. The UI does not number inserts. */
    number: number
    /** `{ NONE: 0, LIKED: 1, DISLIKED: 2 }` */
    playerLikeStatus: number
    /** 1-based rank among recently wrong songs, newest first. Else null. */
    wrongIndex: number | null
    uploaded: boolean
    rebroadcast: boolean
    dub: boolean
    songEntry: LibrarySongEntry
  }

  /**
   * An artist or a group in the library cache (`libraryCacheHandler.js:558`
   * and `:597`). One type covers both because search treats them alike.
   * `IS_GROUP` tells them apart.
   */
  interface LibraryArtistEntry {
    name: string
    /**
     * Lowercased name variants, **alt names included** (`addAltName` adds
     * them). Built at cache load, so search never lowercases per keystroke.
     */
    searchNames?: string[]
    searchIndex?: LibrarySearchIndex | null
    /**
     * Every entry a non-strict artist search tests: the entry, its alt names
     * and, for a group, its members and their groups, recursively
     * (`libraryCacheHandler.js:581` and `:650`).
     */
    getFullMemberEntryList?: () => LibraryArtistEntry[]
    IS_GROUP?: boolean
  }

  /**
   * A first-char → second-char prefilter over an entry's `searchNames`. A
   * worker builds it after the cache loads (`libraryCacheHandler.js:232`);
   * it is null until then. A miss means no name can match. A hit proves
   * nothing.
   *
   * `ui/src/amq/librarySearch.ts` does not use it: the worker is missing from
   * the client capture, so what it indexes cannot be checked.
   */
  interface LibrarySearchIndex {
    [firstChar: string]: { [secondChar: string]: unknown }
  }

  /** `libraryCacheHandler.js:505`. The song itself, shared between anime. */
  interface LibrarySongEntry {
    songId: number
    name: string
    songArtistId: number
    groupId: number
    /** `{ instrumental: 1, chanting: 2, character: 3, standard: 4 }` */
    category: number
    dub: boolean
    rebroadcast: boolean
    /** Lowercased variants of `name`. See `LibraryArtistEntry.searchNames`. */
    searchNames?: string[]
    searchIndex?: LibrarySearchIndex | null
    /**
     * `setupArtists` sets these from the id pairs once the artist and group
     * maps exist. Absent when the song credits nobody in that role.
     */
    artist?: LibraryArtistEntry
    composer?: LibraryArtistEntry
    arranger?: LibraryArtistEntry
  }

  /**
   * An anime's type as the library stores it: `{ name: 'TV', number: 2 }`.
   *
   * **Not a string.** `localizationHandler.convertCategoryToKey`
   * (`localizationHandler.js:423`) lowercases `name`, replaces spaces with
   * underscores to build an `anime_types.*` key, and fills `_NUMBER_` from
   * `number`.
   */
  interface LibraryAnimeCategory {
    name: string
    number?: number | null
  }

  /**
   * `libraryCacheHandler.js:382`. **The client has no difficulty and no song
   * length**, here or elsewhere. Difficulty is available only per song
   * through `get song extended info`.
   */
  interface LibraryAnimeEntry {
    annId: number
    category: LibraryAnimeCategory
    year: number
    seasonId: number
    mainNames: { EN?: string; JA?: string }
    names: { name: string; language?: string }[]
    /**
     * Lowercased variants of **every** name in `names`. Each is also stored
     * with its characters folded (`replaceCharactersForSeachCharacters`) when
     * that changes it, so a plain ASCII query finds a title with macrons
     * (`Jōjō` → `jojo`) or punctuation (`Fate/Zero` → `fate zero`). The
     * **query** is only lowercased, never folded. Built once at cache load.
     */
    searchNames?: string[]
    searchIndex?: LibrarySearchIndex | null
    /** Null until the watched overlay arrives. */
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
    /**
     * Every anime on the account's list, by annId, with its list status:
     * `options.LIST_TYPE_ID_MAP`. It ignores the Included Entries setting,
     * which only sets `watched`.
     */
    animeListMapCache: Record<string, number>
    [key: string]: any
  }

  /** `customList.js`. A list made in the Song Library. */
  interface CustomList {
    customListId: number
    name: string
    /** Only a list without songs can be the active anime list. */
    onlyAnime: boolean
    /** Keyed by annId. */
    animeMap: Map<number, unknown>
    /** Keyed by annSongId. */
    songMap: Map<number, unknown>
    /**
     * The list's row under Settings → Anime List. The `selected` class is the
     * only client-side record of which list is the active anime list.
     */
    $entryAnimeList: any
    [key: string]: any
  }

  const customListHandler: {
    customListMap: Map<number, CustomList>
    /** `customListAnimeList.js`. Set by `setup`, after `login complete`. */
    customListAnimeList: {
      currentMode: number
      CUSTOM_LIST_MODES: {
        DISABLE: 0
        LIST: 1
        INCLUDE: 2
        EXCLUDE: 3
      }
      [key: string]: any
    }
    [key: string]: any
  }

  /** AMQ's own creator. We replace its view but still call into it. */
  const customQuizCreator: {
    /** Call before `changeView('customQuizCreator')` to start a blank quiz. */
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

  /** AMQ's jQuery. The profile modal takes jQuery objects. */
  const $: any

  /** SweetAlert2, used for the private-room password prompt. */
  const Swal: {
    fire: (options: any) => Promise<{ isConfirmed: boolean; value?: string }>
  }
}

export {}
