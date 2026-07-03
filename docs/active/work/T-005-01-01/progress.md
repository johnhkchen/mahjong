# T-005-01-01 — agari-decomposition — Progress

## Completed

- [x] **Step 1+2 — skeleton + standard backtracker** (commit `7a726ac`, folded per
  plan's own allowance): `src/core/agari.ts` with `ConcealedSet` /
  `AgariDecomposition` types, arity guards, `countsOf`, `searchSets`
  (lowest-kind-first, consume-completely-per-branch), `standardDecompositions`,
  `decomposeAgari`, `isAgari`; barrel export in `src/core/index.ts`. Purity gate
  green immediately (type-only `./record` import). Sanity-checked via throwaway
  vitest file (deleted): one-reading hand, 111222333m multiplicity,
  11223344m pair multiplicity, suit-boundary refusal, 4-meld pair-only.
- [x] **Step 3 — special forms** (commit `0e7844e`): `chiitoitsuOf` (seven kinds at
  exactly 2 — the seven-DISTINCT-pairs rule), `kokushiOf` (13 kind indices, the
  14-tile arithmetic documented at the scan), appended zero-melds-only in the
  frozen order standard → chiitoitsu → kokushi.
- [x] **Step 4 — fixtures + reference oracle** (commit `bbbbe99`): positional
  brute-force reference (pair positions → first-position set binding → key dedup),
  first-principles chiitoitsu/kokushi scans, shared key normalization. 18
  fixtures, expected lists hand-derived in comments.
- [x] **Step 5 — property suite** (commit `6f96208`): generators (winners by
  masked candidate choice, random multiset draws via `fc.shuffledSubarray`,
  one-tile perturbations), four properties: generator self-test, winner agreement
  (+ anti-vacuity + re-expansion), random agreement (+ no special forms alongside
  melds), perturbation agreement. numRuns 200–300 each.
- [x] **Step 4's oracle-validity check** (run during step 5, after the full suite
  existed — deviation below): suit-boundary guard broken (`k % 9 <= 7`) → 2
  failures; triplet branch dropped → 6 failures; both restored via git checkout,
  clean tree verified.
- [x] **Step 6 — final pass**: full `just test` 236/236 green (12 files),
  `just check` 0 errors 0 warnings; agari.test.ts adds ~35ms (budget was < 3s).
  AC verified line by line — see review.md.

## Deviations from plan

1. **Commit 1 folded into commit 2** — explicitly allowed by plan step 1 ("may
   fold… the split exists to isolate a purity-gate surprise"); there was none.
2. **Break-the-module oracle check moved from step 4 to after step 5** — with only
   fixtures present the check would have validated less; running it against the
   full suite (fixtures + properties) is strictly stronger. Both planned breaks
   plus results are recorded in commit `6f96208`'s message.
3. **A third planned break (chiitoitsu ===2 rule) skipped** — the sed pattern
   missed and the rule is already pinned twice over (four-of-a-kind fixture +
   reference agreement property); not worth hand-editing the module a third time.
4. **No scratch `node -e` sanity path** — node's type stripping rejects
   extensionless sibling imports; used a throwaway in-tree vitest file instead
   (created, run, deleted within one command; never committed).

## Remaining

Nothing. Review artifact accompanies the final commit.

## Verification snapshot

- `just test`: 12 files, 236 tests, all green (baseline was 11/214 — this ticket
  adds 22).
- `just check`: svelte-check + tsc, 0 errors, 0 warnings.
- Suite runtime: agari.test.ts ~135ms wall in isolation, ~35ms test time.
