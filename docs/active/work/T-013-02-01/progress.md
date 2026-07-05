# Progress — T-013-02-01: report-bug-dialog

All plan steps complete. Commits, in order:

1. `T-013-02-01: buildReportText/buildIssueUrl in drive.ts` — pure logic + unit tests.
2. `T-013-02-01: dictionary terms for the report-bug dialog` — five new `TermKey`s.
3. `T-013-02-01: ReportBug.svelte modal dialog component` — new component.
4. `T-013-02-01: wire ReportBug dialog into App.svelte` — header button, state,
   derived report/issue values, six input guards.
5. `T-013-02-01: feature-detect dialog showModal/close for jsdom` — amendment
   discovered mid-implementation (see below).
6. `T-013-02-01: report-bug dialog tap-interaction suite` — 7 end-to-end cases.
7. `T-013-02-01: SSR terminology coverage for the report-bug dialog` — both-terminology
   label sweep.

## Deviation from plan.md

**jsdom has no `<dialog>` method support at all** (discovered writing Step 4's manual
sanity note, confirmed with a throwaway Node/jsdom script before touching the
component): `HTMLDialogElement.prototype.showModal`/`close` are simply absent in this
project's pinned jsdom 29.1.1, and `<form method="dialog">` submission does nothing
(jsdom logs "Not implemented: HTMLFormElement's requestSubmit()" and never closes the
dialog). Plan step 4 assumed the native APIs would work unconditionally; the actual
component (Step 4's commit, amended by Step 5) feature-detects `showModal`/`close` and
falls back to toggling the `open` attribute by hand, and the close button became a
plain `onclick` handler instead of `formmethod="dialog"`. Both design.md and structure.md
were updated in-place (an "Amendment" section in design.md) rather than left
inconsistent with what shipped. This has no effect on the AC or real-browser
behavior — every evergreen browser has full `<dialog>` support, so the fallback path is
dead code there; it exists solely so this project's own `dom` vitest project can mount
and exercise the dialog at all.

One test-helper deviation, not a design change: the original "pauses table input"
interaction test used `handTileCount` (a "your hand" `<li>` count) as its
before/after proxy, matching plan.md's sketch. First run revealed this is the wrong
signal — a discard (tedashi) removes ONE concealed tile and the drawn tile fills the
vacancy, so hand size stays 13 either way. Switched to counting East's discard pond
(`eastPondCount`, mirroring `app.riichi.tap.svelte.test.ts`'s own `eastPondKinds`
helper) — the correct observable proof a discard registered, following the precedent
already established elsewhere in this test suite. Also had to advance the bot-pacing
timer to the point where the dealer's opening draw has landed before a discard is even
legally offered — the very first test attempt clicked a hand tile before that draw,
which is a legitimate no-op for reasons unrelated to `reportOpen` at all, and the
original assertions could not tell the difference. `tickUntil` (duplicated per this
codebase's per-file test-helper convention, matching `app.riichi.tap.svelte.test.ts`)
now gates the pause/restore test on `[aria-label="drawn tile"]` appearing first.

No other deviations. Every file listed in structure.md was touched exactly as
specified; no additional files were created or modified.

## Verification

- `npx vitest run src/app/drive.test.ts` — 87/87 (includes the new `buildReportText`/
  `buildIssueUrl` blocks).
- `npx vitest run src/app/report-bug.tap.svelte.test.ts` — 7/7.
- `npx vitest run src/app/app.terminology.coverage.ssr.test.ts` — 34/34 (includes the
  new `report dialog` describe block).
- `just test` — 43 files, 1013/1013 passing (full suite, core + app).
- `just check` — svelte-check + tsc, 209 files, 0 errors, 0 warnings.
- `just build` — single-file gate green (`dist/index.html`, 114887 bytes, self-contained).

Not run: a live browser manual pass (`just dev`) — this session has no interactive
browser available. See review.md's open concerns for what that pass would need to
confirm.
