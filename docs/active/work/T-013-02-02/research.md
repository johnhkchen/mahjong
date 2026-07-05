# Research — T-013-02-02: paste-to-reproduce-loader

## Scope of the ticket

The owner's half of E-013 (report/reproduce), pairing with T-013-02-01 (done): a
paste-to-load entry — inside the report dialog or a small dedicated affordance,
implementer's choice — that parses a serialized report's notation and replaces the
app's live `GameRecord` with it, folding to the exact reported state (scores, hands,
ponds, prompts, everything). Parse errors render the parser's own line/position
message instead of loading. The existing `?seed=` boot pin is untouched — this is its
full-record big sibling. Must work with the game in any phase.

## The record/notation contract (already built, extend-only)

- `src/core/record.ts` — `HandRecord` (seed + action log for ONE hand), `foldRecord`
  folds it into `TableState`. Throws `RangeError` naming the action index on any
  illegal/corrupt action.
- `src/core/game.ts` — `GameRecord` (`{ seed: number, hands: readonly (readonly
  HandAction[])[] }`) is the WHOLE game: one action log per hand played, active hand
  always last. `foldGame(record): GameState` derives `{ scores, dealer, seatWinds,
  table, pot }`. Throws if `hands` is empty, or if any non-last hand is still
  `'playing'` (a record's own well-formedness invariant, independent of notation
  parsing).
- `src/core/notation.ts` — the text codec, ALREADY BOTH DIRECTIONS:
  - `serializeGameRecord(record: GameRecord): string` — `v1 <seed base36>` header line,
    then one line per hand, space-separated fixed-width tokens. No trailing newline.
  - `parseGameRecord(text: string): GameRecord` — the strict inverse. Validates syntax
    and numeric range only (tile ids 0-135, seats 0-3, seed < 2^32, exactly one
    supported `NOTATION_VERSION`) — never legality. Every malformed input throws
    `RangeError` with an exact message of the shape `` line ${line}, position
    ${position}: ... `` (1-based line, 1-based char position). A syntactically valid
    but illegal-to-play record parses fine and only throws later, from
    `foldRecord`/`foldGame` (same RangeError shape, `action ${index}: ...` instead).
  - Both functions are already exported through `src/core/index.ts`'s barrel — no core
    work is needed for this ticket. **This ticket is 100% app-layer wiring**: call
    `parseGameRecord`, catch, and either replace state or show the message.

## What "the report's notation" actually looks like (T-013-02-01)

`ReportBug.svelte`'s `<pre aria-label="report preview">` — the thing a user would
copy and later paste back — is `buildReportText()`'s output (`src/app/drive.ts:486`),
NOT raw `serializeGameRecord` output. Its shape:

```
<freeform message, may be empty, may contain any text/newlines>

---
terminology: romaji
hand: 2
actions: 14
origin: https://mahjong.b28.dev
---
v1 <seed>
<hand 0 tokens>
<hand 1 tokens>
...
```

