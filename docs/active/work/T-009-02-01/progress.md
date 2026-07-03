# Progress — T-009-02-01 bot-riichi-policy

Tracking against `plan.md`'s six steps. Working tree is shared with other in-flight
tickets' uncommitted work per Lisa's documented multi-thread-one-branch concurrency model
(T-009-01-01's review notes the same); this ticket only touches `src/core/policy.ts` and
`src/core/policy.test.ts`.

## Step 1 — `isDeadWait` helper + import

Status: done. Commit `9d5a944`.

## Step 2 — wire the riichi step into `discardPolicy`

Status: done. Commit `90b34c5`. All 34 pre-existing `policy.test.ts` tests passed
unchanged, confirming no existing fixture's `offered` array contains a `riichi` action
(as Design predicted) and the new branch is a true no-op against them. `just check`
clean (191 files, 0 errors).

## Step 3 — curated riichi tests (declare / dead-wait decline / cross-seat)

Status: done. Commit `5926715`. Used Research §4's two concrete fixtures verbatim.
Confirmed the decline test is not vacuous: temporarily disabled the `isDeadWait` guard
(reverted immediately after, never committed) and re-ran just that test — it failed as
expected, proving the exception is genuinely load-bearing.

## Step 4 — purity/determinism extension

Status: done. Commit `64a77f6`. Added two new tests (rather than editing the existing
two in place) to avoid any risk to already-passing assertions — same shape, riichi
fixture from Step 3's declare case.

## Step 5 — sweep extension

Status: done. Commit `c32c1aa`. `playPolicy` now returns `riichiFolded`; the per-step
oracle re-derives shanten-0 for a folded riichi the same way it already did for plain
discards (generalized the `if (chosen.type === 'discard')` guard to also cover
`'riichi'`, since both carry `.tile`). The corpus test asserts `riichis > 0`. Ran the
full `policy.test.ts` file three times standalone to check for flakiness in the new
assertion — stable every time (the corpus is a fixed 12-seed array, so this is
expected: either always `> 0` or never).

## Step 6 — full-suite confirmation pass

Status: done, with one deviation documented below.

- `just check` (svelte-check + tsc): clean, 191 files, 0 errors, 0 warnings.
- `just test` (whole repo): **6 pre-existing failures across 4 files**, all outside this
  ticket's touched files (`src/app/drive.test.ts`, `src/core/game.dynamics.test.ts` ×2,
  `src/core/selfplay.test.ts` ×2, `src/core/settlement.property.test.ts`,
  `src/app/app.controls.svelte.test.ts`). None involve `policy.ts`/`policy.test.ts`.
- **Deviation**: rather than assume these are pre-existing, verified directly. Created
  an isolated `git worktree` at this ticket's final commit (`c32c1aa`, symlinking
  `node_modules` in since worktrees don't get their own), ran the full suite there with
  zero uncommitted files present (the shared working tree currently also has an
  uncommitted, in-progress edit to `src/core/dynamics.test.ts` from the concurrent
  T-009-01-04 thread — confirmed via `git diff`/`git log` that this ticket's own commits
  never touch that file). The **same 4 files, same 6 failures** reproduced in the clean
  worktree (a zero-sum settlement violation of −1000/−2000 points, and two mined-seed
  length mismatches), proving they predate this ticket's work entirely — most likely
  fallout from the concurrently-landed riichi settlement/pricing commits already on
  `main` (`de1dd64` "Price ura-dora and the riichi yaku family through
  settlementOf/scoreBreakdownOf" is the leading suspect given the failure shape,
  zero-sum-across-riichi-stick arithmetic). **Not this ticket's bug to fix** — out of
  scope (T-009-02-01 touches `src/core/policy.ts`/`policy.test.ts` only) and a human
  reviewer should track it separately; flagged prominently in `review.md`. Worktree
  removed after verification, no `git reset`/`stash` applied to the shared tree.
- `git diff --stat` against `HEAD~5` confirms only `src/core/policy.ts` and
  `src/core/policy.test.ts` changed across this ticket's five commits; `git status`
  shows no `src/app/` changes from this work.
