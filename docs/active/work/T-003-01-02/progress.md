# T-003-01-02 — Progress: legal-actions-surface

## Completed

### Step 1 — the surface (commit `6144c32`: "legalActions — closed-form legality surface exported from the core barrel")

- Created `src/core/legal.ts`: `legalActions(state: TableState): HandAction[]` with
  the three closed-form arms (ended → `[]`; pre-draw → the turn seat's single draw;
  post-draw → 13 hand discards in hand order + the drawn tile last) and the full
  contract comments from structure.md (independent-statement framing, purity/
  freshness/order guarantees, reachability note on the always-foldable draw,
  extend-only widening note).
- Appended `export * from './legal'` to `src/core/index.ts` (after `./record`).
- Created `src/core/legal.test.ts` with the step-1 blocks: closed-form completeness
  (pre-draw exact singleton; post-draw exact 14, hand-order-then-drawn, distinct
  tiles), ended-hand-offers-nothing, purity (snapshot deep-equal) and freshness
  (equal-but-not-same arrays and per-index action objects). Test-local helpers
  (`dealtLive` / `tsumogiriRecord` / `maximalRecord` / `prefixArb`) mirror the
  record.test.ts convention: expectations derive from wall → partition → deal, never
  from the code under test.
- Gates: `just test` 72/72 green, `just check` 0 errors / 0 warnings.

### Step 2 — the agreement (commit `9d38ae1`: "agreement suite — every offered action folds, all 548 candidates partition into offered/throws, ryuukyoku offers nothing")

- Soundness property: over `prefixArb` (seed × 0–70 turns × optional dangling draw,
  reaching both action points and the ended state), every action `legalActions`
  returns is accepted by `foldRecord` when appended to the prefix.
- Sampled-negatives property: per folded prefix, one-rule-outside actions —
  wrong-seat draw and discard, out-of-sequence draw (post-draw) / discard
  (pre-draw and ended), and discards of tiles from another seat's hand, the dead
  wall, the live wall (when non-empty), and the seat's own pond (when non-empty) —
  each asserted absent from the offered set AND thrown by the fold as `RangeError`.
- Exhaustive partition example at frozen seed 1: all 548 encodable candidates
  (4 draws + 4 seats × 136 tiles) split exactly into offered ⇒ folds / outside ⇒
  throws `RangeError`, at three anchor states — pre-draw (offered size 1),
  post-draw (14), ended (0).
- Gates: `just test` 75/75 green, `just check` clean, `just build` single-file
  gate OK (40.5 kB, self-contained).

## Remaining

Nothing — both plan steps are done and committed; review.md is next.

## Deviations from plan

- None of substance. The only judgment call: the sampled-negatives property keeps
  all negative shapes in one `it` (plan allowed splitting if fc shrinking got
  noisy — it didn't; the suite runs in well under a second, so the contingency was
  not needed).
