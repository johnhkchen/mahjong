# Plan — T-012-01-01 prompt-mount-input-guard

Each step is independently runnable/verifiable and intended as one commit.

## Step 1 — add `src/app/mount-guard.ts`

Write the two exports (`MOUNT_GUARD_MS`, `prefersReducedMotion`). No test file of its
own needed — it's exercised entirely through the two components that consume it (unit
tests on a two-line function with no branching worth isolating add nothing `just
check`/the component tests don't already cover). Verify: `just check` (svelte-check +
tsc) passes on the new file, `tsc` sees no unused-export/type errors.

## Step 2 — wire the guard into `ClaimPrompt.svelte`

Add the import, `guarded = $state(true)`, the mount `$effect`, and wrap all three
`onclick` handlers. Verify: `just check` passes; no test run yet expected to be green
(existing suites that click ClaimPrompt buttons haven't been updated — this step is
expected to turn some currently-green tests red, confirming the guard is real and not
a no-op. Do NOT skip verifying the expected failures — running the affected suites and
seeing them fail on a bare `.click()` with no time advance is the actual proof the
guard works before the test-side fix masks it again).

## Step 3 — wire the guard into `RiichiPrompt.svelte`

Same shape as Step 2, independent file. Verify the same way: `just check` green,
riichi-touching suites now red for the same "click landed inside the guard" reason.

## Step 4 — update `app.riichi.tap.svelte.test.ts`

Insert the two `advanceTimersByTimeAsync(MOUNT_GUARD_MS)`/`flushSync()` pairs
(structure.md's mapping). Verify: `just test` scoped to this file goes green again —
this is also the file that directly proves the AC's "an activation inside the beat
does nothing and the same activation after the beat works" claim, since it's the
narrowest suite (two isolated riichi-decision assertions, not a long multi-window
walk) — good candidate to ALSO add one new, explicit assertion here: click the
`declare riichi` button immediately on mount (0ms elapsed), assert the pond/hand is
unchanged and the prompt is still present, THEN advance `MOUNT_GUARD_MS` and click
again, assert it now lands. This is the one new interaction test the AC explicitly
calls for, layered onto an existing fixture rather than mining a new one.

## Step 5 — update `app.controls.svelte.test.ts`

Insert the two advances inside `driveToHandEnd`. Verify: `just test` scoped to this
file green — this suite drives many hands to completion across arbitrary seeds, so a
regression in the guard's interaction with rapid bot-paced re-prompting would surface
here as a `maxTicks` exceeded error, a useful independent check beyond the two seed-
pinned suites.

## Step 6 — update `claim-window-race.tap.svelte.test.ts`

Insert the one advance before the first window's chi click. Verify: `just test`
scoped to this file green — this is also where the "win button obeys the same beat
and no more" AC line and the reopened-second-window timing assertions
(`expect(ticks).toBe(3)`) live; confirm the inserted 200ms advance does not shift the
frozen `ticks === 3` result (it shouldn't: the advance happens after the first
window's click resolves and before the tick-counting loop starts, so it's outside the
3-tick measurement window — verify this by inspection of the diff, not just a green
run, since a green run alone wouldn't catch a coincidentally-still-passing but
conceptually-misplaced advance).

## Step 7 — update `houtei-dismissal.tap.svelte.test.ts`

Insert the two advances inside its `step()` helper. Verify: `just test` scoped to this
file green.

## Step 8 — update `window-outcome-notice.tap.svelte.test.ts`

Insert the two advances inside its `step()` helper and the three direct-click-site
advances. Verify: `just test` scoped to this file green.

## Step 9 — full suite + typecheck

`just check && just test` for the whole repo. This is the AC's own bar ("`just test`
green"). Also run `just build` once to confirm the single-file production bundle
still compiles cleanly with the new module (`mount-guard.ts` has to get inlined by
`vite-plugin-singlefile` like everything else in `src/app/`).

## Testing strategy

- **Unit-level**: none needed for `mount-guard.ts` itself (see Step 1) — it has no
  branching complex enough to need isolation, and both consuming components exercise
  both its `true`/`false` `matches` paths transitively (default jsdom `matches: false`
  covers the "motion allowed" path in every existing suite; no suite currently
  simulates `prefers-reduced-motion: reduce`, and adding one is out of scope — no AC
  asks for it, and E-012's own Done-looks-like language only asks that the CSS/JS
  beat durations collapse together, not that this ticket prove jsdom's `matchMedia`
  stub can be made to report `reduce`).
- **Interaction-level (the AC's actual ask)**: the new assertion added in Step 4 is
  the direct proof of "activation inside the beat does nothing, same activation after
  the beat works." It's added to the narrowest, cheapest-to-extend existing suite
  rather than mining a new fixture — no new seed needs mining for this ticket.
- **Regression-level**: Steps 5–8 are existing E-011 suites already covering the
  broader lifecycle (window reopening, notice cascade, houtei dismissal, terminology)
  continuing to pass with the guard active, proving the guard doesn't break the
  cascade timing or dismissal/notice/riichi ordering already under test.
- **Verification criteria for "done"**: `just test` green (AC's explicit bar); the
  Step 4 new assertion passes; `just check` clean; no suite weakened (every diff in
  Steps 4–8 is an *insertion* of an advance, never a removed/loosened expectation —
  checked by review in Step 9's diff read before commit).

## Deviation handling

If any Step 4–8 file needs an advance somewhere research.md/structure.md didn't
anticipate (e.g. a click site missed by the grep), add it, note the miss in
`progress.md` under "deviations," and re-run that file's suite before moving on —
don't batch multiple undiscovered fixes into one step silently.
