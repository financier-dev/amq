/*
 * Enough of AMQ's client to boot our screens outside the game.
 *
 * Shapes are copied from the client source at
 * `~/amq-source/<latest>/animemusicquiz.com`. Do not invent shapes: a stub
 * that differs from the real payload still renders here and breaks in game.
 */

/*
 * Models Tampermonkey's sandbox for jQuery.
 *
 * A granted userscript gets its own `window`. Page globals resolve as bare
 * identifiers but are NOT properties of the script's `globalThis`. Everything
 * else here is read as a bare identifier, so it lives on `window`. Svelte
 * reserves the bare `$`, so jQuery is looked up by name. Defining it only on
 * `unsafeWindow` reproduces the game, where `globalThis.$` is `undefined`.
 */
const pageJQuery = (element) => ({
  hasClass: () => false,
  addClass: () => {},
  removeClass: () => {},
  offset: () => ({ top: 0, left: 0 }),
  innerWidth: () => 0,
  get 0() {
    return element
  },
})

window.unsafeWindow = {
  $: pageJQuery,
  get __amqUI() {
    return window.__amqUI
  },
  set __amqUI(value) {
    window.__amqUI = value
  },
}

// --- enums ----------------------------------------------------------------

window.quiz = {
  SCORE_TYPE_IDS: { COUNT: 1, HINT: 2, SPEED: 3, LIVES: 4, BOSS: 5 },
  SHOW_SELECTION_IDS: { AUTO: 1, LOOTING: 2 },
}
window.lobby = { ANSWERING_MODES: { TYPING: 1, MIXED: 2, MULTIPLE_CHOICE: 3 } }

// --- socket + listeners ---------------------------------------------------

window.__log = []

const listeners = {}
window.Listener = class Listener {
  constructor(command, callback) {
    this.command = command
    this.callback = callback
  }
  bindListener() {
    ;(listeners[this.command] ||= []).push(this.callback)
  }
  unbindListener() {
    const list = listeners[this.command] || []
    const index = list.indexOf(this.callback)
    if (index > -1) list.splice(index, 1)
  }
}
window.__fire = (command, data) =>
  (listeners[command] || []).slice().forEach((cb) => cb(data))

window.socket = {
  _disconnected: false,
  _socket: {},
  listners: listeners,
  sendCommand(content) {
    window.__log.push(['sendCommand', content])
    // The server answers `get rooms` with a `New Rooms` snapshot.
    if (content?.command === 'get rooms') {
      setTimeout(
        () => window.__fire('New Rooms', { standard: window.__rooms }),
        0
      )
    }
  },
}

// --- view system ----------------------------------------------------------

/*
 * AMQ's room browser, reduced to what a test can observe: `openView` shows
 * `#roomBrowserPage` and `closeView` hides it. `__amqUI.useLegacy()` must
 * bring this back.
 */
const legacyRoomBrowser = {
  openView(callback) {
    document.querySelector('#roomBrowserPage').classList.remove('hidden')
    window.__log.push(['legacy openView'])
    callback()
  },
  closeView() {
    document.querySelector('#roomBrowserPage').classList.add('hidden')
    window.__log.push(['legacy closeView'])
  },
}

/* AMQ's custom quiz creator, the screen the quiz builder replaces. */
const legacyQuizCreator = {
  openView(cb, arg) {
    window.__log.push(['legacy quiz openView', arg])
    document.querySelector('#customQuizCreatorPage')?.classList.remove('hidden')
    cb()
  },
  closeView() {
    document.querySelector('#customQuizCreatorPage')?.classList.add('hidden')
    window.__log.push(['legacy quiz closeView'])
  },
  setupNewQuiz: () => window.__log.push(['setupNewQuiz']),
  createAlgorithmBlock: (settings) =>
    window.__log.push(['createAlgorithmBlock', settings]),
  currentQuizId: null,
}

window.viewChanger = {
  currentView: 'main',
  __controllers: {
    main: { openView: (cb) => cb(), closeView: () => {} },
    roomBrowser: legacyRoomBrowser,
    customQuizCreator: legacyQuizCreator,
  },
  // Copied from viewChanger.js:44. Keep the early return.
  changeView(newView, arg = {}) {
    if (newView === this.currentView) return
    this.__controllers[this.currentView].closeView(arg)
    this.__controllers[newView].openView(() => {
      this.currentView = newView
    }, arg)
  },
  getCurrentView() {
    return this.currentView
  },
  hideLoadingScreen() {},
}

window.customQuizCreator = legacyQuizCreator

