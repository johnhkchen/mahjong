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

- **Step 2 — set-structure predicates** (committed): pinfu (completesRyanmen
  arithmetic), iipeikou/ryanpeikou (disjoint via peikouCount), sanshoku doujun/
  doukou, ittsuu, chanta/junchan (disjoint family clauses), toitoi, sanankou
  (concealedTripletCount with the ron-absorption adjustment), sankantsu,
  shousangen — table now 27/27, catalog order. 12 CASES rows with rule-derived
  near-miss negatives. 315 tests green.
- **Step 3 — totality + interactions + contract** (committed): CASES tightened
  to the total `Record<YakuName, YakuCase>` (compiler enforces the AC), catalog
  meta-test (27 names, distinct, frozen); interaction tests: ryanpeikou-not-
  iipeikou, chanta-family pairwise exclusivity (+ honroutou/toitoi co-fire),
  honroutou-over-chiitoitsu, double-east wind double-fire, pinfu wait shapes
  (penchan ×2 / tanki / ryanmen low / ryanmen high / otakaze pair / seat-wind
  pair), sanankou ron absorption both directions, rinshan-not-haitei, yakuless
  open completion → [], kokushi → []; contract tests: exact catalog-order
  result list on a five-yaku hand, purity (unmutated inputs, repeat-call
  equality, fresh arrays), RangeError guards (5-set standard ctx, melded
  pairs-form ctx). 330 tests green, check clean.

## Remaining

- Step 4: review.md.

## Deviations from plan

- None so far. Note: the baseline count (236) grew during step 1 because
  T-005-01-02 (waits) landed on the same branch mid-flight — expected under the
  lisa concurrency model; only shared file was the barrel, append-only.
