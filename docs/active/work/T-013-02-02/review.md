# Review — T-013-02-02: paste-to-reproduce-loader

## Summary

Adds the owner's half of E-013 ("bug report is a hand log," paired with T-013-02-01's
reporter half): a paste-to-load entry inside the existing report dialog that parses a
pasted report's notation (a raw `serializeGameRecord` blob, or a full copied
message+context+notation report) and replaces the app's live `GameRecord` wholesale,
folding to the exact reported state — hands, ponds, scores, prompts, everything.
Malformed pastes render the underlying parser's own line/position message and leave
the running game untouched. Loading works regardless of the current hand's phase
(`'playing'`, `'ryuukyoku'`, or `'agari'`), because the whole record is replaced, not
appended to.

## Files changed

- **`src/app/drive.ts`** (+~75 lines) — `loadPastedRecord(text): LoadResult`, a pure
  three-step function (extract the notation block from a pasted blob, parse it,
  fold-validate it) plus a private `extractNotation` helper and the `LoadResult`
  discriminated-union type. Widened its `'../core'` import (`foldGame`,
  `parseGameRecord`, `GameRecord`). No existing export's signature changed.
- **`src/app/drive.test.ts`** (+~90 lines) — `describe('loadPastedRecord')`: six
  cases (raw notation, full-blob extraction, last-header-wins-over-a-fake-embedded-
  one, malformed-notation message pass-through, no-header-line fallback, and a
  syntactically-valid-but-`foldGame`-illegal record's message pass-through).
- **`src/app/dictionary.svelte.ts`** (+6 lines) — two new `TermKey`s (`loadReport`,
  `pasteReport`) for the paste UI's own chrome.
- **`src/app/ReportBug.svelte`** (+~35 lines) — the paste `<textarea>` (locally
  `bind:value`-owned, per design.md Decision 5), a load button calling
  `loadPastedRecord`, a conditional error paragraph, and the new `onload` prop. No
  change to the existing message/report/copy/issue markup.
- **`src/app/App.svelte`** (+~15 lines) — `loadRecord(record: GameRecord)`, placed
  beside `newGame()` (the identical wholesale-replace shape: swap `gameSeed`+`hands`
  together, reset `dismissed`/`notice`), plus closing the dialog and clearing its
  message on a successful load. Wired via `onload={loadRecord}` on the existing
  `<ReportBug>` mount.
- **`src/app/app.terminology.coverage.ssr.test.ts`** (+8 lines) — the two new labels
  added to both terminology tables and to the existing `describe('report dialog')`
  block's assertions (no new `it`/`describe`, extending the existing one).
- **`src/app/paste-load.tap.svelte.test.ts`** (new, ~185 lines) — four end-to-end
  cases against a real mounted `App`: mid-game round-trip (hand+pond DOM contents
  matched against an independently-`foldGame`'d reference of the SAME fixture
  record), full-report-blob extraction, malformed-paste safety (exact thrown
  message shown, dialog stays open, live game provably untouched and still
  functional afterward), and an ended-phase (`'agari'`) load rendering `HandEnd`'s
  scores with no phase-based rejection.
- **`docs/active/work/T-013-02-02/{research,design,structure,plan,progress}.md`** —
  the RDSPI artifacts preceding this one.

No file outside this list was touched. Nothing in `src/core/` changed —
`parseGameRecord`/`serializeGameRecord`/`foldGame`/`GameRecord` were already exactly
fit for purpose (confirmed in Research before writing any code).

## AC verification

The ticket's one AC clause, taken apart:

- ✅ **"An interaction test serializes a mid-game record, loads it through the paste
  entry, and asserts the folded table matches the original"**:
  `paste-load.tap.svelte.test.ts`'s first case. "Deep-equal on the fold" is covered
  two ways: `drive.test.ts`'s unit tests assert `loadPastedRecord(...).record` is
  `toEqual` the exact original `GameRecord` (a stronger, more precise check than a
  DOM comparison could give — the whole record, not just what happens to render),
  and the interaction test's DOM spot-check (below) proves the WIRING from a real
  paste tap through to the rendered table, which the unit test alone cannot.
- ✅ **"a DOM spot-check on hand + pond + scores"**: hand and all four ponds are
  checked in the mid-game case (case 1); scores are checked in the ended-phase case
  (case 4) — `HandEnd`'s own `[aria-label="scores"]` list only renders once the
  ACTIVE hand has ended (`breakdown !== null`), so a mid-`'playing'` fixture cannot
  show scores at all regardless of how the record was loaded; this is a fact about
  `HandEnd`'s own existing rendering gate (T-008-03-01), not something this ticket
  changed or could route around.
- ✅ **"malformed paste shows the parse error and leaves the running game untouched"**:
  `paste-load.tap.svelte.test.ts`'s third case — asserts the exact
  `parseGameRecord`-thrown message renders verbatim, the dialog does NOT close, an
  unaffected pond-tile count proves the live game is untouched, and a subsequent tap
  still discards normally (proving "untouched" means "still fully functional," not
  merely "didn't crash").
- ✅ **"loading works with the game in any phase"**: the fourth case loads an
  ALREADY-ENDED (`'agari'`) record into a fresh app with no special-casing anywhere
  in the implementation — `loadRecord()` unconditionally replaces `gameSeed`/`hands`
  regardless of the OLD game's phase (design.md Decision 8's reasoning: the new
  record is validated as a standalone whole via the `foldGame` check inside
  `loadPastedRecord`, so whatever phase the discarded old game was in is
  irrelevant). `'ryuukyoku'` specifically is not separately end-to-end tested (see
  Gaps below) but shares the identical acceptance path as `'agari'` inside
  `foldGame`/`loadRecord` — no code branches on which ended phase it is.
