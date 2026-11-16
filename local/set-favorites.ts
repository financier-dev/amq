/*
 * Adds every combination of the chosen skins and backgrounds to the account's
 * favorite avatars. It keeps the current favorites and skips the
 * combinations that are already favorites. `--replace` removes the current
 * favorites first.
 *
 *   npm run set-favorites -- --list shiina      # find outfits and their skins
 *   npm run set-favorites -- --skins "Water Princess Shiina"
 *   npm run set-favorites -- --skins "Water Princess Shiina: <skin>, <skin>" \
 *     --backgrounds "Water Princess Shiina" --backgrounds "<location background>"
 *   npm run set-favorites -- --skins "Water Princess Shiina" --replace
 *   npm run set-favorites -- --skins "Water Princess Shiina" --dry-run
 *
 * A selector is an outfit's full name as the store shows it ("<outfit>
 * <character>"), with an optional list of skins after a colon. Without the
 * list, it means every skin of the outfit. A background selector can also be
 * the name of a location background. `--backgrounds` defaults to `--skins`.
 *
 * It logs in with `AMQ_ACCOUNT_*`, because favorites belong to the account.
 *
 * The rules are the store's (`storeAvatarColumn.js`, `updateActionButton`):
 * the star shows only on a combination the account can use. The skin must be
 * unlocked. A skin's own background always works with it. The background of
 * another skin needs that skin unlocked and its outfit's background bonus
 * (10 unlocked skins). A location background must be unlocked. The script
 * skips the other combinations and says why.
 *
 * Favorites have no decorations here.
 */

import { parseArgs } from 'node:util'
import { openSession, request } from '@shared/node/session'

/** Space between commands, so a long list does not flood the socket. */
const COMMAND_GAP_MS = 200
const REPLY_TIMEOUT_MS = 15_000

