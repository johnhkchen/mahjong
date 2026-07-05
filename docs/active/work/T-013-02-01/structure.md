# Structure — T-013-02-01: report-bug-dialog

## Files created

### `src/app/ReportBug.svelte` (new)

Props:
```ts
let {
  open,
  message = '',
  report,           // the full report string (drive.ts's buildReportText output)
  issueLink,        // drive.ts's IssueLink ({ url, clipboardFirst })
  onmessage,        // (text: string) => void — message textarea input
  onclose,          // () => void — dialog dismissed (Escape, backdrop, cancel button)
}: {
  open: boolean
  message?: string
  report: string
  issueLink: IssueLink
  onmessage?: (text: string) => void
  onclose?: () => void
} = $props()
```

Markup shape:
- `<dialog bind:this={dialogEl} onclose={() => onclose?.()} aria-label="report a bug">`
  - heading: `<h2>{term('reportBug')}</h2>`
  - `<textarea aria-label={term('reportMessage')} placeholder={term('reportMessage')}
    value={message} oninput={...}>` — freeform message
  - `<pre aria-label="report preview">{report}</pre>` — read-only, the auto-attached
    report (message is NOT duplicated into `report`'s own display copy — see Plan step
    3 on how `report` prop is composed by the caller so the preview always reflects the
    live message)
  - a copy-confirmation transient (`copied` local `$state<boolean>`, cleared on a
    timeout — same shape as `App.svelte`'s own `notice` auto-clear, reused pattern not
    reinvented) rendering `term('reportCopied')` after a successful copy
  - two delivery buttons: `aria-label={term('copyReport')}` (calls
    `navigator.clipboard.writeText(report)`), and an `<a>`/button
    `aria-label={term('openIssue')}` with `href={issueLink.url}` `target="_blank"
    rel="noopener"` — when `issueLink.clipboardFirst` is true, an additional inline
    note renders near the issue link (a plain string, not dictionary-routed per Decision
    4 — instructional prose, same carve-out as the riichi-stakes bullets)
  - `<form method="dialog">` cancel button (`aria-label` "close", generic UI word, not
    dictionary-routed) triggering the dialog's native `close` event → `onclose`

`$effect` block: `if (open) dialogEl.showModal(); else if (dialogEl.open) dialogEl.close()`.

Style block: matches the existing console-prompt palette (`#124534`/`#2e7d4f`/`#eaf3ee`)
and the codebase's real-44px-touch-target convention for both buttons; `<dialog>`'s
default UA backdrop is overridden with `::backdrop` styled to the same dark palette
(`background: rgba(16,36,27,0.72)`, mirroring `App.svelte`'s own `#10241b` page
background) so the modal doesn't look like a foreign browser chrome popup.

### `src/app/report-bug.tap.svelte.test.ts` (new)

