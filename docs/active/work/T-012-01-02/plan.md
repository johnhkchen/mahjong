# Plan — T-012-01-02 useful-call-prompt-filter

Each step is independently committable and (except step 1, which by construction
breaks compilation until paired with step 2) leaves `just test`/`just check` green.

## Step 1 + 2 (one commit): `drive.ts` predicate + mechanical `drive.test.ts` fixes

1. `drive.ts`: import `callPolicy` from `../core`. Add `claimWindowInterrupts`.
   Change `forcedAction`'s signature and first guard (structure.md).
2. `drive.test.ts`: add `, true` to every existing `forcedAction(...)` call site.
   Verify: `just test` green, zero assertion changes needed (the whole point of
   passing `true` everywhere is that old semantics are preserved exactly).
3. New `describe('claimWindowInterrupts', ...)` in `drive.test.ts`:
   - a state with no window at all (`claimChoices` empty) → `false`, regardless
     of the `promptEveryLegalCall` argument, and never calls into `callPolicy`
     (assert via a state where `callPolicy` would throw if reached — the
     dealt/no-window fixtures already used elsewhere in this file, e.g. `dealt`).
   - the RACE_GAME_SEED-style approved-claim window (or any fixture from the
     existing `promptChoices` describe block already proven non-empty) → `true`
     at `promptEveryLegalCall: false` (policy approves) and `true` at `: true`.
   - a fixture where `callPolicy` declines every offered claim (mine or reuse
     one; `drive.test.ts` already has fixtures for lone/weak claims used
     elsewhere — reuse rather than re-mine per research.md's declined
     houtei-hand-1/pon-ron seeds, folded directly with `foldRecord` rather than
     through the app) → `false` at `promptEveryLegalCall: false`, `true` at
     `: true`.
4. Extend the existing `describe('forcedAction', ...)` block: for the SAME
   declined-claim fixture above, assert `forcedAction(state, offered, PLAYER,
   false)` returns a non-null action (matching what `settleWindow(state,
   offered, PLAYER, null)` independently computes — the double-keyed oracle
   convention this file already uses throughout) while `forcedAction(state,
   offered, PLAYER, true)` returns `null` (waits).

Testing strategy: pure `vitest` (`src/**/*.test.ts` project), no DOM. Oracle:
compare against `settleWindow`'s own independent computation, never a hardcoded
literal, matching this file's existing double-keying convention.

## Step 3: `call-prompt-settings.svelte.ts`

New file per structure.md. No test file of its own — it is exercised entirely
through `App.svelte`'s mounted behavior in step 6's new suite (mirrors how
`dictionary.svelte.ts` has no standalone unit test; `app.terminology.svelte.test.ts`
is the only coverage it has).

## Step 4: `dictionary.svelte.ts` new terms

Add `promptEveryCall`/`quietCalls` to `TermKey` and `TERMS`. Verify:
`app.terminology.coverage.ssr.test.ts` (if it enumerates `TermKey` exhaustively)
still passes — read that file first to confirm whether it iterates
`Object.keys(TERMS)` generically (in which case nothing further is needed) or
hardcodes the key list (in which case add the two new keys there too).

## Step 5: `App.svelte` wiring

Per structure.md: new derived `claimsInterrupt`, `prompt`'s new derivation, the
`forcedAction` call's 4th argument, the new header button + CSS. Manual smoke
check: `just dev`, open the app, verify the new button renders next to
"new game"/the terminology toggle and its label flips on click.

## Step 6: fix the two affected E-011 suites

1. `houtei-dismissal.tap.svelte.test.ts`: add the import, `beforeEach`/`afterEach`
   toggle set/reset/clear, `, true` on its `step()`'s `forcedAction` call.
   Verify: `just test -- houtei-dismissal` green, UNCHANGED assertions (this is
   the "extends rather than duplicates" contract — a diff limited to setup/
   plumbing lines).
2. `window-outcome-notice.tap.svelte.test.ts`: identical shape of fix. Verify
   green, unchanged assertions.
3. `claim-window-race.tap.svelte.test.ts`: confirm it needs no change by running
   it unmodified after steps 1–5 land (research.md already established both its
   windows are policy-approved; this is the regression check, not new work).
4. `app.controls.svelte.test.ts`, `app.riichi.tap.svelte.test.ts`: confirm green
   unmodified (same reasoning).

## Step 7: new end-to-end suite — `call-prompt-filter.tap.svelte.test.ts`

Mirrors `app.terminology.svelte.test.ts`'s and
`window-outcome-notice.tap.svelte.test.ts`'s scaffolding (fake timers, `mountApp`,
`afterEach` reset of both the settings module AND `localStorage`). Fixtures:
reuse the SAME frozen seeds research.md already characterized rather than mining
new ones —

- **default filtering, declined window auto-passes**: drive `HOUTEI_GAME_SEED`'s
  hand-1 walk (`houtei-dismissal.tap.svelte.test.ts`'s own frozen
  `HAND1_SEED = 2723775479`) with the toggle left at its default (off/false,
  fresh `localStorage`). Assert: at the state where the raw chi offer exists
  (`claimChoices(offered, PLAYER).length > 0`, verified via a parallel
  `foldRecord` walk exactly like the existing suite's), NO `[aria-label="call or
  pass"]` ever renders across that transition, and the walk continues (the next
  discard/bot tick lands) without the test driving any tap at that point — proves
  "never renders a prompt and play proceeds as a pass."
- **policy-approved window still prompts by default**: reuse
  `RACE_GAME_SEED` (2654435561) from `claim-window-race.tap.svelte.test.ts` —
  default settings, drive the five tsumogiri rounds, assert the chi prompt DOES
  render (a one-line regression check, not re-asserting that whole file's race
  behavior).
- **toggle restores full prompting for a declined window, live**: mount fresh,
  click the new toggle button BEFORE reaching the seed-2723775479 window, drive
  to the same point as the first bullet, assert the prompt NOW renders with the
  chi button (`aria-label` `"chi 3m with 1m 2m"`), and that tapping "pass"
  behaves exactly as `settleWindow(state, offered, PLAYER, null)` predicts.
- **both terminologies covered**: assert the toggle button's own label text
  under `romaji` and `zh-hant` (`term('promptEveryCall')`/`term('quietCalls')`
  via the production `dictionary.svelte.ts` functions, not hardcoded strings —
  the `window-outcome-notice.tap.svelte.test.ts` convention).
- **persistence**: `localStorage.getItem('mahjong-prompt-every-legal-call')` reads
  back `'true'` after a click; a `vi.resetModules()` + fresh
  `import('./App.svelte')` remount (the `app.terminology.svelte.test.ts`
  `mountFreshApp` pattern, copied) restores the toggled-on state and its label.

Testing strategy: DOM-mounted (`*.svelte.test.ts` project), fake timers, real
taps — the only level that can prove "no prompt ever rendered" (a pure-function
test can't observe what `App.svelte` chooses to show).

## Step 8: `just check` + `just test` full run, then review.md

Run the full suite once at the end of Implement to catch any cross-file
regression the per-step checks above missed (e.g. an unrelated suite that
happens to touch a claim window incidentally).
