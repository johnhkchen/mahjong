# Review — T-009-01-02 riichi-yaku-family-and-uradora

## 1. Summary

Prices the riichi declaration mechanic's yaku consequences end to end through
the E-008 han/settlement pipeline: riichi (1 han), double riichi (2 han,
declared on the seat's first uninterrupted discard), ippatsu (1 han, won within
one uninterrupted go-around — any call kills it), and ura-dora (the under-
indicators, flipped on a riichi win per the frozen dead-wall layout, counted
like ordinary dora but priced as a separate number). Builds entirely on
T-009-01-01's riichi declaration/lock/stick mechanic — this ticket adds no new
`HandAction`, only pricing and the fold-time tracking pricing needs.

Four commits, each independently green (`just test` + `just check`):

1. `cb2a73a` — the yaku family added to `yaku.ts`/`yakuman.ts`/`han.ts`, fully
   catalog-complete and priced, but unreachable from any real fold (the three
   production `Win`-assembly sites carry inert placeholders). Every hand-built
   `WinContext`/`Win` fixture across the existing suite updated to default
   `riichi: 'none', ippatsu: false` — a pure, behavior-preserving widening.
2. `c591c47` — `TableState` gains `doubleRiichi`/`ippatsu`/`uraDoraIndicators`/
   `uradora`; fold-time mutation wired at every point design.md named
   (`applyRiichi`, `applyClaim`, the shared `applyKanTail`, the locked-seat arm
   of the ordinary `discard` case); `record.ts`'s two `Win`-assembly sites
   (`applyWinTail`, and the concurrent T-009-01-03 thread's `completesWithYaku`)
   wired for real via a new shared `riichiStatusOf` helper. Nine new mined-seed
   fixtures in `record.test.ts`.
3. `2b7f06b` — `legal.ts`'s `winYaku` wired for real via its own
   `riichiStatusOf` restatement; one confirmation fixture proving the
   offer/fold agreement still holds at a real riichi win.
4. `de1dd64` — `settlement.ts`'s `winOf` wired for real; `PricedReading`/
   `ScoreBreakdown` gain a separate `uraDoraHan` field (never merged into
   `doraHan`); six new fixtures in `settlement.test.ts` pinning the AC's own
   numbers directly, plus one pre-existing T-009-01-01 fixture corrected (see
   §3).

Planned commit 5 (a confirmation re-run pass) found nothing to fix: the full
suite passed 863/863 three consecutive times after the concurrent T-009-01-03
thread landed its own work.

## 2. Files changed

Core only (`src/core/`), no `src/app/` touched, matching the epic's own
established scope discipline:

- **`yaku.ts`** — `RiichiStatus` type, two new `WinContext` fields, three new
  `YakuName` catalog entries + predicates + table rows.
- **`yakuman.ts`** — `Win` widened to match, `yakuOf`'s per-reading spread
  threads the two new fields.
- **`han.ts`** — three new `YAKU_HAN` rows.
- **`record.ts`** — `TableState.doubleRiichi`/`ippatsu`/`uraDoraIndicators`/
  `uradora`; fold-time mutation in `applyRiichi`/`applyClaim`/`applyKanTail`/
  the `discard` case; a new shared `riichiStatusOf` helper; both local
  `Win`-assembly sites wired for real.
- **`legal.ts`** — its own `riichiStatusOf` restatement; `winYaku` wired.
- **`settlement.ts`** — its own `riichiStatusOf` restatement; `winOf` wired;
  `PricedReading`/`pricedReadingCandidatesOf`/`bestReadingOf`/`bestBaseOf` gain
  a second dora-kind-list parameter; `ScoreBreakdown` gains `uraDoraHan`.
- Test files widened: `yaku.test.ts`, `fu.test.ts`, `han.test.ts`,
  `yakuman.test.ts`, `legal.win.test.ts`, `settlement.property.test.ts`,
  `record.test.ts`, `settlement.test.ts`, `seatview.fairplay.test.ts` (the last
  only for the four new `TableState` fields' default-value plumbing — no new
  assertions). No new files.

`docs/active/work/T-009-01-02/` holds all six phase artifacts.

**Interleaving note (a live concurrent session, not this ticket's own work):**
this session ran alongside another thread actively implementing T-009-01-03
(furiten) in the same files (`record.ts`, `legal.ts`, `legal.win.test.ts`,
`record.test.ts`) in real time. Commits 1-4 above necessarily bundle some of
that thread's uncommitted-at-the-time work where the two tickets' changes fell
inside the same function bodies or file (documented inline in each commit
message, and in progress.md as it happened) — never separable by hunk, per the
same precedent T-009-01-01's own review.md set for `settlement.ts`/T-008-03-01.
Commit 4 deliberately EXCLUDED that thread's still-uncommitted `record.test.ts`
additions at the time (left untouched in the working tree); the thread
committed them itself afterward (`4c74292`), cleanly, with no conflict.

## 3. Notable deviations from Design/Structure (documented live in progress.md)

- **The "double riichi negative: a call already folded" fixture could not be
  isolated to a single variable.** Every seed found in an extensive mining
  search (~10k attempts across several strategies) that had a call precede a
  closed seat's declare ALSO failed the pond-emptiness condition
  simultaneously. Not a coverage gap in effect — `applyRiichi`'s
  `double = isFirstDiscard && noCallsYet` expression has `isFirstDiscard`
  proven false-blocking independently by a clean seed-18 fixture — but flagged
  per plan.md's own fallback allowance rather than silently accepted.
- **"Ippatsu ron" is keyed to the DECLARING seat's own win**, never a
  bystander's — plan.md's draft phrasing ("a third seat wins") was imprecise;
  the design itself (`WinContext.ippatsu` keyed to the winner) was already
  correct. The mined seed-100 fixture proves exactly this AND happens to prove
  double-riichi + ippatsu stacking in the same real win — kept as one fixture
  since it is strictly stronger evidence than the two separate ones plan.md
  originally scoped.
- **One pre-existing T-009-01-01 fixture broke and was corrected**, not
  patched around: `settlement.test.ts`'s "riichi sticks and the pot" ron test
  reused a winner who happened to also be the riichi'd seat — that win now
  correctly carries the `'riichi'` yaku it always should have (the fixture's
  own header comment says it never intended to test han/fu). Recomputed by
  hand (4han/30fu/7700 → 5han/mangan/8000) and documented inline.

## 4. Test coverage

- **`yaku.ts`/`yakuman.ts`/`han.ts`**: the catalog's own table-driven per-yaku
  sweep (`yaku.test.ts`) gained three rows (positive + near-miss negative
  each, plus one adversarial case pinning `ippatsu`'s predicate is exactly
  `ctx.ippatsu`, nothing more); `han.test.ts`'s independently-spelled expected
  table gained the same three names.
- **`record.ts`**: nine real mined-seed fixtures (a throwaway `tsx` scratchpad
  script, never committed, per this file's own established discipline — never
  a hand-built `TableState`): double riichi's first-discard/no-call gate
  (positive + two negative angles), ippatsu's open/close transitions (own-turn
  passing and any-call breaking it, including a THIRD seat's call breaking a
  different seat's window), two full win-tail fixtures (plain riichi+ippatsu
  tsumo; double-riichi+ippatsu ron), and ura-dora indicator capture
  cross-checked against the RAW pre-fold wall (never `state.dead`, which has
  already been shifted) for both the initial flip and a kan flip.
- **`legal.ts`**: one confirmation fixture reusing the double-riichi+ippatsu
  ron anchor, proving `legalActions` still offers the win before it folds.
- **`settlement.ts`**: six fixtures directly pinning the AC's own sentence —
  plain riichi (+1 han → mangan tier), double riichi (+2 han → haneman, and
  `'riichi'` never co-fires), riichi+ippatsu stacking (same haneman total via
  a different yaku path — a nice cross-check), ura-dora gated on riichi status
  and priced as a number separate from ordinary dora, the SAME gate proven
  closed for a non-riichi win even with `uradora` populated, and a full
  pot-inclusive zero-sum-plus-pot regression with all three effects folded
  into one real payment.
- **Regression**: the full suite (`selfplay.test.ts`, `dynamics.test.ts`,
  `game.dynamics.test.ts`, `policy.test.ts`, `purity.test.ts`,
  `settlement.property.test.ts` — all unseeded property suites) run to green
  three consecutive times as the confirmation pass, after the concurrent
  thread's own work landed.

## 5. Open concerns / known gaps

- **The isolated "call-before-first-discard" double-riichi negative is
  missing** (§3) — low risk (the underlying boolean expression's two clauses
  are each independently exercised, just never in true isolation from each
  other in one fixture), flagged rather than silently skipped.
- **`SeatView` does not expose `uraDoraIndicators`/`uradora`** — a deliberate
  design decision (design.md Decision 5), not an oversight: real riichi keeps
  ura-dora hidden until a winning riichi hand reveals it, and `seatview.ts`'s
  own header already names this exact widening as a future, extend-only step,
  not something to do reflexively. No AC clause needs it; the fair-play
  boundary this ticket would otherwise have to re-audit stays untouched.
- **No fold-time guard exists preventing a locked seat from folding a call
  directly** (bypassing `legal.ts`'s own offer-withholding) — pre-existing
  T-009-01-01 scope, not this ticket's to fix, and noted in design.md Decision
  6 as an explicit non-goal to keep this diff scoped to pricing.
- **T-009-01-04 (the dedicated riichi property suite)** is the next ticket in
  this epic and depends on this one — it can now exercise riichi/double-riichi/
  ippatsu/ura-dora pricing over randomized play, which this ticket's fixtures
  intentionally do not attempt (mined, directed scenarios only, per this
  codebase's established per-mechanic-ticket convention).
- **T-009-01-03 (furiten)**, a sibling ticket sharing `record.ts`/`legal.ts`,
  was implemented concurrently in the same session by a different thread and
  is now fully committed (`4c74292`) — no missing-dependency-edge conflict
  materialized (both tickets' changes compose cleanly: furiten's
  `completesWithYaku` now correctly reads a locked seat's real riichi status
  via this ticket's `riichiStatusOf`, which matters for correctness — a riichi
  seat's otherwise-yaku-less hand still has a yaku by virtue of the riichi
  declaration itself, so a passed win must still seal furiten for it).
