# Vendored font subsets

These are the latin subsets of the three families the room browser renders
with, served locally by `tests/harness.html`. They are here so the render
tests measure the metrics the game actually uses: several layout bugs — a
spectator count sitting 4.5px off its baseline, song-type letters sitting high
in their chips — are invisible under a fallback font stack, and `npm test`
fails if these faces do not load.

They are **not** shipped in the userscript. `src/ui/fonts.ts` loads the same
families from Google Fonts at runtime, with system fallbacks if that request is
blocked.

## Files

| File | Family | Weights |
| --- | --- | --- |
| `f0.woff2` | Bricolage Grotesque | 600, 700 (variable) |
| `f1.woff2` | IBM Plex Mono | 400 |
| `f2.woff2` | IBM Plex Mono | 500 |
| `f3.woff2` | IBM Plex Mono | 600 |
| `f4.woff2` | IBM Plex Sans | 400–700 (variable) |

`fonts.css` one level up declares the `@font-face` rules and is generated
alongside these files — see the regeneration note in the repo README.

Fetched from Google Fonts (`fonts.gstatic.com`) via the stylesheet URL in
`src/ui/fonts.ts`.

## Licence

The rest of this repository is MIT, but these font files are not. Both
families are licensed under the **SIL Open Font License, Version 1.1**, which
permits redistribution provided the copyright and licence notice travel with
the files. The upstream notices are included verbatim:

- **IBM Plex Sans, IBM Plex Mono** — Copyright © 2017 IBM Corp., with Reserved
  Font Name "Plex". See [`LICENSE-IBM-Plex.txt`](LICENSE-IBM-Plex.txt).
  Upstream: https://github.com/IBM/plex
- **Bricolage Grotesque** — Copyright 2022 The Bricolage Grotesque Project
  Authors. See
  [`LICENSE-Bricolage-Grotesque.txt`](LICENSE-Bricolage-Grotesque.txt).
  Upstream: https://github.com/ateliertriay/bricolage

Under the OFL these files may not be sold on their own, and any modified
version must not use the reserved font names.
