# T-006-03-01 — discard-policy — Progress

## Completed

- **Step 1 — `src/core/policy.ts` + barrel export** (`04d1c8c`). The module as
  structured: header doctrine (fair-play-typed, selects from offered, tie-break
  frozen in prose, call-branch deferrals named), `CENTER_RANK`/`HONOR_DISTANCE`,
  `centerDistance`, `shantenAfterDiscard`, and `discardPolicy` with the three
  arms (tsumo → discard-argmin → draw) and the own-turn RangeError.
  `export * from './policy'` added to `src/core/index.ts` after `./legal`.
  `just check` clean; full suite green; purity gate covers the new module.

- **Steps 2+3 — `src/core/policy.test.ts`** (one commit, see deviation below).
  18 tests, all green:
  - test-local `tileSource()` (mpsz parser with cross-call copy allocation),
    `viewOf()` SeatView literal builder, `discardsOf()`, `afterDiscard()` oracle;
  - tsumo arm (2): taken over 14 discards though offered last; other seats'
    tsumo ignored;
  - minimality (3): unique tenpai-restoring discard found; argmin equality on a
    shapeless hand; non-raise vs the pre-draw 13;
  - tie-break (3): honor over middle + earliest honor (1z over 5p/7z); terminal
    over middle + symmetric terminals to offered order (1p over 9p/5s);
    same-kind copies tie to offered order via a curated reversed subset;
  - mustDiscard branch (1): one-meld 11-tile hand, unique tenpai discard (7p);
  - draw arm (2): draw taken over other seats' offers; draw over own pre-draw
    ron pinned as the deliberate T-006-03-02 deferral;
  - contract violations (2): RangeError (+ /own-turn/ message) on
    nothing-for-this-seat and on empty offered;
  - purity/determinism (2): reference-identical repeat result, inputs
    JSON-unchanged; structural-clone inputs → structurally equal action;
  - seeded sweep (3): `playPolicy(seed)` drives whole games by the policy's own
    choices with plain-throw checks at every decision point (membership,
    tsumo-always, discard minimality, post-draw non-raise, ACTION_BOUND
    termination) — corpus seeds 0–11 all end in ryuukyoku/agari; byte-identical
    replay on seeds 0/7/23; fc-sampled seeds (numRuns 6).

Verification: `just test` 501 passed (21 files), `just check` 0 errors.

## Deviations from plan

- **Steps 2 and 3 landed as one commit** — the fixture blocks and the sweep were
  written together and there was no green intermediate state worth splitting;
  the plan's verification criteria were applied to the combined result.
- **Sweep corpus trimmed 30 → 12 seeds, fc numRuns 10 → 6** — the plan's own
  fallback: the first run measured ~150ms/seed (O(n²) prefix refolding + oracle
  re-scoring), 4.5s for the corpus test alone. 12 seeds keeps the suite additive
  cost ≈ 2.5s; per-point assertions untouched. The budget is documented in-test.

## Remains

- review.md (step 4), then the artifacts commit.