/* AMQ's message box. The builder uses it to refuse a save without a name. */
window.messageDisplayer = {
  displayMessage: (title, body) => window.__log.push(['message', title, body]),
}

/*
 * The library cache, in the shape `libraryCacheHandler.js` builds:
 * `animeCache` keyed by annId, each anime with `songs.{OP,ED,INS}` of annSong
 * entries, whose `songEntry` has the title and a resolved `artist`, `composer`
 * and `arranger`. The quiz builder reads and searches every name through it.
 */

/*
 * `replaceCharactersForSeachCharacters` (`shared/animeSearchRegex.js`),
 * reduced to the characters in the fixture names below. If a new fixture name
 * needs another character, add it here.
 */
const SEARCH_CHARACTER_REPLACEMENT_MAP = {
  ō: 'o',
  ū: 'u',
  é: 'e',
  '/': ' ',
  ':': ' ',
  '-': ' ',
  '.': ' ',
  '!': ' ',
  ',': ' ',
  '?': ' ',
}

const fold = (value) =>
  value
    .split('')
    .map((char) => SEARCH_CHARACTER_REPLACEMENT_MAP[char] ?? char)
    .join('')

/*
 * `searchNames` as every cache entry builds it: the lowercased name, and the
 * folded form when folding changes it. The folded form lets "re re" find
 * "Re:Re:".
 */
const searchNames = (...names) => {
  const out = []
  for (const name of names) {
    if (!name) continue
    const lower = name.toLowerCase()
    out.push(lower)
    const folded = fold(lower)
    if (folded !== lower) out.push(folded)
  }
  return out
}

/*
 * `LibraryCacheArtistEntry` (`libraryCacheHandler.js:558`): one person.
 * `addAltName` adds the alt names to `searchNames`, and
 * `getFullMemberEntryList` lists them again for a non-strict search.
 */
const artist = (name, altNames = []) => ({
  name,
  searchNames: searchNames(name, ...altNames),
  altNames: altNames.map((alt) => artist(alt)),
  getFullMemberEntryList() {
    return [this, ...this.altNames]
  },
})

/*
 * `LibraryCacheGroupEntry` (`libraryCacheHandler.js:597`). Its `searchNames`
 * do **not** include its members' names. Only `getFullMemberEntryList()`
 * reaches them, so a member's name finds the group's songs only when Strict
 * is off, the default.
 */
const group = (name, members) => ({
  name,
  searchNames: searchNames(name),
  artistMembers: members,
  groupMembers: [],
  altNames: [],
  IS_GROUP: true,
  getFullMemberEntryList() {
    return [this, ...this.artistMembers, ...this.altNames]
  },
})

const marina = artist('Marina')
const lisa = artist('LiSA')
const girlsDeadMonster = group('Girls Dead Monster', [marina, lisa])
const yokoKanno = artist('Yoko Kanno', ['Gabriela Robin'])
const seatbelts = group('Seatbelts', [yokoKanno])

const LIBRARY_FIXTURE = [
  {
    annId: 3312,
    category: { name: 'TV', number: null },
    year: 2010,
    seasonId: 1,
    mainNames: { EN: 'Angel Beats!', JA: 'Angel Beats!' },
    songs: [
      {
        title: 'My Soul, Your Beats!',
        artist: artist('Lia'),
        type: 1,
        number: 1,
      },
      { title: 'Brave Song', artist: artist('Aoi Tada'), type: 2, number: 1 },
      { title: 'Crow Song', artist: girlsDeadMonster, type: 3, number: 1 },
      { title: 'Alchemy', artist: girlsDeadMonster, type: 3, number: 2 },
      {
        title: 'Thousand Enemies',
        artist: girlsDeadMonster,
        type: 3,
        number: 3,
      },
      {
        title: 'Ichiban no Takaramono',
        artist: girlsDeadMonster,
        type: 3,
        number: 4,
      },
    ],
  },
  {
    annId: 4521,
    category: { name: 'TV', number: 2 },
    year: 2016,
    seasonId: 0,
    mainNames: { EN: 'Erased', JA: 'Boku dake ga Inai Machi' },
    songs: [
      {
        title: 'Re:Re:',
        artist: artist('Asian Kung-Fu Generation'),
        type: 1,
        number: 1,
      },
      {
        title: 'Sore wa Chiisana Hikari no You na',
        artist: artist('Sayuri'),
        type: 2,
        number: 1,
      },
    ],
  },
  {
    annId: 7781,
    category: { name: 'Movie', number: null },
    year: 2016,
    seasonId: 2,
    mainNames: { EN: 'Your Name.', JA: 'Kimi no Na wa.' },
    songs: [
      { title: 'Yume Tourou', artist: artist('RADWIMPS'), type: 1, number: 1 },
      { title: 'Nandemonaiya', artist: artist('RADWIMPS'), type: 2, number: 1 },
      { title: 'Zenzenzense', artist: artist('RADWIMPS'), type: 3, number: 1 },
    ],
  },
  {
    annId: 9101,
    category: { name: 'ONA', number: null },
    year: 2021,
    seasonId: 1,
    watched: false,
    mainNames: { EN: 'Unwatched Show', JA: 'Unwatched Show' },
    songs: [
      { title: 'Never Seen', artist: artist('Nobody'), type: 1, number: 1 },
    ],
  },
  {
    annId: 9001,
    category: { name: 'TV Special', number: null },
    year: 1998,
    seasonId: 3,
    mainNames: { EN: 'Cowboy Bebop', JA: 'Cowboy Bebop' },
    songs: [
      {
        title: 'Tank!',
        artist: seatbelts,
        composer: yokoKanno,
        arranger: yokoKanno,
        type: 1,
        number: 1,
      },
      {
        title: 'The Real Folk Blues',
        artist: seatbelts,
        composer: yokoKanno,
        type: 2,
        number: 1,
      },
    ],
  },
]

