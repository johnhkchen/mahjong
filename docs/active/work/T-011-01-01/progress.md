# Progress — T-011-01-01: claim-window-interaction-repro

## Completed

- [x] **Research** — mapped `settleWindow`/`forcedAction` (drive.ts), the
  console `{#if}` and `dismissed` flag (App.svelte), the ryuukyoku houtei
  carve-out (legal.ts/record.ts), and the repo's mined-fixture/jsdom-mount test
  conventions. Flagged the critical constraint: old core-level anchors mined
  under literal all-tsumogiri play (e.g. `HOUTEI_SEED = 1038928`) don't survive
  real policy-bot driving — anything for an `App`-mounted test needs fresh
  mining. `research.md`.
- [x] **Design** — decided to mount the real `App` (not a synthetic harness)
  for both new suites, since the defect lives in `App.svelte`'s own handlers
  having no branch for "the tap lost"; one mined fixture (seed 344) covers both
  AC (a) and (b) per the epic's own framing of them as one symptom chain;
  scoped the houtei mining pivot (tsumogiri-only player → too rare in 200,000
  seeds → discardPolicy-driven player → 8 hits in 20,000). `design.md`.
- [x] **Structure** — file-level plan for the two new test files, their
  helpers, and confirmation that no existing file changes. `structure.md`.
- [x] **Plan** — six-step sequence (mine a/b → write+verify → mine c →
  write+verify → prove-as-real-guard via revert → cleanup+full-suite).
  `plan.md`.
- [x] **Implement**:
  - Mined and froze game seed `2654435561` (hand-0 core seed `344`) for the
    mixed-race + reopened-window fixture.
  - Wrote `src/app/claim-window-race.tap.svelte.test.ts` — passes on first run
    against the current (unfixed) codebase.
  - Mined and froze game seed `2654433429` (hand-0 core seed `2340`; hand-1
    core seed `2723775479`) for the houtei-dismissal fixture, after an initial
    tsumogiri-only mining attempt found zero hits in 200,000 seeds and was
    revised to an actively-tenpai-seeking player model.
  - Wrote `src/app/houtei-dismissal.tap.svelte.test.ts` with a generic,
    non-hardcoded step-driver — passes on first run.
  - **Verified the houtei test is a real regression guard**: temporarily
    reverted commit 3bcf9d3's `dismissed = false` line in `App.svelte`,
    re-ran the suite, confirmed it failed with the expected assertion
    (`expected null not to be null`), then restored the file and confirmed
    `git diff src/app/App.svelte` showed zero changes before proceeding.
  - Deleted every scratchpad mining script (never committed).
  - Ran `npm test` (39 files, 938 tests, all green) and `npm run check`
    (svelte-check + tsc, 0 errors/warnings) after every commit.
  - Three commits: planning artifacts, the (a)/(b) suite, the (c) suite.
- [x] **Review** — this document's sibling, `review.md`.

## Deviations from the plan

- **Houtei mining needed two attempts, not one.** `plan.md` Step 3 anticipated
  this might be rare, but the first (tsumogiri-only) model turned out to be
  rare enough (0/200,000) to warrant a documented pivot rather than a wider
  scan of the same model. The revised (discardPolicy-driven player) model
  found hits quickly (8/20,000). This is recorded in `design.md`'s option
  space for (c), not treated as a silent retry.
- **No shared test-utility module.** Both new suites duplicate small
  step/tick helpers. Considered and explicitly rejected in `design.md` —
  this repo has no shared test-utils module anywhere, and introducing one
  for two call sites would be scope creep beyond a characterization ticket.
- Everything else matched the plan as written.

## Known limitations / what this ticket deliberately does NOT do

- Does not touch `settleWindow`, `App.svelte`'s handlers, or `ClaimPrompt.svelte`
  — no fix, by design (E-011's later tickets own that).
- Does not add terminology-toggle (zh-hant) coverage for the two new suites —
  out of this ticket's scope (see design.md's "explicitly NOT in scope" note).
- The `claim-window-race` suite's `// DEFECT:` assertions will need to be
  flipped (not merely relaxed) once the fix tickets land an outcome notice and
  a fresh-prompt beat — this is intentional and named in the ticket's own
  Context section ("these tests pin the defect and then flip to pinning the
  fix").
