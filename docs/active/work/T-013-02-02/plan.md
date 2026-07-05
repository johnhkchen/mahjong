# Plan — T-013-02-02: paste-to-reproduce-loader

## Step 1: `drive.ts` — `loadPastedRecord` + `extractNotation`

- Widen the `'../core'` import at the top of `drive.ts` to include
  `parseGameRecord`, `foldGame`, and the `GameRecord` type.
- Add `NOTATION_HEADER_RE`, private `extractNotation(text: string): string`, and
  exported `LoadResult` + `loadPastedRecord(text: string): LoadResult` per
  structure.md's exact shape.
- `extractNotation`: split on `\n`, scan for the LAST line matching
  `NOTATION_HEADER_RE`; if found, `lines.slice(thatIndex).join('\n')`; else return
  `text.trim()` unchanged (so `parseGameRecord`'s own header-check throws a legible
  error rather than this function silently guessing wrong).
- **Verify**: `npm run test -- drive.test.ts` not yet updated — just confirm the
  file still compiles/type-checks (`just check`) before writing tests, since this is
  pure addition with no behavior change to existing exports.

## Step 2: `drive.test.ts` — unit tests for `loadPastedRecord`

Add the `describe('loadPastedRecord')` block (structure.md's six cases). Use
`serializeGameRecord`/`parseGameRecord`/`buildReportText`/`foldGame` imports already
available in this test file's context (or add them) to construct fixtures and
independently compute expected error messages — never hardcode a parser error
string twice.

**Verify**: `just test` — this suite alone should be green; nothing else in the repo
changed yet.

## Step 3: `dictionary.svelte.ts` — two new terms

Add `loadReport`/`pasteReport` to `TermKey` and `TERMS`.

**Verify**: `just check` (type-check only; no behavioral test yet references these
keys until Step 5/6).

## Step 4: `ReportBug.svelte` — paste UI

- Add the `onload` prop, `pasteText`/`pasteError` local state, `loadPasted()`
  handler, the new markup block, and the `.paste-error` style, per structure.md.
- Import `loadPastedRecord` from `./drive` and `type { GameRecord }` from `'../core'`.

**Verify**: `just check` clean. No test yet exercises this UI in isolation (this
codebase doesn't unit-test individual `.svelte` components outside SSR/tap suites),
so correctness here is confirmed by Step 6's end-to-end suite plus Step 5's SSR
label coverage.

## Step 5: `App.svelte` — `loadRecord` + wiring

- Add `loadRecord(record: GameRecord)` after `newGame()`.
- Add `onload={loadRecord}` to the existing `<ReportBug>` mount.

**Verify**: `just check` clean; `just test` full suite green (confirms nothing in
the existing report-bug suite or any other tap suite regressed from the new prop).

## Step 6: `app.terminology.coverage.ssr.test.ts` — label coverage

Add the two new label assertions to the existing `describe('report dialog')` block.

**Verify**: `just test -- app.terminology.coverage.ssr.test.ts` green under both
terminologies.

## Step 7: `paste-load.tap.svelte.test.ts` — end-to-end interaction suite

Write the four cases from structure.md, in this order (cheapest/most-isolated
first):
1. Malformed-paste-leaves-game-untouched (no fixture construction needed beyond a
   literal garbage string — fastest to get green, and exercises the error-message
   path first).
2. Mid-game record round-trip (hand-authored `HandAction[][]` fixture — a handful
   of draws/discards, maybe one call — serialized, pasted into a fresh app, DOM
   spot-check against an independently-folded reference).
3. Full-`buildReportText`-blob extraction case (reuses case 2's fixture, wrapped).
4. Any-phase case (a hand-authored fixture ending in a `tsumo`/`ron`/ryuukyoku
   token sequence, loaded and confirmed to render the ended state — e.g. `HandEnd`'s
   breakdown or `table.phase` proxy — with no rejection).

**Verify**: `just test -- paste-load.tap.svelte.test.ts` green in isolation, then
`just test` (full suite) green.

## Step 8: full verification pass + gate

- `just check` (svelte-check + tsc) clean.
- `just test` (full vitest run) green.
- `just build` → confirm the single-file gate still passes (`verify-single-file: OK`
  in build output), matching T-013-02-01's own review.md verification precedent.
- Manual note in review.md (no live browser available in this session, same caveat
  T-013-02-01's review already carries): the real `showModal()` path for the
  extended dialog is structurally unchanged from T-013-02-01's own already-shipped
  fallback logic, so no NEW browser-only risk is introduced by this ticket beyond
  what T-013-02-01 already flagged.

## Testing strategy summary

- **Unit** (`drive.test.ts`): `loadPastedRecord`'s six cases — the bulk of logic
  correctness lives here, cheap and fast.
- **SSR coverage** (`app.terminology.coverage.ssr.test.ts`): the two new labels
  render under both terminologies.
- **Interaction/end-to-end** (`paste-load.tap.svelte.test.ts`): the AC's own
  required scenario — round-trip fidelity (deep-equal proxied via DOM/independent
  fold comparison), malformed-input safety (error shown, game untouched), and
  any-phase loading.
- No new core/property tests needed — `parseGameRecord`/`serializeGameRecord`/
  `foldGame` are pre-existing, already covered by their own test suites
  (`notation.test.ts`-equivalent coverage, whatever the existing file is named,
  confirmed untouched by this ticket).

## Commit boundaries (atomic, each independently green)

1. `drive.ts` + `drive.test.ts` (Steps 1-2).
2. `dictionary.svelte.ts` (Step 3).
3. `ReportBug.svelte` (Step 4).
4. `App.svelte` wiring (Step 5).
5. `app.terminology.coverage.ssr.test.ts` (Step 6).
6. `paste-load.tap.svelte.test.ts` (Step 7).
7. Any final fixups surfaced by Step 8's full-suite/build pass.
