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

If these two are empty, the scripts use the `AMQ_TEST_ACCOUNT_*` account.

**AMQ allows one session for each account.** When a script logs in, it
disconnects any other session of that account, including a game you are in.

## What is inside

| File              | What it does                                                 | Run                    |
| ----------------- | ------------------------------------------------------------ | ---------------------- |
| `anime-titles.ts` | Prints the Japanese title of every anime on your anime list. | `npm run anime-titles` |

Add `-- --help` to a command to see its options.
