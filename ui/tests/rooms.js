/*
 * Fixture rooms in the shape of `New Rooms` entries from the 2026-09-19
 * client: `friendNames` and `allPlayers.{players,spectators}` of
 * `{name, level}`.
 *
 * The set follows the design mock's sample data, so a render can be compared
 * with the mock. The settings were derived from the chips the mock shows.
 */

const DEF = window.hostModal.DEFUALT_SETTINGS
const clone = (value) => JSON.parse(JSON.stringify(value))

function settings(over = {}) {
  return Object.assign(clone(DEF), over)
}

function types(openings, endings, inserts) {
  return {
    standardValue: { openings, endings, inserts },
    advancedValue: { openings: 0, endings: 0, inserts: 0, random: 20 },
  }
}

function guess(seconds, extra = 0) {
  const base = Array.isArray(seconds)
    ? { randomOn: true, standardValue: 20, randomValue: seconds }
    : { randomOn: false, standardValue: seconds, randomValue: [1, 60] }
  return {
    guessTime: base,
    extraGuessTime: {
      randomOn: false,
      standardValue: extra,
      randomValue: [0, 15],
    },
  }
}

/** selection: 1 random, 2 mix, 3 watched */
function selection(standardValue) {
  const advanced = { watched: 0, unwatched: 0, random: 0 }
  if (standardValue === 3) advanced.watched = 20
  else if (standardValue === 1) advanced.random = 20
  else {
    advanced.watched = 10
    advanced.random = 10
  }
  return { songSelection: { standardValue, advancedValue: advanced } }
}

function difficulty(tiers) {
  return {
    songDifficulity: {
      advancedOn: false,
      standardValue: {
        beginner: tiers.includes('beginner'),
        easy: tiers.includes('easy'),
        medium: tiers.includes('medium'),
        hard: tiers.includes('hard'),
        expert: tiers.includes('expert'),
      },
      advancedValue: [0, 100],
    },
  }
}

function mods(over) {
  return { modifiers: Object.assign(clone(DEF.modifiers), over) }
}

const ALL = ['beginner', 'easy', 'medium', 'hard', 'expert']

function roster(names, levels) {
  return names.map((name, index) => ({
    name,
    level: levels[index % levels.length],
  }))
}

const LEVELS = [112, 47, 8, 91, 23, 140, 66, 5, 78, 33, 159, 12]

function room(id, name, host, over, extra = {}) {
  const players = roster(over.playerNames || [], LEVELS)
  const spectators = roster(over.spectatorNames || [], LEVELS)
  return {
    id,
    host,
    hostAvatar: {
      avatar: {
        avatarName: 'Kanade',
        outfitName: 'Default',
        optionName: 'Hat',
        optionActive: false,
        colorName: 'Default',
        sizeModifier: '0',
        animated: false,
      },
      background: { backgroundHori: 'Sky' },
    },
    settings: settings(
      Object.assign({ roomName: name, roomSize: over.cap }, extra)
    ),
    numberOfPlayers: players.length,
    numberOfSpectators: spectators.length,
    friendNames: over.friends || [],
    allPlayers: { players, spectators },
    inLobby: !over.playing,
    songLeft: over.playing ? over.songs - over.played : over.songs,
  }
}

// Names are distinct. Spectators use a separate pool, so nobody is both a
// player and a spectator of one room.
const names = (count, seed) =>
  Array.from({ length: count }, (_, i) => SAMPLE[(seed + i) % SAMPLE.length])

const watchers = (count, seed) =>
  Array.from(
    { length: count },
    (_, i) => WATCHERS[(seed + i) % WATCHERS.length]
  )

const SAMPLE = [
  'Solarzz',
  'xDubzz',
  'nanase_vt',
  'kuro_ayame',
  'Tsubaki88',
  'rin_no_uta',
  'hexadecimal',
  'opED_enjoyer',
  'sanderz',
  'mochi_desu',
  'Zrackz',
  'TikiFreeky',
  'AurumKitsune',
  'WEEBfreeza',
  'MimikApe',
  'dweebb',
  'monomiki',
  'Carlitos113',
  'shiro_neko',
  'bakaAF',
  'not_a_bot',
  'yuzu_chan',
  'kirakira',
  'ponkotsu',
]

const WATCHERS = [
  'lurker_01',
  'just_watching',
  'popcorn_kun',
  'afk_sorry',
  'nekomata',
  'silent_bob',
  'tourist',
  'oboro',
]

