# ui — AMQ interface reimplementation

A userscript that replaces two screens of
[Anime Music Quiz](https://animemusicquiz.com) on the live game:

- **Room browser.** The grid of room tiles becomes a sortable list. The
  filters and the join, spectate and host actions work as before.
- **Quiz builder.** The custom quiz creator becomes an editor with two panes:
  the song library on the left, and the quiz as one grouped list on the right.

The rest of the game does not change, and other AMQ userscripts continue to
work.

## Install

1. Open the raw [`dist/amq-ui.user.js`](../dist/amq-ui.user.js) on GitHub.
   Tampermonkey offers to install it.
2. Reload animemusicquiz.com.

The script is tested with Tampermonkey only. It asks for one permission,
`unsafeWindow`.

## If a screen does not work

You can switch each screen back to AMQ's own without a reload. Run one of
these in the browser console:

```js
__amqUI.useLegacy() // use AMQ's room browser
__amqUI.quizBuilder.useLegacy() // use AMQ's quiz builder
```

Each screen switches independently. `useNew()` switches a screen back to this
script and keeps what you were editing. If the script fails at startup, it
switches both screens back to AMQ's automatically.

## Known limitations

- **You cannot edit random ranges** for guess time, sample point and playback
  speed. The builder shows them, and a save keeps them unchanged. Use AMQ's
  own builder to change one.
- **You cannot filter the library by difficulty, genres or tags.** The game
  does not send them with the library. Use an algorithm block to filter by
  them.

## How this was built

Everything in this folder, code and design alike, was vibe coded by Claude,
with a few human touches of my own.
