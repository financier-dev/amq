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

"Uses in games" follows Settings → Anime List: your anime list with the ticked
Included Entries, and the AMQ Custom List selected there in its mode.

Add `-- --help` to a command to see its options.
