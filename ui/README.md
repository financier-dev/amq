# ui — AMQ interface reimplementation

A userscript that replaces parts of the
[Anime Music Quiz](https://animemusicquiz.com) interface, over the live game:

- **Room browser** — the grid of room tiles becomes a sortable list, with the
  same filters and the same join / spectate / host behaviour.
- **Quiz builder** — the custom quiz creator becomes a two-pane editor: the
  song library on the left, the whole quiz as one grouped list on the right.

Nothing else in the game changes, and other AMQ userscripts keep working
alongside it.

## Install

Open [`dist/amq-ui.user.js`](../dist/amq-ui.user.js) raw on GitHub —
Tampermonkey offers to install it — then reload animemusicquiz.com.

Tampermonkey is what this is tested against; other userscript managers are
untested. The only permission it asks for is `unsafeWindow`.

## If a screen misbehaves

Either screen can be handed back to AMQ's own, live, without a reload. In the
browser console:

```js
__amqUI.useLegacy() // the room browser, back to AMQ's
__amqUI.quizBuilder.useLegacy() // the quiz builder, back to AMQ's
```

They revert independently, and `useNew()` takes either back with whatever you
were editing still in place. If the script fails while starting up it hands
both screens back on its own.

## Known limitations

- **Random ranges** for guess time, sample point and playback speed are shown
  but not editable. A quiz that uses one keeps it through a save; AMQ's own
  builder is where you change it.
- **Difficulty, genres and tags are not library filters.** The game does not
  send any of the three with the library, so there is nothing to filter on.
  All three still work inside an algorithm block, which the server evaluates.

## How this was built

Everything in this folder, code and design alike, was vibe coded by Claude,
with a few human touches of my own.
