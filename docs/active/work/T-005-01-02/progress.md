# T-005-01-02 — tenpai-waits — Progress

## Completed (all plan steps)

- [x] **Step 1** — `src/core/waits.ts` (visibleCounts, guards, 34-kind completion
  loop with the ≥ 4 skip, isTenpai) + barrel line. `just check` 0 errors,
  `just test` 236/236 (pre-suite baseline preserved, purity gate covers the new
  module). Commit `ef3430f`.
- [x] **Step 2** — fixture suites: wait shapes (tanki, ryanmen, kanchan, penchan,
  shanpon, cross-suit order pin, junsei chuuren, meld-bearing ryanmen, four-meld
  tanki), special forms (chiitoitsu single wait, four-of-a-kind noten, kokushi
  13-sided and single), exhaustion convention (concealed 1111m producer,
  ankan-blocked ryanmen, all-waits-exhausted noten), contract (garbage noten, both
  RangeErrors, > 4 melds, purity, isTenpai). 20 tests. Commit `1d3ae53`.
- [x] **Step 3** — meld-aware property layer: real-meld builder over one shared
  4-copy budget (pon/chi/ankan forms), builder self-test (200 runs),
  winner-minus-one containment + 34-kind biconditional + order pin (300 runs),
  random 13-tile draws biconditional + isTenpai equivalence (300 runs). 3
  properties. Commit `ae4c1b0`.
- [x] **Step 4** — final gates: `just test` 259/259 (~2.2s wall, suite budget
  held), `just check` 0 errors. review.md written.

## Deviations from plan

1. **Fixture derivation error, caught by the suite** (plan risk #1, resolved as
   the plan prescribed): the concealed-exhaustion fixture `1111m234m567m999p` was
   hand-derived as waiting on [4m] only. The module reported [4m, 7m]; re-deriving
   from the rules confirmed 7m — pair 77m lets the fourth 1m join 23m as 123m and
   the 567m block re-form as 456m (111 + 123 + 456 + 999). The FIXTURE was wrong,
   not the module; expected list and comment corrected. The 1m exclusion — the
   point of the fixture — was correct throughout.
2. **None else.** Module shape, API, convention, commit boundaries, and test
   architecture all landed as designed. The plan's other contingencies (builder
   form coverage, runtime blowout, barrel conflict with -03) never fired; no
   sign of a concurrent -03 commit as of `ae4c1b0`.

## State for a resumed session

Implementation complete and committed (`ef3430f` → `1d3ae53` → `ae4c1b0`);
review.md is the handoff. Ticket frontmatter untouched per RDSPI rule 3 (lisa
advances phases on artifact detection).
