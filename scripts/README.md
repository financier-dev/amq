# scripts — userscripts for the game page

Small userscripts for [Anime Music Quiz](https://animemusicquiz.com). They
build into one file, [`dist/amq.user.js`](../dist/amq.user.js).

## Install

1. Open the raw [`dist/amq.user.js`](../dist/amq.user.js) on GitHub.
   Tampermonkey offers to install it.
2. Reload animemusicquiz.com.

The script is tested with Tampermonkey only.

## What is inside

Each file in this folder is one script. `main.ts` starts all of them when the
game has loaded.

| File                        | What it does                                                                          | Chat commands                                                                                                            |
| --------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `commands.ts`               | Runs a chat message that starts with `/` as a command.                                | `/help`                                                                                                                  |
| `answerInput.ts`            | Highlights the answer input when it holds a valid anime name.                         |                                                                                                                          |
| `answerTimes.ts`            | Shows hint times and how your answer time compares with your best, under the avatars. |                                                                                                                          |
| `antiAfk.ts`                | Disables the AFK kicker.                                                              |                                                                                                                          |
| `autoHideVideo.ts`          | Hides the video for the anime in `SHOWS_TO_HIDE`.                                     |                                                                                                                          |
| `autoSkip.ts`               | Votes to skip when you or a teammate entered a valid anime name.                      | `/autoskip`, `/avs`                                                                                                      |
| `autoSubmit.ts`             | Submits the answer whenever the answer input changes.                                 | `/as`                                                                                                                    |
| `autoVoter.ts`              | Votes for the themes and song types in `options` in a Jam quiz.                       |                                                                                                                          |
| `betterDropdown.ts`         | Highlights matches in the answer dropdown, removes its delay and adds quick answer.   | `/qa`                                                                                                                    |
| `chatTimestamps.ts`         | Adds a timestamp to each chat message.                                                |                                                                                                                          |
| `customCommands.ts`         | Commands for the lobby and the quiz.                                                  | `/at`, `/autoready`, `/start`, `/autostart`, `/spec`, `/dd`, `/autovoteyes`, `/autoreturnlobby`, `/lobby`, `/p`          |
| `customCss.ts`              | Page background and transparent panels.                                               |                                                                                                                          |
| `easyExtraInfo.ts`          | Shows type, vintage, rating, difficulty and sample in the song info box.              |                                                                                                                          |
| `easySettings.ts`           | Commands that change the game settings.                                               | `/diff`, `/type`, `/songs`, `/teams`, `/genre`, `/roomsize`, `/gtime`, `/dist`, `/title`, `/chants`, `/fsr`, `/settings` |
| `fixHints.ts`               | Restyles the anime title while a name hint shows.                                     |                                                                                                                          |
| `forceVideoHost.ts`         | Pins the video host region.                                                           | `/forcehost`                                                                                                             |
| `jamVoteResultAnnouncer.ts` | Announces the selected theme and the song type distribution in chat.                  |                                                                                                                          |
| `keyboardShortcuts.ts`      | Keyboard shortcuts for the quiz.                                                      |                                                                                                                          |
| `onlineNotifications.ts`    | Shows a notification when a friend comes online or goes offline.                      |                                                                                                                          |
| `playerStats.ts`            | Shows each player's accuracy on songs from their own list.                            | `/stats`                                                                                                                 |
| `showExtraSongInfo.ts`      | Shows when you last saw the song, and every accepted answer.                          |                                                                                                                          |
| `songHistory.ts`            | Shows a song history table under the Standings box.                                   |                                                                                                                          |

Type `/help` in the game chat for the list of commands, and `/help <command>`
for the details of one.

`lib/` holds helpers that more than one script uses.

## Build

Run these from the repository root.

```
npm install
npm run build -- amq           # build dist/amq.user.js
AMQ_TARGET=amq npm run dev     # dev server: the page reloads on each save
```

The [root readme](../README.md#developing-with-hmr) explains the dev server.

The scripts build into one file only. A script cannot be built by itself.

## Add a script

Create a `.ts` file in this folder with a default export:

```ts
export default async function setup() {
  // The game has loaded when this runs.
}
```

`main.ts` includes every file in this folder, so there is no list to update.
To add a chat command, import `registerCommand` from `./commands`.
