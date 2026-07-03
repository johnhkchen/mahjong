# T-005-02-04 — win-conservation-determinism-suite — Progress

## Completed

- **Step 0 — carrier confirmation (scratchpad):** re-ran the mining scan with the
  final `playWinEager` body (byte-for-byte the committed policy) over seeds
  0..999. Carriers confirmed identical to the research scan:
  [100, 277, 360, 626, 731, 834, 876, 950] — tsumo at 876 (winner 1, tile 81,
  tanyao) and 950 (winner 3, tile 16, tanyao); the six rons carry yakuhai-hatsu,
  yakuhai-round-wind, and tanyao across winners 0/1/2, game lengths 21..161
  actions, several ending mid-wall (live 2..61 — good spread for the identities).
- **Steps 1+2 — suite additions (`src/core/dynamics.test.ts`):**
  - header: two trajectory sources became three (win-eager carrier corpus named);
  - `playWinEager` after `greedyCorpus` — playGreedy's mirror image (wins taken
    eagerly, else uniform index over the full offered set, core rng, same
    ACTION_BOUND trip), doc comment carries the termination argument and the
    division of labor vs playGreedy;
  - `WIN_CARRIER_SEEDS` + `winCorpus` with the freeze comment (mining range,
    tsumo carriers named, never-regenerate, re-mine-on-loud-failure remedy);
  - `describe('wins over random play')` with the four planned tests: end-form
    coverage + end identities; conservation at every prefix through the won
    state; double-fold winner/tile/yaku (and whole-state) equality; two-sided
    quiescence (offered set empty + 9-form × 4-seat append menu through
    `assertMutantThrows`, ron included).
- **Smoke check (plan step 1 verification):** flipping carrier 100 → seed 0 (a
  ryuukyoku seed) fails 3 of the 4 new tests loudly, first assertion
  `expected 'ryuukyoku' to be 'agari'` — the anti-vacuity wiring works;
  conservation alone stays green, correctly (it holds for ryuukyoku games too).
  Reverted before commit.
- **Verification:** `just test` — 407 tests, 19 files, all green (dynamics file
  runtime ~1.4 s, corpus load cost negligible as designed).

## Deviations from plan

1. **One code commit instead of two.** The plan split the describe block across
   commits 1 and 2; the block landed as one cohesive insertion and splitting it
   with hunk-staging would have manufactured an artificial intermediate state.
   All plan-step verifications (including the flip-a-carrier smoke check) were
   still run individually.
2. **`just check` fails — NOT from this ticket's changes.** `svelte-check`
   reports 5 errors, all in `src/core/mine.test.ts` and `src/core/mine2.test.ts`
   — untracked TEMPORARY mining probes ("Deleted after capture") belonging to the
   concurrent T-005-02-03 session, which appeared in the working tree mid-flight
   together with `docs/active/work/T-005-02-03/`. This ticket's file shows zero
   problems in the same run. Left in place — they are another thread's in-flight
   work artifacts; flagged in review.md for the human/lisa to reconcile.

## Remaining

Nothing — review.md is the closing artifact.
