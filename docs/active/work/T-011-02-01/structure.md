# Structure — T-011-02-01: window-outcome-notice

## Files created

### `src/app/WindowNotice.svelte` (new)

Pure presentational component, sized like `RiichiPrompt.svelte`: one prop, no input
wiring, a small styled block.

- **Props**: `{ outcome: WindowOutcome }` (from `./drive`) — no optional/default,
  always rendered with a real outcome (the caller's `{#if notice !== null}` guard
  guarantees this).
- **Markup**: one `<p class="notice" role="status">` composing `windTerm(outcome.winner)`
  + `callTerm(outcome.winnerType)` + fixed English scaffolding + `callTerm(outcome.playerType)`
  — e.g. "South called pon — your chi was outranked." `role="status"` matches
  `HandEnd.svelte`'s existing precedent for a non-interruptive announcement.
- **Style**: same dark-felt palette tokens as `ClaimPrompt`/`RiichiPrompt`
  (`#124534`/`#2e7d4f`/`#eaf3ee`), sized to sit in the console's reserved slot without
  changing its `min-height`.
- No exports beyond the component itself; no test file changes required for this
  file directly (covered via `app.terminology.coverage.ssr.test.ts` and indirectly
  via `claim-window-race.tap.svelte.test.ts`).

## Files modified

### `src/app/drive.ts`

- New exported type `CallType = 'chi' | 'pon' | 'daiminkan' | 'ron'`.
- New exported interface `WindowOutcome { winner: Seat; winnerType: CallType;
  playerType: HandAction['type'] }`.
- New private type guard `isCallType(type): type is CallType`.
- New exported function `windowOutcome(chosen: HandAction, settled: HandAction | null):
  WindowOutcome | null` — the reference-equality check from design.md, placed
  directly after `settleWindow` (its only two callers reach it immediately after
  calling `settleWindow`, matching this file's existing "read top to bottom in call
  order" organization).
- No changes to any existing export's signature or behavior.

### `src/app/dictionary.svelte.ts`

- New exported function `callTerm(type: 'chi' | 'pon' | 'daiminkan' | 'ron' | 'tsumo'):
  string` — the daiminkan→"kan" mapping promoted from `ClaimPrompt.svelte`'s private
  `callName`, then `term()`. Placed near `windTerm` (the other seat/call-shaped
  helper this file already exports).
- No new `TermKey` entries, no change to `TERMS`.

### `src/app/ClaimPrompt.svelte`

- Delete the local `callName` function.
- Import `callTerm` from `./dictionary.svelte` instead of building it locally.
- Replace the three `callName(...)` call sites with `callTerm(...)` verbatim
  (identical argument shapes — no behavior change, no markup change).

### `src/app/App.svelte`

- Import `windowOutcome` and `type WindowOutcome` from `./drive`; import
  `WindowNotice` from `./WindowNotice.svelte`.
- New `NOTICE_DURATION_MS = 2000` constant, alongside the existing `BOT_DELAY_MS`.
- New `let notice = $state<WindowOutcome | null>(null)`.
- `claim()`: after the existing `if (settled !== null) activeHand().push(settled)`,
  add `notice = windowOutcome(action, settled)`.
- `takeWin()`: same addition, `notice = windowOutcome(win, settled)`.
- `pass()`: add `notice = null` (unconditional, after the existing branch).
- `newHand()`: add `notice = null` alongside the existing `dismissed = false`.
- `newGame()`: add `notice = null` alongside the existing `dismissed = false`.
- New `$effect` (placed directly after the existing forced-action `$effect`): while
  `notice !== null`, a `setTimeout(() => { notice = null }, NOTICE_DURATION_MS)`,
  cleared on re-run/unmount — the auto-dismiss timer.
- Console cascade: insert `{:else if notice !== null}<WindowNotice {outcome=notice} />`
  between the existing claim-prompt branch and the riichi branch; extend the
  existing comment above the `{#if}` to document all four tiers and the "a live
  decision always preempts a notice; a notice always preempts the ordinary per-turn
  cascade" rationale.
- No style-block changes needed (`WindowNotice` carries its own `<style>`, sized to
  the existing `.console` reserved slot already sized for a one-row prompt — the
  notice is a comparable single line, no `.console` min-height change expected, but
  worth a visual sanity check in Implement).

### `src/app/drive.test.ts`

- New `describe`/`it` block for `windowOutcome`, placed near `settleWindow`'s own
  tests, using the already-frozen fixtures cited in design.md:
  - Seed 3 (`raceWindow3`): tapping `EAST_CHI_A` loses to `SOUTH_PON_3` →
    `windowOutcome` returns `{ winner: 1, winnerType: 'pon', playerType: 'chi' }`.
  - Seed 5 (`ponWindow5`): tapping `EAST_PON_5` wins outright → `windowOutcome`
    returns `null`.
  - Seed 212 (`kanWindow212`): tapping `EAST_KAN_212` wins outright → `windowOutcome`
    returns `null`.
  - Defensive: `windowOutcome(anyAction, null)` → `null`.
- No changes to any existing test in this file.

### `src/app/app.terminology.coverage.ssr.test.ts`

- Import `WindowNotice` and a hand-built `WindowOutcome` literal (e.g.
  `{ winner: 1, winnerType: 'pon', playerType: 'chi' }` — South, pon, chi, matching
  the seed-3 fixture's own facts so the literal isn't arbitrary).
- Add expected romaji/zh-hant strings to the `EXPECTED` table's coverage loop (or a
  small dedicated assertion block alongside the existing `ClaimPrompt`/`RiichiPrompt`
  render calls in this file) — asserting the winner's wind name and both call names
  render correctly under each terminology.

