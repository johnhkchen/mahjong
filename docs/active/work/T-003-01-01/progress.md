# T-003-01-01 — Progress

Tracking against plan.md. All steps complete.

## Step log

- [x] **Step 0 — Baseline**: `just test` (53 tests) and `just check` green on a clean
  tree before any change.
- [x] **Step 1 — Widen the contract types** (commit `c637802`):
  `HandAction` replaced `never` with the seat-tagged draw/discard union + contract-
  freeze doc comment; `TableState` grew `ponds`/`turn`/`drawn`/`phase` with their
  load-bearing doc comments; `foldRecord` returns the post-deal values
  (`ponds: [[],[],[],[]]`, `turn: 0`, `drawn: null`, `phase: 'playing'`); the
  explicit-composition property learned the four new expected fields. The old
  non-empty-log guard was left in place for this step, per plan. Test + check green.
- [x] **Step 2 — The step function** (commit `420509a`): module-private
  `applyAction(state, action, index)` with the full check order (phase → unknown-type
  default → seat-vs-turn → draw arm with out-of-sequence + empty-live guards →
  discard arm with undrawn guard, tsumogiri vs tedashi end-append, pond push,
  ryuukyoku-or-advance); `foldRecord`'s guard replaced by the `forEach` application
  loop; fold + step doc comments rewritten; old test 6 ("rejects non-empty log")
  deleted, its corrupt-cast idiom earmarked for Step 4. Test (52) + check green.
- [x] **Step 3 — Helpers + happy-path suite** (commit `b23439f`): helpers
  `dealtLive`, `tsumogiriRecord`, `maximalRecord`, `FULL_TURNS = LIVE_WALL_SIZE -
  DEAL_SIZE`, `turnsArb`; new describe "draw/discard step" with 6 tests (interleaved
  tsumogiri property, dangling-draw property, tedashi example on frozen seed-1
  literals, maximal-record ryuukyoku property incl. 18/18/17/17 pond split,
  exactly-when boundary property, non-empty determinism/freshness); existing tests
  extended per structure — freshness (+ponds), non-mutation (property now folds
  mid-hand records, snapshot via `structuredClone`), conservation (hands + ponds +
  drawn + live + dead = 136 over prefixes, with an optional dangling draw). Test
  (58) + check green.
- [x] **Step 4 — Throw matrix** (commit for this step): new describe "illegal actions
  throw instead of folding silently" with 9 tests: wrong-seat draw, wrong-seat
  discard, draw-after-draw, discard-before-draw, discard of another seat's tile,
  discard of a live-wall tile, discard of an already-ponded tile, draw AND discard
  after ryuukyoku, unknown action type (corrupt cast, at deal and mid-hand). Each
  asserts `RangeError` plus a message fragment. Test (67) + check green.
- [x] **Step 5 — Whole-repo confirmation**: `just test` 67/67, `just check` 0 errors
  0 warnings, `just build` single-file gate OK (dist/index.html self-contained,
  40.5 kB). No app changes were needed — TableState growth was additive, as designed.

## Deviations from plan

- None of substance. Two additions beyond the plan's literal list: the throw matrix
  gained a "discard of an already-ponded tile" case (falls out of the
  discard-before-draw guard — worth pinning) and the unknown-type case is asserted
  both at the deal and mid-hand. The plan's "tile that sits in live" case used
  live[1] (South's upcoming draw) as the concrete tile.
- Test counts: 53 baseline → 67 final (−1 deleted, +6 happy-path, +9 throw matrix).

## Acceptance criteria status

- (a) interleaved draw/discard folds yield expected ponds, turn pointer, drawn tile —
  **covered** (interleaved/dangling/tedashi tests, property + example).
- (b) draining record folds to ryuukyoku exactly when live is empty — **covered**
  (maximal-record + exactly-when boundary properties).
- (c) wrong-seat / tile-not-in-hand / draw-out-of-sequence throw loudly — **covered**
  (9-case throw matrix).
- `just test` green — **yes, 67/67**.
