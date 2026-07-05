# Structure — T-013-02-02: paste-to-reproduce-loader

## File-level change list

### `src/app/drive.ts` (modified, +~50 lines)

New exports, placed after `buildIssueUrl`/`IssueLink` (the report-building section
this pairs with):

```ts
export interface LoadResult {
  readonly ok: boolean
  readonly record: GameRecord | null
  readonly message: string | null
}
// modeled as a discriminated union in practice:
//   { ok: true, record: GameRecord, message: null }
//   { ok: false, record: null, message: string }

const NOTATION_HEADER_RE = /^v[0-9]+ [0-9a-z]+$/

function extractNotation(text: string): string { ... }

export function loadPastedRecord(text: string): LoadResult { ... }
```

- Needs new imports at the top of `drive.ts`: `parseGameRecord`, `foldGame`, and
  `GameRecord` type — all already available from `'../core'` (the same barrel
  `App.svelte` imports from; `drive.ts` currently imports a narrower set from
  `'../core'` at the top of the file — this just widens that one import list).
- `extractNotation` is a private (non-exported) helper — only `loadPastedRecord`
  calls it; no test needs it directly since `loadPastedRecord`'s own unit tests
  cover both the with-wrapper and without-wrapper cases end to end.
- `loadPastedRecord` body shape:
  1. `const notationText = extractNotation(text)`
  2. `try { record = parseGameRecord(notationText) } catch (e) { return { ok: false, record: null, message: (e as Error).message } }`
  3. `try { foldGame(record) } catch (e) { return { ok: false, record: null, message: (e as Error).message } }`
  4. `return { ok: true, record, message: null }`

### `src/app/drive.test.ts` (modified, +~60 lines)

New `describe('loadPastedRecord')` block, sibling to the existing
`describe('buildReportText')`/`describe('buildIssueUrl')` blocks. Cases:
- raw notation (no wrapper) parses to the exact expected `GameRecord`.
- a full `buildReportText`-shaped blob (message + `---` + context + `---` +
  notation) extracts and parses correctly — construct via `buildReportText` itself
  in the test, not hand-authored wrapper text, so this test breaks loudly if
  `buildReportText`'s own shape ever changes incompatibly.
