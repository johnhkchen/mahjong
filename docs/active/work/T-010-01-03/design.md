# Design — T-010-01-03 dual-terminology-coverage

## Decision 1 — New dedicated test file, not an extension of `app.ssr.test.ts`

**Chosen: `src/app/app.terminology.coverage.ssr.test.ts`**, a new file in the `node` vitest
project (plain `.test.ts`, `svelte/server` render, same as `app.ssr.test.ts`).

Rejected: appending describe blocks to `app.ssr.test.ts` in place. That file is already 651 lines
and each existing suite carries a heavy contextual comment block explaining its own fixture
choice; folding a ~20-term × 2-terminology sweep into it would roughly double its length and mix
two different testing concerns (romaji-default behavioral coverage vs. terminology-parameter
coverage) in one file. A dedicated file matches the ticket's own naming
(`dual-terminology-coverage`) and mirrors T-010-01-02's own precedent of adding
`app.terminology.svelte.test.ts` as a sibling file rather than editing `app.ssr.test.ts` for its
toggle-behavior tests — the one exception T-010-01-02 DID make (`app.ssr.test.ts`'s new
"terminology (SSR, no localStorage)" describe) was deliberately small (one block, boot-only) and
about a different fact (default renders without touching storage), not about terminology
parameterization itself.

## Decision 2 — Expected labels are hand-authored literals, not imported from the dictionary

`dictionary.svelte.ts` exports only `term()`, `windTerm()`, `activeTerminology()`,
`setTerminology()`, and the `Terminology`/`TermKey` types — the `TERMS` record itself is module-
private, so importing "the real values" isn't even possible without widening that module's public
surface (out of scope: this is a test-only ticket, no production code changes). The new suite
therefore defines its own literal expectation table, keyed by `Terminology` then a subset of
`TermKey`, matching the exact style `app.terminology.svelte.test.ts` already uses for
`WINDS_ROMAJI`/`WINDS_ZH`. This is a deliberate, not incidental, choice: even if `TERMS` were
exported, asserting `body.includes(TERMS[key][t])` would be tautological — the render path and
the assertion would share the same source of truth, so a wrong value in `TERMS` could never fail
its own test. A hand-copied literal table is a real regression check: if someone edits
`dictionary.svelte.ts`'s zh-hant glyphs, this suite fails and shows exactly what changed.

Trade-off accepted: the literal table is authored by reading `dictionary.svelte.ts`'s current
values (this ticket does not have a native speaker on hand either — same caveat T-010-01-01 and
T-010-01-02 review.md already carry forward), so a systematically wrong glyph would pass both the
source and the test. That's a real gap but out of this ticket's scope (verifying translation
correctness); the AC only asks that both terminologies actually render through to the surfaces,
which this proves.

## Decision 3 — Parameterization shape: a `TERMINOLOGIES` loop per describe block, not `it.each`

Chosen: `for (const terminology of TERMINOLOGIES) { describe(terminology, () => { ... }) }`
nesting, with `setTerminology(terminology)` in a `beforeAll`/`beforeEach` and
`setTerminology('romaji')` restored in `afterEach`. Rejected `describe.each`/`it.each`: this
codebase has never used vitest's `.each` API (grepped: zero occurrences across all `*.test.ts`),
and the per-surface fixtures (specific seeds, specific derived facts) read more naturally as
named `it()` blocks nested under a named-terminology `describe()` than as templated `.each` rows
— consistent with "don't introduce a pattern the codebase doesn't already use" for a small,
bounded parameterization (2 terminologies × ~7 surfaces, not a combinatorial matrix).

## Decision 4 — Reuse existing SSR fixtures/seeds verbatim, mine nothing new

research.md confirmed every named surface already has a frozen anchor seed in `app.ssr.test.ts`.
Reusing them (duplicating the small `foldRecord`/`tsumogiriTurns` setup, since no shared fixture
module exists in `src/app/` today — matching the existing duplication convention) keeps this
ticket's diff test-only and avoids the risk of mining a new seed that turns out to hit an
unrelated edge case. The only seam is wrapping each `render()` call with `setTerminology(t)`
before it — SSR renders are pure snapshots (`render()` returns a fresh `{ body }` string each
call, no persisted DOM), so no remount/cleanup machinery is needed, unlike the jsdom mount suite.

