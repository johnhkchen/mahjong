# Design — T-013-02-01: report-bug-dialog

## Decision 1: a new `ReportBug.svelte` component, native `<dialog>` + `showModal()`

**Chosen**: one new component, `src/app/ReportBug.svelte`, mounted unconditionally
inside `App.svelte` (like `ClaimPrompt`/`RiichiPrompt` are conditionally mounted), wired
to a `<dialog>` element and driven with `.showModal()`/`.close()` imperatively from an
`$effect`.

**Rejected: manual overlay div + `inert` attribute on `<main>`.** Would need: a
fixed-position backdrop, manual focus trap, manual Escape-key handling, and setting
`inert` on every sibling by hand — four concerns `<dialog>` provides for free
(`showModal()` puts the dialog in the top layer, makes everything outside it inert to
pointer/keyboard interaction and screen readers, and Escape-to-close is built in). No
dependency, a real platform primitive, and it directly satisfies the AC's "game input
underneath is paused or inert while the dialog is open" — that IS `showModal()`'s
documented behavior, not something this ticket needs to hand-implement or test-prove
beyond confirming the dialog is open (jsdom does not implement inertness/top-layer
behavior for `<dialog>`, so this can't be asserted via jsdom DOM queries directly — see
Decision 5, Test Strategy below).

**Rejected: reusing the `.console` slot pattern (`ClaimPrompt`/`RiichiPrompt`'s
in-flow `<aside>`).** Those are always non-modal, in-flow prompts that coexist with a
still-live table underneath (a claim prompt doesn't pause the bot loop or the pond
rendering). This feature explicitly wants the OPPOSITE: table input paused. Forcing it
into the existing prompt cascade would also fight that cascade's own precedence rules
(claim > notice > riichi > hint) for no reason — report-bug is orthogonal to game flow,
triggered from the header, not the console.

## Decision 2: report text lives behind one pure builder function in `drive.ts`

**Chosen**: a new pure function in `src/app/drive.ts`:

```ts
export interface BugReport {
  readonly message: string
  readonly notation: string
  readonly terminology: Terminology
  readonly handIndex: number
  readonly actionCount: number
  readonly origin: string
}

export function buildReportText(report: BugReport): string
```

`buildReportText` formats the four context fields plus the notation and the user's
message into one deterministic string — the same content both delivery paths (copy,
issue body) send. `ReportBug.svelte` calls this with props it's handed (message from its
own local textarea state, everything else passed down from `App.svelte`, which already
holds `record`, `hands`, `activeTerminology()`). This keeps `drive.ts`'s existing
discipline (pure app-level logic, zero DOM, unit-testable without mounting) and mirrors
how `seatScoresOf`/`windowOutcome` already live there rather than inline in `App.svelte`.

**Rejected: building the report string inline inside `ReportBug.svelte`.** Every other
`.svelte` file in this codebase is presentation-only; string assembly this involved
(four context lines + a notation blob + a message) is exactly what `drive.ts` exists to
hold, and a pure function is trivially unit-tested in `drive.test.ts` without touching
Svelte/jsdom at all — cheaper and more precise than only ever exercising it through a
mounted dialog.

