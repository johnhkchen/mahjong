# Review — T-010-01-03 dual-terminology-coverage

## What changed

**Created (the only file this ticket adds):**
- `src/app/app.terminology.coverage.ssr.test.ts` — a parameterized SSR suite: 12 named surfaces
  (seat labels; claim prompt chi/pon and kan; win prompt tsumo and ron; riichi prompt; furiten
  badge; yakuless notice; hand-end tsumo-win-with-dora, bot ron-win, and ryuukyoku; the next-hand
  button) each rendered once under `romaji` and once under `zh-hant`, 24 tests total. Every
  assertion targets an exact expected label pulled from a hand-authored `EXPECTED` literal table
  (not imported from `dictionary.svelte.ts`'s private `TERMS`, so the test isn't tautological
  against its own source — design.md Decision 2). All 20 `TermKey` entries are exercised at least
  once (design.md Decision 6's coverage table).

**Modified:** none. No file under `src/app/` or `src/core/` needed a change — Step 1's grep audit
(progress.md) confirmed every existing consumer already routes through `term()`/`windTerm()`; the
ticket's own gap was purely a testing gap, not a wiring gap. This is also why `just build`'s
output byte count is identical to T-010-01-02's own recorded baseline (104.31 kB) — zero
production code moved.

**Deleted:** none.

## Test coverage

- **New:** 24 tests in the new file (12 surfaces × 2 terminologies), all passing.
- **Full suite:** `npm run test` → 37 files, 936/936 passing (was 912 before this ticket; the
  delta is exactly the new file's test count — no regression, no leakage of the file's own
  `setTerminology()` calls into any sibling file, confirmed by the file-scoped `afterEach(() =>
  setTerminology('romaji'))`).
- **Gates:** `npm run check` → 198 files, 0 errors/warnings. `npm run build` → single-file gate
  passes all rules, 104.31 kB (gzip 34.32 kB), well under the 300,000-byte ceiling.
- **Fixtures reused, none newly mined:** every fixture (seeds 15, 212, 542630, 887141, 1038928's
  neighbor 3951, 397, 20899, boot seed 1) already existed as a frozen anchor in `app.ssr.test.ts`
  before this ticket; this suite only adds a `setTerminology(t)` call around fresh `render()`
  calls of the same states, per design.md Decision 4.

## Gaps and open concerns for human attention

1. **Translation accuracy is unverified, again.** This ticket proves the plumbing — every named
   surface actually renders the dictionary's zh-hant values when `zh-hant` is active — but the
   `EXPECTED` table's zh-hant literals were copied by reading `dictionary.svelte.ts`'s existing
   values, not checked against a native speaker. This is the same caveat T-010-01-01 review.md
   and T-010-01-02 review.md both already raised and explicitly deferred to a future pass; this
   ticket does not close it, and cannot by design (a self-referential proofread-and-then-test-
   against-the-same-proofread-value can't catch a systematically wrong glyph). Worth flagging
   again now that three tickets in a row have carried the same open item forward.
2. **Mixed-language surfaces remain untested here too, by design.** The riichi-stakes three
   bullets, the yakuless notice's connective prose, `HandEnd`'s yaku-name list, and `limitName`
   all stay English-only under `zh-hant` (T-010-01-01 design.md's own scope boundary). This
   ticket's coverage sweep does not assert anything about those regions remaining English
   (nothing to prove — they're untouched by `term()` either way), so a future ticket that DOES
   translate them would need its own new coverage, not an extension of this file.
3. **The seat-label SSR helper (`seatWindLabel`) is coupled to Svelte's current SSR class-
   attribute emission shape** (`class="seat {area} {scoped-hash} {conditional toggles}"`,
   discovered empirically — see progress.md's Deviation). A future Svelte upgrade that changes
   how `class:` directives serialize in SSR output could break this one helper without touching
   any production behavior; the fix would be local to this test file.
4. **No limit-hand (yakuman/mangan+) hand-end fixture is exercised.** The two hand-end win
   fixtures (542630 tsumo, 3951 ron) are both non-limit hands, so the `fu`/`han` term coverage
   comes from exactly one anchor and the `limitName` branch of `HandEnd.svelte`'s points line
   (untranslated core data) is never hit by this suite. Not a gap against the AC (the AC asks for
   term coverage, not exhaustive game-state coverage, and `limitName` carries no `TermKey`
   vocabulary to begin with), but worth noting if a future ticket wants a stricter "every branch
   of HandEnd's points line" sweep.

## Nothing else outstanding

No TODOs left in the new file. `src/core/` untouched. `src/app/` diff is exactly the one new test
file. One commit (`0c70c36`), staged deliberately excluding the pre-existing, already-modified
ticket-frontmatter files in the working tree (unrelated to this ticket's own work — Lisa's own
phase tracking, left alone per RDSPI's own rule not to touch phase/status fields).
