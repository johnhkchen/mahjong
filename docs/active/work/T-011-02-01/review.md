# Review — T-011-02-01: window-outcome-notice

## What changed

**New files:**
- `src/app/WindowNotice.svelte` (37 lines) — the outcome notice itself: a pure
  presentational component naming the winner (`windTerm`) and both call types
  (`callTerm`), `role="status"`, no input wiring.
- `src/app/window-outcome-notice.tap.svelte.test.ts` (≈220 lines) — interactive
  coverage for the two AC conditions the existing race fixture couldn't cover in
  its own walk (see below): "never when passed" and "never when it wins."

**Modified:**
- `src/app/drive.ts` — added `CallType`, `WindowOutcome`, `windowOutcome()` (the
  one comparison: reference-equality between what the player tapped and what
  `settleWindow` actually pushed).
- `src/app/dictionary.svelte.ts` — added `callTerm()`, promoted from
  `ClaimPrompt.svelte`'s previously-private `callName`.
- `src/app/ClaimPrompt.svelte` — refactored to use the shared `callTerm()`;
  verified byte-identical rendered output (existing suites unchanged, still
  green).
- `src/app/App.svelte` — `notice` state, `NOTICE_DURATION_MS = 2000` auto-dismiss
  effect, `windowOutcome()` wired into `claim()`/`takeWin()`, explicit
  `notice = null` in `pass()`/`newHand()`/`newGame()`, and the new
  `{:else if notice !== null}` cascade tier with a documenting comment.
- `src/app/drive.test.ts` — four new unit tests for `windowOutcome()`.
- `src/app/app.terminology.coverage.ssr.test.ts` — two new cases rendering
  `WindowNotice` directly under both terminologies.
