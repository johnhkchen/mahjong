# Research — T-012-01-01 prompt-mount-input-guard

## Ticket in one line

`ClaimPrompt.svelte` and `RiichiPrompt.svelte` render their buttons the instant they
mount; a tap landing during the entry CSS beat (~200ms) currently fires the button's
`onclick` handler immediately, so a mistimed tap (or the second half of a phone
double-tap) aimed at a just-closed prompt can land on the very next one. Need: during
the mount beat, buttons still render immediately (no `disabled`, no visual change) but
activations are inert; after the beat, activations work normally. Under
`prefers-reduced-motion`, both the CSS beat and the JS guard collapse to 0.

## The two prompt components

### `src/app/ClaimPrompt.svelte`

- Pure input wiring (props in, `onclaim`/`onpass`/`onwin` callbacks out), no internal
  state today (no `$state`, no `$effect`).
- Renders three kinds of buttons: `.call.win` (tsumo/ron, conditional on `win`),
  `.call` (one per `choices` entry: chi/pon/daiminkan), `.pass` (conditional on
  `canPass`).
- Has an existing **CSS-only** entry transition (lines 154–175): `@starting-style` +
  `transition: opacity 200ms ease-out, transform 200ms ease-out`, gated behind
  `@media (prefers-reduced-motion: no-preference)`. Comment at line 162 already notes
  "200ms sits inside App.svelte's 250ms BOT_DELAY_MS tick." This is the "existing CSS
  transition duration" the ticket's Context refers to.
- No JS-side awareness of the beat at all today — buttons are live from the first
  paint.

### `src/app/RiichiPrompt.svelte`

- Same shape: pure props in, `ondeclare`/`ondecline` out, no internal state.
- Renders `.declare` and `.pass` buttons.
- **Has no CSS entry transition at all** — no `@starting-style`, no `transition`, no
  `@media (prefers-reduced-motion)` block. This is a real gap between the ticket's
  Context ("A freshly-mounted ClaimPrompt (and RiichiPrompt) ignores button
  activations during its entry beat (~the existing CSS transition duration)") and the
  current code: RiichiPrompt has no existing beat to reference. The AC only asserts
  behavior for ClaimPrompt's buttons (call/pass/win); RiichiPrompt is named in Context
  as in-scope but not in the AC's concrete assertions.

## How each mounts fresh (why the guard matters)

`src/app/App.svelte`:
- `promptKey` (line 83) is the claimable window's own `seat:tile` identity (or
  `'no-window'`). The console's `{#key promptKey}` (line 290) wraps `<ClaimPrompt>` —
  every new window is a genuinely fresh DOM mount, never a patched update (already
  proven by `claim-window-race.tap.svelte.test.ts`'s `isConnected`/`!==` assertions,
  lines 178–183).
- `<RiichiPrompt>` (line 304) is NOT wrapped in a `{#key}` — it sits in a plain
  `{:else if riichi !== null}` branch of the four-tier console cascade (claim prompt >
  outcome notice > riichi prompt > hint, lines 276–307). Svelte still mounts a fresh
  `RiichiPrompt` instance each time the `{:else if}` branch becomes true after being
  false (an `{:else if}` transition is a mount/unmount, not a patch, since it's a
  different branch of the same `{#if}` chain) — so a guard added inside RiichiPrompt's
  own `$effect` will still fire on each occasion the riichi decision reappears.
- The bot pacing tick (`BOT_DELAY_MS = 250`, line 122) drives `forcedAction` pushes one
  per 250ms tick via `setTimeout` (line 236) — windows can reopen within a few ticks of
  each other (documented in claim-window-race.tap.svelte.test.ts: a second window
  reopened 3 ticks / ~750ms after the first closed). 250ms > 200ms, so a naive guard
  duration of 200ms comfortably fits inside one bot tick without stalling normal
  bot-paced play.

## Existing motion conventions in this codebase

