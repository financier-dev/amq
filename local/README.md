# local — scripts that run on your computer

Command-line scripts for [Anime Music Quiz](https://animemusicquiz.com). They
run in Node, not in the browser. A script logs in to the game in a headless
browser and reads data from it.

## Setup

Run these from the repository root.

```
npm install
npx playwright install chromium
cp .env.example .env
```

Then put your AMQ user names and passwords in `.env`:

```
AMQ_ACCOUNT_USERNAME=…
AMQ_ACCOUNT_PASSWORD=…
AMQ_TEST_ACCOUNT_USERNAME=…
AMQ_TEST_ACCOUNT_PASSWORD=…
```

`AMQ_ACCOUNT_*` is your own account. `AMQ_TEST_ACCOUNT_*` is a second account
for the scripts that stay online or change account settings, so they do not
take over your game.

**AMQ allows one session for each account.** When a script logs in, it
disconnects any other session of that account, including a game you are in.

Options go after `--`, for example `npm run rooms -- --all`. Add `-- --help`
to any command to see its options.

## What is inside

| Command                     | What it does                                                           | Logs in as      |
| --------------------------- | ---------------------------------------------------------------------- | --------------- |
| `npm run anime-titles`      | Prints the Japanese title of every anime your account uses in games.   | your account    |
| `npm run watch-rooms`       | Stays online and tells you when a "no dd" room opens.                  | test account    |
| `npm run rooms`             | Prints the open public rooms and their main settings.                  | test account    |
| `npm run video-cache`       | Serves your cached song videos to the game and downloads missing ones. | does not log in |
| `npm run clean-video-cache` | Lists cached videos that AMQ deleted. Deletes them with `--delete`.    | does not log in |
| `npm run queue-list-videos` | Queues the videos of every song on an anime list for download.         | either, by flag |

## anime-titles

Prints the Japanese title of every anime your account uses in games. "Uses in
games" follows Settings → Anime List: your anime list with the ticked
Included Entries, and the AMQ Custom List selected there in its mode.

| Option               | What it does                                                                                  |
| -------------------- | --------------------------------------------------------------------------------------------- |
| `--keep-case`        | Keep AMQ's capitalisation. By default, titles are all lowercase.                              |
| `--overrides <file>` | Use this file of title overrides. Default: `local/anime-titles.overrides.json`.               |
| `-o, --out <file>`   | Write to a file instead of the terminal.                                                      |
| `--pipe`             | Separate the titles with `\|` instead of a new line, for MonkeyType's custom text.            |
| `--candidates`       | Print the annId, the chosen title and every registered name of each anime, separated by tabs. |
| `--headed`           | Show the browser window.                                                                      |

To change the title of an anime or leave it out, copy
`anime-titles.overrides.example.json` to `anime-titles.overrides.json` and
edit it. Use `--candidates` to see the names you can choose from.

## watch-rooms and rooms

Both use the test account. They only read: they do not join, watch or host a
room, and they do not chat.

`watch-rooms` keeps the room browser open and checks each new or renamed
room. When a name contains "no dd" or "nodd", it prints the room and shows a
macOS notification. Leave it running in a terminal. If it loses the
connection, it logs in again. If another session logs in with the same
account, it waits 30 minutes before it logs in again.

| Option         | What it does                                                                                       |
| -------------- | -------------------------------------------------------------------------------------------------- |
| `--match <re>` | Report rooms whose name matches this regular expression (case does not matter) instead of "no dd". |
| `--no-notify`  | Print matches only. Send no notifications.                                                         |
| `--headed`     | Show the browser window.                                                                           |

To get the alerts on Discord too, create a webhook (Server Settings →
Integrations → Webhooks) and put its URL in `.env`:

```
ROOM_ALERT_DISCORD_WEBHOOK=https://discord.com/api/webhooks/…
```

Anyone with the URL can post to your channel. Do not share it.

`rooms` prints the open public rooms. While `watch-rooms` runs, `rooms` reads
its list and does not log in. Otherwise `rooms` logs in, reads the list once
and logs out.

| Option     | What it does                                 |
| ---------- | -------------------------------------------- |
| `--all`    | Show private rooms too.                      |
| `--json`   | Print every setting of each room as JSON.    |
| `--headed` | Show the browser window, if `rooms` logs in. |

## Video cache

Three scripts keep song videos on your disk, so the game can play them with
no wait. They work with `scripts/videoCache.ts` in the AMQ Master Script.

### video-cache

Start it before you play and leave it running:

```
npm run video-cache
```

When the cache has a song's video (720p, else 480p), the game plays it from
your disk. When it does not, the game plays the mp3, and the server downloads
the video for the next time. A download never replaces the mp3 during a
round. When the server is not running, every song plays the mp3. During the
reveal, the video box shows why a song played the mp3.

To go back to AMQ's usual playback, type `/videocache off` in the game chat
(`/videocache on` to turn it back on). The cache also does nothing while the
quality setting is mp3.

The first time, Brave asks if animemusicquiz.com can access localhost. Allow
it.

Videos are kept in `~/amq-cache`. To use another folder, set
`AMQ_VIDEO_CACHE_DIR` in `.env`. Downloads run one at a time. If the server
stops, it continues the queued downloads the next time it starts.

| Option             | What it does                                                    |
| ------------------ | --------------------------------------------------------------- |
| `--limit-kbps <n>` | Download speed limit in KB/s. Default: 500. `0` means no limit. |

### clean-video-cache

AMQ often replaces videos. Run this from time to time to find the cached
videos that AMQ deleted. It asks an AMQ video host about each file. A file
that it cannot check is kept.

| Option          | What it does                                                     |
| --------------- | ---------------------------------------------------------------- |
| `--delete`      | Delete the files that AMQ deleted. Without it, only list them.   |
| `--host <name>` | The AMQ video host to ask: `EU`, `NA1` or `NA2`. Default: `NA2`. |

### queue-list-videos

Queues the video of every song on an anime list, so the cache has them before
you play. `video-cache` must be running. Downloads start while the list is
still being read.

```
npm run queue-list-videos -- --main-account     # your own list
npm run queue-list-videos -- --mal <user>       # any MyAnimeList user's list
```

AMQ gives the file names one song at a time, so the script sends one request
every 2 seconds. A list of 3,000 songs takes about 1 hour 40 minutes. Each
answer is saved in `local/.cache/list-videos.json`, so a song is asked about
only once, and a stopped run continues where it stopped.

| Option           | What it does                                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------------------------------ |
| `--main-account` | Log in as your account and use its list and all its custom lists. Changes no setting.                              |
| `--mal <user>`   | Log in as the test account and set its anime list to this MyAnimeList user. The setting stays on the test account. |
| `--from-cache`   | Do not log in. Queue the files saved by earlier runs again.                                                        |
| `--limit <n>`    | Ask about the first `n` new songs only. Use it for a test.                                                         |
| `--delay-ms <n>` | Wait between requests, in milliseconds. Default: 2000.                                                             |
| `--host <name>`  | The AMQ video host to download from: `EU`, `NA1` or `NA2`. Default: `NA2`.                                         |
| `--headed`       | Show the browser window.                                                                                           |

Use exactly one of `--main-account`, `--mal` and `--from-cache`. The list
follows the account's Settings → Anime List: only the ticked Included Entries.
With `--mal`, the run disconnects `watch-rooms`, which uses the same account.
