# T-006-02-01 — standard-form-shanten — Progress

Implementation log against plan.md. All steps complete; one recorded deviation.

## Step 1 — module `src/core/shanten.ts` — DONE

Written per structure §2: header charter (block-count formula, arity-only melds,
exhaustion deferred to waits/-03, `shanten` name reserved for -02), type-only
imports, private `countsOf` (third-copy comment), `MAX_MELDS`, the `bestValue`
backtracker, `standardShanten` face. Guard messages exactly as pinned in the plan.

Implementation notes:

- Branch order inside `bestValue`: triplet, run (the +2s), head pair, partial
  pair, adjacent proto-run, gapped proto-run (the +1s), advance last — plan's
  prune-friendly ordering. Early return whenever `best` meets the
  `2·blocksLeft + headFree` upper bound.
- The two same-kind pair branches (head vs partial) share the decrement shape but
  differ in which budget they spend — kept as two explicit blocks rather than a
  loop, matching the house preference for legible branches over clever
  compression (the searchSets style).
- `TENPAI_TILE_COUNT`/`AGARI_TILE_COUNT` named constants mirror waits.ts/agari.ts.

Verified: `just check` — 0 errors, 0 warnings (svelte-check + tsc).

## Step 2 — barrel export — DONE, one merge note

`export * from './shanten'` added after `./waits` in `src/core/index.ts`.

**Concurrency note**: the first Edit attempt failed because a parallel lisa
thread (T-006-01-01, seatview) had landed `export * from './seatview'` in the
barrel between my read and write. Re-read, re-applied; confirmed via git log
that seatview.ts and its barrel line were already committed (79f15aa), so my
commit carries only the shanten line. Exactly the DAG-edge-missing case the
workflow doc names; harmless here — disjoint lines, no semantic overlap.

## Steps 3–5 — test suite `src/core/shanten.test.ts` — DONE

All six describe blocks written (18 tests): complete hands (14-tile winner −1,
4-melds pair −1), tenpai 0 (ryanmen/tanki/shanpon/4-meld tanki/14-tile
containing tenpai), ladders (1-shanten broken-head ryanmen, 2-shanten
three-sets-four-singles, scattered-13 → 8), meld discount (tenpai at 1/2/3/4
melds over shrinking concealed remainders), head-vs-partial tension
(22334455m double-run-with-head → 1; six-pairs standard → 3 pinning the block
cap; triplet-beats-head-split → 1), contract (both arities incl. 0 → −1 on
drawing the wait; both RangeErrors verbatim; 5-melds throw; purity/determinism).

Every expected value derived in the fixture comment as an explicit block
decomposition; the ryanmen/tanki/meld fixtures deliberately echo waits.test.ts
hands whose tenpai status is pinned independently there.

Verified: `just test` — 19 files, 466 tests, all green (466 includes the
parallel threads' suites; the shanten suite is 18 of them). No fixture
disagreed with its derivation on first run — no backtracker debugging was
needed, so the plan's "debug the search, not the fixture" contingency went
unused.

## Step 6 — cross-suite sanity + scope sweep — DONE

- Full unfiltered `just test` green (above) — purity.test.ts accepted the new
  module through its `src/core/*.ts` glob.
- Scope grep over shanten.ts: chiitoi/kokushi appear only in the header's
  pointer to T-006-02-02; no bare `shanten` export; no meld-content reads
  (`own`/`claimed` appear nowhere in code, one incidental comment word).

## Commits

- `db1a388` — `T-006-02-01: standardShanten — the block-count standard-form
  shanten` (module + barrel + full test suite).

**Deviation from plan**: plan preferred two commits (anchors, then the rest) but
allowed folding "if Steps 3–5 complete in one sitting" — they did; the suite was
authored as one file in one pass, and splitting it post-hoc would have staged an
artificial intermediate. One code commit, recorded here.

RDSPI artifacts (research → review) committed separately at Review close, the
T-006-01-01 precedent.

## Remaining

Nothing on the code. Review phase (review.md) closes the ticket's pass.
