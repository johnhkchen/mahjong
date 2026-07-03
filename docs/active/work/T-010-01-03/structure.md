# Structure — T-010-01-03 dual-terminology-coverage

## Files touched

**Created (the only file this ticket adds):**
- `src/app/app.terminology.coverage.ssr.test.ts`

**Modified:** none expected. No production file under `src/app/` or `src/core/` needs a change —
the dictionary and every consumer already route through `term()`/`windTerm()` (T-010-01-01/02).
If Implement's grep/render pass surfaces an actual missed hardcoded literal (a true gap, not
merely untested), Plan's Step 1 covers verifying this before any test is written, and Progress
will record it as a deviation if found. Not anticipated based on research.md's read of every
consumer file.

**Deleted:** none.

## Internal organization of the new file

Single file, top-to-bottom:

1. **Header comment** — states the file's scope (dual-terminology coverage, T-010-01-03) and its
   explicit non-goals (not the toggle's own behavior — that's `app.terminology.svelte.test.ts`;
   not a translation-correctness review — glyph values are read off the current dictionary, not
   verified against a native speaker, same caveat as T-010-01-01/02).

2. **Imports** — `render` from `'svelte/server'`; `foldRecord`, `kindOf`, `legalActions`,
   `furitenSeal`, `yakulessTenpai`, `scoreBreakdownOf`, `handSeedOf`, and needed types from
   `'../core'`; `promptChoices`, `PLAYER`, `riichiPrompt`, `winChoice` from `'./drive'`;
   `setTerminology` from `'./dictionary.svelte'`; the five view components (`App`, `Table`,
   `ClaimPrompt`, `RiichiPrompt`, `HandEnd` is reached only via `Table` — `HandEnd` is never
   rendered standalone anywhere in the existing suite either, so this ticket doesn't start).

3. **Shared constants**:
   - `TERMINOLOGIES = ['romaji', 'zh-hant'] as const` — the loop driver.
   - `EXPECTED: Record<Terminology, Record<TestedKey, string>>` — the hand-authored literal
     table from design.md Decision 2/6, one row per terminology, one column per the subset of
     `TermKey`s this suite exercises (all 20, per Decision 6's coverage map).
   - `WIND_LABELS: Record<Terminology, readonly [string, string, string, string]>` — derived
     view of `EXPECTED`'s east/south/west/north for the seat-order helpers, matching
     `app.terminology.svelte.test.ts`'s own `WINDS_ROMAJI`/`WINDS_ZH` naming convention (kept
     local to this file — no shared constants module exists in `src/app/`, matching the
     established per-file duplication convention research.md documented).

4. **Local helpers** (copied/adapted from `app.ssr.test.ts`, not imported — that file exports
   nothing, matching its own established no-shared-helpers convention):
   - `tsumogiriTurns(live, n)` — verbatim copy.
   - `regionTokens(body, label, closeTag)` — verbatim copy, for slicing labeled regions before
     asserting (design.md Decision 7).
   - `seatWindText(body, area)` is NOT copied as-is (that helper in
     `app.terminology.svelte.test.ts` operates on a live DOM element's `childNodes`; SSR has only
     a string). Instead a small SSR-appropriate equivalent: locate the `.seat.{area}` region by
     its wind text directly, since `Table.svelte`'s SEATS render the wind label as the very first
     text node inside `<div class="seat {area}">` — reuse `app.ssr.test.ts`'s own established
     technique of slicing between two known markers rather than parsing HTML.

5. **`afterEach(() => setTerminology('romaji'))`** at the top level (design.md Decision 5) —
   applies to every `it()` in the file regardless of which describe it's nested under.

6. **One outer loop over `TERMINOLOGIES`**, each iteration producing a `describe(terminology, …)`
   block containing the per-surface `it()`s from design.md Decision 6's table, in this order
   (grouped by ticket's own AC ordering — "prompts (call/win/riichi), seat labels, furiten badge,
   hand-end and score screens"):
   1. Seat labels
   2. Claim prompt — chi/pon
   3. Claim prompt — kan
   4. Win prompt — tsumo
   5. Win prompt — ron
   6. Riichi prompt
   7. Furiten badge
   8. Yakuless notice
   9. Hand-end — tsumo win with dora
   10. Hand-end — ron win (bot)
   11. Hand-end — ryuukyoku
   12. Next-hand button

   `setTerminology(terminology)` is called once at the top of each `describe`'s body via a
   `beforeAll` scoped to that describe (Svelte SSR render reads `current` synchronously at call
   time — no async boundary, so `beforeAll` suffices over `beforeEach`; the file-level `afterEach`
   still resets after every `it()` regardless, so no test can leak into a sibling describe even if
   ordering ever changes).

## Public interface

None — this is a leaf test file, nothing exports from it, nothing imports it.

## Ordering / dependencies

Single-file, single-commit unit of work (see plan.md) — there is no multi-file sequencing
concern. The only ordering constraint internal to the file is that `EXPECTED`/`WIND_LABELS`
constants and the local helpers must precede the `describe.each`-equivalent loop that consumes
them (plain top-to-bottom JS module evaluation, no special setup).
