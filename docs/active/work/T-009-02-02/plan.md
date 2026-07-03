# Plan — T-009-02-02 riichi-dynamics-suite

## Steps

### Step 1 — reproduce the baseline failure (verification only, no change)

Run `npx vitest run src/core/game.dynamics.test.ts` before touching anything and confirm
it fails exactly as research.md documented (`expected 99000 to be 100000`, 2 of 3 tests
red). This is already done during research (see research.md) but is repeated here as
step 0 of the implementation record so `progress.md` has its own before/after evidence,
not just a citation of the research artifact.

**Verification:** command output shows 2 failed / 1 passed, same assertion text.

### Step 2 — add `expectedPotCarry` and fix `expectValidBoundary`'s conservation formula

Single edit to `src/core/game.dynamics.test.ts`:
- insert `expectedPotCarry` (structure.md Change 1) near the other independently-restated
  helpers,
- fix the `(1) conservation` assertion to include `state.pot` (structure.md Change 2.1),
- add the `(5) pot carry` assertion (structure.md Change 2.2).

This one step covers both AC clauses "points + pot conserved" and "including pot
carries" — they are adjacent lines in the same function, no reason to split into two
commits.

**Verification:** `npx vitest run src/core/game.dynamics.test.ts` — the two currently
failing tests (`multi-hand dynamics: corpus`, `multi-hand dynamics: property over the
full seed domain`) must now pass. The already-passing byte-identical-replay test must
stay green (untouched by this step).

### Step 3 — add the riichi non-vacuity tally

Edit to the `'multi-hand dynamics: corpus'` `it` block (structure.md Change 3):
`riichiHands` counter, increment condition, final `toBeGreaterThan(0)` assertion.

**Verification:** re-run `npx vitest run src/core/game.dynamics.test.ts`; the corpus test
must still pass, and temporarily asserting `expect(riichiHands).toBe(0)` (a throwaway
local check while iterating, reverted before commit) should FAIL — proving the assertion
is live, not vacuously true because the corpus never reaches the line. (This is a
manual sanity check during implementation, not a persisted test.)

### Step 4 — full-suite regression check

Run `just test` (or `npx vitest run` over all of `src/core/`) to confirm no other suite
regressed. Research.md's scope claim — only `game.dynamics.test.ts` needed a change — is
verified here: if any other file's tests fail, that claim was wrong and design.md's
Decision "no change to game.ts/record.ts/settlement.ts/policy.ts" must be revisited
before proceeding.

**Verification:** full `just test` run is green.

### Step 5 — typecheck

Run `just check` (svelte-check + tsc) to confirm the new helper function and edits
type-check cleanly — `expectedPotCarry`'s parameter/return types must match
`TableState`/`number` exactly as used elsewhere in the file.

**Verification:** `just check` exits 0.

## Testing strategy

This ticket's entire deliverable IS test code — there is no separate "production code +
tests for it" split. The verification for each step above (steps 2/3 are the only
substantive edits) is the test suite itself passing, which is both the implementation and
its own proof of correctness. No additional test file is needed beyond the edits to
`game.dynamics.test.ts` itself (design.md Decision 1).

## Commit plan

One commit, covering steps 2+3 together (structure.md's own "Ordering" section: the three
changes are not independently meaningful). Step 1 (baseline reproduction) and steps 4-5
(regression/typecheck) are verification, not committed changes. Commit message should
name the regression fixed (conservation formula) and the AC clauses closed (pot carry,
riichi non-vacuity), following this repo's `(T-009-02-02)`-suffixed commit convention
visible in recent `git log` (e.g. "Widen the seeded sweep to oracle-check and require
riichi (T-009-02-01)").

## Risks / open questions going into Implement

- None identified that change the plan — research.md's probe already confirmed riichi
  incidence (83/120) and reproduced the exact failure this plan fixes, so there is low
  risk of the implementation step surfacing new facts. The one thing to watch: confirm
  `state.pot` at a fresh (`hands: [...hands, []]`) boundary really is exactly the carried
  pot with zero contribution from the new empty hand (true by `foldRecord`'s definition —
  an empty `actions` array performs no `applyRiichi`, so `state.pot` stays at `context.potIn`
  — but worth eyeballing in the actual diff/run rather than assuming).

## Repair (2026-07-04) — steps 6-10

### Step 6 — reproduce the expanded-scope baseline

`just test`: confirm exactly the four failures the repair note names (settlement
property, selfplay seeds 25/13, drive.test.ts), and confirm the note's fourth item
(`app.controls.svelte.test.ts`) is already green (`npx vitest run
src/app/app.controls.svelte.test.ts`). Do not assume the note is current — verify.

**Verification:** `just test` output shows 4 failed / 899 passed across exactly the three
named files; the fourth file passes standalone.

### Step 7 — fix `settlement.property.test.ts` (structure.md Change 4)

**Verification:** `npx vitest run src/core/settlement.property.test.ts` passes. Repeat
5x (fast-check samples randomly each run) to rule out a flaky fix rather than a correct
one.

### Step 8 — re-mine and re-pin `selfplay.test.ts`'s two anchors (structure.md Change 5)

Instrument first (temporary `console.log` of `selfPlay(25)`/`selfPlay(13)`'s actual
`{length, endPhase, win}`), read the actual values, THEN write the new expectations —
never guess a plausible-looking fixed value. For seed 13, since its new trajectory drops
the houtei scenario the test exists to pin, scan seeds 0-39 first (matches the existing
named-anchor range) for a replacement that still exhibits it; if none exists in that
range, widen the scan (design.md Decision 7). Remove all instrumentation before
committing.

**Verification:** `npx vitest run src/core/selfplay.test.ts` — all 6 tests (not just the
2 previously failing) pass, confirming the re-mine didn't disturb seeds 9/19's
already-passing anchors.

### Step 9 — re-pin `drive.test.ts`'s BOT-rons-the-player anchor (structure.md Change 6)

Same instrument-then-pin discipline as Step 8.

**Verification:** `npx vitest run src/app/drive.test.ts` — all tests in the file pass
(71 pre-existing + this 1, not just this 1 in isolation).

### Step 10 — full-suite regression + typecheck

`just test` (all 35 files) and `just check`, both must be clean. Re-run `just test` a
second time to catch any fast-check flakiness the single run might have missed (only
`settlement.property.test.ts` samples randomly among the touched files).

**Verification:** two consecutive green `just test` runs; `just check` exits 0.

## Commit plan (repair)

One commit covering Changes 4-6 together — same "not independently meaningful, land as
the repair they are" reasoning as the original plan's commit, and because splitting by
file would make three commits each individually leave `just test` red (they're
independent failures with a shared root cause, not a dependency chain, but the repair
note's own framing — and this ticket's own "done still means just test fully green" — is
about the whole tree, not file-by-file).
