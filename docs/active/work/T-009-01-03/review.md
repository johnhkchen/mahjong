# Review: T-009-01-03 furiten-completion

## Summary

Completes furiten per `legal.ts`'s own deferral: temporary furiten (a passed
winning discard seals ron until the seat's own next draw) and riichi furiten
(the same pass while locked seals ron for the rest of the hand), both derived
purely from the fold — no new `HandAction` was added; the log still records no
"pass," the fact is reconstructed forward as the record is folded.

## Files changed

- **`src/core/record.ts`**
  - `TableState` gains `tempFuriten`/`riichiFuriten` (Seat-indexed booleans),
    initialized false in `foldRecord`.
  - New private helpers: `completesWithYaku` (isAgari-gated, then `yakuOf` —
    this module's own restatement of legal.ts's `winYaku`, per both modules'
    documented independence doctrine) and `sealPassedWins` (loops the three
    non-discarder seats, seals `tempFuriten` always and `riichiFuriten` when
    already locked).
  - `sealPassedWins` is called from the three places a claim window closes
    WITHOUT that window's ron: `applyAction`'s `'draw'` case, `applyClaim`,
    `applyDaiminkan` — never from `applyRon` (a taken ron ends the hand; the
    fields are never consulted again) and never at discard time (see below).
  - `clearTempFuriten` (a small fresh-array-copy helper, the `applyRiichi`
    idiom) is called at both of a seat's own "draw" sites: the ordinary wall
    draw and `applyKanTail`'s rinshan draw.
- **`src/core/legal.ts`**
  - `ronOffers`'s furiten gate now ORs `discardFuriten(state, seat)` (unchanged,
    self-pond, on-the-fly) with `state.tempFuriten[seat]` and
    `state.riichiFuriten[seat]` (fold-tracked, read straight off state).
  - Module header, `discardFuriten`, and `ronOffers` doc-comments updated to
    describe the extended three-way gate; the furiten-divergence property
    (offered narrower than folds) explicitly now covers all three kinds —
    `applyRon` was not touched, so the divergence is unchanged in nature.
- **`src/core/record.test.ts`** — new `describe('furiten tracking
  (T-009-01-03)', ...)`: fold-level set/clear/permanence assertions (see
  Test coverage below).
- **`src/core/legal.win.test.ts`** — `ronGates` oracle extended; new
  `describe('temporary and riichi furiten (T-009-01-03)', ...)`.

No files were created or deleted. `SeatView`/`seatview.ts` and any app-layer
surface were intentionally left untouched — out of scope per this ticket's ACs
(a future hints/UI ticket would decide whether/how to surface furiten status).

## A real bug found and fixed during implementation

The first working version sealed furiten at DISCARD time (inside
`performDiscard`), reasoning that "if the very next action is that seat's own
ron, it doesn't matter — the hand ends." That reasoning was wrong: `legalActions`
is queried on the state immediately after the discard, BEFORE any decision is
made — sealing there gates the very ron offer the seat had not yet been given a
chance to take. Running the full suite caught this immediately: `selfplay.test.ts`
lost all ron wins, and several other suites broke. Fixed by moving the seal to
the three places a window actually CLOSES without a ron (see Files changed).
A second, related bug surfaced fixing the first: sealing from `applyClaim`/
`applyDaiminkan` AFTER the claiming seat's hand was already spliced for the new
meld corrupted the completion probe (`decomposeAgari` threw wrong-arity errors).
Fixed by moving the seal call before the hand-mutating splice in both functions.
Both are exactly the kind of ordering bug the ticket's "derived from the fold"
framing makes easy to get wrong on a first pass — worth a careful look in
review, though the regression-guard test (record.test.ts's "vacuous case" test,
using the coexistence-window seed) now pins the corrected behavior directly.

## Test coverage

- **`record.test.ts`** (fold-level, direct `TableState` field assertions):
  non-vacuous seal/persist/clear (seed 3951, reusing legal.win.test.ts's own
  RON_SEED geometry), determinism (re-fold twice, identical arrays), the
  vacuous immediate-next-actor case (seed 4851 / COEXIST_SEED — doubles as the
  regression guard for the discard-time bug), and riichi furiten's permanent
  seal surviving the locked seat's own next draw (seed 100, extending the
  existing `RIICHI_SEED` riichi-declaration fixture).
- **`legal.win.test.ts`** (offer-level, `legalActions`/`ronOffers`): the same
  RON_SEED pass withholds `ron` for the sealed seat through the sealed span;
  `tsumoOffer`'s total absence of a furiten gate (via one synthetic-state
  override — no natural fixture combines a permanent seal with a later tsumo
  point for this suite's existing anchors, so the property is checked directly
  against the pure function); the riichi-permanent-vs-temp-clears contrast.
  The pre-existing "two-sided win partition" property test's `ronGates` oracle
  now reads the two fold-tracked fields directly (their only authority — see
  record.ts's own doc-comments on why they can't be independently recomputed
  from a snapshot) — this test's random sweep over many seeds/turns is the
  broadest check that `ronOffers` composes all three furiten kinds correctly,
  well beyond the hand-picked fixtures above.

## Gaps / known limitations

- No fixture exercises a "genuine second matching discard while sealed" (i.e.,
  a real seed where, after a seat is sealed, a LATER discard before its own
  next draw ALSO completes its hand — the clearest possible demonstration of
  `ronOffers` withholding an otherwise-live ron). Two scratchpad mining passes
  (tens of thousands of seeds, tsumogiri-only) never turned one up cheaply
  within a reasonable time budget; the property test's random sweep is relied
  on for that specific sub-case instead of a pinned fixture. If a future ticket
  needs this exact shape (e.g. a defense/hints feature), it's worth a longer
  mining run or a purpose-built hand-constructed fixture.
- `completesWithYaku`/`sealPassedWins` do not seal anything on the ryuukyoku
  houtei arm's final discard (no window is ever opened there) — this is
  intentional (the hand ends with or without a houtei ron either way, so no
  future `legalActions` call could ever observe a stale seal), documented in
  research.md/design.md, not re-litigated here.
- This ticket's work landed interleaved with a concurrently running
  T-009-01-02 (riichi-yaku-family-and-uradora) thread sharing the same working
  tree (Lisa's documented concurrency model). `legal.ts`/`record.ts`/
  `legal.win.test.ts` ended up committed under that ticket's own commits
  (verified content-correct after each, via `just check` + `just test`); only
  `record.test.ts` needed a commit from this thread directly. Nothing to
  action — noted for traceability when reading git history.

## Critical issues for human attention

None. Full suite green (`just test`: 33 files / 863 tests), `just check` clean.