const { values: flags } = parseArgs({
  options: {
    skins: { type: 'string', multiple: true, default: [] },
    backgrounds: { type: 'string', multiple: true, default: [] },
    option: { type: 'string', default: 'both' },
    list: { type: 'string' },
    replace: { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
    'test-account': { type: 'boolean', default: false },
    headed: { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
})

if (flags.help) {
  console.log(`Usage: npm run set-favorites -- [options]

  --skins <selector>        skins to favorite; repeat for more
  --backgrounds <selector>  backgrounds to combine them with; repeat for
                            more (default: the same as --skins)
  --option <on|off|both>    the outfit's toggle (tiara, hat, …) in the
                            favorites: on, off or both versions (default: both)
  --list <text>             print the outfits whose name contains this text,
                            with their skins, and change nothing
  --replace                 remove all current favorites first (default:
                            keep them)
  --dry-run                 print the changes, and make none
  --test-account            use AMQ_TEST_ACCOUNT_* instead of AMQ_ACCOUNT_*
  --headed                  show the browser

A selector is "<outfit> <character>", for example "Water Princess Shiina",
optionally followed by a colon and a comma-separated list of skins:
"Water Princess Shiina: <skin>, <skin>". A background selector can also be the
name of a location background.`)
  process.exit(0)
}

const OPTION_STATES: Record<string, boolean[]> = {
  on: [true],
  off: [false],
  both: [true, false],
}
const optionStates = OPTION_STATES[flags.option]
if (!optionStates) throw new Error('--option must be on, off or both')

const listing = flags.list !== undefined
if (!listing && flags.skins.length === 0) {
  throw new Error('Give at least one --skins selector, or --list. See --help.')
}

interface Skin {
  colorId: number
  name: string
  unlocked: boolean
}

interface Outfit {
  avatarId: number
  fullName: string
  /** `"None"` when the outfit has no toggle. */
  optionName: string
  bonusUnlocked: boolean
  skins: Skin[]
}

interface LocationBackground {
  id: number
  name: string
  unlocked: boolean
}

interface FavoriteSetup {
  avatar: { avatarId: number; colorId: number; optionActive: boolean }
  background: {
    avatarId?: number | null
    colorId?: number | null
    backgroundUniqueId?: number | null
  }
}

interface Favorite extends FavoriteSetup {
  favoriteId: number
  decorated: boolean
}

interface Store {
  outfits: Outfit[]
  locations: LocationBackground[]
  favorites: Favorite[]
}

type Background =
  | { kind: 'skin'; outfit: Outfit; skin: Skin }
  | { kind: 'location'; location: LocationBackground }

interface Combination {
  outfit: Outfit
  skin: Skin
  optionActive: boolean
  background: Background
}

const fold = (text: string) => text.trim().toLowerCase()

function backgroundLabel(background: Background): string {
  return background.kind === 'skin'
    ? `${background.outfit.fullName} ${background.skin.name}`
    : background.location.name
}

function combinationLabel({
  outfit,
  skin,
  optionActive,
  background,
}: Combination) {
  const option =
    outfit.optionName === 'None'
      ? ''
      : ` (${outfit.optionName} ${optionActive ? 'on' : 'off'})`
  return `${outfit.fullName} ${skin.name}${option} on ${backgroundLabel(background)}`
}

function printOutfits(outfits: Outfit[]) {
  for (const outfit of outfits) {
    const option =
      outfit.optionName === 'None' ? '' : `, toggle: ${outfit.optionName}`
    const bonus = outfit.bonusUnlocked ? '' : ', background bonus locked'
    console.log(`${outfit.fullName}${option}${bonus}`)
    for (const skin of outfit.skins) {
      console.log(`  ${skin.unlocked ? ' ' : '🔒'} ${skin.name}`)
    }
  }
}

/** Splits "Outfit Character: A, B" into the outfit name and the skin names. */
function parseSelector(selector: string) {
  const colon = selector.indexOf(':')
  if (colon === -1) return { name: fold(selector), skinNames: null }
  return {
    name: fold(selector.slice(0, colon)),
    skinNames: selector
      .slice(colon + 1)
      .split(',')
      .map(fold)
      .filter(Boolean),
  }
}

function pickSkins(outfit: Outfit, skinNames: string[] | null): Skin[] {
  if (!skinNames) return outfit.skins
  return skinNames.map((name) => {
    const skin = outfit.skins.find((skin) => fold(skin.name) === name)
    if (!skin) {
      throw new Error(
        `${outfit.fullName} has no skin named "${name}". Its skins: ` +
          outfit.skins.map((skin) => skin.name).join(', ')
      )
    }
    return skin
  })
}

function findOutfit(store: Store, name: string) {
  return store.outfits.find((outfit) => fold(outfit.fullName) === name)
}

function resolveSkins(store: Store, selector: string) {
  const { name, skinNames } = parseSelector(selector)
  const outfit = findOutfit(store, name)
  if (!outfit) {
    throw new Error(
      `No outfit is named "${selector}". Use --list to find its name.`
    )
  }
  return pickSkins(outfit, skinNames).map((skin) => ({ outfit, skin }))
}

function resolveBackgrounds(store: Store, selector: string): Background[] {
  const { name, skinNames } = parseSelector(selector)
  const outfit = findOutfit(store, name)
  if (outfit) {
    return pickSkins(outfit, skinNames).map((skin) => ({
      kind: 'skin',
      outfit,
      skin,
    }))
  }
  const location = store.locations.find(
    (location) => fold(location.name) === fold(selector)
  )
  if (location) return [{ kind: 'location', location }]
  throw new Error(
    `No outfit or location background is named "${selector}". Use --list ` +
      'to find an outfit.'
  )
}

/** Why the store would not let the account use this combination, if not. */
function blocker({ outfit, skin, background }: Combination): string | null {
  if (!skin.unlocked) {
    return `the skin ${outfit.fullName} ${skin.name} is locked`
  }
  if (background.kind === 'location') {
    return background.location.unlocked
      ? null
      : `the location background ${background.location.name} is locked`
  }
  const ownBackground =
    background.outfit.avatarId === outfit.avatarId &&
    background.skin.colorId === skin.colorId
  if (ownBackground) return null
  if (!background.outfit.bonusUnlocked) {
    return `${background.outfit.fullName} needs 10 unlocked skins before its backgrounds go on other skins`
  }
  if (!background.skin.unlocked) {
    return `the background ${backgroundLabel(background)} is locked`
  }
  return null
}

function favoriteData({
  outfit,
  skin,
  optionActive,
  background,
}: Combination): FavoriteSetup {
  return {
    avatar: { avatarId: outfit.avatarId, colorId: skin.colorId, optionActive },
    background:
      background.kind === 'skin'
        ? {
            avatarId: background.outfit.avatarId,
            colorId: background.skin.colorId,
          }
        : { backgroundUniqueId: background.location.id },
  }
}

/** Equal for two favorites that `StoreFavorites.getFavoriteId` would match. */
function favoriteKey({ avatar, background }: FavoriteSetup) {
  const skin = `${avatar.avatarId}/${avatar.colorId}/${avatar.optionActive}`
  return background.backgroundUniqueId
    ? `${skin} on location ${background.backgroundUniqueId}`
    : `${skin} on ${background.avatarId}/${background.colorId}`
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const { browser, page } = await openSession({
  headed: flags.headed,
  accounts: [flags['test-account'] ? 'AMQ_TEST_ACCOUNT' : 'AMQ_ACCOUNT'],
})

try {
  const store: Store = await page.evaluate(() => ({
    outfits: storeWindow.getAllAvatars().map((avatar) => ({
      avatarId: avatar.avatarId,
      fullName: `${avatar.outfitName} ${avatar.avatarName}`,
      optionName: avatar.optionName,
      bonusUnlocked: Boolean(
        storeWindow.getAvatarBonusUnlocked(avatar.avatarId)
      ),
      skins: avatar.colors.map((color) => ({
        colorId: color.colorId,
        name: color.name,
        unlocked: color.unlocked,
      })),
    })),
    locations: storeWindow.topBar.backgrounds.backgrounds.map((location) => ({
      id: location.id,
      name: location.name,
      unlocked: location.unlocked,
    })),
    favorites: storeWindow.topBar.favorites.favoriteAvatars.map((favorite) => ({
      favoriteId: favorite.favoriteId,
      avatar: favorite.avatar,
      background: favorite.background,
      decorated: Boolean(
        favorite.frontDecorationId || favorite.backDecorationId
      ),
    })),
  }))

  if (listing) {
    const text = fold(flags.list!)
    const outfits = store.outfits.filter((outfit) =>
      fold(outfit.fullName).includes(text)
    )
    const locations = store.locations.filter((location) =>
      fold(location.name).includes(text)
    )
    if (outfits.length === 0 && locations.length === 0) {
      console.log(`No outfit or location background contains "${flags.list}".`)
    }
    printOutfits(outfits)
    for (const location of locations) {
      console.log(
        `${location.unlocked ? '  ' : '🔒'} ${location.name} (location background)`
      )
    }
  } else {
    const skins = flags.skins.flatMap((selector) =>
      resolveSkins(store, selector)
    )
    const backgrounds = (
      flags.backgrounds.length ? flags.backgrounds : flags.skins
    ).flatMap((selector) => resolveBackgrounds(store, selector))

    // A favorite with decorations is not the same as one without, so a
    // combination is only a duplicate of an undecorated favorite.
    const kept = flags.replace ? [] : store.favorites
    const existing = new Set(
      kept.filter((favorite) => !favorite.decorated).map(favoriteKey)
    )
    const combinations: Combination[] = []
    const seen = new Set<string>()
    const skipped = new Map<string, number>()
    let alreadyFavorites = 0
    for (const { outfit, skin } of skins) {
      const states = outfit.optionName === 'None' ? [true] : optionStates
      for (const optionActive of states) {
        for (const background of backgrounds) {
          const combination = { outfit, skin, optionActive, background }
          const key = favoriteKey(favoriteData(combination))
          if (seen.has(key)) continue
          seen.add(key)
          if (existing.has(key)) {
            alreadyFavorites++
            continue
          }
          const reason = blocker(combination)
          if (reason) skipped.set(reason, (skipped.get(reason) ?? 0) + 1)
          else combinations.push(combination)
        }
      }
    }

    for (const [reason, count] of skipped) {
      console.error(`skipping ${count} combination(s): ${reason}`)
    }
    if (alreadyFavorites) {
      console.error(
        `skipping ${alreadyFavorites} combination(s): already a favorite`
      )
    }
    // With --replace, going on would only clear the favorites.
    if (combinations.length === 0 && (flags.replace || !alreadyFavorites)) {
      throw new Error(
        'No combination can be used. The favorites did not change.'
      )
    }

    if (flags.replace) {
      const verb = flags['dry-run'] ? 'would remove' : 'removing'
      console.error(`${verb} ${store.favorites.length} favorite(s)`)
    }
    if (flags.replace && !flags['dry-run']) {
      for (const { favoriteId } of store.favorites) {
        await request(page, {
          type: 'avatar',
          command: 'remove favorite avatar',
          reply: 'remove favorite avatar',
          data: { favoriteId },
          matchField: 'favoriteId',
          matchValue: favoriteId,
          timeout: REPLY_TIMEOUT_MS,
        })
        await sleep(COMMAND_GAP_MS)
      }
    }

    console.error(
      `${flags['dry-run'] ? 'would add' : 'adding'} ${combinations.length} favorite(s)`
    )
    let failed = 0
    for (const combination of combinations) {
      console.log(combinationLabel(combination))
      if (flags['dry-run']) continue
      // The reply has no request id, so commands go one at a time.
      const reply = await request(page, {
        type: 'avatar',
        command: 'new favorite avatar',
        reply: 'new favorite avatar',
        data: favoriteData(combination),
        timeout: REPLY_TIMEOUT_MS,
      }).catch((error: Error) => ({ error: error.message }))
      if (reply?.favoriteId === undefined) {
        failed++
        console.error(`  not added: ${JSON.stringify(reply)}`)
      }
      await sleep(COMMAND_GAP_MS)
    }

    if (!flags['dry-run']) {
      const count = await page.evaluate(
        () => storeWindow.topBar.favorites.favoriteAvatars.length
      )
      console.error(
        `done: the account has ${count} favorite(s)` +
          (failed ? `, ${failed} could not be added` : '')
      )
      if (failed) process.exitCode = 1
    }
  }
} finally {
  await browser.close()
}
