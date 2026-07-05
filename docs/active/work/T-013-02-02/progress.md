# Progress — T-013-02-02: paste-to-reproduce-loader

## Completed (all 7 steps of plan.md, in order)

1. **`src/app/drive.ts`**: added `NOTATION_HEADER_RE`, private `extractNotation`,
   exported `LoadResult` type, exported `loadPastedRecord(text: string): LoadResult`.
   Widened the `'../core'` import to add `foldGame`, `parseGameRecord`, `type GameRecord`.
2. **`src/app/drive.test.ts`**: added `describe('loadPastedRecord')` with six cases
   (raw notation, full `buildReportText` blob, last-header-wins extraction, malformed
   notation, no-header-line fallback, syntactically-valid-but-foldGame-illegal
   record). Widened imports (`foldGame`, `handSeedOf`, `parseGameRecord`,
   `serializeGameRecord`).
3. **`src/app/dictionary.svelte.ts`**: added `loadReport`/`pasteReport` `TermKey`s and
   their `TERMS` entries.
4. **`src/app/ReportBug.svelte`**: added the `onload` prop, local `pasteText`/
   `pasteError` state, `loadPasted()` handler, the paste `<textarea>` + load button +
   error paragraph markup, and the `.load`/`.paste-error` styles.
5. **`src/app/App.svelte`**: added `loadRecord(record: GameRecord)` (mirrors
   `newGame()`'s wholesale-replace shape) and wired `onload={loadRecord}` on the
   `<ReportBug>` mount.
6. **`src/app/app.terminology.coverage.ssr.test.ts`**: added the two new labels to
   both `EXPECTED` terminology tables and to the existing `describe('report dialog')`
   block's assertions.
7. **`src/app/paste-load.tap.svelte.test.ts`** (new file): four end-to-end cases —
   mid-game round-trip (hand+pond DOM match against an independently-folded
   reference), full-blob extraction, malformed-paste safety (exact error message,
   dialog stays open, live game provably untouched then still workable), and an
   ended-phase (agari) load showing scores with no phase-based rejection.

## Verification run at each commit boundary

- `just check` (svelte-check + tsc): clean throughout, 0 errors/warnings, after
  every step (confirmed fresh at the end: 210 files, 0/0).
- `just test`: full suite green at the end — 44 files, 1023 tests passed (up from
  1013/209 files before this ticket — +10 tests: 6 in `drive.test.ts`, 2 in
  `app.terminology.coverage.ssr.test.ts`, 4 new tests in `paste-load.tap.svelte.test.ts`
  minus... actual delta reconciles as: 6 (drive.test.ts) + 4 (paste-load, new file)
  + 0 net new in the SSR coverage file (two new assertions inside an EXISTING `it`,
  not new `it` blocks) = the observed +10).
- `just build`: `verify-single-file: OK — dist/index.html is self-contained
  (120598 bytes)` — the single-file gate passes.

## Deviations from the plan

**None of substance.** One correction mid-write, caught immediately by the test
run rather than by inspection:

- The first `paste-load.tap.svelte.test.ts` draft's `pondKinds` helper scanned raw
  `innerHTML` with a regex (mirroring `report-bug.tap.svelte.test.ts`'s own
  `eastPondCount` bare-count helper) but needed the actual kind TEXT per tile, not
  just a count — the regex-over-innerHTML approach returned an empty array (likely
  an index/slice mismatch against the actual serialized markup, not investigated
  further since the fix was simpler than debugging it: `querySelectorAll('[aria-
  label="..."] .kind')` reads the same DOM directly and needs no string-index
  bookkeeping at all). Two lines of code, no test assertions changed.

**One judgment call not spelled out in Structure**, made directly against research.md
Decision 8/Structure's "any phase" case: rather than hand-authoring a from-scratch
`ryuukyoku` fixture (a full 70-draw exhaustive-draw walk) for the "any phase" test,
I reused `app.terminology.coverage.ssr.test.ts`'s own ALREADY-PROVEN seed-542630
tsumo-win fixture, computing the one `gameSeed` whose `handSeedOf(gameSeed, 0)`
equals that seed exactly (`handSeedOf`'s XOR step is its own inverse — solved
directly, then confirmed against `handSeedOf` itself before use). This keeps the
test deterministic and fast while still exercising a genuinely-ended (`'agari'`)
phase, which is the harder case for "loading works in any phase" (ryuukyoku and
agari share the same `foldGame`-acceptance path; agari additionally exercises
`HandEnd`'s rendering, which is the DOM surface the AC's "scores" spot-check needs).

## No scope creep

Every file touched was named in structure.md's own list. No core (`src/core/`) file
changed — confirmed: `parseGameRecord`/`serializeGameRecord`/`foldGame`/`GameRecord`
were already exactly fit for purpose, per research.md.