const animeCache = {}
const annSongIdToAnnId = {}
let nextAnnSongId = 9000

for (const fixture of LIBRARY_FIXTURE) {
  const songs = { OP: [], ED: [], INS: [] }
  for (const song of fixture.songs) {
    nextAnnSongId += 1
    const entry = {
      annSongId: nextAnnSongId,
      annId: fixture.annId,
      type: song.type,
      number: song.number,
      playerLikeStatus: 0,
      wrongIndex: null,
      uploaded: true,
      rebroadcast: false,
      dub: false,
      songEntry: {
        songId: nextAnnSongId,
        name: song.title,
        category: 4,
        searchNames: searchNames(song.title),
        artist: song.artist,
        composer: song.composer,
        arranger: song.arranger,
      },
    }
    annSongIdToAnnId[entry.annSongId] = fixture.annId
    songs[song.type === 1 ? 'OP' : song.type === 2 ? 'ED' : 'INS'].push(entry)
  }
  animeCache[fixture.annId] = {
    annId: fixture.annId,
    category: fixture.category,
    year: fixture.year,
    seasonId: fixture.seasonId,
    mainNames: fixture.mainNames,
    names: [{ name: fixture.mainNames.EN }, { name: fixture.mainNames.JA }],
    // Every name, as in the cache. Searching "Boku dake" then finds the anime
    // shown as "Erased".
    searchNames: searchNames(fixture.mainNames.EN, fixture.mainNames.JA),
    watched: fixture.watched !== false,
    songs,
    get mainName() {
      return this.mainNames.EN || this.mainNames.JA
    },
  }
}

/*
 * The cache starts **empty**, as in game. `animeCache` is `{}` until
 * `getCache` fetches the master list and its overlays. A pre-filled stub
 * would hide a builder that never requests the cache.
 */
window.__libraryLoadCalls = 0

window.libraryCacheHandler = {
  animeCache: {},
  getCache(callback) {
    window.__libraryLoadCalls += 1
    window.__log.push(['getCache'])
    // Asynchronous, as in the real client, which waits for the socket.
    setTimeout(() => {
      window.libraryCacheHandler.animeCache = animeCache
      callback(animeCache)
    }, 10)
  },
  getCachedAnime: (annId) =>
    window.libraryCacheHandler.animeCache === animeCache
      ? animeCache[annId]
      : undefined,
  getAnnIdFromAnnSongId: (annSongId) =>
    window.libraryCacheHandler.animeCache === animeCache
      ? annSongIdToAnnId[annSongId]
      : undefined,
  getCachedAnnSongEntry(annSongId) {
    if (window.libraryCacheHandler.animeCache !== animeCache) return undefined
    const annId = annSongIdToAnnId[annSongId]
    if (!annId) return undefined
    const anime = animeCache[annId]
    return [...anime.songs.OP, ...anime.songs.ED, ...anime.songs.INS].find(
      (song) => song.annSongId === annSongId
    )
  },
}

/** The ids the fixture generated, for assertions. */
window.__libraryIds = {
  annIds: LIBRARY_FIXTURE.map((entry) => entry.annId),
  annSongIds: Object.keys(annSongIdToAnnId).map(Number),
}