- `Table.svelte` (lines 369–420) and `HandEnd.svelte` (line 139) both use CSS-only
  `animation`/`transition` gated behind `@media (prefers-reduced-motion: no-preference)`
  — the same pattern ClaimPrompt already uses. None of them have a JS-side
  reduced-motion check; this ticket is the first place JS needs to know the user's
  motion preference (to collapse the guard's `setTimeout` duration to 0).
- No `matchMedia` usage anywhere in `src/` today (confirmed via grep). `jsdom` (v29.1.1,
  the `dom` Vitest project's environment, `vite.config.ts`) does implement
  `window.matchMedia`, returning a real `MediaQueryList`-shaped object whose `matches`
  defaults to `false` (no user preference simulated) — safe to call unconditionally in
  both SSR-adjacent and DOM contexts, but must be guarded for the `node` Vitest project
  (`src/app/app.ssr.test.ts`, environment `node`, no `matchMedia` global at all) if any
  touched component is exercised there.
- Numeric pacing constants are conventionally **duplicated** across files with a
  cross-referencing comment rather than imported from a shared module — e.g.
  `BOT_DELAY_MS = 250` is redefined in `App.svelte` and independently in five test
  files, each commented "App.svelte's own pacing constant, duplicated for the timer
  advance" or "per convention." This is the established idiom for a magic number that
  must stay in sync between production code and its test-side timer advances.

## SSR boundary

- `src/app/app.ssr.test.ts` and `app.terminology.coverage.ssr.test.ts` render via
  `svelte/server` (no `$effect`, confirmed by App.svelte's own comment at line 233:
  "`$effect` never runs in SSR"). A guard implemented via `$state` + `$effect` never
  activates during SSR — the rendered HTML is static and has no click handlers wired
  live anyway, so SSR output/assertions are unaffected. `matchMedia` is not called
  during SSR either, since the effect that would call it never runs there.

## Test suites that click ClaimPrompt/RiichiPrompt buttons (must be touched)

Grepped every `.click()` in `src/app/*.svelte.test.ts` and filtered to buttons that
belong to ClaimPrompt (`.call`, `.pass` inside `.prompt`, aria-labels `pass`/
`tsumo`/`ron *`) or RiichiPrompt (`.declare`, `.riichi .pass`, aria-labels
`declare riichi`/`not yet`). Buttons belonging to `Table.svelte` (hand tiles, drawn
tile) or `App.svelte`/`HandEnd.svelte` (`.new-game`, `.next-hand`,
`.terminology-toggle`) are NOT gated by this ticket and need no changes.

Files needing an inserted timer-advance before their first click on a freshly (re)mounted
prompt, since every fold-driven click in these suites currently fires in the same
"tick" the prompt mounted in (0ms of guard time elapsed from the prompt's own
perspective):

1. `app.riichi.tap.svelte.test.ts` — clicks `[aria-label="declare riichi"]` (line 76)
   and `[aria-label="not yet"]` (line 104), each right after `tickUntil` first detects
   the RiichiPrompt.
2. `app.controls.svelte.test.ts` — `driveToHandEnd`'s generic loop (lines 63–90)
   clicks a win button or the pass button the instant either is found, with no time
   advance between detection and click.
3. `claim-window-race.tap.svelte.test.ts` — clicks the first window's sole chi button
   (line 125) immediately after `tickUntil` detects `claimPrompt`.
4. `houtei-dismissal.tap.svelte.test.ts` — its `step()` helper (lines 115–166) clicks
   `passBtn` (line 127) or `notYet` (line 144) the instant either is found.
5. `window-outcome-notice.tap.svelte.test.ts` — its own (independently duplicated)
   `step()` helper clicks `passBtn` (line 137) or `.riichi .pass` (line 157)
   immediately; three more direct clicks in the test bodies themselves click a
   just-detected button with no advance: `passBtn` (line 215), `winButton` (line 251),
   `ponButton` (line 299).

Each of these will start failing once the guard ships (the click becomes a no-op,
button stays present, loops either spin or hang past their tick budget) unless updated
to advance the guard duration before clicking — exactly what the AC asks for
("existing E-011 suites updated to advance past the beat rather than weakening
assertions").

## Constraints carried from the epic (E-012)

- View/drive-only; `src/core/` untouched.
- The guard must not delay the win button's availability beyond the beat (no special
  extra delay for `.call.win`).
- No new dependencies.
- Out of scope: claim priority, engine gates, sound, the "prompt every legal call"
  toggle (that's T-012-01-02).
