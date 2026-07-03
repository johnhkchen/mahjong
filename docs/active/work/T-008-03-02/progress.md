# Progress — T-008-03-02 next-hand-new-game-controls

## Steps completed (plan.md's numbering)

1. **`HandEnd.svelte`** — added optional `scores`/`onnext` props, `displayScores = scores ??
   breakdown?.scores`, the `.next-hand` button (gated inside the existing `breakdown !== null`
   block), and its CSS. Verified: full suite green before adding any new test (zero regression on
   the fallback path).
2. **`Table.svelte`** — widened `scores`/`onnext` as pure pass-through props to `<HandEnd>`.
   Verified: full suite green, unchanged.
3. **SSR cases** — added scores-override and next-hand-visibility assertions to the existing
   `hand-end view`, `wall-exhausted table view`, and `no hand-end region while playing` describe
   blocks in `app.ssr.test.ts`.
4. **`hand-end.tap.svelte.test.ts`** (NEW) — mount/click coverage proving the button reaches
   `onnext` through `Table`'s forwarding, on both a won and a ryuukyoku fixture, plus the
   button's absence when `onnext` is omitted.
5. **`App.svelte`** — the `GameRecord` state-model rewrite (`gameSeed`/`hands` in place of
   `seed`/`actions`, `record`/`game`/`table`/`offered`/`seatScores` derives, `activeHand()`
   helper, `newHand()`, widened `newGame()`, two new props on `<Table>`). `just check` clean.
6. **Fixture fix** — `app.ssr.test.ts`'s one `App`-rendering block now builds its comparison
   `table` via `handSeedOf(BOOT_SEED, 0)` instead of the raw seed (research.md §6/§7 — the only
   assertion Step 5's per-hand seed derivation invalidated). Full suite green again after this.
7-8. **`app.controls.svelte.test.ts`** (NEW) — the generic `driveToHandEnd` helper plus click
   assertions for both controls, fake-timer-driven against a real mounted `App`. Passed on the
   first run (no iteration needed on the timer-driving pattern — `flushSync()` after every
   `vi.advanceTimersByTimeAsync`/click was sufficient; no `Promise.resolve()` wrapping needed).
9. **`just check`** and **`just test`** — both clean. **`npm run build`** also run as an extra
   gate (not in the original plan, added because this ticket touches `App.svelte` heavily) —
   `dist/index.html` builds and self-file-verifies at 93KB.

## Deviation from plan.md — `seatScoresOf` promoted to an exported `drive.ts` function

plan.md/design.md originally scoped the Player→Seat score remap as an inline `App.svelte`
`$derived` array literal. While writing Step 7's integration test it became clear this remap is
the ONLY place `game.dealer`'s rotation is user-visible at all under design.md Decision 2's scope
(Table's wind labels are fixed to engine Seat, never to a persistent Player — they never move).
An inline expression would have been provable only through the slow, imprecise full-App
mount-and-drive test. Moved it to `drive.ts` as `seatScoresOf(scores, dealer)`, exported and
covered by three exact, fast unit tests in `drive.test.ts` (identity at dealer=0, the rotated
remap by hand, and a permutation/conservation property over all four dealer values). `App.svelte`
now calls `seatScoresOf(game.scores, game.dealer)`. design.md's Decision 3 updated in place with
this revision noted. No other plan.md step changed; step numbering/verification is otherwise as
written.

## Not done / consciously out of scope

- No `src/core/` changes (confirmed — `game.ts` stays untouched, no new exports).
- No visual seat-rotation (design.md Decision 2, deliberate scope cut — flagged in review.md).
- No live `just dev` click-through in a real browser (this sandbox has none available) — the
  `app.controls.svelte.test.ts` mount-driven test exercises the identical `App.svelte` source
  through real DOM events and real `$effect` scheduling, which is the closest available substitute
  and is noted as such in review.md.

## Test tallies

Before this ticket: 31 test files, 798 tests, all green. After: 33 test files (+2 new),
812 tests (+14: 3 SSR override/visibility cases in `app.ssr.test.ts`'s hand-end/ryuukyoku/playing
blocks, 3 `seatScoresOf` cases in `drive.test.ts`, 3 click cases in `hand-end.tap.svelte.test.ts`,
3 integration cases in `app.controls.svelte.test.ts` — plus fixture-only changes to the existing
`dealt-table view` block, no count change there). `just check`: 0 errors, 0 warnings. `npm run
build`: green, single-file output verified.
