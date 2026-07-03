# Review — T-011-01-01: claim-window-interaction-repro

## What changed

Two new files, no existing file modified:

- `src/app/claim-window-race.tap.svelte.test.ts` (155 lines) — AC sequences
  (a) and (b): mounts the real `App`, mines a mixed pon/chi race window (game
  seed `2654435561`), taps the player's only (losing) chi choice, and asserts
  both the immediate no-visible-outcome defect and the reopened,
  structurally-identical second window that follows three ticks later.
- `src/app/houtei-dismissal.tap.svelte.test.ts` (240 lines) — AC sequence (c):
  mounts the real `App`, drives a mined game (seed `2654433429`) through a
  lone houtei ron decline and into the next hand via a generic, non-hardcoded
  step-driver, asserting the next hand's first claim prompt actually renders.

Four docs artifacts under `docs/active/work/T-011-01-01/` (research, design,
structure, plan) plus this review. No changes anywhere in `src/core/`,
`src/app/drive.ts`, `src/app/App.svelte`, or `src/app/ClaimPrompt.svelte` —
this ticket is test-only, matching E-011's own "view/drive-only, this epic
changes what the player sees, not what folds" scoping and T-011-01-01's own
"characterization first, before any fix" charter.

## Test coverage

Both new files are themselves the ticket's deliverable test coverage; there is
no additional code to cover. Specifics:

- **`claim-window-race.tap.svelte.test.ts`**: one `it`, but it is a continuous
  walk asserting seven distinct facts in sequence (fixture sanity → the race
  loss's silence → the reopened window's shape → its timing → its structural
  identity to the first). `just test` / `npm test` passes today (39 files, 938
  tests) — this is expected and correct for a characterization suite: it pins
  CURRENT (defective) behavior, it does not require the defect to be fixed.
- **`houtei-dismissal.tap.svelte.test.ts`**: one `it`, driving two whole hands
  end to end through a real mounted `App`. Verified as a genuine regression
  guard, not merely a suite that happens to pass: I temporarily reverted
  commit 3bcf9d3's `dismissed = false` line and re-ran the suite — it failed
  with the expected assertion — then restored the file (confirmed via `git
  diff` showing zero changes) before finalizing. This is the strongest
  evidence available that the test actually exercises the fixed code path.
- **Full-suite check**: `npm test` (39 files / 938 tests) and `npm run check`
  (svelte-check + tsc, 0 errors) both green after the final commit.

### Gaps

- Neither new suite exercises the `zh-hant` terminology toggle. Deliberately
  out of scope for this ticket (design.md) — the fix tickets that add new
  user-facing strings (an outcome notice, a fresh-prompt marker) are where
  dual-terminology coverage for THOSE strings belongs; this ticket's
  assertions key off `aria-label`/structural facts that don't vary by
  terminology for the call TYPES already covered elsewhere (`chi`/`pon` labels
  are covered under both terminologies in `app.terminology.svelte.test.ts`).
- The mined fixtures (game seeds `2654435561` and `2654433429`) are each
  useful for exactly one hand's geometry; they are not general-purpose and
  should not be reused for unrelated future tickets without re-verifying the
  specific facts they pin (this repo's own "never regenerate, but also never
  assume without re-checking" convention for mined seeds).
- `claim-window-race.tap.svelte.test.ts`'s "no outcome anywhere" assertion
  (`target.querySelector('.notice, .outcome, [role="alert"], [aria-live]')`)
  is necessarily a negative check against class/role names that don't exist
  yet — if a fix ticket introduces an outcome notice under a DIFFERENT
  selector than these four, this specific assertion would need updating
  alongside the aria-label equality assertions it sits next to (both are
  flagged `// DEFECT:` for exactly this reason).

## Open concerns for a human reviewer

1. **Fixture longevity.** Both suites mine specific seeds and assert exact
   `discardPolicy`/`callPolicy` outcomes at specific turns. Any future change
   to bot policy (shanten tie-breaks, accept-rule thresholds) could shift
   these fixtures the same way `drive.test.ts`'s own header describes for the
   T-006-03-03 policy-bot migration. This is accepted risk, consistent with
   how every other mined-fixture suite in this repo already lives — not a new
   risk this ticket introduces.
2. **`houtei-dismissal.tap.svelte.test.ts`'s runtime.** The suite drives ~150
   real actions through fake timers and DOM re-renders in one test; it runs in
   well under a second in this environment, but it is the heaviest single test
   in the new coverage. No action needed now; worth watching if the suite
   list grows and CI time becomes a concern.
3. **The generic step-driver duplicated, not shared.** Both new files
   independently implement small tick/tap-driving helpers. `design.md` records
   the explicit decision not to extract a shared module (no precedent for one
   in this repo, and it's two call sites). A human reviewer who disagrees with
   that call should say so now — a third suite needing the same shape would
   tip the balance toward extracting one.

## Nothing critical is outstanding

No TODOs, no `.skip`/`.todo`, no known-failing assertions. `just test` and
`just check` are both green. The ticket's single Acceptance Criterion is met
in full: a jsdom suite (two suites, in fact) drives all three sequences
through real taps on mined seeds, documents current behavior with `// DEFECT:`
markers, and the houtei-reset regression passes.
