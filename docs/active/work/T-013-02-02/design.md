# Design — T-013-02-02: paste-to-reproduce-loader

## Decision 1: extend `ReportBug.svelte` with a paste field, not a new dialog

**Chosen**: add a "load from paste" textarea + button INSIDE the existing report
dialog, below the copy/issue actions. One dialog, two jobs (report out, reproduce
in) — both are "the bug-report round trip," and both need the exact same context
(they're two ends of the same conversation: "here's what happened" / "make it
happen again").

**Rejected: a new dedicated `LoadRecord.svelte` dialog.** Would duplicate the
`<dialog>`/`showModal()`/jsdom-fallback machinery (research.md's "Existing dialog/
component conventions") for no functional gain, plus a second header button, a
second `reportOpen`-shaped boolean, and a second set of `if (xOpen) return` guards
sprinkled through `App.svelte`'s handlers. The AC never asks for a *separate*
affordance — the ticket text explicitly offers "inside the report dialog" as
implementer's first-listed option, and reusing `reportOpen` means every existing
input-pause guard already covers this feature for free (research.md's point about
whatever boolean gates the new UI needing the identical guard — reusing the SAME
boolean is the cheapest way to guarantee that).

**Rejected: a header-level always-visible paste box outside any dialog.** The ticket
frames this as a companion to the report dialog ("its full-record big sibling"), and
an always-visible paste box would need its OWN input-pause story since it would sit
in the header, live, during normal play — solving a problem the dialog already
solves by being modal.

## Decision 2: `drive.ts` gets one pure function, `extractNotation`, plus a load-result type

```ts
export type LoadResult =
  | { readonly ok: true; readonly record: GameRecord }
  | { readonly ok: false; readonly message: string }

export function loadPastedRecord(text: string): LoadResult
```

`loadPastedRecord` does three things, each already-existing logic composed, not
reimplemented:
1. **Extract** the notation block from whatever was pasted. Rule: find the LAST line
   in the text matching the header regex `/^v[0-9]+ [0-9a-z]+$/` (mirroring
   `notation.ts`'s own `HEADER_RE`, not re-deriving a new one — see Decision 3), and
   take from that line to the end of the text. If no such line exists, pass the
   ENTIRE trimmed text through unchanged (covers the raw-notation-only paste case;
   `parseGameRecord` will throw its own line-1 header error on genuinely malformed
   input either way, which is the desired behavior for "not notation at all").
2. **Parse**: call `parseGameRecord` on the extracted text inside a `try`.
3. **Validate-by-folding**: call `foldGame` on the successfully parsed record inside a
   second `try` (catches `foldGame`'s own "non-last hand still playing" corruption
   guard, and any `foldRecord` action-level `RangeError` a syntactically-valid-but-
   illegal log would throw). Discards the folded result — this call exists ONLY to
   surface the error now, synchronously, in the loader's own control flow, rather than
   crashing the next reactive `$derived(foldGame(record))` re-run inside `App.svelte`
   after the state has already been replaced.

Any caught `RangeError` (from either try) becomes `{ ok: false, message: error.message
}` — `parseGameRecord`/`foldRecord`/`foldGame` already produce exact, human-readable
`line X, position Y` / `action N` messages (the AC's own wording: "Parse errors render
the parser's line/position message instead of loading"), so no re-formatting is
needed. Success becomes `{ ok: true, record }`.

**Rejected: returning just `GameRecord | null` and losing the message.** The AC
requires showing "the parser's line/position message" — a bare `null` throws that
information away. A discriminated-union result is the established shape for "this
computation can fail with information the caller must show" in this codebase's own
adjacent code (`IssueLink.clipboardFirst` is the closest sibling: a boolean flag
plus data, not an exception bubbled to the view layer).

**Rejected: doing the try/catch inline in `App.svelte`.** Same reasoning
T-013-02-01's Decision 2 already established for `buildReportText`/`buildIssueUrl`:
this is app-level pure logic over already-available core exports, belongs in
`drive.ts`, and is trivially unit-tested in `drive.test.ts` without mounting anything.

**Rejected: skipping the fold-validation step (parse only, trust `parseGameRecord`'s
own syntax/range checks).** `parseGameRecord`'s own doc-comment is explicit that it
"never validates legality... a syntactically well-formed but semantically illegal
parsed record parses fine and throws only later, from `foldRecord`/`foldGame`."
Skipping the fold check would mean a hand-edited or corrupted-but-syntactically-valid
paste (e.g., two riichi actions for the same seat, a chi against a closed window)
silently replaces the live game state and THEN crashes on the next `$derived` re-run
— a strictly worse failure mode than showing the same exact error message one
render-cycle earlier, before any state is touched.

## Decision 3: extraction reuses `notation.ts`'s grammar knowledge without re-exporting internals

`notation.ts`'s `HEADER_RE` (`/^v([0-9]+) ([0-9a-z]+)$/`) is module-private. Rather
than exporting it (widening core's public surface for one app-side convenience),
`drive.ts`'s `loadPastedRecord` declares its OWN copy, `/^v[0-9]+ [0-9a-z]+$/`
(without the capture groups it doesn't need — it only tests, never extracts fields;
`parseGameRecord` re-validates and extracts for real). This is the SAME
cross-module-duplication convention `record.ts`'s own header documents
extensively ("legal.ts's own `winYaku`... never imported — both modules'
independence doctrine") applied to a regex instead of a predicate function — cheap to
duplicate, and keeps `core/` and `app/` from growing a coupling neither module's own
contract calls for.

**Rejected: exporting `HEADER_RE` from `notation.ts`.** Would put a second thing
(besides the two public functions) on core's public contract for one caller,
worse, would tie the app layer to a regex that's supposed to be an implementation
detail of the parser's own multi-line scanning, not a general "does this look like a
notation document" test the app should own its own opinion about (the app's rule —
"last matching line, not first" — is a paste-workflow-specific heuristic that has
nothing to do with how the parser itself works internally).

## Decision 4: `App.svelte` gets one `loadRecord(record: GameRecord)` handler, mirroring `newGame()`

```ts
function loadRecord(record: GameRecord): void {
  gameSeed = record.seed
  hands = record.hands.map((h) => [...h])
  dismissed = false
  notice = null
  reportOpen = false
  reportMessage = ''
  pasteText = ''
  pasteError = null
}
```

Wired to a new "load" button inside `ReportBug.svelte`, which calls
`drive.ts`'s `loadPastedRecord(pasteText)` and either invokes `onload(result.record)`
(a new callback prop, joining `onmessage`/`onclose`) or sets a local error string the
dialog renders.

This is `newGame()`'s exact shape (research.md already identified this as the
directly-applicable precedent): replace `gameSeed`+`hands` together, reset the
same two presentation flags `newGame()` already resets. Two additions beyond
`newGame()`'s own scope: closing the dialog and clearing its own message/paste
fields, since a successful load is also naturally "I'm done with this dialog."

`hands = record.hands.map((h) => [...h])` performs the readonly→mutable narrowing
research.md flagged (`GameRecord.hands: readonly (readonly HandAction[])[]` vs. the
`$state`'s own `HandAction[][]`), a one-line shallow copy — no deep clone needed
since `HandAction` itself is entirely `readonly`-fielded and never mutated in place
anywhere in this codebase (record.ts's own action vocabulary doc-comment: every
field is `readonly`).

**Rejected: leaving `reportMessage` untouched on load.** A freeform message about
"the bug that just happened" describes the PRIOR state, which the load just
discarded — carrying it forward into a freshly loaded game's report (which would now
describe a DIFFERENT hand) is actively misleading were the player to reopen the
dialog and copy a report without noticing.

## Decision 5: the paste UI's own local state lives in `ReportBug.svelte`, not `App.svelte`

`pasteText` (the textarea's live value) and `pasteError` (the last parse failure
message, or null) are `$state` INSIDE `ReportBug.svelte` — mirroring `copied`'s own
existing precedent in that file (a transient, purely-presentational fact no other
component needs to read). `App.svelte` only receives the final `onload` callback with
an already-validated `GameRecord` — it never sees intermediate paste text or partial
errors, the same routing shape `onmessage`/`onclose` already use for the existing
message field.

**Rejected: threading `pasteText`/`pasteError` up through `App.svelte` (mirroring
`reportMessage`'s prop-controlled shape).** `reportMessage` is prop-controlled
because `App.svelte` needs its live value to build `reportText` (the preview `<pre>`
reads it). Nothing outside `ReportBug.svelte` ever needs the paste box's live text or
its transient error — `onload` firing IS the only externally-visible effect, so
keeping the intermediate state local is the cheaper, equally-correct shape (design.md
Decision 6 for T-013-02-01 makes the identical distinction: "presentation state
affecting >1 concern... lives in App.svelte, while purely-internal, single-component
state... stays local").

## Decision 6: no fold-mismatch DOM re-render race — `record` is already `$derived`

Because `App.svelte`'s `record`/`game`/`table`/`offered`/etc. are ALL `$derived` off
`gameSeed`+`hands` (never separately cached), reassigning both in `loadRecord()`
inside one synchronous function body triggers exactly one coherent re-derivation
cycle — there is no intermediate render where `gameSeed` reflects the new game but
`hands` still reflects the old one (Svelte 5 runes batch derived recomputation to the
next microtask/flush, not per-assignment). This needs no new code, just confirms
`newGame()`'s existing pattern already has this property and `loadRecord()` inherits
it for free by using the same two-assignment shape.

## Decision 7: dictionary entries for the new labels only; the parser's own error text stays untranslated

New `TermKey`s: `loadReport` (the button/heading label — "load report" /
zh-hant equivalent), `pasteReport` (textarea label/placeholder). The parser's raw
`RangeError.message` (e.g. `` line 3, position 12: malformed tile "zz"... ``) is
NOT routed through `term()` — same carve-out T-013-02-01's Decision 4 already
established for the notation body and its context block: this is a
developer/maintainer-facing diagnostic string tied 1:1 to `notation.ts`'s own frozen
grammar wording, not player-facing prose. Translating it would also risk the message
drifting out of sync with the exact wording `notation.ts`'s own tests pin.

## Decision 8: "works in any phase" needs no special-casing at all

The AC's "loading works with the game in any phase" falls out of Decision 4 for
free: `loadRecord()` unconditionally replaces `gameSeed`/`hands` regardless of
`table.phase` (`'playing'`, `'ryuukyoku'`, or `'agari'`) — unlike `newHand()` (line
269 of `App.svelte`), which deliberately GUARDS on `table.phase !== 'playing'`
because appending an empty hand onto a still-live one would corrupt `foldGame`'s own
invariant. A full record replacement has no such constraint: the freshly loaded
`hands` array is `foldGame`-validated (Decision 2's fold-check) as a STANDALONE
record before it ever touches `App.svelte`'s state, so whatever phase the OLD game
was in is irrelevant — it's being discarded wholesale, not appended to.

## Test strategy sketch (elaborated fully in Plan)

- `drive.test.ts`: unit tests for `loadPastedRecord` — raw notation input (no
  wrapper), full `buildReportText`-shaped input (extraction path), malformed notation
  (exact message pass-through), syntactically-valid-but-illegal notation (the
  fold-check path's own error surfaces), and the "no header line at all" fallback
  (whole trimmed text handed to `parseGameRecord`, which then throws its own line-1
  error).
- A new interaction test (new file `paste-load.tap.svelte.test.ts`, mirroring
  `report-bug.tap.svelte.test.ts`'s own mounting/tick helpers): serialize a
  mid-game record (a few draws/discards/calls into a real hand) via
  `serializeGameRecord`, paste it through the dialog's textarea, click load, assert
  (a) `hands`/`gameSeed`'s effect on the DOM — hand tiles, pond contents, scores —
  matches a SEPARATELY-folded reference (`foldGame` on the same record, read via
  DOM spot-checks à la `eastPondCount`/`handButtons`), and (b) a deep-equal check is
  awkward to do purely through the DOM, so the assertion is: fold the ORIGINAL
  record independently in the test, extract the same facts the DOM exposes (hand
  tile kinds, pond tile kinds, scores), and compare those — not a literal
  `toEqual(table)` (the component never exposes its internal `table` object to the
  test, by this codebase's own established DOM-only testing convention). A second
  case: paste garbage, assert the dialog shows the exact thrown message and the
  live game (checked via an unaffected pond count, `report-bug.tap.svelte.test.ts`'s
  own `eastPondCount` proxy) is untouched. A third case: load while phase is
  `'agari'` (past a full mocked hand) or `'ryuukyoku'`, confirming no phase guard
  blocks it.
- `app.terminology.coverage.ssr.test.ts`: new labels (`loadReport`, `pasteReport`)
  added to the existing `describe('report dialog')` block from T-013-02-01.
