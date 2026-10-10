import { addListener } from './events'

const defaultNames = { current: [] as string[] }
const lowercaseNames = { current: [] as string[] }

let tracking = false

function trackNames() {
  if (tracking) return
  tracking = true

  addListener('get all song names', (data) => {
    defaultNames.current = data.names
    lowercaseNames.current = data.names.map((name: string) =>
      name.toLocaleLowerCase()
    )
  })
  addListener('update all song names', (data) => {
    if (data.deleted.length) {
      const lowercaseDeletedNames = data.deleted.map((name: string) =>
        name.toLocaleLowerCase()
      )
      defaultNames.current = defaultNames.current.filter(
        (name) => !data.deleted.includes(name)
      )
      lowercaseNames.current = lowercaseNames.current.filter(
        (name) => !lowercaseDeletedNames.includes(name)
      )
    }
    if (data.new.length) {
      defaultNames.current = defaultNames.current.concat(data.new)
      lowercaseNames.current = lowercaseNames.current.concat(
        data.new.map((name: string) => name.toLocaleLowerCase())
      )
    }
  })
}

/**
 * Every anime name the answer input accepts. Returns a holder, not a copy:
 * `current` changes when the game sends or updates the list.
 *
 * Call it after `ensureLoad()` and before the first quiz. The first call
 * binds the listeners, and the game sends the list when a quiz starts.
 */
export const getAllAnimeNames = (
  options: { lowercase: boolean } = { lowercase: false }
): { current: string[] } => {
  trackNames()
  return options.lowercase ? lowercaseNames : defaultNames
}

/** Resolves with the names once the game has sent them. */
export const getFixedAnimeNames = async (
  ...args: Parameters<typeof getAllAnimeNames>
) => {
  const animeNames = getAllAnimeNames(...args)
  while (true) {
    if (animeNames.current.length > 0) {
      return animeNames.current
    }
    await new Promise((res) => setTimeout(res, 100))
  }
}

type MasterListAnime = Pick<LibraryAnimeEntry, 'names' | 'mainNames'>

let animeList: Promise<MasterListAnime[]> | null = null

/**
 * The anime of the library master list. Call it after `ensureLoad()`.
 *
 * This fetches the list itself and does not call
 * `libraryCacheHandler.getCache`. `getCache` keeps one callback slot, so a
 * call here would drop a callback that another script is waiting on.
 */
export function loadAllAnime(): Promise<MasterListAnime[]> {
  animeList ??= new Promise<MasterListAnime[]>((resolve) => {
    const unbind = addListener('get current master list id', async (data) => {
      unbind()
      const res = await fetch(
        `https://animemusicquiz.com/libraryMasterList?masterId=${data.masterListId}`,
        {
          headers: {
            accept: 'application/json, text/javascript, */*; q=0.01',
            'x-requested-with': 'XMLHttpRequest',
          },
          credentials: 'include',
        }
      )
      const animeData: any = await res.json()
      resolve(Object.values(animeData.animeMap))
    })
    socket.sendCommand({
      type: 'library',
      command: 'get current master list id',
    })
  })
  return animeList
}