## Decision 5 — State isolation: reset `setTerminology('romaji')` in `afterEach`, scoped per file

`current` in `dictionary.svelte.ts` is a module-scoped singleton. Vitest's `node` project does not
guarantee file-level module isolation is irrelevant here (each test *file* gets its own module
graph by default in Vitest; the risk is only test-to-test *within* this one new file). A single
top-level `afterEach(() => setTerminology('romaji'))` guards every `it()` in the file, mirroring
`app.terminology.svelte.test.ts`'s own existing reset pattern — cheap insurance, not a new idiom.

## Decision 6 — Surface-to-fixture-to-TermKey coverage map (drives Plan's step list)

| Surface | Fixture (seed) | TermKeys asserted |
|---|---|---|
| Seat labels | any dealt `Table`/`App` render | east, south, west, north |
| Claim prompt (chi/pon) | 15, 8 tsumogiri turns | chi, pon |
| Claim prompt (kan) | 212, 6 tsumogiri turns | kan |
| Win prompt (tsumo) | 542630, turn-32 draw | tsumo |
| Win prompt (ron, mid-window) | 887141, turn-4 window | ron |
| Riichi prompt | 397, opening draw | tenpai, riichi, declareRiichi, notYet |
| Furiten badge | 3951, sealed (2 turns) | furiten, ron, tsumo |
| Yakuless notice | 20899, dealt-only | tsumo, riichi |
| Hand-end (tsumo win, dora) | 542630, played to tsumo | tsumo, dora, fu, han, east/south/west/north (scores) |
| Hand-end (ron win, bot) | 3951, played to ron | ron, east/south/west/north (winner+from+scores) |
| Hand-end (ryuukyoku) | BOOT_SEED=1, 70 turns | ryuukyoku, tenpai, noten, east/south/west/north |
| Next-hand button | any ended `Table` + `onnext` | nextHand |

Every one of the 20 `TermKey` entries appears at least once. `noten` and `dora`/`fu`/`han` each
appear in exactly one fixture (no redundant alternate anchor needed — the ticket asks for
coverage, not multiple witnesses per term).

## Decision 7 — Assert exact label text, not mere presence-of-glyph

Where a term is reachable at more than one place in the same render (e.g. `tsumo` appears in both
the yakuless notice and a nearby furiten badge, if both render at once), assertions target the
specific aria-labeled region or button text the way `app.ssr.test.ts` already does
(`regionTokens`, `body.indexOf('aria-label="…"')` slicing), not a bare `body.includes(glyph)`
which could pass on an unrelated coincidental match (e.g. `南` also appears as a physical honor-
tile glyph rendered by `Tile.svelte`, per T-010-01-01 review.md's own documented distinction and
`app.terminology.svelte.test.ts`'s `seatWindText` helper working around exactly this). This ticket
reuses that same "slice the labeled region first, then assert" discipline rather than a raw
substring search.

## Rejected: a jsdom/mount-based sweep instead of SSR

Every named surface renders via `svelte/server` already in `app.ssr.test.ts` under `romaji`
today; nothing about "does this label change under `zh-hant`" requires a live DOM, event
handling, or the toggle button itself (that's T-010-01-02's own tested contract). Mounting via
jsdom would add setup cost (the `vitest-dom-setup.ts` localStorage polyfill, `flushSync`,
mount/unmount pairs) for zero additional coverage value. SSR is both the cheaper and the more
representative choice — the AC's own wording ("SSR/component tests parameterized") allows either,
and every fixture research.md found was already an SSR one.

## Build/check gates — no design decision needed

This ticket adds one new test file and zero production code. `just check` and `just build`
should pass exactly as they did after T-010-01-02 (bundle size unchanged), and Plan's final step
runs both explicitly to confirm rather than assume — closing the same gap T-010-01-01 review.md
flagged about relying on "should pass" instead of a real run.
