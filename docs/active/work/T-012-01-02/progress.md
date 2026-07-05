# Progress — T-012-01-02 useful-call-prompt-filter

All plan.md steps completed in one continuous pass (no deviations from the plan).

## Completed

1. **`drive.ts`**: added `claimWindowInterrupts(state, offered, player,
   promptEveryLegalCall)`; `forcedAction` now takes `promptEveryLegalCall` as a
   required 4th parameter and consults `claimWindowInterrupts` instead of the raw
   `claimChoices` length. No other line of `forcedAction` changed — the existing
   fallthrough arms (bot-only settle, stale-window head draw) already produce the
   correct auto-pass result.
2. **`drive.test.ts`**: every pre-existing `forcedAction(...)` call site (25)
   updated to pass `, true` (preserves old "always wait" semantics exactly — the
   whole suite ran unmodified-behavior first, confirmed green, before any new
   assertions were added). Added `describe('claimWindowInterrupts', ...)` (4
   cases: no-window, declined-by-default, toggle-restores-true,
   approved-by-default) and one new `forcedAction` case contrasting the filtered
   vs. unfiltered auto-settle at the same declined-claim fixture (seed 3,
   `raceWindow3`), oracle-checked against `settleWindow`'s own independent
   computation.
3. **`src/app/call-prompt-settings.svelte.ts`** (new): the toggle module,
   `dictionary.svelte.ts`'s own shape mirrored — module-scoped `$state`,
   `mahjong-prompt-every-legal-call` localStorage key, guarded read/write.
4. **`dictionary.svelte.ts`**: added `promptEveryCall`/`quietCalls` `TermKey`
   entries (romaji + zh-hant).
5. **`app.terminology.coverage.ssr.test.ts`**: added the two new keys to its
   `EXPECTED` literal (a type-checking requirement — `Record<Terminology,
   Record<TermKey, string>>` — not new behavioral coverage; this file's own scope
   is explicitly "not the toggle's own click/persist behavior").
6. **`App.svelte`**: new `claimsInterrupt` derived; `prompt`'s derivation now
   gates on it; the `$effect`'s `forcedAction` call passes
   `promptEveryLegalCall()`; new header button (`.call-prompt-toggle`) sharing
   the terminology toggle's visual register and CSS declarations.
7. **`houtei-dismissal.tap.svelte.test.ts`** /
   **`window-outcome-notice.tap.svelte.test.ts`**: both set
   `setPromptEveryLegalCall(true)` in `beforeEach` (reset to `false` +
   `localStorage.clear()` in `afterEach`) so their pre-existing generic
   decline-everything drivers keep their exact pre-ticket assumption ("every
   offered claim/win renders a prompt") — zero assertion changes in either file,
   confirmed by running them unmodified-behavior first.
8. **`claim-window-race.tap.svelte.test.ts`**, **`app.controls.svelte.test.ts`**,
   **`app.riichi.tap.svelte.test.ts`**: confirmed to need no changes (both
   windows in the race fixture are policy-approved; the other two files' generic
   drivers already tolerate an absent prompt).
9. **`src/app/call-prompt-filter.tap.svelte.test.ts`** (new): 5 end-to-end cases
   — default auto-pass on a policy-declined window (no prompt ever renders, and
   play keeps progressing), a policy-approved window still prompting by default,
   the toggle restoring full prompting live for the same declined window, both
   terminologies' label text, and toggle persistence across a simulated reload
   (`vi.resetModules()` + fresh `import('./App.svelte')`, mirroring
   `app.terminology.svelte.test.ts`'s `mountFreshApp` pattern).

## Verification

- `just test` (`npx vitest run`): 41 files, 969 tests, all green (up from 40
  files / 959 tests pre-ticket).
- `just check` (svelte-check + tsc): 205 files, 0 errors, 0 warnings.
- Manual: `vite` dev server boots and serves the app shell; the new
  `call-prompt-filter.tap.svelte.test.ts` suite is the actual behavioral proof
  for the toggle button's rendering/click/label/persistence (a real browser
  click-through was not additionally performed — see review.md's open concerns).

## Deviations from plan.md

None. One correction made mid-implementation (not a plan deviation, a bug in the
first draft of the new test file): the new suite's own generic `step()` driver
initially assumed every player claim/win always renders a pass button — true for
`houtei-dismissal`/`window-outcome-notice` (which force `promptEveryLegalCall:
true` for their whole walk) but NOT for this new file's own default-setting
scenario, whose hand-0 walk (before the target hand-1 window) turned out to
cross an earlier claim window not documented in the houtei-dismissal fixture's
own comments. Fixed by holding the toggle on for hand 0's walk only (matching
houtei-dismissal's own convention) and restoring the default immediately before
driving toward the actual window under test.
