# Plan — T-013-02-01: report-bug-dialog

Each step is independently committable; `just test` (or targeted `npx vitest run
<file>`) and `just check` should pass after every step before moving on.

## Step 1 — `drive.ts`: `buildReportText` + tests

- Add `BugReport` interface and `buildReportText`. Format:
  ```
  <message>

  ---
  terminology: <terminology>
  hand: <handIndex>
  actions: <actionCount>
  origin: <origin>
  ---
  <notation>
  ```
  (exact separator/labels decided at write time; the test asserts against the function's
  OWN literal output, not a hand-duplicated format string, to avoid a tautological test —
  instead assert each of the 6 pieces of information appears, plus exact message and
  exact notation substring presence, plus a stable overall shape via one full fixed
  snapshot-style string for one concrete `BugReport` input).
- Empty message is valid input (empty string, not required).
- Unit tests in `drive.test.ts`: exact output for one concrete fixture object; message
  containing embedded newlines is preserved verbatim (not escaped/mangled).
- Verify: `npx vitest run src/app/drive.test.ts`.

## Step 2 — `drive.ts`: `buildIssueUrl` + tests

- `GITHUB_REPO = 'johnhkchen/mahjong'`, `MAX_ISSUE_URL_LENGTH = 6000`.
- `buildIssueUrl(title, body)`:
  ```ts
  export function buildIssueUrl(title: string, body: string): IssueLink {
    const base = `https://github.com/${GITHUB_REPO}/issues/new`
    const full = `${base}?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`
    if (full.length <= MAX_ISSUE_URL_LENGTH) return { url: full, clipboardFirst: false }
    const shortBody = 'This report is long — paste the copied report into this issue instead.'
    return {
      url: `${base}?title=${encodeURIComponent(title)}&body=${encodeURIComponent(shortBody)}`,
      clipboardFirst: true,
    }
  }
  ```
- Tests: a short body stays `clipboardFirst: false` with a URL containing the exact
  `encodeURIComponent` of title/body; a body engineered to push the full URL length past
  6000 (e.g. `'x'.repeat(6500)`) returns `clipboardFirst: true` and a url containing the
  short body's own encoded text, NOT the long body; a boundary case at exactly the
  threshold (construct a body whose encoded URL is exactly 6000 chars) takes the
  `<=` branch — assert the exact boundary behavior explicitly since Design named it.
- Verify: `npx vitest run src/app/drive.test.ts`.

## Step 3 — `dictionary.svelte.ts`: five new terms

- Add `reportBug`, `copyReport`, `openIssue`, `reportMessage`, `reportCopied` to
  `TermKey` and `TERMS` (romaji: 'report bug', 'copy report', 'open issue', 'message',
  'copied'; zh-hant: pick natural Traditional Chinese equivalents, e.g. 回報問題 /
  複製回報 / 開啟議題 / 訊息 / 已複製— final call at write time, no test asserts
  translation correctness per the file's own documented caveat).
- Verify: `npx tsc --noEmit` (or `just check`) — no other file references these keys
  yet, so nothing else should break.

## Step 4 — `ReportBug.svelte`

- Build per structure.md's markup shape. Local state: `copied = $state(false)`, a
  `$effect` for the `open`-driven `showModal()`/`close()` call, a `copyReport()` handler
  that awaits `navigator.clipboard.writeText(report)` then sets `copied = true` with a
  ~1500ms auto-clear timer (mirrors `App.svelte`'s own `NOTICE_DURATION_MS` pattern,
  new local constant, not imported — presentation-only, single-component scope, matches
  `guarded`'s existing precedent of NOT sharing every timing constant).
- No `mount-guard.ts` import (Decision 5).
- `<dialog>`'s native `close` event (fires on Escape-dismiss too) is the ONE source that
  calls `onclose?.()` — the cancel button is a plain `<button formmethod="dialog">`
  inside a `<form method="dialog">` so browsers close it natively; this makes Escape,
  backdrop click (if enabled), and the cancel button all converge on the same `onclose`
  path rather than three separate handlers.
- Verify: no test yet exercises this file directly (it's exercised via `App.svelte` in
  Step 6) — confirm `just check` is clean (types) and manually sanity-check via `just
  dev` that the dialog opens/closes, textarea works, at this point still unwired from
  `App.svelte` (skip if not yet mounted anywhere — defer manual check to Step 6).

## Step 5 — Wire `ReportBug` into `App.svelte`

- Add imports, state, derived values, handlers exactly as structure.md specifies.
- Add the header button (`.report-bug-toggle`, joins the shared CSS selector list).
- Add the six `if (reportOpen) return` guards (Decision 8) — place as the FIRST line
  inside `tap`, `claim`, `pass`, `takeWin`, `declareRiichi`, `declineRiichi`.
- Mount `<ReportBug .../>` after the existing markup.
- Verify: `just check` clean; `npx vitest run` — every EXISTING test file must still
  pass unchanged (no test currently opens the dialog, so `reportOpen` stays false and
  no existing behavior should change; if any existing test breaks, it means a guard or
  prop wiring leaked into the default-closed path incorrectly — fix before proceeding).

## Step 6 — `report-bug.tap.svelte.test.ts`

- Write the 8 cases from structure.md in order (open+report-contents, message-live-
  update, copy-clipboard, issue-url-shape, long-message-clipboard-first, input-inert-
  while-open, restored-after-close, both-terminologies).
- Clipboard mock: a `beforeEach` in this file (not a shared setup file — matches this
  codebase's per-file duplication convention) defining
  `Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
  writeText: vi.fn().mockResolvedValue(undefined) } })`, restored/redefined fresh each
  test (jsdom's `navigator` persists across tests in the same file unless reset).
- For case 6 (input-inert), use the app's existing `handButtons`/pond-reading helper
  style (duplicate the small helpers from `app.riichi.tap.svelte.test.ts` as this
  codebase's convention dictates) to snapshot rendered hand/pond HTML before and after
  an attempted tap while `reportOpen` is true, asserting no change; then close and
  assert a subsequent tap DOES change it.
- Verify: `npx vitest run src/app/report-bug.tap.svelte.test.ts`.

## Step 7 — `app.terminology.coverage.ssr.test.ts` addition

- New `describe('report dialog')` rendering `ReportBug` via `svelte/server`'s `render`
  with `open: true` and minimal fixed `report`/`issueLink` props, asserting the five new
  labels under both terminologies (reuse the file's existing `EXPECTED` table pattern —
  add the five keys to both `romaji`/`zh-hant` sub-records).
- Verify: `npx vitest run src/app/app.terminology.coverage.ssr.test.ts`.

## Step 8 — full verification pass

- `just test` (whole suite green, including core's untouched 773+ tests).
- `just check` (svelte-check + tsc clean).
- `just build` (single-file gate — confirms `vite-plugin-singlefile` still inlines
  everything into one `dist/index.html`; the new `<dialog>`/clipboard code has no new
  external asset or network call, so this should need no special handling, but the AC
  names "single-file gate green" explicitly).
- Manual sanity pass via `just dev`: open the dialog, type a message, hit copy (confirm
  a real clipboard write in an actual browser, not just the jsdom mock), confirm the
  issue link opens a prefilled GitHub new-issue page, confirm background taps do
  nothing while open and resume after close.

## Commit boundaries

Roughly one commit per step (1+2 may combine as one "drive.ts additions" commit since
both are pure, reviewed together naturally; 3 alone; 4 alone; 5 alone; 6 alone; 7 alone).
`progress.md` tracks actual commits as they land, matching the RDSPI Implement contract.