### `src/app/claim-window-race.tap.svelte.test.ts` (T-011-01-01's file)

- New local helper `reachFirstWindow(target)`: the existing five-tsumogiri-round
  loop plus the fixture-sanity assertions, factored out so both `it`s in this file
  can reach the same starting point without duplicating it.
- Existing `it`, first window: flip the DEFECT assertion (`.notice` etc. must now be
  `not.toBeNull()`); add assertions naming West (winner) and chi (player's own call)
  correctly, in whatever text/aria shape `WindowNotice` renders.
- Existing `it`, extended: after asserting the second window's button, tap it (chi on
  2s) and assert the outcome — if uncontested (confirmed in Implement), assert
  `notice` clears/is absent post-resolution (the WIN case) and that the CLAIM PROMPT
  (not a stale notice) was what rendered during the 750ms gap before this tap (the
  cascade-preemption proof design.md describes).
- New sibling `it`: `reachFirstWindow`, then tap "pass" instead of the chi button;
  assert no notice element renders (the PASSED case). The window still resolves to
  West's pon regardless (same bot behavior), so this reuses the identical fixture.

## Ordering

1. `drive.ts` + `drive.test.ts` (foundation, independently verifiable).
2. `dictionary.svelte.ts` + `ClaimPrompt.svelte` refactor (independently verifiable —
   no behavior change, existing suites must stay green unchanged).
3. `WindowNotice.svelte` (depends on 1 and 2 for its types/vocabulary helper).
4. `app.terminology.coverage.ssr.test.ts` (depends on 3).
5. `App.svelte` wiring (depends on 1 and 3).
6. `claim-window-race.tap.svelte.test.ts` (depends on 5 — needs the real mounted
   behavior to assert against).

## Module boundaries / public interfaces

`drive.ts` gains two exports (`WindowOutcome`, `windowOutcome`) and `CallType`,
additive only. `dictionary.svelte.ts` gains one export (`callTerm`), additive only.
No existing export's signature changes. `WindowNotice.svelte` is a new leaf
presentational component, imported only by `App.svelte` (and the terminology
coverage test) — same shape as `RiichiPrompt.svelte`'s own import footprint.
