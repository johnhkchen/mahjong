# Structure — T-012-01-01 prompt-mount-input-guard

## New file

### `src/app/mount-guard.ts`

Plain TS module (no runes — it's a pure constant plus a stateless function, not
component-local reactive state; see design.md Decision 1). Public interface:

```ts
export const MOUNT_GUARD_MS: number // = 200
export function prefersReducedMotion(): boolean
```

No imports. No dependency on Svelte. Placed alongside `dictionary.svelte.ts`/`drive.ts`
in `src/app/` since it's app-layer presentation logic, not core.

## Modified files

### `src/app/ClaimPrompt.svelte`

- **Script block additions** (after the existing `$props()` destructure):
  - `import { MOUNT_GUARD_MS, prefersReducedMotion } from './mount-guard'`
  - `let guarded = $state(true)`
  - one `$effect` that computes `prefersReducedMotion() ? 0 : MOUNT_GUARD_MS`, sets a
    `setTimeout` to clear `guarded`, returns the `clearTimeout` cleanup (same shape as
    App.svelte's own two existing mount/cleanup effects, lines 233–238 and 246–252).
- **Markup changes**: the three `onclick` lambdas (`.call.win` line 54, `.call` line
  70, `.pass` line 78) each get their callback invocation wrapped in `if (!guarded)`.
  No new elements, no new attributes, no class/style changes — button DOM output is
  byte-identical whether guarded or not (satisfies "buttons render immediately").
- **No CSS changes.** The existing `@starting-style`/`transition` block (lines
  154–175) already encodes the 200ms beat visually; `mount-guard.ts`'s
  `MOUNT_GUARD_MS` constant is the single source both this CSS's implicit 200ms and
  the new JS guard must agree with (design.md Decision 2) — a one-line comment is
  added near the `<style>` block cross-referencing `mount-guard.ts` so a future editor
  of one duration remembers to check the other.

### `src/app/RiichiPrompt.svelte`

- Same script-block shape as ClaimPrompt: import, `guarded = $state(true)`, one mount
  `$effect` with the identical body (duplicated, not shared — see design.md Decision
  1: the effect logic itself stays inline per component, only the constant/function
  are shared).
- **Markup changes**: `.declare`'s `onclick` (line 34) and `.pass`'s `onclick` (line
  37) each wrapped in `if (!guarded)`.
- **No new CSS.** RiichiPrompt has no existing entry transition (research.md), and
  adding one is out of scope for this ticket (a purely visual change, not requested by
  either the ticket or epic) — the JS guard stands alone here, still using the shared
  `MOUNT_GUARD_MS` so its duration matches ClaimPrompt's beat even without a visible
  animation of its own.

## Modified test files

Each gets a local `const MOUNT_GUARD_MS = 200` declaration (mirroring the existing
`BOT_DELAY_MS` convention already present in every one of these files) and one or more
inserted `await vi.advanceTimersByTimeAsync(MOUNT_GUARD_MS); flushSync()` pairs,
immediately before a click that could otherwise land inside a fresh mount's guard
window. No existing assertions are loosened; only new awaits are inserted.

1. **`src/app/app.riichi.tap.svelte.test.ts`** — insert the advance immediately after
   each `tickUntil` that detects a RiichiPrompt button (`declare riichi` at line 74→76,
   `not yet` at line 102→104), before the `.click()`.

2. **`src/app/app.controls.svelte.test.ts`** — insert the advance inside
   `driveToHandEnd`'s loop, immediately before the `win.click()` (line 70) and the
   `pass.click()` (line 76) branches. The `drawn.click()` branch (line 82) is
   untouched — Table.svelte's drawn-tile button isn't gated.

3. **`src/app/claim-window-race.tap.svelte.test.ts`** — insert the advance right after
   the `tickUntil(target, () => claimPrompt(target) !== null)` at line 113, before
   `firstCalls[0]!.click()` (line 125). The second window's chi button is never
   clicked in this file, so no second insertion is needed there.

4. **`src/app/houtei-dismissal.tap.svelte.test.ts`** — insert the advance inside the
   shared `step()` helper, before `passBtn.click()` (line 127) and before
   `notYet.click()` (line 144).

5. **`src/app/window-outcome-notice.tap.svelte.test.ts`** — insert the advance inside
   its own (independently duplicated) `step()` helper, before `passBtn.click()` (line
   137) and before `notYet.click()` (line 157); and at three direct call sites in the
   test bodies: before `passBtn!.click()` (line 215), before `winButton!.click()`
   (line 251), before `ponButton!.click()` (line 299).

## Files explicitly NOT touched

- `src/core/` — untouched (E-012 constraint).
- `src/app/App.svelte` — no changes; `promptKey`/`{#key}`/cascade logic is unaffected,
  the guard is entirely internal to the two prompt components.
- `src/app/Table.svelte`, `HandEnd.svelte`, `WindowNotice.svelte` — no guard, no
  mention in the ticket.
- `src/app/table.tap.svelte.test.ts`, `hand-end.tap.svelte.test.ts`,
  `app.terminology.svelte.test.ts` — their clicks target ungated buttons
  (hand tiles, drawn tile, `.next-hand`, `.new-game`, `.terminology-toggle`); confirmed
  in research.md's click-site audit.
- SSR test files (`app.ssr.test.ts`, `app.terminology.coverage.ssr.test.ts`) — no
  `$effect` runs during SSR, so no guard state or `matchMedia` call is ever reached;
  their static-HTML assertions are unaffected by construction.

## Ordering

1. `mount-guard.ts` first (no dependents yet, nothing else compiles against it).
2. `ClaimPrompt.svelte`, then `RiichiPrompt.svelte` — independent of each other, can
   be done in either order or together; both only depend on step 1.
3. Test file updates last, in the order listed above — each can be verified
   independently by running its own suite (`just test` or a scoped vitest run) as it's
   finished, satisfying plan.md's "small enough to commit atomically" requirement.