So a real "paste the report back" flow must extract the trailing notation block out of
a larger pasted blob — `parseGameRecord` on the WHOLE pasted text will fail (line 1 is
the free-message text, not a `v<N> <seed>` header) unless the loader locates where the
notation starts. `buildReportText`'s own format is NOT part of the versioned notation
contract (only `NOTATION_VERSION` governs `serializeGameRecord`'s grammar) — T-013-02-01's
review.md flags this exact gap for whoever picks up this ticket: "a future ticket
parsing pasted reports back ... will need to either read this same shape or treat the
message/context block as free text and extract only the notation lines."

Two live possibilities the paste box needs to tolerate:
1. A raw notation blob (just what `serializeGameRecord` emits — e.g., a user who ran
   `serializeGameRecord` themselves, or copy-pasted only the `<pre>`'s tail).
   `parseGameRecord` handles this directly, no extraction needed.
2. The FULL `copyReport`/`openIssue` output (the AC's actual bug-report round-trip
   case) — message + `---` + context block + `---` + notation. The loader must strip
   everything through the LAST `---` delimiter (or find the last line matching the
   header regex `^v[0-9]+ [0-9a-z]+$` and take from there) before calling
   `parseGameRecord`.

## Where the live GameRecord lives and how it's replaced

`src/app/App.svelte`:
- `gameSeed = $state(initialSeed)` and `hands = $state<HandAction[][]>([[]])` are the
  ONLY two pieces of authoritative mutable state (`record = $derived<GameRecord>({
  seed: gameSeed, hands })`). Everything else (`game`, `table`, `offered`,
  `seatScores`, etc.) is `$derived` off `record`.
- `newGame()` (line 286) is the existing precedent for wholesale-replacing both: sets
  a fresh `gameSeed` and resets `hands = [[]]`, plus clears `dismissed`/`notice`
  presentation state. A paste-load is structurally the SAME shape of operation —
  replace `gameSeed` and `hands` together, atomically, then clear the same
  presentation flags — except the new values come from a parsed record instead of a
  fresh seed/empty hands.
- `hands` is typed as `HandAction[][]` (mutable inner arrays — `activeHand()` pushes
  onto `hands[hands.length - 1]`) but `GameRecord.hands` is `readonly (readonly
  HandAction[])[]`. `newGame()`'s `hands = [[]]` already performs this readonly→mutable
  narrowing implicitly (an empty array has no variance issue); a parsed record's
  `hands` would need a shallow re-map to plain mutable arrays (`parsed.hands.map(h =>
  [...h])`) to keep pushing onto the active hand type-safe afterward.
- No other component holds a copy of the record — `Table.svelte`, `ClaimPrompt`,
  `RiichiPrompt`, `HandEnd`, `WindowNotice`, `ReportBug` are all presentational,
  reading `$derived` values or receiving props. Replacing `gameSeed`/`hands` at the
  `App.svelte` level is therefore sufficient to re-derive the entire tree.
- **`foldGame`'s own validity requirement**: a parsed `GameRecord` whose `hands` list
  has a non-last hand still `'playing'` throws at fold time (`foldGame`'s own guard),
  which surfaces as a runtime error, not a parse error, if the pasted text is
  syntactically valid notation but describes an impossible game. This is a second
  error surface beyond `parseGameRecord`'s own throws — the loader must catch AROUND
  `foldGame`, not just around `parseGameRecord`, if it wants to render this failure the
  same way (or at minimum not crash the app). Worth deciding in Design whether to
  validate-by-folding at paste time (parse, then `foldGame` once to confirm it doesn't
  throw, discard the result) before committing to state.

## `?seed=` precedent (the "half sibling" this ticket completes)

`bootSeed()` (App.svelte:46) reads `location.search`'s `seed` param at mount time only
— a boot-time pin, never touched again during a live session. It seeds a FRESH game
(`hands = [[]]`), not a full record replay. This ticket's paste loader is a strict
superset at runtime: same idea (an external string names a game), but (a) usable at
any time during a live session, not just boot, and (b) replays the ENTIRE hands array,
not just a starting seed.

## Existing dialog/component conventions (T-013-02-01's precedent, directly reusable)

- **Native `<dialog>` + `showModal()`/`.close()`**, feature-detected with an
  `open`-attribute fallback for jsdom (jsdom 29.1.1 has the `<dialog>` ELEMENT but not
  its methods) — `ReportBug.svelte`'s `$effect` (lines 44-54) is the exact pattern to
  reuse verbatim for a new dialog, or the SAME dialog (see Design's affordance-location
  choice).
- **`reportOpen`-style guard**: `App.svelte` gates `tap`/`claim`/`pass`/`takeWin`/
  `declareRiichi`/`declineRiichi` behind `if (reportOpen) return`. Whatever boolean
  gates the NEW dialog needs the identical guard applied (or reuse `reportOpen` itself
  if the paste entry lives inside `ReportBug.svelte`).
- **`drive.ts` pure-function discipline**: string/data shaping logic (extracting the
  notation substring, wrapping a caught error into a display string) belongs in
  `drive.ts` as a DOM-free pure function, unit-tested in `drive.test.ts` — NOT inline
  in a `.svelte` file. `buildReportText`/`buildIssueUrl` are the direct precedent.
- **Dictionary routing**: any new user-facing label (a "load" button, a "paste"
  placeholder, an error heading) needs `TermKey` entries in
  `dictionary.svelte.ts`, covered by `app.terminology.coverage.ssr.test.ts`'s
  per-terminology sweep. The parser's OWN error message text (from `parseGameRecord`'s
  `RangeError`) is machine-generated English and — per T-013-02-01 Decision 4's
  precedent for the notation body — is a strong candidate to stay untranslated
  scaffolding rather than routed through `term()`.
- **No `mount-guard.ts` needed** unless the new affordance reactively remounts
  mid-play the way `ClaimPrompt`/`RiichiPrompt` do; a paste dialog opened by one
  deliberate button tap has the same "no remount race" shape T-013-02-01 Decision 5
  already reasoned through — likely also inapplicable here.

## Test project layout and existing patterns to mirror

- `*.tap.svelte.test.ts` files mount a REAL `App` (via `mount`/`flushSync` from
  `'svelte'`) and drive it through DOM taps — `report-bug.tap.svelte.test.ts` is the
  closest sibling: `beforeEach`/`afterEach` fake-timer setup, `mountApp(seed)` helper,
  `tickUntil(target, predicate)` to advance the bot-pacing clock, class/aria-label
  queries (`.report-bug-toggle`, `[aria-label="close"]`, `[aria-label="report
  preview"]`), a `typeMessage`-style helper for `<textarea>`/`<input>` value + `input`
  event dispatch.
- `eastPondCount`/`handButtons` string-scanning helpers in that file are the
  established way to assert on rendered hand/pond state without deep component
  internals knowledge — directly reusable for this ticket's "assert the folded table
  matches the original" DOM spot-check (hand + pond + scores, per the AC).
- `drive.test.ts` is the home for any new pure-function unit tests (notation
  extraction, error-to-message mapping).
- `app.terminology.coverage.ssr.test.ts` is the home for the new labels' SSR coverage
  under both terminologies.
- Vitest has (at least) two projects: a `dom` project (jsdom, for `.svelte.test.ts`/
  `.tap.svelte.test.ts`) and a plain Node project (for `.ssr.test.ts`,
  `drive.test.ts`-style pure logic) — `dictionary.svelte.ts`'s `loadStored()` and
  `call-prompt-settings.svelte.ts`'s `loadStored()` both guard on `typeof window ===
  'undefined'` specifically because of this Node project's absence of `window`/
  `localStorage`.

## Files this ticket will touch (confirmed by the above; Structure phase decides exact new files)

- `src/core/notation.ts` / `src/core/index.ts` — likely untouched (parse/serialize
  already exist and are exported).
- `src/app/drive.ts` (+`drive.test.ts`) — new pure function(s): extracting a notation
  substring from a pasted blob, and/or a typed result wrapping success/parse-error.
- `src/app/App.svelte` — new `$state` for the paste UI (open/closed, pasted text,
  error message), a `loadRecord()`-shaped handler mirroring `newGame()`'s
  wholesale-replace shape, guards on existing input handlers if a new modal is
  introduced.
- Either `src/app/ReportBug.svelte` (extending it with a paste field) or a new
  component (e.g. `LoadRecord.svelte`) — Design's call.
- `src/app/dictionary.svelte.ts` — new `TermKey`s for whatever labels the chosen UI
  needs.
- A new `*.tap.svelte.test.ts` (or an addition to `report-bug.tap.svelte.test.ts`) for
  the end-to-end paste-load interaction test the AC demands.
- `app.terminology.coverage.ssr.test.ts` — new labels' coverage block.

## Constraints and assumptions surfaced, not yet resolved (Design's job)

- Where does the paste affordance live: inside `ReportBug.svelte` (one dialog, two
  jobs) or a new dedicated small dialog/panel? The ticket text explicitly defers this
  ("implementer's choice, documented").
- What exact substring-extraction rule turns a full pasted bug report into the
  `parseGameRecord`-ready notation text (last `---`-delimited block vs. last
  header-matching line vs. requiring the raw notation only)?
- Does the loader validate-by-folding (`foldGame`) before committing to state, so a
  syntactically valid but semantically corrupt record shows a parse-shaped error
  instead of crashing the app on the next reactive re-fold?
- What happens to presentation-only state (`dismissed`, `notice`, `reportOpen`,
  `reportMessage`) on a successful load — `newGame()`'s precedent resets `dismissed`/
  `notice`; a loaded record could resume mid-hand with a live claim window, so
  `dismissed`/`notice` resetting to their fresh-hand defaults is probably still
  correct (they're re-derived from `table`/`offered` on next tick regardless), but
  `reportOpen` should very likely close on a successful load either way.