window.__rooms = [
  room(
    1,
    'Song/Artist only',
    'kurenai_op',
    {
      cap: 40,
      songs: 20,
      playerNames: names(12, 0),
      spectatorNames: watchers(2, 5),
      friends: ['Solarzz', 'kuro_ayame'],
    },
    Object.assign(
      { numberOfSongs: 20, songType: types(true, true, false) },
      guess(30),
      selection(1),
      difficulty(ALL),
      mods({ duplicates: true, rebroadcastSongs: false }),
      { genre: [{ id: 2, state: 1 }] }
    )
  ),

  room(
    2,
    '1v1 learn session',
    'anticoool',
    {
      cap: 8,
      songs: 100,
      playerNames: names(2, 3),
      spectatorNames: watchers(1, 9),
    },
    Object.assign(
      { numberOfSongs: 100, songType: types(true, true, true) },
      guess(20),
      selection(3),
      difficulty(['expert', 'hard']),
      mods({ dubSongs: true, fullSongRange: true }),
      {
        genre: [
          { id: 3, state: 1 },
          { id: 4, state: 2 },
        ],
      }
    )
  ),

  room(
    3,
    'Hop Skip Jump!',
    'Druid_Unlucky',
    {
      cap: 6,
      songs: 30,
      playerNames: names(3, 7),
      spectatorNames: watchers(2, 2),
      friends: ['sanderz'],
    },
    Object.assign(
      { numberOfSongs: 30, songType: types(true, false, false) },
      guess(20),
      selection(2),
      difficulty(ALL),
      {
        genre: [
          { id: 1, state: 1 },
          { id: 5, state: 1 },
          { id: 6, state: 3 },
          { id: 7, state: 2 },
        ],
      }
    )
  ),

  room(
    4,
    'chill vibes only',
    'mochi_desu',
    { cap: 9, songs: 30, playerNames: names(4, 11) },
    Object.assign(
      { numberOfSongs: 30, songType: types(true, true, true) },
      guess(25, 5),
      selection(1),
      difficulty(['medium', 'easy', 'beginner']),
      mods({ quizJoin: false }),
      {
        playbackSpeed: {
          randomOn: false,
          standardValue: 3,
          randomValue: [true, true, true, true],
        },
        tags: [
          { id: 102, state: 1 },
          { id: 101, state: 3 },
        ],
      }
    )
  ),

  room(
    5,
    'Mostazabra Kadabra',
    'monomiki',
    { cap: 8, songs: 40, playerNames: names(2, 1), playing: true, played: 12 },
    Object.assign(
      { numberOfSongs: 40, songType: types(true, true, false) },
      guess(20),
      selection(3),
      difficulty(ALL)
    )
  ),

  room(
    6,
    'guess the artist',
    'dweebb',
    {
      cap: 9,
      songs: 30,
      playerNames: names(4, 6),
      spectatorNames: watchers(1, 4),
    },
    Object.assign(
      { numberOfSongs: 30, songType: types(true, true, false) },
      guess(20),
      selection(1),
      difficulty(['expert', 'hard', 'medium']),
      mods({ rebroadcastSongs: false }),
      {
        genre: [
          { id: 2, state: 1 },
          { id: 12, state: 2 },
        ],
      }
    )
  ),

  room(
    7,
    'apple picking',
    'MonkeySkull',
    { cap: 2, songs: 40, playerNames: names(2, 8) },
    Object.assign(
      {
        numberOfSongs: 40,
        showSelection: 2,
        songType: types(true, true, true),
      },
      guess(40, 5),
      selection(1),
      difficulty(ALL),
      mods({ lootDropping: false }),
      {
        inventorySize: {
          randomOn: false,
          standardValue: 5,
          randomValue: [1, 99],
        },
      }
    )
  ),

  room(
    8,
    'Aurum',
    'AurumKitsune',
    { cap: 2, songs: 36, playerNames: names(2, 12), playing: true, played: 31 },
    Object.assign(
      { numberOfSongs: 36, songType: types(true, true, false) },
      guess(20),
      selection(3),
      difficulty(ALL),
      { genre: [{ id: 8, state: 1 }] }
    )
  ),

  room(
    9,
    'expert only no mercy',
    'nanase_vt',
    {
      cap: 8,
      songs: 60,
      playerNames: names(6, 2),
      spectatorNames: watchers(3, 7),
    },
    Object.assign(
      { numberOfSongs: 60, scoreType: 4, songType: types(true, true, true) },
      guess(15, 3),
      selection(3),
      difficulty(['expert']),
      mods({ dubSongs: true, fullSongRange: true, rebroadcastSongs: false }),
      {
        genre: [
          { id: 13, state: 2 },
          { id: 12, state: 2 },
        ],
      }
    )
  ),

  room(
    10,
    'AAAAAAAA',
    'Zrackz',
    { cap: 3, songs: 100, playerNames: names(3, 4) },
    Object.assign(
      { numberOfSongs: 100, songType: types(false, false, true) },
      guess([25, 30]),
      selection(1),
      difficulty(ALL),
      {
        genre: [
          { id: 9, state: 1 },
          { id: 10, state: 3 },
        ],
      }
    )
  ),

  room(
    11,
    'weekly tourney rd2',
    'TikiFreeky',
    {
      cap: 8,
      songs: 45,
      playerNames: names(8, 10),
      spectatorNames: watchers(4, 1),
      friends: ['Tsubaki88', 'rin_no_uta', 'hexadecimal'],
      playing: true,
      played: 27,
    },
    Object.assign(
      {
        numberOfSongs: 45,
        scoreType: 5,
        privateRoom: true,
        songType: types(true, true, true),
      },
      guess(20, 5),
      selection(1),
      difficulty(['expert', 'hard']),
      { bossLives: 5, bossPowerUps: 3, genre: [{ id: 4, state: 2 }] }
    )
  ),

  room(
    12,
    'ova + specials grind',
    'Carlitos113',
    { cap: 8, songs: 30, playerNames: names(2, 9) },
    Object.assign(
      { numberOfSongs: 30, scoreType: 3, songType: types(true, true, false) },
      guess(15),
      selection(2),
      difficulty(ALL),
      mods({ dubSongs: true, rebroadcastSongs: false }),
      {
        type: { tv: false, movie: false, ova: true, ona: true, special: true },
        genre: [{ id: 11, state: 1 }],
        tags: [{ id: 100, state: 3 }],
      }
    )
  ),

  room(
    13,
    'GENSHIN!!!',
    'WEEBfreeza',
    { cap: 3, songs: 50, playerNames: names(1, 13) },
    Object.assign(
      { numberOfSongs: 50, songType: types(true, true, false) },
      guess(60, 10),
      selection(3),
      difficulty(ALL),
      {
        genre: [
          { id: 8, state: 1 },
          { id: 5, state: 1 },
        ],
        vintage: {
          standardValue: { years: [2011, 2022], seasons: [1, 2] },
          advancedValueList: [],
        },
      }
    )
  ),

  room(
    14,
    'insert songs only',
    'MimikApe',
    { cap: 2, songs: 20, playerNames: names(2, 0), playing: true, played: 4 },
    Object.assign(
      { numberOfSongs: 20, songType: types(false, false, true) },
      guess(20),
      selection(1),
      difficulty(ALL),
      { genre: [{ id: 4, state: 2 }] }
    )
  ),
]

