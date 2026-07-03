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
