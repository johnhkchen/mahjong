# Plan — T-010-01-03 dual-terminology-coverage

Single new test file, so the steps below are internal checkpoints within one commit rather than
independently-committable units — the ticket's whole scope is one atomic addition (a parameterized
suite either exists correctly or it doesn't; there's no meaningful intermediate state to commit).
One commit at the end, verified green before it lands.

## Step 1 — Confirm no production gap exists (sanity check before writing tests)

Grep `src/app/*.svelte` for the same nine-plus term list T-010-01-01's own audit used (chi, pon,
kan, ron, tsumo, riichi, ryuukyoku, tenpai, noten, furiten, declare riichi, not yet, next hand,
dora, fu, han, East, South, West, North) outside `dictionary.svelte.ts`, excluding known-safe
categories already documented (TS comments, `.type === 'tsumo'` string comparisons, CSS class
selectors, the riichi-stakes prose, `Tile.svelte`'s honor-tile glyphs). Expected result: clean,
matching T-010-01-01's own review.md audit — this step should find nothing new to fix. If it does
find something, fix the production file first (small, mechanical `term()`/`windTerm()` swap,
matching T-010-01-01's established pattern) and record it as a deviation in progress.md before
proceeding to Step 2.

**Verification:** manual grep output reviewed, zero unexpected hits.

## Step 2 — Write the shared constants and helpers (structure.md §3-4)

Create `src/app/app.terminology.coverage.ssr.test.ts` with the header comment, imports,
`TERMINOLOGIES`, `EXPECTED`, `WIND_LABELS`, and the three local helpers
(`tsumogiriTurns`, `regionTokens`, the SSR seat-wind-text helper). No `it()`s yet.

**Verification:** file type-checks (`npx tsc --noEmit` or rely on Step 8's full `just check`) —
not yet run standalone; folded into later steps since the file has no tests to run until Step 3.

## Step 3 — Seat labels + claim prompt (chi/pon/kan) — Decision 6 rows 1-3

Add the `TERMINOLOGIES` loop skeleton with the first three surfaces' `it()`s: seat labels (any
dealt render), chi/pon (seed 15), kan (seed 212). Each asserts the aria-label/button text exactly
matches `EXPECTED[terminology][...]`.

**Verification:** `npx vitest run src/app/app.terminology.coverage.ssr.test.ts` (or
`flox activate -- npx vitest run …`) — new tests pass, `romaji` assertions confirm the loop
mechanics work before zh-hant is trusted to be meaningful.

## Step 4 — Win prompt (tsumo/ron) + riichi prompt — Decision 6 rows 4-6

Add tsumo (seed 542630 turn-32), ron (seed 887141 turn-4), riichi prompt (seed 397) — asks line
(tenpai + riichi words), declare/decline button labels.

**Verification:** same targeted vitest run, full file.

## Step 5 — Furiten badge + yakuless notice — Decision 6 rows 7-8

Add furiten (seed 3951, 2 turns) and yakuless (seed 20899) blocks.

**Verification:** same targeted vitest run.

## Step 6 — Hand-end screens — Decision 6 rows 9-12

Add tsumo-win-with-dora (seed 542630 played to tsumo), bot-ron-win (seed 3951 played to ron),
ryuukyoku (BOOT_SEED=1, 70 turns), next-hand button. These are the largest fixtures (most derived
facts per block: yaku list is core data and stays unchecked here — only the term-routed
vocabulary: ryuukyoku/tenpai/noten/tsumo/ron/dora/fu/han/wind labels).

**Verification:** same targeted vitest run — full new file green, both terminologies, all 20
`TermKey`s exercised at least once (cross-check against design.md Decision 6's table by eye).

## Step 7 — Full suite regression

Run the complete test suite (`just test`, both `node` and `dom` projects) to confirm the new file
doesn't leak terminology state into any pre-existing test (the `afterEach` reset is the guard;
this step proves it empirically rather than by inspection alone) and that nothing else regressed.

**Verification:** full `just test` green, test count increased by exactly the new file's `it()`
count, no prior file's pass/fail status changed.

## Step 8 — Gates

Run `just check` (svelte-check + tsc) and `just build` (single-file gate). Both expected to pass
unchanged from T-010-01-02's baseline (~104.3 kB, well under the 300,000-byte ceiling) since no
production file changed. Record actual numbers in progress.md/review.md rather than assuming.

**Verification:** both commands exit 0; build gate's printed byte count noted.

## Step 9 — Commit

One commit: `Add the dual-terminology SSR coverage sweep for T-010-01-03`. Stages exactly the one
new test file (plus any Step 1 production fix, if one was needed — expected not to be).

## Testing strategy summary

- **Unit/component level:** all new coverage is itself test code (no new production logic to
  unit-test separately).
- **Integration level:** SSR renders through the real Svelte compiler and real core fold, exactly
  as `app.ssr.test.ts` already does — these ARE integration tests of the view layer against core.
- **What's deliberately NOT covered:** translation correctness (glyph accuracy) — carried forward
  as an open concern in review.md, same as the two prior tickets; the toggle's own click/persist
  behavior (T-010-01-02's file); jsdom/mount-level rendering (Decision: rejected, SSR suffices).
- **Regression guard:** Step 7's full-suite run plus the `afterEach` reset is the specific
  mechanism preventing this ticket's own state manipulation (`setTerminology` calls) from bleeding
  into any other file's tests.
