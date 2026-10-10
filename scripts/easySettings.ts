import merge from 'deepmerge'
import { registerCommand } from './commands'

let batchedChanges = {}
function changeSettings(settingChanges: object) {
  batchedChanges = merge(batchedChanges, settingChanges)

  if (!lobby.inLobby) {
    gameChat.systemMessage('Settings changes will be applied when in lobby')
  }

  const doit = () => {
    if (!lobby.inLobby) {
      setTimeout(doit, 100)
      return
    }
    socket.sendCommand({
      type: 'lobby',
      command: 'change game settings',
      data: {
        settingChanges: batchedChanges,
        communityMode: false,
      },
    })
    batchedChanges = {}
  }

  doit()
}

function changeDiff(min: number, max: number) {
  changeSettings({
    songDifficulity: {
      ...lobby.settings.songDifficulity,
      advancedOn: true,
      advancedValue: [min, max],
    },
  })
}

function changeType(types: string[]) {
  const openings = types.includes('op')
  const endings = types.includes('ed')
  const inserts = types.includes('in')

  if (!openings && !endings && !inserts) {
    return
  }

  changeSettings({
    songType: {
      ...lobby.settings.songType,
      standardValue: { openings, endings, inserts },
    },
  })
}

function changeSongs(numSongs: number) {
  changeSettings({
    numberOfSongs: numSongs,
    songSelection: {
      ...lobby.settings.songSelection,
      advancedValue: { watched: numSongs, unwatched: 0, random: 0 },
    },
    songType: {
      ...lobby.settings.songType,
      advancedValue: { openings: 0, endings: 0, inserts: 0, random: numSongs },
    },
  })
}

function getGenreObj(genre: string) {
  return hostModal.genreFilter.awesomepleteInstance._list.find(
    (g) => g.name.toLocaleLowerCase() === genre.toLocaleLowerCase()
  )
}

function addGenre(genre: { id: number; name: string }) {
  changeSettings({
    genre: [...lobby.settings.genre, { id: genre.id.toString(), state: 1 }],
  })
}

function removeGenre(genre: { id: number; name: string }) {
  changeSettings({
    genre: [
      ...lobby.settings.genre.filter((g) => String(g.id) !== String(genre.id)),
    ],
  })
}

function removeAllGenres() {
  changeSettings({ genre: [] })
}

function changeTeamSize(size: number) {
  changeSettings({ teamSize: size })
}

function changeRoomSize(size: number) {
  changeSettings({ roomSize: size })
}

function changeGuessTime(time: number, extraTime: number = 0) {
  changeSettings({
    guessTime: {
      randomOn: false,
      randomValue: [1, 60],
      standardValue: time,
    },
    extraGuessTime: {
      randomOn: false,
      randomValue: [0, 15],
      standardValue: extraTime,
    },
  })
}

function changeWatchedDistribution(dist: 1 | 2 | 3) {
  changeSettings({ watchedDistribution: dist })
}

function changeRoomTitle(title: string) {
  changeSettings({ roomName: title })
}

function toggleChantings(enable: boolean) {
  changeSettings({
    openingCategories: {
      ...lobby.settings.openingCategories,
      chanting: enable,
    },
    endingCategories: {
      ...lobby.settings.endingCategories,
      chanting: enable,
    },
    insertCategories: {
      ...lobby.settings.insertCategories,
      chanting: enable,
    },
  })
}

function setFullSongRange(enable: boolean) {
  changeSettings({
    modifiers: {
      ...lobby.settings.modifiers,
      fullSongRange: enable,
    },
  })
}