- ✅ **`just test` green**: 44 files / 1023 tests passed (up from 1013 before this
  ticket).
- ✅ **single-file gate green**: `verify-single-file: OK — dist/index.html is
  self-contained (120598 bytes)`.
- ✅ **`just check` clean**: 210 files, 0 errors, 0 warnings.

## Test coverage assessment

Strong on the AC's own named scenario and on the two failure modes `loadPastedRecord`
itself introduces beyond `parseGameRecord`'s pre-existing syntax/range checks (the
extraction heuristic, and the fold-validation step).

**Gaps / things a human reviewer may want to weigh**:
- **No dedicated `'ryuukyoku'`-specific end-to-end case.** The "any phase" AC clause
  is satisfied by the `'agari'` case (harder to reach deterministically than
  `'playing'`, and exercises the same `foldGame`-acceptance path `'ryuukyoku'` would),
  but a reviewer who wants the literal third phase covered explicitly would need a
  new fixture — omitted here because constructing a full 70-draw exhaustive-draw
  walk deterministically (without reusing a policy-driven loop, which introduces its
  own flakiness risk against bot policy changes) would cost meaningfully more test
  code for no NEW code path coverage (nothing in `loadRecord`/`loadPastedRecord`
  branches on which ended phase a record carries).
- **`extractNotation`'s "last header-shaped line" heuristic has one known blind
  spot**: a pasted report whose FREEFORM MESSAGE itself contains a line that
  coincidentally matches `/^v[0-9]+ [0-9a-z]+$/` AND appears after the real
  notation's own header line (impossible in the current `buildReportText` format,
  where the message is always FIRST and the notation always LAST, but not something
  the loader itself enforces or could detect) would extract the wrong, later
  fragment. This is a real accepted trade-off (documented in design.md Decision 2/3),
  not an oversight — the ticket's own format guarantee (notation is always the LAST
  thing in a `buildReportText` output) makes the failure mode currently
  unreachable through the app's own dialog, only through a hand-crafted adversarial
  paste.
- **The fold-validation step (`foldGame` inside `loadPastedRecord`) re-folds the
  WHOLE pasted game once just to check it doesn't throw, then `App.svelte`'s own
  `$derived(foldGame(record))` folds it again on the next reactive tick** — a
  deliberate, cheap redundancy (design.md Decision 2's own reasoning: surfacing the
  identical error one render-cycle earlier, before any state is touched, is worth
  one extra fold of what is, in practice, a short per-session game log) rather than
  a performance concern worth optimizing away.
- **zh-hant translations for the two new labels (`loadReport`, `pasteReport`) are
  original, not reviewed by a native speaker** — the same caveat every prior
  terminology ticket's review already carries (T-010-01-01/02, T-012-01-02,
  T-013-02-01).
- **No live-browser manual pass** — same caveat T-013-02-01's own review carries
  for the underlying `<dialog>`/`showModal()` mechanics (unchanged by this ticket;
  this ticket only adds markup INSIDE the already-shipped dialog, introducing no
  new browser-only risk beyond what that review already flagged).
