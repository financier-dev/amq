/*
 * Fixture custom quizzes in the shape of `quizSave` in the `load custom quiz`
 * reply of the 2026-09-19 client.
 *
 * Every shape is copied from `generateBlockSave()` in
 * `scripts/pages/gamePage/customQuiz/creator/`. Do not invent shapes: a stub
 * that differs from the real payload passes here and corrupts a quiz in game.
 *
 * `__quizRoundTrip` covers every branch of the serializer, including shapes a
 * hand-built quiz would not produce.
 */

// All five block kinds, chaining, every override, and both the fixed and the
// random form of each rule value.
window.__quizRoundTrip = {
  name: 'round trip',
  description: 'every branch the serializer has',
  tags: [3, 11],
  ruleBlockRandomOrder: true,
  ruleBlocks: [
    {
      randomOrder: true,
      songCount: 20,
      // Fixed form.
      guessTime: { guessTime: 20, extraGuessTime: 0 },
      samplePoint: { samplePoint: 50 },
      playBackSpeed: { playBackSpeed: 1 },
      duplicates: true,
      guessModes: { song: true, tinyVideo: false, blurVideo: false },
      blocks: [
        // Anime entry with no overrides, the common case.
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
        // Exactly one override. The other keys must stay absent.
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
      // Duplicates off, which changes how the block info line counts.
      duplicates: false,
      guessModes: { song: true, tinyVideo: true, blurVideo: false },
      blocks: [
        // Algorithm block. `settings` is opaque and must round-trip unchanged.
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
        // Message block. `avatar` is opaque too. The client spreads the base
        // fields *after* the body fields.
        {
          message: 'halfway there',
          avatar: { characterId: 14, avatarId: 3, colorId: 2, poseId: 1 },
          videoDisplay: false,
          delay: 0,
          time: 5,
          connectUp: false,
          locked: false,
        },
        // Title block. An empty string is a valid title, which is why the
        // loader tests `!= undefined`.
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
 * The same quiz with a field our model does not know, at all three levels. A
 * newer client can add such fields, and the round-trip must carry them
 * through.
 */
window.__quizWithUnknownFields = (() => {
  const quiz = JSON.parse(JSON.stringify(window.__quizRoundTrip))
  quiz.someFutureQuizField = 'keep me'
  quiz.ruleBlocks[0].someFutureBlockField = 42
  quiz.ruleBlocks[0].blocks[0].someFutureEntryField = { nested: true }
  return quiz
})()

/*
 * A quiz as the *server* sends it on load. Algorithm blocks arrive with
 * `annSongIds`. The client consumes and deletes them
 * (`customQuizAlgorithmBlock.js:126-131`), so a save does not carry them and
 * the round-trip must drop them.
 */
window.__quizAsLoaded = (() => {
  const quiz = JSON.parse(JSON.stringify(window.__quizRoundTrip))
  quiz.ruleBlocks[1].blocks[0].annSongIds = [101, 102, 103]
  // The server also adds a quiz `version` and a per-block `matchSongCount`.
  // Neither is in `generateQuizSave`, so a save must not send them back.
  quiz.version = 10
  quiz.ruleBlocks[0].matchSongCount = 4
  return quiz
})()