/*
 * Two rooms that test chip behaviour.
 *
 * `samplePoint` in the first is default in effect: with `randomOn` set, only
 * `randomValue` is used, so a different `standardValue` must not produce a
 * chip (roomFilter.js `compareSettings`).
 */
window.__rooms.push(
  room(
    15,
    'inert sample point',
    'edgecase',
    { cap: 8, songs: 20, playerNames: names(2, 15) },
    Object.assign(
      { numberOfSongs: 20, songType: types(true, true, false) },
      guess(20),
      selection(1),
      difficulty(ALL),
      {
        samplePoint: {
          randomOn: true,
          standardValue: 5,
          randomValue: [0, 100],
        },
      }
    )
  ),
  room(
    16,
    'category limits',
    'edgecase2',
    { cap: 8, songs: 20, playerNames: names(2, 18) },
    Object.assign(
      { numberOfSongs: 20, songType: types(true, true, true) },
      guess(20),
      selection(1),
      difficulty(ALL),
      {
        insertCategories: {
          instrumental: true,
          chanting: false,
          character: true,
          standard: true,
        },
        // Not default: `randomOn` is off, so `standardValue` is used.
        samplePoint: {
          randomOn: false,
          standardValue: 50,
          randomValue: [0, 100],
        },
      }
    )
  )
)

window.__rooms.push(
  room(
    17,
    'teams of two',
    'teamhost',
    { cap: 8, songs: 20, playerNames: names(4, 6) },
    Object.assign(
      { numberOfSongs: 20, teamSize: 2, songType: types(true, true, false) },
      guess(20),
      selection(3),
      difficulty(ALL)
    )
  )
)

// More chips than two lines hold, to test wrapping and the `+N` chip.
window.__rooms.push(
  room(
    18,
    'everything room',
    'kitchensink',
    { cap: 8, songs: 20, playerNames: names(3, 2) },
    Object.assign(
      { numberOfSongs: 20, songType: types(true, true, true) },
      guess(20),
      selection(1),
      difficulty(ALL),
      mods({
        dubSongs: true,
        fullSongRange: true,
        rebroadcastSongs: false,
        quizJoin: false,
      }),
      {
        genre: [
          { id: 1, state: 1 },
          { id: 2, state: 1 },
          { id: 3, state: 1 },
          { id: 5, state: 1 },
          { id: 8, state: 1 },
          { id: 9, state: 3 },
          { id: 4, state: 2 },
          { id: 7, state: 2 },
          { id: 12, state: 2 },
        ],
        tags: [
          { id: 100, state: 1 },
          { id: 101, state: 3 },
          { id: 102, state: 1 },
        ],
      }
    )
  )
)

window.__friends = window.__rooms.flatMap((entry) => entry.friendNames)