- malformed notation (e.g., a bad tile digit) returns `{ ok: false, message }` where
  `message` matches the exact string `parseGameRecord` throws for that input
  (assert via calling `parseGameRecord` directly in the test and catching, comparing
  messages — not a hardcoded string, so this test doesn't independently pin
  `notation.ts`'s own wording twice).
- a syntactically valid but illegal record (e.g., two hands where hand 0 is still
  `'playing'` followed by hand 1) returns `{ ok: false, message }` matching
  `foldGame`'s own thrown message.
- no header line anywhere in the pasted text: whole trimmed text handed to
  `parseGameRecord` unchanged, which throws its own line-1 "malformed header" error
  (assert the returned message matches that).
- multiple header-shaped lines in the text picks the LAST one (a constructed
  fixture: fake free-text containing something that happens to match the header
  shape, followed by the real header + hand lines).

### `src/app/ReportBug.svelte` (modified, +~60 lines)

New props: `onload: (record: GameRecord) => void` (joins `onmessage`/`onclose` in
the existing props destructure) — needs a new `import type { GameRecord } from
'../core'` at the top.

New local state (near the existing `copied`/`COPIED_DURATION_MS` block):
```ts
let pasteText = $state('')
let pasteError = $state<string | null>(null)

function loadPasted() {
  const result = loadPastedRecord(pasteText)
  if (result.ok) {
    pasteError = null
    pasteText = ''
    onload?.(result.record)
  } else {
    pasteError = result.message
  }
}
```
Needs `import { loadPastedRecord } from './drive'` — sibling to nothing currently
imported there (this file currently imports only `IssueLink`/`term`; adding this one
function import).

Markup addition: a new `<label class="field">` block after the existing
`issueLink`/`clipboard-first-note` block and before the close button, holding:
- a `<textarea aria-label={term('pasteReport')} placeholder={term('pasteReport')}
  bind:value={pasteText}>` (a plain two-way bind is fine here — unlike the message
  textarea, which is prop-controlled from `App.svelte`, this is Decision 5's
  purely-local state, so no `oninput`/callback indirection is needed).
- a `<button type="button" aria-label={term('loadReport')} onclick={loadPasted}>`
  labeled `term('loadReport')`.
- a conditional `{#if pasteError}<p class="paste-error">{pasteError}</p>{/if}`.

`<style>` additions: a `.paste-error` rule (small, `color` a warning-adjacent tone —
reuse the file's existing dark-green palette variables literally, e.g. a muted red
against `#124534`, no new CSS custom properties needed for one paragraph).

### `src/app/App.svelte` (modified, +~15 lines)

- Import `parseGameRecord`... actually NOT needed directly — `App.svelte` only
  needs the already-imported `GameRecord` type (already imported at line 9) and the
  new `loadRecord` function operating on a `GameRecord` value handed up from
  `ReportBug`'s `onload`. No new core imports required in `App.svelte` itself.
- New function, placed directly after `newGame()` (the structurally closest
  sibling — same "replace the whole record" shape):
  ```ts
  function loadRecord(record: GameRecord) {
    gameSeed = record.seed
    hands = record.hands.map((h) => [...h])
    dismissed = false
    notice = null
    reportOpen = false
    reportMessage = ''
  }
  ```
- Wire the new prop on the existing `<ReportBug ...>` mount: add `onload={loadRecord}`
  alongside the existing `onmessage={setReportMessage}` `onclose={closeReport}`.

No other file needs a code change for the load path itself.

### `src/app/dictionary.svelte.ts` (modified, +~4 lines)

- Two new `TermKey` union members: `'loadReport' | 'pasteReport'`.
- Two new `TERMS` entries, placed directly after the existing `reportCopied` entry
  (keeping every T-013-02-0x report-dialog term grouped together, matching the
  file's existing grouping-by-feature convention):
  ```ts
  loadReport: { romaji: 'load report', 'zh-hant': '載入回報' },
  pasteReport: { romaji: 'paste report', 'zh-hant': '貼上回報' },
  ```

### `src/app/app.terminology.coverage.ssr.test.ts` (modified, +~10 lines)

Extend the existing `describe('report dialog')` block (added by T-013-02-01) with
two more per-terminology label assertions for `loadReport`/`pasteReport`, following
the exact pattern already there for `reportBug`/`copyReport`/etc.

### New file: `src/app/paste-load.tap.svelte.test.ts` (new, ~150 lines)

Mirrors `report-bug.tap.svelte.test.ts`'s structure closely enough to justify
copying its helper functions rather than sharing a module (this codebase's own
established per-test-file duplication convention, cited repeatedly in
`report-bug.tap.svelte.test.ts`'s own comments — `tickUntil`, `mountApp`,
`eastPondCount` are each independently duplicated per file already):
- `mountApp`, `tickUntil`, `openDialog`, `closeDialog` — duplicated verbatim (or
  near-verbatim) from `report-bug.tap.svelte.test.ts`.
- New helpers: `pasteAndLoad(target, text)` (finds the paste textarea by
  `aria-label`, sets `.value`, dispatches `input`, clicks the load button, flushes);
  `pasteErrorText(target)` (reads `.paste-error` text content, or `null`).
- Cases (per the AC and design.md's Test strategy sketch):
  1. Build a mid-game record by ticking a fresh `mountApp` forward a few turns
     (reusing `tickUntil`/`handButtons`-style taps from other suites, or
     hand-constructing a valid `HandAction[][]` fixture directly and calling
     `serializeGameRecord` on it — the latter is simpler and avoids flakiness from
     driving bot policy for a "few turns in" fixture). Paste the serialized text
     into a FRESH second `mountApp` and load it; assert the resulting DOM (hand
     tile kinds via `handButtons`, pond kinds via `eastPondCount`-style helpers
     generalized to any seat, scores via score-display query) matches
     `foldGame`/`seatScoresOf` computed independently in the test over the SAME
     fixture record.
  2. Paste garbage (`'not notation at all'`) into a live game partway through a
     hand; assert `pasteErrorText` shows the exact message `parseGameRecord` throws
     for that input (computed in the test via calling `parseGameRecord` directly and
     catching), and assert the live game is untouched (an `eastPondCount`-style
     proxy unchanged, mirroring `report-bug.tap.svelte.test.ts`'s own pause-test
     precedent for "prove nothing changed").
  3. Paste a full `buildReportText`-shaped blob (message + context + notation) and
     confirm it still loads correctly — proves the extraction path, not just raw
     notation.
  4. Construct (or tick a game to) an ended hand (`'agari'` or `'ryuukyoku'`
     phase — simplest via a small hand-authored fixture record ending in `T0`/`X..`
     tokens rather than ticking a real game to completion, for determinism and
     speed), serialize it, and load it into a fresh app — assert it loads
     successfully with no phase-based rejection (HandEnd.svelte's own breakdown
     rendering, or the folded `table.phase`, is the observable proxy).

## Ordering

1. `drive.ts` + `drive.test.ts` (pure logic, independently testable, no UI
   dependency) — first, since everything else calls into it.
2. `dictionary.svelte.ts` (two terms) — small, unblocks the component work next.
3. `ReportBug.svelte` (paste UI + `loadPasted()`) — depends on both of the above.
4. `App.svelte` (`loadRecord` + wiring the new `onload` prop) — depends on
   `ReportBug.svelte`'s new prop existing.
5. `app.terminology.coverage.ssr.test.ts` — depends on the dictionary entries
   existing and `ReportBug.svelte` rendering them.
6. `paste-load.tap.svelte.test.ts` — depends on everything above; written last,
   exercises the full wired path end to end.

## Public interfaces introduced

- `drive.ts`: `LoadResult` (exported type), `loadPastedRecord(text: string):
  LoadResult` (exported function). No changes to any existing exported signature.
- `ReportBug.svelte`: one new prop, `onload: (record: GameRecord) => void`.
  Existing props (`open`, `message`, `report`, `issueLink`, `onmessage`, `onclose`)
  unchanged.
- `App.svelte`: no new exported surface (it's the app root); one new internal
  function `loadRecord`.
- `dictionary.svelte.ts`: two new `TermKey` union members, extending (not
  narrowing) the existing type — every existing `term()` call site is unaffected.

## Nothing in `src/core/` changes

`parseGameRecord`, `serializeGameRecord`, `foldGame`, `GameRecord` are all already
exported and already exactly fit for this ticket's purpose — confirmed in Research.
This ticket is entirely `src/app/` wiring plus tests.
