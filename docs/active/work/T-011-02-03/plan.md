# Plan — T-011-02-03: window-legibility-regression-suite

## Step 0: verify and land T-011-02-01's pending implementation

1. Confirm `just check` is green on the current working tree (done at Research time
   — 202 files, 0 errors/warnings).
2. Run `just test` twice more to confirm the one flaky failure
   (`game.dynamics.test.ts`'s full-domain property test) is the pre-existing,
   out-of-scope core bug from research.md and not something this tree's changes
   caused — reruns already green in Research.
3. `git add` exactly the files structure.md's prep-commit list names (all of
   T-011-02-01's own diff — code + its own new test files — but NOT the four
   ticket frontmatter files, which stay unstaged per this repo's own convention).
4. Commit with a message crediting T-011-02-01, mirroring the sibling tickets'
   two-commit shape (implementation, then artifacts): one commit for the code, one
   for `docs/active/work/T-011-02-01/*`.
5. Verify: `git status` shows only this ticket's own untracked work
   (`docs/active/work/T-011-02-03/`) plus the four still-unstaged ticket frontmatter
   files remaining.

**Verification:** `git log --oneline -5` shows the two new commits; `git status`
is clean apart from ticket frontmatter and this ticket's own new work.

## Step 1: `drive.test.ts` — the two new `windowOutcome` unit cases

Add inside the existing `describe('windowOutcome', ...)` block:
- `ron` beats `pon` (South's ron on tile 82 vs the player's pon `[83, 80]`) — literal
  `HandAction` values matching the mined fixture exactly (cross-check, not
  independent invention).
- `ron` beats `ron` (atamahane) — synthetic, commented as such.

**Verification:** `npx vitest run src/app/drive.test.ts` — all existing +2 new pass.

## Step 2: `app.terminology.coverage.ssr.test.ts` — two new outcome-notice rows

Add the `ron`-beats-`pon` and `ron`-beats-`ron` cases inside the existing
`describe('outcome notice', ...)` block, following the file's own two-case pattern
exactly (hand-built `WindowOutcome`, `render(WindowNotice, {props: {outcome}})`,
assert `>${t.X}<` per span).

**Verification:** `npx vitest run src/app/app.terminology.coverage.ssr.test.ts` —
all existing + 4 new (2 cases × 2 terminologies, inside the existing per-terminology
loop) pass.

## Step 3: mine-verify the interactive pon/ron fixture end to end

Before writing the interactive test, run the throwaway scratchpad walk (already done
in Research — core seed 85, 78 actions, settles to South's ron) ONE more time
against the mounted App itself (not just the pure fold) inside a scratch test file,
confirming:
- The DOM's claim button for the target window reads `aria-label="pon 3s with 3s
  3s"`.
- `South`'s ron actually lands the hand in `agari` and the hand-end screen renders.
- The exact tick/guard count needed (already 78 from the pure walk; the App-mounted
  walk should match exactly since it drives the identical functions — confirm, don't
  assume).

Delete the scratch file once confirmed; nothing from it ships.

**Verification:** scratch run passes locally; deleted before the real test file is
written (no dead scratch file left in `src/app/`).

## Step 4: `window-outcome-notice.tap.svelte.test.ts` — the new fixture + terminology wrap

1. Add the terminology constants (structure.md) and `afterEach` reset.
2. Wrap the file's two existing top-level `it`s in the terminology loop, switching
   their notice/aria-label assertions from hardcoded English to `windTerm`/
   `callTerm`-derived expected values. (These two `it`s currently assert ABSENCE of
   a notice/prompt, which is terminology-invariant — but wrapping them still proves
   the negative holds under `zh-hant` too, i.e., switching terminology doesn't
   somehow conjure a notice into existence.)
3. Add the new `describe` block (structure.md): drive to the 78-action window, tap
   the pon, assert the notice's three spans, the hand-end screen, and the
   `next hand` click's `notice` reset.

**Verification:** `npx vitest run src/app/window-outcome-notice.tap.svelte.test.ts`
— full file green, including the ×2 terminology multiplication of the whole file.

## Step 5: `claim-window-race.tap.svelte.test.ts` — terminology-wrap the chi fixture

Wrap the existing single `it` (seed 344) in the same terminology loop; replace the
notice/aria-label hardcoded-English assertions with `windTerm`/`callTerm`-derived
values; keep every structural (`isConnected`, `!==`, `className`) assertion as is
(terminology-independent, unchanged).

**Verification:** `npx vitest run src/app/claim-window-race.tap.svelte.test.ts` —
both terminology iterations green (2 total, each the full seven-fact walk).

## Step 6: full-suite gate

1. `just test` — full suite green (allow for the known pre-existing
   `game.dynamics.test.ts` flake; rerun that one file in isolation if it fires, per
   research.md).
2. `just check` — 0 errors/warnings.
3. `just build` — single-file gate; confirm `dist/index.html` size is still well
   under budget (T-011-02-01/02's own builds were 104-106KB; this ticket adds no
   production code, so size should be unchanged or trivially different from source
   map/comment churn only — actually: test files never ship, so size should be
   byte-identical to before this ticket).
4. Final `grep -rn "DEFECT" src/` — confirm still zero real markers (only the
   historical narrative comment, unchanged from today).

**Verification:** all three `just` targets green; the AC's explicit list satisfied
in full.

## Step 7: commit

One commit for this ticket's test-only diff (four files: `drive.test.ts`,
`app.terminology.coverage.ssr.test.ts`, `window-outcome-notice.tap.svelte.test.ts`,
`claim-window-race.tap.svelte.test.ts`), matching the sibling tickets' "one
implementation commit" shape (this ticket has no separate "production code" step to
split out, since it changes zero non-test files) — then `progress.md`/`review.md` in
a second commit.

## Testing strategy summary

- **Unit** (`drive.test.ts`): the two new call-type combinations at the pure-function
  layer — cheapest, no mining needed for the atamahane case.
- **SSR/render** (`app.terminology.coverage.ssr.test.ts`): the same two combinations,
  both terminologies, component-level — proves `WindowNotice`'s own rendering is
  correct for types not otherwise exercised end-to-end.
- **Interactive** (`window-outcome-notice.tap.svelte.test.ts`,
  `claim-window-race.tap.svelte.test.ts`): the full app-mounted proof, now under BOTH
  terminologies, spanning chi (existing, re-parameterized) and pon+ron (new,
  mined) — plus the hand-boundary notice-reset gap this ticket closes.
- No `src/core/` tests added or needed (no core changes).