**Rejected: importing `serializeGameRecord` directly inside `ReportBug.svelte`.** Same
reasoning — the component should stay a pure consumer of `drive.ts`'s output, not reach
into `core` itself. (`App.svelte` already imports both `core` and `drive.ts`
directly for other props, so this is a routing choice, not a hard rule, but keeping the
notation-shaping logic in one place avoids a second implementation of "what a report
contains" appearing inline in markup.)

## Decision 3: the GitHub issue URL builder is a second pure `drive.ts` function

```ts
export interface IssueLink {
  readonly url: string
  readonly clipboardFirst: boolean
}

export function buildIssueUrl(title: string, body: string): IssueLink
```

Builds `https://github.com/johnhkchen/mahjong/issues/new?title=<enc>&body=<enc>`.
Measures the FULL resulting URL string length against a `MAX_ISSUE_URL_LENGTH = 6000`
constant (co-located, exported for the test file to reference rather than duplicating
the magic number — matching `MOUNT_GUARD_MS`'s precedent of a shared exported constant
rather than restating it). When the encoded URL would exceed the threshold, `url` is
rebuilt with a SHORT fixed body ("this report is long — paste the copied report into
this issue instead") and `clipboardFirst: true`; the title is preserved either way. The
dialog reads `clipboardFirst` to decide whether to show the "paste from clipboard"
instruction text.

**Rejected: truncating the body to fit.** A truncated notation is a corrupted report —
`parseGameRecord` would either fail confusingly or (worse) silently parse a truncated
prefix into a wrong-but-valid record. Silent corruption is exactly what this ticket's
whole premise (a bug report reproduces EXACTLY) cannot tolerate; falling back to
clipboard-first for the long case is the honest behavior the ticket already names.

## Decision 4: dictionary entries for this feature's own labels only

New `TermKey` entries: `reportBug`, `copyReport`, `openIssue`, `reportMessage`,
`reportCopied` (the copy-confirmation microcopy). These are feature-specific verbs/nouns
exactly like `declareRiichi`/`notYet`/`nextHand` already are — added to `TERMS` and
covered in `app.terminology.coverage.ssr.test.ts`'s existing per-terminology sweep
pattern (a new `describe('report dialog')` block there, SSR-rendering `ReportBug` under
both terminologies).

**Rejected: routing the notation/context block through `term()`.** The report BODY
(context lines like "hand index: 2", the notation itself) is machine-consumable text
meant to be pasted verbatim into a parser and read by the (English-speaking, per the
GitHub-issues audience) maintainer — not user-facing prose a Traditional-Chinese-reading
player needs translated. Only the DIALOG'S OWN chrome (button labels, the message
field's label/placeholder, the dialog's heading) are dictionary-routed; this mirrors the
dictionary module's own documented carve-out ("full-sentence prose... stays English
scaffolding"). The AC's "dictionary terms for all labels" is read literally as labels
(buttons, headings, field labels), not as "everything the dialog renders."

## Decision 5: no `mount-guard.ts` input guard on this dialog

**Chosen**: `ReportBug.svelte`'s buttons are NOT wrapped in the `guarded` mount-input
pattern `ClaimPrompt`/`RiichiPrompt` use.

**Why**: that guard exists specifically for prompts that mount/remount REACTIVELY,
mid-play, sometimes in tight succession (a fresh claim window opening right after a
prior one closed) — the race is "a tap aimed at the closing prompt lands on the newly
mounted one instead." The report dialog opens from one discrete, deliberate header tap
and there is no reactive remount race: it doesn't reopen itself, isn't keyed to game
state, and closing it never causes an immediate re-mount of itself. Adding the guard
would be defending against a race this component cannot experience — introducing
complexity the codebase's own "no design for hypothetical future requirements" bias
argues against.

## Decision 6: dialog open/close state lives in `App.svelte`, not the component

`App.svelte` holds `let reportOpen = $state(false)`, toggled by the header button and
by the dialog's own close/cancel affordance (via an `onclose` callback prop, mirroring
`onnext`/`ondeclare` elsewhere). `ReportBug.svelte` receives `open: boolean` as a prop
and its own `$effect` calls `dialogEl.showModal()`/`.close()` to follow it — this
mirrors the codebase's existing convention that presentation state affecting >1
concern (or that other future features might need to read/toggle) lives in `App.svelte`
(`dismissed`, `notice`), while purely-internal, single-component state (`guarded` in
`ClaimPrompt`) stays local. Whether the game record can still be corrupted by input
"underneath" while open is irrelevant to this state, since `showModal()` handles
inertness structurally, independent of `reportOpen`'s Svelte-level truth — `reportOpen`
only decides whether the `<dialog>` element itself is asked to be modal.

**Rejected: fully self-contained state (a plain header `<button popovertarget=...>`
with no App-level boolean).** Native `popovertarget`/`<dialog>` interop for imperative
`showModal()` calls still needs a JS-owned open/closed boolean somewhere to drive the
`$effect`; keeping it in `App.svelte` costs one `$state` line and keeps the toggle
consistent with the header's other three buttons, which already live there.

## Decision 7: clipboard access wrapped in a tiny local helper, not `drive.ts`

