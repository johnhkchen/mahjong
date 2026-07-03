# Progress — T-010-01-03 dual-terminology-coverage

## Step 1 — Production gap check

Grepped `src/app/*.svelte` for all sixteen named term literals outside `dictionary.svelte.ts`.
Result: clean, matching T-010-01-01's own prior audit exactly. Every hit was a `term()`/
`windTerm()` call, a `.type === '…'` string comparison, a hardcoded (by-design, untranslated)
`aria-label`/`class` attribute constant, or a comment. **No production deviation** — as
anticipated in plan.md.

## Steps 2-6 — Wrote `src/app/app.terminology.coverage.ssr.test.ts`

Wrote the whole file in one pass rather than strictly incrementally per plan.md's step split
(the constants/helpers and the twelve `it()`s were straightforward enough, given research.md's
fixture inventory and design.md's coverage table, to author together) — then ran it once and
fixed forward. One deviation found empirically:

**Deviation — the seat-label helper's class-attribute marker.** plan.md/structure.md assumed
`class="seat {area}"` would appear literally in the SSR body (mirroring
`app.terminology.svelte.test.ts`'s DOM-based helper, which reads `childNodes[0]` and never looks
at the class attribute at all). Running the suite showed Svelte's SSR output actually renders
`class="seat east svelte-5dy8av you active"` — the scoped-style hash and any active `class:you`/
`class:active` toggles are appended inside the same attribute, after the area name, before the
closing quote. Fixed `seatWindLabel()` to match on `class="seat {area} "` (an unclosed prefix)
and separately locate the attribute's closing quote before scanning on to the tag's `>`. Recorded
in the helper's own comment. This is a test-file-only fix; no design decision changed.

All other assertions (claim/win/riichi prompts, furiten badge, yakuless notice, hand-end
screens, next-hand button) passed on the first run once the file was runnable — the fixture
seeds and `EXPECTED` literal table were correct as designed.

**Result:** `npx vitest run src/app/app.terminology.coverage.ssr.test.ts` → 24/24 passing (12
surfaces × 2 terminologies).

## Step 7 — Full suite regression

`npm run test` → 37 files, **936/936 passing** (was 912 before this ticket; +24 matches the new
file exactly, confirming no leakage into or breakage of any existing file). The `afterEach(() =>
setTerminology('romaji'))` reset was sufficient — no cross-test state bleed observed.

## Step 8 — Gates

- `npm run check` (svelte-check + tsc): **198 files, 0 errors, 0 warnings.**
- `npm run build`: **104.31 kB** (gzip 34.32 kB) — byte-for-byte identical to T-010-01-02's own
  recorded baseline, confirming zero production code changed. Single-file gate: all rules pass
  (one file, `<!doctype html>`, `id="app"`, no reference attributes, no remote CSS `url()`,
  well under the 300,000-byte ceiling).

## Step 9 — Commit

One commit, staging exactly the one new test file (no production file changed, so Step 1's
anticipated "no deviation" held — nothing else to stage).

## Deviations from plan.md summary

1. Steps 2-6 collapsed into one authoring pass instead of five separately-verified increments —
   the fixture/coverage design from research.md and design.md was concrete enough that
   incremental verification added no information the final full-file run didn't already give.
2. `seatWindLabel()`'s class-attribute marker, described above — a test-file implementation
   detail, not a design or scope change.

No other deviations. Ticket's AC is met: parameterized suite exists, renders every named surface
under both terminologies with exact expected labels, `just build` passes the size gate, `just
check` is clean.
