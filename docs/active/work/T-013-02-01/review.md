# Review — T-013-02-01: report-bug-dialog

## Summary

Adds the reporter's half of E-013 ("bug report is a hand log"): a header "report bug"
affordance that opens a modal dialog holding a freeform message field and an
auto-attached, read-only report — `serializeGameRecord(record)` (T-013-01-01's
notation) plus context (terminology, hand index, action count, app origin) — with two
delivery paths: copy-to-clipboard (always works) and a prefilled GitHub new-issue URL
for `johnhkchen/mahjong`, falling back to a short clipboard-first body once the encoded
URL would exceed ~6000 chars. The table is inert to player input while the dialog is
open. This is the first true modal in the app; every prior "prompt" (`ClaimPrompt`,
`RiichiPrompt`) was an always-in-flow console element, never something that paused
play underneath it.

## Files changed

- **`src/app/drive.ts`** (+~90 lines) — two new pure exports: `buildReportText`
  (formats message + context block + notation into the one string both delivery paths
  send) and `buildIssueUrl` (encodes a `github.com/.../issues/new` URL, falling back to
  a fixed short clipboard-first body past `MAX_ISSUE_URL_LENGTH = 6000`). Both are
  DOM-free, unit-tested without mounting anything, following this file's existing
  discipline.
- **`src/app/drive.test.ts`** (+~85 lines) — `describe('buildReportText')` /
  `describe('buildIssueUrl')` blocks: exact-output assertions, empty-message handling,
  short/long/boundary-exact URL-length cases.
- **`src/app/dictionary.svelte.ts`** (+11 lines) — five new `TermKey`s for the dialog's
  own chrome (`reportBug`, `copyReport`, `openIssue`, `reportMessage`, `reportCopied`).
  The report BODY itself (context lines, the notation) deliberately stays outside the
  dictionary — it's a machine-parseable artifact for an English-speaking maintainer,
  not player-facing prose (design.md Decision 4, same carve-out the module's own header
  already documents for other full-sentence content).
- **`src/app/ReportBug.svelte`** (new, ~220 lines) — the dialog component: a native
  `<dialog>` driven by `showModal()`/`close()` when available, feature-detected with an
  `open`-attribute fallback (see Amendment below); message textarea, read-only report
  `<pre>`, copy button (with a transient "copied" confirmation), issue link `<a>`, a
  conditional clipboard-first instruction, and a close button. No `mount-guard.ts`
  double-tap guard — that pattern exists for reactively-remounting prompts during live
  play, and this dialog opens from one deliberate header tap with no such race
  (design.md Decision 5).
- **`src/app/App.svelte`** (+~65 lines) — `reportOpen`/`reportMessage` state, derived
  `handIndex`/`actionCount`/`origin`/`reportNotation`/`reportText`/`issueLink`, the
  header button (joining the existing three-button shared style selector), the
  `<ReportBug>` mount, and one-line `if (reportOpen) return` guards at the top of
  `tap`/`claim`/`pass`/`takeWin`/`declareRiichi`/`declineRiichi` — the explicit,
  test-observable half of "input underneath is inert" (design.md Decision 8). The
  bot-pacing `$effect` is deliberately NOT paused; see Open Concerns.
- **`src/app/report-bug.tap.svelte.test.ts`** (new, ~185 lines) — 7 end-to-end cases
  against a real mounted `App`: exact notation+context in the report; live message
  reflection; clipboard write on copy (jsdom clipboard mocked via
  `Object.defineProperty`, jsdom has no Clipboard API at all); correctly-encoded issue
  URL; clipboard-first fallback past the length threshold; input paused while open and
  restored after close (proxied via East's discard-pond count, not hand-tile count —
  see Deviation below); both-terminology label check on the live toggle path.
- **`src/app/app.terminology.coverage.ssr.test.ts`** (+35 lines) — a new `describe('report
  dialog')` block, SSR-rendering `ReportBug` under both terminologies, asserting the
  five new labels.
- **`docs/active/work/T-013-02-01/{research,design,structure,plan,progress}.md`** — the
  RDSPI artifacts preceding this one.

No existing export's signature changed; no file outside this list was touched.

## AC verification

