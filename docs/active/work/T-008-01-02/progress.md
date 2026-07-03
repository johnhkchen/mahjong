# Progress — T-008-01-02 han-values-and-dora-counting

## Completed

All plan.md steps executed, in order, each committed independently:

1. **`src/core/han.ts` scaffolded** — `isMenzen` (duplicated per precedent),
   the private `YAKU_HAN` table (all 26 `YakuName` entries, TypeScript's
   `Record<YakuName, ...>` making an incomplete table a compile error),
   `YAKUMAN_HAN = 13` + `YAKUMAN_SET`, and `hanOf(name, melds)`.
   Commit `21f3100`.
2. **Dora counting added to the same file** — `allKindsOf(win)` and
   `countOf(kinds, kind)` (both duplicated from `yakuman.ts`), and
   `doraHanOf(win, doraKinds)`. Included in the same commit as step 1 (the
   plan called for a separate step; in practice both fit naturally in one
   file-write pass before the first typecheck, so they landed in one commit
   rather than two — a deviation from the plan's step numbering, not its
   content. No functional difference.)
3. **Barrel export** — `export * from './han'` appended to
   `src/core/index.ts`. Commit `b69bc12`.
4. **`src/core/han.test.ts` written** — 50 tests across seven `describe`
   blocks (full `hanOf` table incl. compiler-enforced totality check,
   `hanOf` yakuman-flat-13, five `doraHanOf` counting cases, one win-gate
   integration test). Commit `cf6f5e1`.
5. **Full verification** — `just test` (642/642 passing, up from 592 before
   this ticket — 50 new), `just check` (182 files, 0 errors).

## Deviations from plan

- **One bug caught during implementation, not anticipated by the plan**: my
  first draft of `allKindsOf` in `han.ts` had a garbled placeholder line
  instead of the real `kindOf(tile)` conversion for meld tiles (`TileId` →
  `TileKind`) — caught immediately by `just check` (step 1's own verification
  gate did its job) before any commit. Fixed by importing `kindOf` from
  `./tiles` and using it, matching `yakuman.ts`'s original.
- **Tile-count errors in the first draft of the test fixtures**: several
  `doraHanOf` fixtures and the win-gate fixture were first written with the
  wrong concealed tile count (forgetting that a closed win needs 14 concealed
  tiles — pair + 4 sets — while an open win with one meld needs 11). Caught
  by actually running the suite (`vitest run src/core/han.test.ts`) rather
  than by typecheck (tile-count-wrong-but-well-typed fixtures compile fine;
  `winOf`'s `isAgari` guard is what would have thrown "fixture ... is not a
  win" — in this case none of the miscounted fixtures happened to throw,
  because I caught and recomputed them by hand before the first test run,
  cross-checking each spec's tile count against the pair+3n formula before
  running). All fixtures were corrected before the commit landed — the
  committed test file's first run was already 50/50 green.
- **One `purity.test.ts` failure**, unrelated to `han.ts`'s logic: a doc
  comment containing `distinguish "impossible" from "open value" here`
  literally matched the codebase's import-purity scanner (`SPECIFIER_RE`
  matches `from ['"]...['"]` anywhere in raw source, including comments, by
  deliberate fail-loud design per `purity.test.ts`'s header comment). Reworded
  the comment to avoid the word "from" immediately preceding a quoted phrase.
  This was caught only by running the FULL suite (`just test`), not by
  `just check` or the single-file test run — worth noting for future core
  modules: always run the whole suite once, not just the new file, before
  considering a module done (plan.md's step 5 already called for this; it's
  the reason the plan had it as a distinct final step rather than folding it
  into step 4).

## No deviations in scope

Nothing outside `src/core/han.ts`, `src/core/han.test.ts`, and
`src/core/index.ts` was modified. `yaku.ts`, `yakuman.ts`, `fu.ts`, `record.ts`
are untouched, as planned — the AC's "without changing yaku.ts's name-only API
contract" is satisfied by non-interference, not by any compensating change.

## State at handoff

Working tree clean relative to this ticket's scope (three commits:
`21f3100`, `b69bc12`, `cf6f5e1`). `just test` and `just check` both green.
Ready for Review.