Mounts real `App` (mirrors `app.riichi.tap.svelte.test.ts`'s `mountApp` helper,
duplicated per this codebase's established per-file convention). Covers:
1. Opening the dialog via the header `report bug` button shows the report containing
   the exact `serializeGameRecord(record)` output for the live game (asserted against
   `serializeGameRecord` imported directly from `../core`, applied to a hand-built
   record matching the fixture's actions — mirrors how other tap suites assert against
   independently-recomputed expected values rather than the component's own internals).
2. Typing into the message textarea updates the report text live (message appears in
   the copied/report content).
3. Clicking "copy report" calls the mocked `navigator.clipboard.writeText` with the
   full report string (message + notation + context) — clipboard mocked via
   `Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
   writeText: vi.fn().mockResolvedValue(undefined) } })` in a `beforeEach`.
4. The issue-link href is a correctly `encodeURIComponent`-ed
   `https://github.com/johnhkchen/mahjong/issues/new?title=...&body=...` for a normal
   short report.
5. A synthetic long message (padded past the 6000-char URL threshold) flips the issue
   link to the short clipboard-first body and renders the "paste from clipboard"
   instruction text.
6. While the dialog is open, tapping a hand tile (or any other table control) does not
   change `hands`/the rendered pond — asserted by comparing the rendered hand/pond DOM
   before and after a tap attempt while `open` is true, matching Decision 8's explicit
   guard (this is the concrete, jsdom-checkable stand-in for "input underneath is
   inert").
7. Closing the dialog (via the close button, which fires the native `close` event in
   jsdom same as a real dialog) restores normal input handling — a tap after close DOES
   register.
8. Both terminologies: the dialog's own chrome (heading/button labels) reads correctly
   under `zh-hant` — this duplicates a slice of what
   `app.terminology.coverage.ssr.test.ts` also covers via SSR, intentionally (this file
   proves the LIVE toggle path, the SSR file proves the label mapping itself, same
   split every other terminology-covered feature already has).

## Files modified

### `src/app/drive.ts`

Add, near the bottom (after `tenpaiHint`/`tapDiscard`, before `forcedAction` — grouped
with the other pure "app-level, non-legality" helpers):
- `export interface BugReport { message, notation, terminology, handIndex, actionCount, origin }`
- `export function buildReportText(report: BugReport): string`
- `export const GITHUB_REPO = 'johnhkchen/mahjong'`
- `export const MAX_ISSUE_URL_LENGTH = 6000`
- `export interface IssueLink { url, clipboardFirst }`
- `export function buildIssueUrl(title: string, body: string): IssueLink`

No changes to any existing export signature — pure additions.

### `src/app/drive.test.ts`

New `describe('buildReportText')` / `describe('buildIssueUrl')` blocks, unit-level,
no mounting — same file, appended, following its existing per-function `describe`
grouping convention.

### `src/app/dictionary.svelte.ts`

- `TermKey` union gains: `'reportBug' | 'copyReport' | 'openIssue' | 'reportMessage' | 'reportCopied'`
- `TERMS` gains five entries (romaji defaults matching the labels used directly in
  markup today, e.g. `reportBug: { romaji: 'report bug', 'zh-hant': '回報問題' }` — exact
  zh-hant strings decided during Implement, consistent with the existing
  "romaji === pre-ticket hardcoded English" invariant the module header documents).

### `src/app/App.svelte`

- New imports: `ReportBug` (component), `buildReportText`, `buildIssueUrl`,
  `GITHUB_REPO` from `./drive`, `term` already imported.
- New state: `let reportOpen = $state(false)`, `let reportMessage = $state('')`.
- New derived values:
  - `handIndex = $derived(hands.length - 1)`
  - `actionCount = $derived(activeHand().length)` — reuse the existing `activeHand()`
    helper (already defined for `tap`/`claim` etc.)
  - `origin = $derived(typeof location !== 'undefined' ? location.origin : 'offline')`
  - `reportNotation = $derived(serializeGameRecord(record))` (new import of
    `serializeGameRecord` from `../core`, alongside the existing core imports)
  - `reportText = $derived(buildReportText({ message: reportMessage, notation:
    reportNotation, terminology: activeTerminology(), handIndex, actionCount, origin }))`
  - `issueLink = $derived(buildIssueUrl('Bug report', reportText))`
- New handlers: `openReport()` (`reportOpen = true`), `closeReport()` (`reportOpen =
  false`), `setReportMessage(text: string)` (`reportMessage = text`).
- Guard additions (Decision 8) at the top of `tap`, `claim`, `pass`, `takeWin`,
  `declareRiichi`, `declineRiichi`: `if (reportOpen) return`.
- Header markup: one new `<button class="report-bug-toggle" onclick={openReport}
  aria-label={term('reportBug')}>{term('reportBug')}</button>` joining the existing
  three-button group, sharing their CSS selector block (rename the shared selector
  list to include `.report-bug-toggle` alongside `.new-game`/`.terminology-toggle`/
  `.call-prompt-toggle`).
- New markup: `<ReportBug open={reportOpen} message={reportMessage} report={reportText}
  {issueLink} onmessage={setReportMessage} onclose={closeReport} />` placed as a sibling
  after `<Table .../>` and the `.console` div (position irrelevant — `<dialog>` renders
  in the top layer regardless of DOM order).

### `src/app/app.terminology.coverage.ssr.test.ts`

New `describe('report dialog')` block (import `ReportBug`, render with a minimal fixed
prop set — `open: true`, a short fixed `report` string, a fixed `issueLink`), asserting
the five new labels render correctly under both terminologies. Follows the file's
existing per-feature `describe` grouping.

## Ordering

1. `drive.ts` + `drive.test.ts` (pure logic, no component dependency) — can be verified
   standalone with `just test` before touching any `.svelte` file.
2. `dictionary.svelte.ts` (new terms) — small, mechanical, unblocks both the component
   and its SSR coverage test.
3. `ReportBug.svelte` (new component) — depends on 1 and 2's exports.
4. `App.svelte` wiring (depends on 1, 2, 3 all existing).
5. `report-bug.tap.svelte.test.ts` (depends on the fully wired `App.svelte`).
6. `app.terminology.coverage.ssr.test.ts` addition (depends on 2, 3 only — can run in
   parallel with 4/5 once 3 lands).

No file outside this list changes. No deletions.
