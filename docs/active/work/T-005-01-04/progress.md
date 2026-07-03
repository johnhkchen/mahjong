# T-005-01-04 — yakuman-and-yaku-gate — Progress

## Completed

- [x] **Step 1 — yakuman.ts + barrel** (commit `aeaeafe`)
  - `src/core/yakuman.ts` NEW (~280 lines): YakumanName (10-literal union),
    frozen YAKUMAN_NAMES, WinYakuName, Win, allKindsOf/countOf helpers,
    WIND/DRAGON/GREEN kind consts, the ten predicates in catalog order, the
    private YAKUMAN table, and yakuOf — the aggregator with the gate,
    supersession, stacking, and union-across-readings conventions documented
    in the module header and on yakuOf itself (AC's "convention documented
    in the module").
  - `src/core/index.ts` +1 barrel line (append-only, the waits/yaku
    precedent).
  - Verified: `just check` 0 errors, `just test` 330 green (nothing imported
    the module yet), purity sweep picks the file up via the barrel.
- [x] **Step 2 — yakuman.test.ts** (commit `535b626`)
  - `src/core/yakuman.test.ts` NEW (~270 lines): h()/meld builders, winOf
    (fixtures validated through the real isAgari, no `pick` — the aggregator
    consumes all readings), the type-total
    `CASES: Record<YakumanName, { positive, negative }>` table, and the four
    describes from structure.md (per-yakuman cases + meta-test, gate and
    supersession, union across readings, contract).
  - Verified: `just test` 361 green (31 new), `just check` 0 errors. All
    tests passed on first run — plan.md's fixture derivations held.

## Remaining

Nothing — implementation complete; review.md is the next artifact.

## Deviations from plan.md

1. **Ryuuiisou negative spec simplified**: plan sketched
   `223344s456s88s666z`; implemented `234s456s666s88s666z` (three plain runs
   + hatsu triplet + green pair, one non-green 5s) — same near-miss, one
   fewer duplicated-run reading to reason about in the comment.
2. **Chinroutou positive also ron-demoted** (`source:'discard'`,
   winningKind completing a triplet), extending the trick plan.md only
   applied to tsuuiisou — keeps suuankou out of the positive so the
   contains-assertion exercises chinroutou specifically, not a stack.
3. **The chuuren positive's winningKind set to '5m'** (the surplus tile)
   rather than the default first tile — cosmetic; any held kind passes the
   concealed-membership guard.
4. Commit hashes: step 1 = `aeaeafe`, step 2 = `535b626` (plan's two-commit
   shape held; no third implementation commit needed).

## Verification snapshot

- `just test`: 15 files, 361 tests, all green.
- `just check`: svelte-check 165 files, 0 errors 0 warnings; tsc node config
  clean.
- AC mapping: per-yakuman ± tests = the total CASES table (compile-enforced);
  `[]` for yakuless completions = the gate test (exact `[]` on an open
  yakuless completion); suppression convention = module header + the
  suuankou-hides-its-shadows and ron-demotion-fallback exact-list tests.