window.roomBrowser = {
  activeRooms: {},
  openView: (cb) => cb(),
  closeView: () => {},
  fireJoinLobby: (id, password) => window.__log.push(['join', id, password]),
  fireSpectateGame: (id) => window.__log.push(['spectate', id]),
  spectateGameWithPassword: (id) => window.__log.push(['spectatePrivate', id]),
  openHostModal: () => window.__log.push(['hostRoom']),
}

/*
 * AMQ's global Backspace guard, ported from setup.js:54-100.
 *
 * It blocks Backspace unless `event.target` is a text input. An event that
 * crosses a shadow boundary is retargeted to the host element, so the guard
 * sees our wrapper `<div>` and blocks the key unless we stop the event.
 */
const TEXT_INPUT_TYPES = [
  'text',
  'password',
  'file',
  'search',
  'email',
  'number',
  'date',
  'color',
  'datetime',
  'datetime-local',
  'month',
  'range',
  'tel',
  'time',
  'url',
  'week',
]
document.addEventListener('keydown', (event) => {
  if (event.keyCode !== 8) return
  let doPrevent = true
  const target = event.srcElement || event.target
  const disabled = target.readOnly || target.disabled
  if (!disabled) {
    if (target.isContentEditable) doPrevent = false
    else if (target.tagName === 'INPUT') {
      const type = (target.getAttribute('type') || '').toLowerCase()
      if (TEXT_INPUT_TYPES.indexOf(type) > -1) doPrevent = false
    } else if (target.tagName === 'TEXTAREA') doPrevent = false
  }
  if (doPrevent) {
    window.__log.push(['backspace blocked', target.tagName])
    event.preventDefault()
  }
})

// --- lookups --------------------------------------------------------------

