# Review — T-008-03-02 next-hand-new-game-controls

Self-assessment and handoff. What a human reviewer needs without reading every diff.

## What changed

| File | Change |
|---|---|
| `src/app/App.svelte` | State model rewritten: `seed`/`actions` → `gameSeed`/`hands: HandAction[][]` (a real `GameRecord`). `table`/`offered` now derive through `foldGame`, not `foldRecord` directly. New `seatScores` derive, `activeHand()` helper, `newHand()`, widened `newGame()`. `<Table>` gets two new props. |
| `src/app/Table.svelte` | Additive only: two new optional props (`scores`, `onnext`), forwarded to `<HandEnd>`. No other line changed. |
| `src/app/HandEnd.svelte` | Additive: `scores`/`onnext` optional props, `displayScores` fallback, a `.next-hand` button + CSS. |
| `src/app/drive.ts` | One new exported pure function, `seatScoresOf(scores, dealer)` — the Player→Seat score remap (see Deviation, progress.md). |
| `src/app/app.ssr.test.ts` | One fixture fixed (`handSeedOf(BOOT_SEED, 0)`), five new SSR cases. |
| `src/app/drive.test.ts` | Three new `seatScoresOf` unit cases. |
| `src/app/hand-end.tap.svelte.test.ts` | NEW — mount/click coverage for the button's wiring. |
| `src/app/app.controls.svelte.test.ts` | NEW — fake-timer-driven, full-`App`-mounted coverage of both controls end to end. |

No `src/core/` file touched. No ticket/story frontmatter touched (Lisa's own domain, per the
task instructions this ticket ran under).

## Test coverage

798 → 812 tests, 31 → 33 files, all green (`just test`). `just check` (svelte-check + tsc): 0
errors/warnings. `npm run build`: green, `dist/index.html` self-file-verified.

- **Fast/pure**: `seatScoresOf`'s three cases prove the ONE user-visible consequence of
  `game.dealer`'s rotation (research.md/design.md — Table's wind labels never move under this
  ticket's scope, so the score remap is the only place a wrong dealer value could surface) —
  identity at dealer 0, a hand-verified rotated remap, and a permutation/conservation property
  over every dealer value.
- **SSR**: prop-forwarding and fallback-vs-override behavior for `scores`/`onnext`, both hand-end
  screens (agari, ryuukyoku), and the playing-state negative case.
- **Mount, no timers**: the button's click reaches `onnext` through `Table`'s forwarding.
- **Mount, fake timers, full App**: the AC's own literal scenario — "from a won or drawn hand in
  `just dev`" — driven through a real `App` via a GENERIC decline/tsumogiri/take-any-win policy
  (legal at every pause `forcedAction` can produce, so it needs no offline seed-mining and is
  robust to future core changes to bot behavior). Proves conservation, a real fresh deal after
  "next hand," and a real reset after "new game," including a second full hand-end reached
  post-reset.

## Open concerns for a human reviewer

1. **Named scope cut, not a bug: the interactive seat does not follow a rotating persistent
   Player identity around the table (design.md Decision 2).** The human always plays whichever
   seat is dealt at engine Seat 0 — which is, by `record.ts`'s own frozen convention, always
   THIS hand's dealer. `game.dealer`/`game.scores`/`game.seatWinds` (the `foldGame` machinery)
   correctly track a rotating persistent Player identity underneath, and `seatScoresOf` correctly
   relabels the score DISPLAY through that rotation — but Table's WIND LABELS are fixed to engine
   Seat, not Player, so they never visibly move, and the human is never dealt as a genuine
   non-dealer hand. This is a real, deliberate, and — worth stating plainly — debatable scope cut
   made to keep this ticket to an app-wiring change rather than a four-component seat-rotation UI
   redesign (design.md's Decision 2 lays out the full alternative and why it was deferred, not
   silently dropped). **Recommend a follow-up ticket** deciding whether/how the human's seat
   should track their persistent Player identity — this is squarely a P2 (teachability) question
   (charter.md: "riichi as non-dealer," defense awareness), not a P1 correctness gap, and the AC
   as literally written ("dealer/wind rotated by the game fold") is satisfied by what shipped.
2. **No live browser click-through.** This sandbox has no browser; `app.controls.svelte.test.ts`
   mounts the real `App.svelte` source via `svelte`'s `mount()`/jsdom and drives real DOM click
   events with fake timers standing in for `just dev`'s real 250ms pacing — the closest available
   substitute, but a human should still click through one multi-hand session in `just dev` once,
   per this repo's own established norm (T-008-03-01's `review.md` set this precedent).
3. **`?seed=` boot pin now reproduces a DIFFERENT deal than before this ticket, for the same seed
   number.** Intentional and AC-sanctioned (research.md §7 — hand 0's wall now derives via
   `handSeedOf(gameSeed, 0)` rather than using the raw seed directly, matching `GameRecord`'s own
   contract), but worth flagging explicitly: any bug report or shared `?seed=` link from before
   this ticket no longer reproduces the same hand. No test or code depends on the OLD mapping
   surviving; this is purely a heads-up for anyone who bookmarked a pre-ticket seed link.
4. **`app.controls.svelte.test.ts`'s generic driver always TAKES an offered win rather than ever
   declining one.** This keeps the driver simple and seed-agnostic (any legal choice reaches SOME
   hand end), but means this suite never exercises the "player declines their own ron to keep
   playing" path end-to-end through a real mount — that path is already covered at the `drive.ts`
   level (`drive.test.ts`'s existing `settleWindow`/`forcedAction` suites), just not through this
   NEW integration harness. Not a gap in the AC's coverage, flagged only for completeness.
5. **`seatScoresOf` is a duplicate of `game.ts`'s private `playerOfSeat` formula**, per this
   codebase's own established convention (`windKindOf` already duplicated in `settlement.ts` and
   `game.ts`) rather than widening `game.ts`'s exports. If a THIRD consumer of this exact formula
   ever appears, that would be the natural trigger to promote it to a shared export instead.
