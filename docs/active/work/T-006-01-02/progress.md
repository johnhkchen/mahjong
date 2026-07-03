# T-006-01-02 fair-play-property-tests — Progress

## Baseline

`just test` green before work: 19 files, 466 tests (2.5s).

## Step 1 — Scaffold: sources, surgery, guard suite ✅

Commit `c452d2a` — `src/core/seatview.fairplay.test.ts` created with:
- replicas (origin-cited): `dealtLive`/`tsumogiriRecord`/`foldedState`
  (seatview.test.ts), `isCall`/`isWin`/`ACTION_BOUND`/`playGreedy`/`playWinEager`/
  `allZones` (dynamics.test.ts), `exposedTileIds` (seatview.test.ts);
- corpora: greedy seeds [0, 1, 2, 63, 67, 69], win carriers
  [100, 277, 360, 626, 731, 834, 876, 950] (dynamics' frozen anchors);
- surgery: `copyState`, `collectHidden`/`writeHidden` (one frozen slot order),
  `rotatedSibling`, `shuffledSibling`; `publicIds` for the inclusion side;
- guard suite (4 tests): corpus covers all five call forms + both win forms;
  siblings conserve 136 distinct ids; public part untouched; rotation changes
  every hidden slot, pools ≥ 2.

**Deviation from plan (small, documented in code):** `collectHidden` excludes
`drawn` from the hidden pool when `win !== null` — a tsumo win DISCLOSES the drawn
tile (win.tile names it), so at agari the drawn slot is public. Plan's pool
definition said "drawn iff turn ≠ s"; that is correct only while `win === null`.
Captured as `drawnHiddenFrom()` with rationale comment. Without it the mutant would
differ in a publicly announced tile, violating "differ only in hidden tiles".

Verify: new suite green (4 tests), full run 20 files / 470 tests green.

## Step 2 — Equivalence property ✅

Commit `75bae1d` — two tests:
- fc breadth: seed × turns × dangle × seat × permSeed over tsumogiri folds;
  rotated + shuffled siblings both `.toEqual` the original view.
- corpus depth: every prefix × every seat × rotation + 2 frozen shuffle seeds over
  all 14 corpus games (melds, kans, kan-dora, rinshan-shortened walls, agari).

**Teeth check (per plan, not committed):** temporarily changed seatview.ts to leak
`drawn` unconditionally (`drawn: state.drawn`) — the equivalence property failed
after 4 fc runs and the corpus sweep failed; reverted via `git checkout`, suite
green again. The property detects a real hidden-state leak.

## Step 3 — Inclusion property + budget ✅

Commit `fdba0df` — three tests: fc tsumogiri domain; every prefix × every seat over
both corpora; agari finals with the non-vacuity pin (`state.win` non-null for every
carrier, `view.win` shared reference, win.tile inside the public set).

`just check` green (svelte-check 0 errors, tsc clean).

**Deviation from plan (perf lever, different from the planned one):** the file
initially ran 3.45s — over the ~2s budget — dominated by the inclusion corpus sweep
(2.6s of per-tile `expect()` overhead, ~470k assertions). Instead of the planned
strided-prefix lever (which drops coverage), rewrote `expectIncluded` to collect
violations and assert once per (state, seat). Commit `7622939`: 2.6s → 0.13s, file
now 1.0s total, **every prefix kept in both sweeps**. The stride lever was never
needed.

## Final state

- `just test`: 20 files, 475 tests, all green (new suite: 9 tests, ~1.0s).
- `just check`: 0 errors, 0 warnings.
- Commits: c452d2a, 75bae1d, fdba0df, 7622939 (all touching only the new test file).
- No runtime code changed; no leak found in seatView (expected — the teeth check
  proves the property would have caught one).