window.localizationHandler = {
  // Real strings from the client's en.json (tests/locale.js). An unknown key
  // returns the key itself, which `derive.t()` treats as a miss.
  translate: (key, data) => {
    let value = window.__locale?.[key]
    if (value === undefined) return key
    // The real handler fills `_UPPERCASE_` placeholders from lowercase keys
    // of the data object. A placeholder with no value stays as it is.
    for (const [name, replacement] of Object.entries(data ?? {})) {
      value = value.split(`_${name.toUpperCase()}_`).join(String(replacement))
    }
    // A `_NUMBER_` placeholder with no value is removed, so "OVA _NUMBER_"
    // renders as "OVA".
    return value
      .replace(/_NUMBER_/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  },
  convertAnimeGenreToKey: (name) => name,
  convertAnimeTagToKey: (name) => name,
  // Copied from `localizationHandler.js:423`.
  convertCategoryToKey: ({ name, number }) => ({
    key: `anime_types.${name.toLowerCase().replace(/ /g, '_')}`,
    parameters: { number: number != null ? number : '' },
  }),
}

window.idTranslator = {
  genreNames: {
    1: 'Action',
    2: 'Music',
    3: 'Shounen',
    4: 'Ecchi',
    5: 'Isekai',
    6: 'Comedy',
    7: 'Sports',
    8: 'Fantasy',
    9: 'Drama',
    10: 'Mecha',
    11: 'Adventure',
    12: 'Kids',
    13: 'Idol',
  },
  tagNames: { 100: 'Historical', 101: 'Iyashikei', 102: 'Slice of Life' },
}

window.socialTab = {
  onlineFriends: {},
  isFriend: (name) => window.__friends.includes(name),
  isBlocked: () => false,
}
window.__friends = []

window.playerProfileController = {
  loadProfile: () => {},
  // The real implementation calls `closeHandler()` unconditionally when the
  // profile closes (playerProfileController.js:28), so a missing handler
  // throws. Record its type for the test to assert on.
  loadProfileIfClosed: (name, $requestObject, offsets, closeHandler) =>
    window.__log.push(['profile', name, typeof closeHandler]),
}

window.Swal = {
  fire: () => Promise.resolve({ isConfirmed: true, value: 'hunter2' }),
}

// jQuery is NOT on `window`. See the sandbox comment at the top.

window.cdnFormater = {
  AVATAR_SIZES: [100, 150, 250, 350, 500, 600, 900],
  AVATAR_HEAD_SIZES: [100, 150, 250],
  AVATAR_HEAD_FILENAME: 'Head.webp',
  AVATAR_POSE_IDS: { BASE: 1 },
  newAvatarHeadSrc: (a, o, opt, on, c) =>
    `https://animemusicquiz.com/cdn/v1/avatars/${a}/${o}/${on ? opt : 'No ' + opt}/${c}/250px/Head.webp`,
  newAvatarHeadSrcSet: () => '',
  newSizedAvatarSrc: (a, o, opt, on, c) =>
    `https://animemusicquiz.com/cdn/v1/avatars/${a}/${o}/${on ? opt : 'No ' + opt}/${c}/250px/Basic.webp`,
}

// --- default settings (copied from hostModal.DEFUALT_SETTINGS) --------------

window.hostModal = {
  openHostModal: () => window.__log.push(['host']),
  changeSettings: (changes) =>
    window.__log.push(['changeSettings', Object.keys(changes).length]),
  setModePreviewGame: (tile) => {
    window.__previewTile = tile
    window.__log.push(['setModePreviewGame'])
  },
  showSettings: () => window.__log.push(['showSettings']),
  /*
   * `hostModal.js:2399`. AMQ calls `updateSettings` on the second argument
   * when the player confirms. The quiz builder passes a shim that writes to
   * its model, and the test calls it as the real modal does.
   */
  setModeQuizBuilder(existingSettings, targetBlock) {
    window.__quizBuilderTarget = targetBlock ?? null
    window.__log.push(['setModeQuizBuilder', Boolean(existingSettings)])
  },
  getQuizBuilderSettings: () => ({ numberOfSongs: 7 }),
  show: () => window.__log.push(['showModal']),
  hide: () => window.__log.push(['hideModal']),
  DEFUALT_SETTINGS: {
    roomName: '',
    privateRoom: false,
    roomSize: 8,
    teamSize: 1,
    numberOfSongs: 20,
    modifiers: {
      skipGuessing: true,
      skipReplay: true,
      queueing: true,
      duplicates: true,
      lootDropping: true,
      rebroadcastSongs: true,
      dubSongs: false,
      fullSongRange: false,
      quizJoin: true,
    },
    songPool: 1,
    songSelection: {
      standardValue: 3,
      advancedValue: { watched: 20, unwatched: 0, random: 0 },
    },
    watchedDistribution: 1,
    songType: {
      standardValue: { openings: true, endings: true, inserts: false },
      advancedValue: { openings: 0, endings: 0, inserts: 0, random: 20 },
    },
    openingCategories: {
      instrumental: true,
      chanting: true,
      character: true,
      standard: true,
    },
    endingCategories: {
      instrumental: true,
      chanting: true,
      character: true,
      standard: true,
    },
    insertCategories: {
      instrumental: true,
      chanting: true,
      character: true,
      standard: true,
    },
    guessTime: { randomOn: false, standardValue: 20, randomValue: [1, 60] },
    extraGuessTime: { randomOn: false, standardValue: 0, randomValue: [0, 15] },
    scoreType: 1,
    hintSetup: {
      songPoints: 5,
      nameCost: 2,
      infoCost: 1,
      multipleChoiceCost: 4,
      audioCost: 3,
      tinyVideoCost: 3,
      blurVideoCost: 3,
    },
    showSelection: 1,
    answeringMode: 1,
    guessMode: { song: true, tinyVideo: false, blurVideo: false },
    inventorySize: { randomOn: false, standardValue: 20, randomValue: [1, 99] },
    lootingTime: { randomOn: false, standardValue: 90, randomValue: [10, 300] },
    lives: 5,
    bossLives: 3,
    bossPowerUps: 3,
    bossMaxSongs: 10,
    samplePoint: { randomOn: true, standardValue: 1, randomValue: [0, 100] },
    playbackSpeed: {
      randomOn: false,
      standardValue: 1,
      randomValue: [true, true, true, true],
    },
    songDifficulity: {
      advancedOn: false,
      standardValue: {
        beginner: true,
        easy: true,
        medium: true,
        hard: true,
        expert: true,
      },
      advancedValue: [0, 100],
    },
    songPopularity: {
      advancedOn: false,
      standardValue: { disliked: true, mixed: true, liked: true },
      advancedValue: [0, 100],
    },
    playerScore: {
      advancedOn: false,
      standardValue: [1, 10],
      advancedValue: Array(10).fill(true),
    },
    animeScore: {
      advancedOn: false,
      standardValue: [2, 10],
      advancedValue: Array(9).fill(true),
    },
    animePopularity: {
      advancedOn: false,
      standardValue: 5,
      advancedValue: [1, 9999],
    },
    vintage: {
      standardValue: { years: [1924, 2026], seasons: [0, 3] },
      advancedValueList: [],
    },
    type: { tv: true, movie: true, ova: true, ona: true, special: true },
    genre: [],
    tags: [],
  },
}