/** Registers chat commands that change the game settings. */
export default async function setup() {
  registerCommand(
    'diff',
    () => ({
      shortHelp: 'Change song difficulty range',
      longHelp:
        'Usage: /diff [min] [max]</br>Changes the song difficulty range to [min, max].',
    }),
    (args) => {
      const [min, max] = args.split(' ').map((x) => parseInt(x))
      if (min < max) changeDiff(min, max)
    }
  )

  registerCommand(
    'type',
    () => ({
      shortHelp: 'Change song types',
      longHelp:
        'Usage: /type [op|ed|in] ...</br>Changes the song types to the specified types. Use "op" for openings, "ed" for endings, and "in" for inserts.',
    }),
    (args) => {
      const types = args.split(' ').map((x) => x.toLowerCase())
      changeType(types)
    }
  )

  registerCommand(
    'songs',
    () => ({
      shortHelp: 'Change number of songs',
      longHelp:
        'Usage: /songs [number]</br>Changes the number of songs in the game to [number].',
    }),
    (args) => {
      const songs = parseInt(args)
      if (!isNaN(songs)) changeSongs(songs)
    }
  )

  registerCommand(
    'teams',
    () => ({
      shortHelp: 'Change team size',
      longHelp: 'Usage: /teams [size]</br>Changes the team size to [size].',
    }),
    (args) => {
      const size = parseInt(args)
      if (!isNaN(size)) changeTeamSize(size)
    }
  )

  registerCommand(
    'genre',
    () => ({
      shortHelp: 'Add or remove genre filter',
      longHelp:
        'Usage: /genre [genre]|rem [genre]|none</br>Adds or removes the specified genre from the genre filter. Use "rem" to remove a genre, or "none" to clear all genres.',
    }),
    (args) => {
      const argsArr = args.split(' ')
      if (argsArr[0].toLocaleLowerCase() === 'none') {
        removeAllGenres()
        return
      }
      const isRemove = argsArr[0].toLocaleLowerCase() === 'rem'
      const genre = argsArr.slice(isRemove ? 1 : 0).join(' ')
      const genreObj = getGenreObj(genre)
      const hasGenre = lobby.settings.genre.some(
        (g) => g.id.toString() === genreObj?.id.toString()
      )

      if (!genreObj) return
      if (isRemove) {
        if (!hasGenre) return
        removeGenre(genreObj)
      } else {
        if (hasGenre) return
        addGenre(genreObj)
      }
    }
  )

  registerCommand(
    'roomsize',
    () => ({
      shortHelp: 'Change room size',
      longHelp: 'Usage: /roomsize [size]</br>Changes the room size to [size].',
    }),
    (args) => {
      const size = parseInt(args)
      if (isNaN(size)) {
        gameChat.systemMessage('Error: Invalid room size')
        return
      }
      changeRoomSize(size)
    }
  )

  registerCommand(
    'gtime',
    () => ({
      shortHelp: 'Change guess time',
      longHelp:
        'Usage: /gtime [seconds] [extra]</br>Changes the guess time to [seconds] with an optional extra time of [extra].',
    }),
    (args) => {
      const [timeStr, extraStr] = args.split(' ')
      const time = parseInt(timeStr)
      const extraTime = extraStr ? parseInt(extraStr) : 0
      if (isNaN(time) || isNaN(extraTime)) {
        gameChat.systemMessage('Error: Invalid guess time or extra time')
        return
      }
      changeGuessTime(time, extraTime)
    }
  )

  registerCommand(
    'dist',
    () => ({
      shortHelp: 'Change watched distribution',
      longHelp:
        'Usage: /dist [random|weighted|equal]</br>Changes the watched distribution to "random", "weighted", or "equal".',
    }),
    (args) => {
      switch (args) {
        case 'random':
        case 'r':
          changeWatchedDistribution(1)
          break
        case 'weighted':
        case 'w':
          changeWatchedDistribution(2)
          break
        case 'equal':
        case 'eq':
          changeWatchedDistribution(3)
          break
        default:
          gameChat.systemMessage(
            'Error: Invalid distribution. Use "random", "weighted", or "equal".'
          )
      }
    }
  )

  registerCommand(
    'title',
    () => ({
      shortHelp: 'Change room title',
      longHelp:
        'Usage: /title [new title]</br>Changes the room title to [new title].',
    }),
    (args) => {
      changeRoomTitle(args)
    }
  )

  registerCommand(
    'chants',
    () => ({
      shortHelp: 'Toggle chantings',
      longHelp: 'Usage: /chants [on|off]</br>Enables or disables chantings.',
    }),
    (args) => {
      const mode = args.trim().toLocaleLowerCase()
      switch (mode) {
        case 'on':
          toggleChantings(true)
          break
        case 'off':
          toggleChantings(false)
          break
        default:
          gameChat.systemMessage('Error: Invalid argument for chants command.')
      }
    }
  )

  registerCommand(
    'fsr',
    () => ({
      shortHelp: 'Toggle full song range',
      longHelp: 'Usage: /fsr [on|off]</br>Enables or disables full song range.',
    }),
    (args) => {
      const mode = args.trim().toLocaleLowerCase()
      switch (mode) {
        case 'on':
          setFullSongRange(true)
          break
        case 'off':
          setFullSongRange(false)
          break
        default:
          gameChat.systemMessage('Error: Invalid argument for fsr command.')
      }
    }
  )

  registerCommand(
    'settings',
    () => ({
      shortHelp: 'Check current game settings',
      longHelp: 'Usage: /settings</br>Displays the current game settings.',
    }),
    () => {
      const settings = lobby.settings
      if (!settings) {
        gameChat.systemMessage('No game settings. Join a room first.')
        return
      }

      const output = ['Current game settings:']

      // Not every game mode sends every setting. A setting that cannot be
      // read gets its own line and does not stop the others.
      const add = (label: string, read: () => string | null) => {
        try {
          const value = read()
          if (value !== null) output.push(`${label}: ${value}`)
        } catch {
          output.push(`${label}: not available`)
        }
      }

      add('Room title', () => settings.roomName)

      add('Song types', () =>
        Object.entries(settings.songType.standardValue)
          .filter(([, enabled]) => enabled)
          .map(([type]) => type)
          .join(', ')
      )

      add('Guess time', () => {
        const guessTime = settings.guessTime.randomOn
          ? `[${settings.guessTime.randomValue.join(', ')}]`
          : settings.guessTime.standardValue
        const extraTime = settings.extraGuessTime.randomOn
          ? `[${settings.extraGuessTime.randomValue.join(', ')}]`
          : settings.extraGuessTime.standardValue
        return `${guessTime}${extraTime ? ' ' + extraTime : ''}`
      })

      add('Difficulty', () =>
        settings.songDifficulity.advancedOn
          ? settings.songDifficulity.advancedValue.join(' - ')
          : Object.entries(settings.songDifficulity.standardValue)
              .filter(([, enabled]) => enabled)
              .map(([level]) => level)
              .join(', ')
      )

      add('Watched distribution', () =>
        settings.watchedDistribution === 1
          ? 'Random'
          : settings.watchedDistribution === 2
            ? 'Weighted'
            : 'Equal'
      )

      add('Modifiers', () =>
        Object.entries(settings.modifiers)
          .filter(([, enabled]) => enabled)
          .map(([modifier]) => '</br>  - ' + modifier)
          .join('')
      )

      const stateToSymbol = {
        1: '+',
        2: '-',
        3: '?',
      }
      const describeFilters = (
        entries: RoomGenreTagEntry[],
        filter: SettingDropDownFilter
      ) =>
        entries
          .map(
            (entry) =>
              stateToSymbol[entry.state as keyof typeof stateToSymbol] +
              filter.awesomepleteInstance._list.find(
                (item) => item.id.toString() === entry.id.toString()
              )?.name
          )
          .join(', ') || null

      add('Genre', () => describeFilters(settings.genre, hostModal.genreFilter))
      add('Tags', () => describeFilters(settings.tags, hostModal.tagFilter))

      gameChat.systemMessage(output.join('</br>'))
    }
  )
}
