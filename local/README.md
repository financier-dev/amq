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

Then put your AMQ user name and password in `.env`:

```
AMQ_ACCOUNT_USERNAME=…
AMQ_ACCOUNT_PASSWORD=…
```

`anime-titles` always uses this account. It does not use the
`AMQ_TEST_ACCOUNT_*` account.

**AMQ allows one session for each account.** When a script logs in, it
disconnects any other session of that account, including a game you are in.

## What is inside

| File              | What it does                                                         | Run                    |
| ----------------- | -------------------------------------------------------------------- | ---------------------- |
| `anime-titles.ts` | Prints the Japanese title of every anime your account uses in games. | `npm run anime-titles` |
| `watch-rooms.ts`  | Stays online and tells you when a "no dd" room opens.                | `npm run watch-rooms`  |
| `rooms.ts`        | Prints the open public rooms and their main settings.                | `npm run rooms`        |

"Uses in games" follows Settings → Anime List: your anime list with the ticked
Included Entries, and the AMQ Custom List selected there in its mode.

`watch-rooms` and `rooms` use the `AMQ_TEST_ACCOUNT_*` account. They only
read: they do not join, watch or host a room, and they do not chat.

`watch-rooms` keeps the room browser open and checks each new or renamed
room. When a name contains "no dd" or "nodd", it prints the room and shows a
macOS notification. To look for other names, use `--match`.

To get the alerts on Discord too, create a webhook (Server Settings →
Integrations → Webhooks) and put its URL in `.env`:

```
ROOM_ALERT_DISCORD_WEBHOOK=https://discord.com/api/webhooks/…
```

Anyone with the URL can post to your channel. Do not share it.
Leave it running in
a terminal. If it loses the connection, it logs in again. If another session
logs in with the same account, it waits 30 minutes before it logs in again.

While `watch-rooms` runs, `rooms` reads its list and does not log in.
Otherwise `rooms` logs in, reads the list once and logs out.

Add `-- --help` to a command to see its options.