- ✅ **Report text contains the exact `serialize()` output and the user message**:
  `report-bug.tap.svelte.test.ts`'s first two cases assert the report `<pre>` contains
  `serializeGameRecord({ seed, hands })` computed independently in the test (not read
  off the component's own internals) and the live-typed message.
- ✅ **Copy puts the full report on the clipboard (jsdom clipboard mock)**: mocked via
  `Object.defineProperty(navigator, 'clipboard', ...)` in `beforeEach`; asserts
  `writeText` was called with a string containing both the message and the notation.
- ✅ **Issue URL correctly encoded, switches to clipboard-first past ~6k**:
  `buildIssueUrl` unit tests (exact encoding, short/long/exact-boundary cases) plus an
  end-to-end case typing a 7000-char message and asserting the href swaps to the short
  body and the dialog shows the instruction note.
- ✅ **Game input underneath is paused or inert while open**: `App.svelte`'s six
  explicit guards, proven by the pond-count-unchanged-then-changed interaction test.
- ✅ **Both terminologies covered**: the tap suite's live-toggle case plus the SSR
  coverage sweep's new `describe('report dialog')` block.
- ✅ **Single-file gate green**: `just build` → `verify-single-file: OK — dist/index.html
  is self-contained (114887 bytes)`.
- ✅ **`just test`/`just check` clean**: 1013/1013 tests, 209 files / 0 errors / 0
  warnings.

## Deviation from the plan (see progress.md for the full account)

jsdom 29.1.1 implements the `<dialog>` element but neither `showModal()`/`close()` nor
form-owned `method="dialog"` submission — calling either unconditionally would throw in
every test that opens this dialog. `ReportBug.svelte` feature-detects and falls back to
manually toggling the `open` attribute; the close button became a plain `onclick`
handler. This is dead code in every real browser (full `<dialog>` support is universal
in evergreen browsers) — it exists purely so this project's own test suite can exercise
the component at all. `design.md` carries a dedicated "Amendment" section documenting
this since it wasn't anticipated in Design/Structure.

The pause/restore interaction test also needed two corrections mid-write: (1) hand tile
*count* is the wrong discard proxy (a tedashi discard removes one concealed tile but
the drawn tile fills the vacancy, so hand size is invariant at 13) — switched to
counting East's discard pond, matching `app.riichi.tap.svelte.test.ts`'s own
`eastPondKinds` precedent; (2) a discard isn't legally offered at all until the
dealer's own opening draw lands, so the test now ticks the bot-pacing timer forward to
`[aria-label="drawn tile"]` first, exactly like the other tap suites already do.

## Test coverage assessment

Strong on every AC clause and on the two most novel implementation risks this ticket
introduced (jsdom's total lack of `<dialog>` behavior, and the tedashi hand-size
invariant that would have made the pause-guard test a false negative either way).

**Gaps / things a human reviewer may want to weigh**:
- **No live-browser manual pass.** plan.md's Step 8 called for opening the dialog in an
  actual browser via `just dev` to confirm a real clipboard write, a real prefilled
  GitHub issue page opening, and genuine `showModal()` inertness/focus-trapping. This
  session has no interactive browser available, so that pass was not run — everything
  above is verified through jsdom (which cannot exercise the real modal path at all,
  per the Amendment) and unit tests. The real-browser `showModal()` path is,
  structurally, dead-simple (one conditional call this component already exercises the
  `else` branch of), but it has literally never been driven by any test in this repo.
  Recommend a manual check before shipping, or a follow-up ticket if this project ever
  adds a real-browser test runner (e.g. Playwright) — none exists today.
- **The bot-pacing `$effect` is not paused while the dialog is open** (design.md
  Decision 8's explicit scope cut): a bot could draw/discard/call while the player is
  composing a report. This does not corrupt anything (the fold is still driven by the
  one authoritative `hands` log) and the AC only names *player* input, but a player
  writing a long message could return to find the table has advanced several turns —
  arguably surprising, and worth a product call on whether a future ticket should pause
  the clock too (would need its own resume-on-close bookkeeping, deliberately deferred
  here rather than half-built).
- **The exact report text format is this ticket's own invention** — the AC doesn't
  specify field order or separator punctuation, only that message + notation + context
  (terminology/hand index/action count) must all be present. `buildReportText`'s chosen
  shape (message, then a `---`-delimited context block, then the notation) is
  documented in Design/Structure and tested against its own literal output; a future
  ticket parsing pasted reports back (T-013-02-02, already on the board) will need to
  either read this same shape or treat the message/context block as free text and
  extract only the notation lines — worth flagging to whoever picks that ticket up,
  since `buildReportText`'s exact format is not itself part of the versioned notation
  contract (`NOTATION_VERSION` only governs `serializeGameRecord`'s own grammar).
- **zh-hant translations for the five new labels are original, not reviewed by a native
  speaker** — same caveat every prior terminology ticket's own review already carries
  (T-010-01-01/02, T-012-01-02).
- The clipboard-first fallback's short body text ("This report is long — paste the
  copied report into this issue instead.") is hardcoded English in both terminologies —
  intentional (design.md Decision 4's carve-out), consistent with the riichi-stakes
  bullets' own precedent, but worth a second look if a future ticket decides
  instructional prose like this SHOULD be translated after all.
