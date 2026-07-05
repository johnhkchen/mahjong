# Structure — T-012-01-02 useful-call-prompt-filter

## Files created

### `src/app/call-prompt-settings.svelte.ts`

New sibling module to `dictionary.svelte.ts`, identical shape:

- `const STORAGE_KEY = 'mahjong-prompt-every-legal-call'`
- `function loadStored(): boolean` — guarded on `typeof window`, malformed/absent
  → `false` (the default: filtered).
- `let current = $state<boolean>(loadStored())`
- `export function promptEveryLegalCall(): boolean`
- `export function setPromptEveryLegalCall(next: boolean): void` — sets `current`,
  guarded `localStorage.setItem` (stores `'true'`/`'false'` via `String(next)`,
  read back via `stored === 'true'`).

No other exports. No dependency on `dictionary.svelte.ts` (the label text is
composed in `App.svelte`, which already imports both modules).

### `src/app/call-prompt-filter.tap.svelte.test.ts`

New end-to-end suite (see plan.md for the exact fixtures/assertions). Mirrors
`app.terminology.svelte.test.ts`'s mount/cleanup/reset scaffolding, plus
`window-outcome-notice.tap.svelte.test.ts`'s fake-timer `step` style for driving
to a target window.

## Files modified

### `src/app/drive.ts`

- Add `callPolicy` to the existing `../core` import (alongside `discardPolicy`,
  `seatView`, etc. already imported).
- New exported function `claimWindowInterrupts(state, offered, player,
  promptEveryLegalCall)` — placed directly after `claimChoices`/before
  `tapClaim` (keeps the claim-window predicate family textually together; the
  existing "one predicate family" doc comment above `promptChoices` gets a
  one-line addendum naming this function as the fourth member).
- `forcedAction`'s signature gains `promptEveryLegalCall: boolean` as its 4th
  parameter; its first guard becomes:
  ```ts
  if (claimWindowInterrupts(state, offered, player, promptEveryLegalCall) ||
      winChoice(offered, player) !== null) {
    return null
  }
  ```
  Every other line of `forcedAction` is untouched — the fallthrough arms already
  produce the correct auto-settle result (design.md Decision 2).
- Doc comment above `forcedAction` gets one paragraph describing the new
  parameter and pointing at `claimWindowInterrupts`.

### `src/app/dictionary.svelte.ts`

- `TermKey` union gains `'promptEveryCall' | 'quietCalls'`.
- `TERMS` gains both entries (romaji/zh-hant pairs, design.md Decision 5).

### `src/app/App.svelte`

- Import `claimWindowInterrupts` from `./drive`.
- Import `promptEveryLegalCall, setPromptEveryLegalCall` from
  `./call-prompt-settings.svelte`.
- New derived: `const claimsInterrupt = $derived(claimWindowInterrupts(table,
  offered, PLAYER, promptEveryLegalCall()))`.
- `prompt`'s derivation changes from `promptChoices(offered, PLAYER)` to
  `claimsInterrupt ? promptChoices(offered, PLAYER) : []`. Nothing else in the
  template changes — the existing `(prompt.length > 0 || win !== null) &&
  !dismissed` cascade guard is untouched, still the single source of visibility
  truth.
- `forcedAction(table, offered, PLAYER)` call in the `$effect` gains the 4th
  argument: `forcedAction(table, offered, PLAYER, promptEveryLegalCall())`.
- New header button, same visual register/class-sharing convention as
  `.terminology-toggle` (`design.md` Decision 5 / T-010-01-02's own Decision 3
  precedent — shared declarations via a compound selector, not a shared class
  name): `.call-prompt-toggle`, `onclick={() =>
  setPromptEveryLegalCall(!promptEveryLegalCall())}`, label/aria-label reading
  `term('promptEveryCall')` when currently filtered (off) or `term('quietCalls')`
  when currently unfiltered (on) — names the mode a tap switches TO, mirroring
  `TERMINOLOGY_LABEL`'s own convention exactly.
- CSS: extend the existing `.new-game, .terminology-toggle { ... }` selector
  block to include `.call-prompt-toggle`.

## Files modified — test call sites (mechanical, preserve old semantics)

### `src/app/drive.test.ts`

- Add `callPolicy` (if not already imported — it is not currently imported by
  this file) and `claimWindowInterrupts` to the `import { ... } from './drive'`
  block (only needed if the new describe block references them directly; it
  does).
- Every existing `forcedAction(<a>, <b>, PLAYER)` call site (~25, per
  research.md) gets a 4th argument `, true)` — mechanical, preserves the exact
  pre-ticket "always wait on any player claim" semantics these tests assert.
- New `describe('claimWindowInterrupts', ...)` block (plan.md's test list),
  placed after the existing `describe('promptChoices', ...)` block (textual
  proximity to the function family it extends).
- New assertions inside the existing `describe('forcedAction', ...)` block for
  the filtered-vs-unfiltered contrast on one declined-window fixture.

### `src/app/houtei-dismissal.tap.svelte.test.ts`

- Import `setPromptEveryLegalCall` from `./call-prompt-settings.svelte`.
- `beforeEach`: `setPromptEveryLegalCall(true)` (alongside the existing
  `vi.useFakeTimers()`).
- `afterEach`: `setPromptEveryLegalCall(false)` (alongside the existing
  `vi.useRealTimers()`), plus `localStorage.clear()` (this file never touched
  storage before; the toggle write does now, so clear it the same way
  `app.terminology.svelte.test.ts`'s own `afterEach` does for its key).
- Its `step()` helper's `forcedAction(state, offered, PLAYER)` call gets `, true)`.

### `src/app/window-outcome-notice.tap.svelte.test.ts`

- Identical shape of change: import + `beforeEach`/`afterEach`
  set/reset/clear, and `step()`'s `forcedAction(state, offered, PLAYER)` call
  gets `, true)`.

### `src/app/claim-window-race.tap.svelte.test.ts`

- No change (design.md Decision 6 — both its windows are policy-approved
  already).

### `src/app/app.riichi.tap.svelte.test.ts`, `src/app/app.controls.svelte.test.ts`

- No change (neither calls `forcedAction` directly nor depends on claim-window
  rendering in a way sensitive to the filter — research.md).

## Ordering

1. `drive.ts` (the core predicate + `forcedAction` signature) — everything else
   depends on this compiling.
2. `dictionary.svelte.ts` (new terms) — independent, but `App.svelte` needs it.
3. `call-prompt-settings.svelte.ts` (new module) — independent.
4. `App.svelte` (wiring) — depends on 1–3.
5. `drive.test.ts` mechanical `forcedAction` call-site fixes — needed to keep the
   suite compiling the instant step 1 lands; do this in the SAME commit as step 1
   to avoid a red intermediate state.
6. `houtei-dismissal.tap.svelte.test.ts` / `window-outcome-notice.tap.svelte.test.ts`
   fixes — depend on step 3 (the settings module) and step 1.
7. New `drive.test.ts` `claimWindowInterrupts`/`forcedAction` filter assertions.
8. New `call-prompt-filter.tap.svelte.test.ts` suite — depends on everything above.