`writeText` lives directly in `ReportBug.svelte` (a one-line `navigator.clipboard.
writeText(text)` call inside the copy button's handler) rather than in `drive.ts`,
because it is a genuine DOM/browser-API side effect (not a pure computation) — `drive.ts`'s
whole discipline is being DOM-free pure logic over `HandAction`/`TableState`. This one
call is the sole DOM-touching code this ticket adds outside `.svelte` files, and it stays
inside the component that owns the button, exactly where `App.svelte`'s own
`setTimeout`/`localStorage` calls already live (in effects/handlers, not in `drive.ts`).

## Amendment (discovered during Implement): jsdom has no `<dialog>` method support

jsdom 29.1.1 (this project's pinned devDependency) implements the `<dialog>` ELEMENT
but not `showModal()`/`close()`, nor form-owning `method="dialog"` submission at all —
calling either unconditionally throws in every test that mounts this dialog.
`ReportBug.svelte`'s effect feature-detects `typeof dialogEl.showModal === 'function'`
and falls back to toggling the `open` attribute by hand when absent; the close button
is a plain `type="button"` with an explicit `onclick={() => onclose?.()}` rather than a
`method="dialog"` form, since jsdom cannot fire a submit-driven close at all. This does
not weaken Decision 1 or Decision 8 in real browsers (every evergreen browser has full
`<dialog>` support; the fallback path is dead code there) — it only means this
project's OWN test suite exercises the non-modal fallback rendering, with
`reportOpen`'s explicit handler guards (Decision 8) doing the actual inertness proof
work in that environment, exactly as Decision 8 already anticipated ("the thing the
interaction test actually asserts against ... rather than asserting on browser-internal
inertness this project can't observe from jsdom").

## Decision 8: an explicit `reportOpen` guard in App.svelte's own handlers, not reliance on `<dialog>` alone

Native `showModal()` inertness is real in evergreen browsers, but jsdom's `<dialog>`
implementation does not model top-layer/inert semantics at all (clicks on background
elements still fire in jsdom regardless of `open`) — so relying on it alone would make
the AC's "game input underneath is paused or inert" both unverifiable in this
project's own test environment AND, in a browser without full `<dialog>` support,
un-enforced. `tap`/`claim`/`pass`/`takeWin`/`declareRiichi`/`declineRiichi` in
`App.svelte` each gain a one-line guard (`if (reportOpen) return`) at their top —
belt-and-suspenders with the native modal behavior, and the thing the interaction test
actually asserts against (deterministic, jsdom-verifiable) rather than asserting on
browser-internal inertness this project can't observe from jsdom. The `$effect` driving
`forcedAction`'s bot-pacing loop is NOT paused this way — the ticket's own AC only names
*player* input being paused (freeform message entry, clipboard/issue actions co-existing
with an inert table underneath); pausing the bot clock too would be a bigger, unasked-for
behavior change and would need its own resume-on-close bookkeeping. Left running, the
worst case is a bot discard lands while the dialog is open, which the player simply sees
once they close it — never a state corruption, since the fold is still driven by the
single authoritative `hands` log either way.

## Test strategy sketch (elaborated fully in Plan)

- `drive.test.ts`: unit tests for `buildReportText` (exact string shape, all four context
  fields present) and `buildIssueUrl` (correct encoding, correct threshold behavior at
  the boundary, both under/over ~6k).
- A new `report-bug.tap.svelte.test.ts`: mounts real `App`, opens the dialog via the
  header button, asserts the report `<pre>`/`<textarea readonly>` contains the exact
  `serializeGameRecord(record)` output plus the typed message; mocks
  `navigator.clipboard.writeText` (`vi.fn()`, defined via `Object.defineProperty` since
  jsdom has no clipboard implementation) and asserts the copy button calls it with the
  full report string; asserts the issue-link `<a href>`/button target contains the
  correctly-encoded URL, and a synthetic long-message case crosses the 6k threshold and
  switches to the clipboard-first short body + visible instruction text. A "background
  input inert" assertion is necessarily a *behavioral proxy* in jsdom (jsdom does not
  model `<dialog>` top-layer inertness) — see Structure/Plan for the exact assertion
  (dialog's `open` attribute/`HTMLDialogElement.open` true, and that a discard tap
  behind it does not mutate `hands` while open — the latter checkable directly since
  `hands` is inspectable via the mounted component's reactive output).
- `app.terminology.coverage.ssr.test.ts`: new `describe('report dialog')` block,
  SSR-rendering `ReportBug` under both terminologies, asserting the new `TermKey`
  labels render correctly (dialog heading, both button labels, message field label).
