# Plan — T-008-03-02 next-hand-new-game-controls

Nine steps, each independently verifiable. No `src/core/` step — this ticket is app-layer only
(structure.md). Steps 1-3 are pure/presentational and safe to land before touching `App.svelte`;
steps 4-5 wire the record model; steps 6-9 are tests, run continuously as each piece lands (this
plan interleaves rather than batching all tests at the end, since each step's own tests are what
prove it before the next step builds on it).

## Step 1 — `HandEnd.svelte`: `scores`/`onnext` props, `next-hand` button

Add the two optional props, `displayScores` derived, the `{#if onnext}` button block, and its CSS
(design.md Decision 3-4, structure.md). No behavior change when the new props are omitted —
verify by running the EXISTING `app.ssr.test.ts` hand-end suite unmodified first (must stay
green; proves the default/fallback path is untouched before any new test is added).

**Verify**: `just test` — zero existing failures.

## Step 2 — `Table.svelte`: forward `scores`/`onnext`

One prop-widening, one template-line change (structure.md). Same verification as Step 1 — no
existing test should move (`table.tap.svelte.test.ts` and every `Table`-rendering block in
`app.ssr.test.ts` don't pass the new props, so they exercise the identical old code path).

**Verify**: `just test` — zero existing failures.

## Step 3 — SSR: `scores`-override and `next-hand`-visibility cases

Extend `app.ssr.test.ts`'s hand-end/ryuukyoku/playing-table describe blocks per structure.md
(override values render instead of `breakdown.scores`; button present exactly when `onnext` is
passed on an ended hand, absent while playing or when `onnext` is omitted). These test Steps 1-2
directly, still with zero `App.svelte`/`GameRecord` involvement.

**Verify**: `just test` — new cases green, everything else unchanged.

## Step 4 — `hand-end.tap.svelte.test.ts`: click reaches `onnext`

New file (structure.md). Mount `Table` with a won and a ryuukyoku fixture, spy `onnext`, click,
assert called once each. This is the ONLY thing SSR structurally can't prove (button wiring
reaches a real click) — land it before touching `App.svelte` so the click plumbing is proven
independently of the state-model rewrite in Step 5.

**Verify**: `just test` (the `dom` vitest project specifically —
`flox activate -- vitest run --project dom` if `just test` doesn't already cover it; check
`vitest.config`/`package.json` scripts first for how `table.tap.svelte.test.ts` currently runs).

## Step 5 — `App.svelte`: `GameRecord` state model

The full rewrite in structure.md: `gameSeed`/`hands` state, `record`/`game`/`table`/`offered`/
`seatScores` derives, `hands[hands.length-1].push` at every former `actions.push` site, `newHand`,
widened `newGame`, template's two new props on `<Table>`. This is the one step touching the most
surface — do it as a single atomic commit (the AC's own controls only make sense together; a
half-migrated state model has no meaningful intermediate green state beyond "still compiles").

**Verify**: `just check` (svelte-check + tsc — catches any `$derived`/type mismatch immediately);
`just dev` and manually play one hand through to an end, confirm "next hand" and "new game" both
appear and look sane before running automated tests (this repo's own stated norm for UI-surface
changes — a human should click through once, per T-008-03-01's review.md precedent).

## Step 6 — Update the one broken SSR fixture

`describe('dealt-table view (SSR)')`'s `table` fixture (structure.md — `handSeedOf(BOOT_SEED, 0)`
in place of raw `BOOT_SEED`). This is the ONLY existing assertion Step 5's seed-derivation change
invalidates (research.md §6/§7) — everything else in `app.ssr.test.ts` renders `Table` directly
against hand-authored fixtures untouched by App's internals.

**Verify**: `just test` — the FULL existing suite (`drive.test.ts`, `table.tap.svelte.test.ts`,
`app.ssr.test.ts`, every `src/core/` test) must be green again after this one-line fix; if
anything else broke, that indicates a missed seat/seed assumption not caught by this plan and
needs investigation before continuing.

## Step 7 — `app.controls.svelte.test.ts`: the generic driver + both controls end-to-end

New file (structure.md). Write `driveToHandEnd` first as an isolated helper, test it in isolation
(mount `App`, run the driver, assert a `next-hand` button eventually appears — no click yet) before
adding the click-and-assert cases. `vi.useFakeTimers()` interacting with Svelte 5's `$effect`
scheduler under `mount()` is the one genuinely novel testing pattern in this ticket (research.md
§6 — no prior test drives App's bot loop through a mount); budget iteration here specifically:
if `flushSync()` alone after `vi.advanceTimersByTimeAsync` doesn't settle the DOM, try wrapping in
`await Promise.resolve()` first, or driving with `vi.runAllTimersAsync()` per-tick instead of a
fixed `BOT_DELAY_MS` advance.

**Verify**: run this file alone first (fast iteration on the timer-driving pattern before adding
assertions), then the full suite.

## Step 8 — `next hand` and `new game` assertions

Once Step 7's driver reliably reaches a hand end, add: click `next-hand`, assert
`sum(scores) === 100000` and the post-click table shows a fresh deal (13 hand tiles again, wall
count back near its dealt maximum — reuse `dealt.live.length`-style assertions from
`app.ssr.test.ts`'s existing conventions); click `new-game`, assert scores reset to
`[25000,25000,25000,25000]` and `phase === 'playing'` with no `next-hand` button.

**Verify**: `just test`, full suite green.

## Step 9 — `just check` and final full-suite pass

`just check` (svelte-check + tsc) and `just test` one more time as the closing gate, matching this
repo's standard commit-readiness bar (referenced throughout T-008-02-01/T-008-03-01's own
`progress.md`/`review.md` files).

## Testing strategy summary

- **Unit/SSR** (Steps 1, 3, 6): `HandEnd`/`Table` prop-forwarding and fixture updates — fast,
  deterministic, the bulk of new coverage.
- **Component-mount, no timers** (Step 4): proves the button's click handler is wired through
  `Table`'s forwarding — isolates ONE new risk (a typo in the prop-forwarding chain) from the
  bigger risk in Step 7.
- **Component-mount, fake timers, full app** (Steps 7-8): the only way to exercise `App.svelte`'s
  `$effect`-driven bot loop and the `GameRecord` state model together, matching the AC's literal
  "from a won or drawn hand in `just dev`" framing — this is genuinely what a human clicking
  through the app would do, scripted.
- **Manual** (Step 5): one click-through in `just dev`, per this repo's established norm for
  UI-surface tickets, before the automated suite is trusted.
