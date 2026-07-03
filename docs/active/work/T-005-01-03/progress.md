# T-005-01-03 — standard-yaku-catalog — Progress

## Completed

- **Step 0 — baseline**: `just test` (236) and `just check` green before starting.
- **Step 1 — types, guards, scan-family predicates** (committed):
  - `src/core/yaku.ts`: YakuName (all 27 literals), STANDARD_YAKU_NAMES (frozen,
    catalog order), WindKind, WinContext (`source` field subsumes tsumo/ron per
    design D2), helpers (meldSetOf, isMenzen, isTsumo, combinedSets, allKinds,
    numberedSuitsOf), arity guards, kokushi → `[]`, and `standardYakuOf` over the
    15 scan-family predicates: menzen-tsumo, tanyao, yakuhai×5, chiitoitsu,
    honroutou, honitsu, chinitsu, haitei, houtei, rinshan, chankan.
  - `src/core/index.ts`: `export * from './yaku'` appended (after the sibling
    ticket's './waits' line, which landed concurrently — no conflict).
  - `src/core/yaku.test.ts`: h(), kind-real meld builders (chi/pon/daiminkan/
    shouminkan/ankan), ctxOf through the real decomposeAgari (asserts unique
    reading unless `pick` given), CASES rows for the 15, meld-builder sanity
    tests (open dragons fire, ankan keeps menzen).
  - Suite green: 291 tests, check clean.

## Remaining

- Step 2: the 12 set-structure predicates (pinfu, iipeikou, ryanpeikou,
  sanshoku×2, ittsuu, chanta, junchan, toitoi, sanankou, sankantsu, shousangen)
  + their CASES rows.
- Step 3: tighten CASES to the total Record, interaction + contract tests.
- Step 4: review.md.

## Deviations from plan

- None so far. Note: the baseline count (236) grew during step 1 because
  T-005-01-02 (waits) landed on the same branch mid-flight — expected under the
  lisa concurrency model; only shared file was the barrel, append-only.