- `src/app/claim-window-race.tap.svelte.test.ts` (T-011-01-01's file) — flipped
  the `// DEFECT:` "no notice" marker to assert the notice's presence and exact
  content, plus one appended assertion proving cascade preemption.

No `src/core/` changes. No new runtime dependencies. `npm run build` verified:
single self-contained `dist/index.html`, 106KB, well under the size gate.

## Test coverage

- **Pure-function (`drive.test.ts`)**: `windowOutcome` against the seed-3 race
  (loss → correct winner/types), seed-15 window (win → null), the tsumo point
  (win → null, the "tsumo never loses" invariant), and a defensive
  `settled === null` case. All reuse fixtures already frozen in that file — no
  new mining at this layer.
- **Terminology (`app.terminology.coverage.ssr.test.ts`)**: `WindowNotice`
  rendered directly with hand-built outcomes under both `romaji`/`zh-hant`,
  covering a chi-loses-to-pon case and a daiminkan-named-as-kan case.
- **Interactive, the loss case (`claim-window-race.tap.svelte.test.ts`)**: the
  real mounted `App`, real taps, the mixed pon/chi race (seed 344) — asserts the
  notice's exact content after the loss, AND that the reopened second window's
  claim prompt (not the still-logically-live notice) is what renders 750ms
  later — the cascade-priority proof, riding the existing fixture's own timing
  against `NOTICE_DURATION_MS`'s deliberately-longer 2000ms.
- **Interactive, the passed case (`window-outcome-notice.tap.svelte.test.ts`)**:
  same seed-344 fixture, alternate branch — taps "pass" instead of the chi, the
  window still resolves to West's pon, no notice appears.
- **Interactive, the wins case (same new file)**: a freshly-mined tsumo fixture
  (game seed 2654435389, core seed 396) driven by a generic step-driver
  (houtei-dismissal.tap.svelte.test.ts's own pattern) to an uncontested tsumo;
  asserts no notice before OR after taking it.
- **Full suite**: `npm test` — 40 files, 948 tests, green. `npm run check` —
  svelte-check + tsc, 0 errors/warnings.

## Critical issue for human attention

**A real, pre-existing, out-of-scope crash bug was discovered while mining the
interactive "wins" fixture.** `src/core/legal.ts`'s `furitenSeal`/`waits` assume
a seat's hand is always in the classic 13-tile-equivalent shape
(`concealed === 13 - 3*melds`). The instant a seat's OWN chi/pon/daiminkan
lands, that seat sits in `TableState.mustDiscard` — a real, ordinary
14-tile-equivalent shape (11 concealed + 1 meld, owing exactly one discard) —
and `waits()` throws (`RangeError: waits requires 10 concealed tiles with 1
melds, got 11`). `App.svelte`'s `furitenTile = $derived(furitenSeal(table,
PLAYER))` is unconditional on every render, so **the live app crashes the
instant the player successfully calls chi, pon, or daiminkan** (not merely
loses a window — an ordinary, successful claim). No existing test suite (before
or after this ticket) drives a player's own successful claim through the
mounted `App`, which is why this has never surfaced. Reproduction: mount `App`
at game seed `2654435561` (the existing race fixture), drive to its second
window (chi on 2s), tap the chi button instead of declining — the mount throws
immediately. This is out of this ticket's scope (E-011 is view/drive-only; the
fix belongs in `src/core/legal.ts`, most likely gating `furitenSeal` on
`!state.mustDiscard` or having callers skip the call while a claim discard is
owed) and was NOT fixed here. **This should become its own ticket before the
next real playtest**, since it is trivially reachable by any player who
successfully calls a tile.

## Other open concerns

1. **`NOTICE_DURATION_MS = 2000` is this ticket's own judgment call**, not
   specified by the ticket or epic beyond "a readable beat." Chosen to
   comfortably exceed the existing race fixture's 750ms reopen gap so that
   fixture doubles as a cascade-priority proof (design.md). If a human reviewer
   wants a different feel (shorter/longer), it's a one-line change with no
   structural consequence — nothing else depends on the exact value beyond that
   750ms floor.
2. **The per-hand resets (`notice = null` in `newHand()`/`newGame()`) are
   untested directly.** They mirror `dismissed`'s own precedent (the exact bug
   class T-011-01-01(c) regression-tested) defensively, but no existing fixture
   ends a hand immediately after a lost claim to exercise the reset itself. Low
   risk (the code path is a one-line mirror of an already-proven pattern), but
   worth a human's awareness if a future ticket wants dedicated coverage.
3. **`windowOutcome`'s ron-loses-to-a-bot's-ron (atamahane) path is exercised by
   the same logic as the tested chi/pon-loses-to-pon path, but not by a
   dedicated fixture.** `isCallType`/the reference-equality check don't
   special-case call type, so this is low-risk, but no test names it directly —
   noted in design.md as a deliberate scope call, not an oversight.
4. **Concurrent-thread footprint.** T-011-02-02 (fresh-prompt-beat) was
   implemented and fully committed in the same working tree partway through
   this ticket's Implement phase. This ticket's diff to `App.svelte`/
   `ClaimPrompt.svelte`/`claim-window-race.tap.svelte.test.ts` is layered
   correctly on top of that committed baseline (verified via `git diff`/
   `git status` at each step), but a human reviewer diffing this ticket's
   commits in isolation should know the console cascade and `ClaimPrompt`'s CSS
   both carry T-011-02-02's changes too, not introduced here.

## Nothing else critical is outstanding

No TODOs, no `.skip`/`.todo`, no known-failing assertions in this ticket's own
scope. `just test` and `just check` are both green, and the production build
succeeds under the size gate. The ticket's Acceptance Criterion is met: the
notice names the winner's seat and claim type (both terminologies), appears
exactly when the player's tapped answer loses, never when it wins or when the
player passes, and the four-tier console cascade is both documented (in
`App.svelte`) and tested (the cascade-preemption assertion). The one critical
item for a human is the out-of-scope `furitenSeal`/`waits` crash flagged above.
