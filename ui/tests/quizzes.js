/*
 * Fixture custom quizzes, shaped like the `load custom quiz` reply's `quizSave`
 * from the 2026-09-19 client.
 *
 * Every shape here is transcribed from `generateBlockSave()` in
 * `scripts/pages/gamePage/customQuiz/creator/`, not invented — the README is
 * emphatic that a stub which drifts from the real payload renders fine here and
 * breaks in game, and for the serializer that failure mode is a corrupted quiz
 * rather than a misaligned column.
 *
 * `__quizRoundTrip` is deliberately hostile: it carries every branch the
 * serializer has, including the ones a hand-built quiz would never produce.
 */

// A quiz that exercises all five block kinds, chaining, every override, and
// both the scalar and the random form of each rule value.
window.__quizRoundTrip = {
  name: 'round trip',
  description: 'every branch the serializer has',
  tags: [3, 11],
  ruleBlockRandomOrder: true,
  ruleBlocks: [
    {
      randomOrder: true,
      songCount: 20,
      // Scalar form.
      guessTime: { guessTime: 20, extraGuessTime: 0 },
      samplePoint: { samplePoint: 50 },
      playBackSpeed: { playBackSpeed: 1 },
      duplicates: true,
      guessModes: { song: true, tinyVideo: false, blurVideo: false },
      blocks: [
        // Anime entry, no overrides at all — the common case.
        {
          connectUp: false,
          locked: false,
          annId: 3312,
          includeSongTypes: { op: true, ed: true, in: false },
          numberOfSongs: 3,
        },
        // Chained to the entry above, and locked.
        {
          connectUp: true,
          locked: true,
          annSongId: 9042,
        },
        // A third link in the same chain.
        {
          connectUp: true,
          locked: false,
          annSongId: 9043,
        },
        // Every override present, each in its random form.
        {
          connectUp: false,
          locked: false,
          annId: 4521,
          includeSongTypes: { op: true, ed: false, in: true },
          numberOfSongs: 1,
          guessTime: { guessTime: [20, 30], extraGuessTime: [1, 5] },
          samplePoint: { samplePoint: [10, 80] },
          playBackSpeed: { playBackSpeed: [1, 1.5, 2] },
          guessModes: { song: false, tinyVideo: true, blurVideo: true },
        },
        // Exactly one override — the presence rule matters most here.
        {
          connectUp: false,
          locked: false,
          annSongId: 7781,
          samplePoint: { samplePoint: 25 },
        },
      ],
    },
    {
      randomOrder: false,
      songCount: 12,
      guessTime: { guessTime: 15, extraGuessTime: 3 },
      samplePoint: { samplePoint: [0, 100] },
      playBackSpeed: { playBackSpeed: 2 },
      // Duplicates off — changes how the block info line counts.
      duplicates: false,
      guessModes: { song: true, tinyVideo: true, blurVideo: false },
      blocks: [
        // Algorithm block: `settings` is an opaque host-modal blob and must
        // come back out byte-identical.
        {
          connectUp: false,
          locked: false,
          settings: {
            numberOfSongs: 5,
            songSelection: {
              standardValue: 1,
              advancedValue: { watched: 5, unwatched: 0, random: 0 },
            },
            songType: {
              standardValue: { openings: true, endings: true, inserts: false },
              advancedValue: { openings: 0, endings: 0, inserts: 0, random: 5 },
              advancedOn: false,
            },
            songDifficulity: {
              advancedOn: true,
              standardValue: { easy: true, medium: true, hard: false },
              advancedValue: [0, 60],
            },
            vintage: {
              standardValue: { years: [1944, 2026], seasons: [0, 3] },
              advancedValueList: [],
            },
            genre: [],
            tags: [],
            modifiers: {
              duplicates: true,
              rebroadcastSongs: true,
              dubSongs: false,
            },
          },
        },
        // Message block: `avatar` is an opaque blob too, and the base fields are
        // spread *after* the body ones in the client.
        {
          message: 'halfway there',
          avatar: { characterId: 14, avatarId: 3, colorId: 2, poseId: 1 },
          videoDisplay: false,
          delay: 0,
          time: 5,
          connectUp: false,
          locked: false,
        },
        // Title block, and an empty string is a legitimate value — which is why
        // the loader tests `!= undefined` rather than truthiness.
        {
          title: '',
          connectUp: false,
          locked: false,
        },
      ],
    },
  ],
}

/*
 * The same quiz with a field our model does not know about, at all three
 * levels. A capture newer than ours will do exactly this, and the round-trip
 * must carry the field through rather than silently dropping it.
 */
window.__quizWithUnknownFields = (() => {
  const quiz = JSON.parse(JSON.stringify(window.__quizRoundTrip))
  quiz.someFutureQuizField = 'keep me'
  quiz.ruleBlocks[0].someFutureBlockField = 42
  quiz.ruleBlocks[0].blocks[0].someFutureEntryField = { nested: true }
  return quiz
})()

/*
 * A freshly-loaded quiz as the *server* sends it: algorithm blocks arrive with
 * `annSongIds` pre-computed. The client consumes and deletes them
 * (`customQuizAlgorithmBlock.js:126-131`), so they are not part of a save —
 * this is the one field a round-trip is expected to drop.
 */
window.__quizAsLoaded = (() => {
  const quiz = JSON.parse(JSON.stringify(window.__quizRoundTrip))
  quiz.ruleBlocks[1].blocks[0].annSongIds = [101, 102, 103]
  // Found by the live suite: the server also stamps a quiz `version` and a
  // per-block `matchSongCount`. Neither is in `generateQuizSave`, so a save
  // must not echo them back.
  quiz.version = 10
  quiz.ruleBlocks[0].matchSongCount = 4
  return quiz
})()
