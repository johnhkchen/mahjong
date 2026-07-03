# Review — T-011-02-03: window-legibility-regression-suite

## What changed

This ticket is entirely test-only — no `src/core/`, `src/app/App.svelte`,
`WindowNotice.svelte`, `ClaimPrompt.svelte`, `drive.ts`, or `dictionary.svelte.ts`
edits. Four files modified (commit `542a571`):

- **`src/app/drive.test.ts`** — two new `windowOutcome` unit cases: `ron` beating
  the player's `pon` (the exact two `HandAction` values the new interactive fixture
  below actually produces, cross-checked not invented) and `ron` beating the
  player's own `ron` (the atamahane/head-bump case — a synthetic pair, since
  `windowOutcome` is pure and never touches the fold; no fixture exists or was
  mined for this combination, see Open Concerns).
- **`src/app/app.terminology.coverage.ssr.test.ts`** — two new rows in the existing
  `describe('outcome notice', ...)` block, both terminologies, following the file's
  own hand-built-`WindowOutcome` convention exactly (no restructuring).
- **`src/app/window-outcome-notice.tap.svelte.test.ts`** — the file's three
  scenarios (the pre-existing pass-case and win-case, plus a brand new "pon loses
  to ron, hand ends mid-notice" fixture) are now each run under both `romaji` and
  `zh-hant`, wrapped in a `for (const terminology of TERMINOLOGIES)` loop mirroring
  `app.terminology.coverage.ssr.test.ts`'s own shape. The new fixture uses a mined
  game seed (`2654435812`, core seed 85): the player's only claim offer is a pon,
  outranked by a bot's ron on the same tile — a ron always ends the hand, so this
  is the first fixture anywhere in the suite that reaches `agari` with the notice
  still showing, exercising `App.svelte`'s `newHand()` reset of `notice` for the
  first time (T-011-02-01 review.md's own open concern #2, closed here).
- **`src/app/claim-window-race.tap.svelte.test.ts`** — the existing seed-344 "mixed
  race" `it` (chi loses to pon, notice, reopen, remount, cascade preemption — the
  fullest single lifecycle walk in the suite) is now run under both terminologies
  the same way; the DOM-structural remount assertions (`isConnected`, `className`
  equality, reference inequality) are terminology-independent and untouched — only
  the text expectations changed, from hardcoded English to `callTerm`/`windTerm`.

A prior, separate concern this session also resolved: **T-011-02-01's entire
implementation (`WindowNotice.svelte`, `drive.ts`'s `windowOutcome`,
`dictionary.svelte.ts`'s `callTerm`, the `App.svelte`/`ClaimPrompt.svelte` wiring,
and that ticket's own new/modified tests) was sitting fully finished but wholly
uncommitted** in the working tree at the start of this session — its own
`review.md` was complete and dated, but no commit anywhere touched it. This was
landed first, as two catch-up commits (`41a0c15` code, `e04bfe1` artifacts) crediting
T-011-02-01 correctly, before this ticket's own work began — see research.md/
design.md Decision 1 for the full reasoning. This ticket's commit (`542a571`) is
clean test-only diff on top of that.

## Test coverage

- **Unit** (`drive.test.ts`): 77 tests (75 existing + 2 new), all green. The two new
  cases give `windowOutcome` full coverage of the AC-named call types as BOTH
  winner and player-tap where that direction is real (chi can never win — legal.ts's
  own frozen precedence rules it out, correctly absent from every table).
- **SSR/component** (`app.terminology.coverage.ssr.test.ts`): 32 tests (28 + 4 new:
  2 cases × 2 terminologies), all green. `WindowNotice` now has direct, both-
  terminology coverage of every AC-named call-type combination.
- **Interactive** (`window-outcome-notice.tap.svelte.test.ts`,
  `claim-window-race.tap.svelte.test.ts`): 8 tests total (6 + 2, all doubled from
  3 + 1 by the terminology wrap), all green. Together these prove the full open→
  answer→outcome→next-window (or hand-end) lifecycle for chi (seed 344) and for
  pon+ron in one fixture (seed 85/game seed 2654435812), each under both
  terminologies.
- **Full suite**: `just test` — 40 files, 959 tests, green (948 baseline + 11 net
  new). `just check` — 202 files, 0 errors/warnings. `just build` —
  `dist/index.html` 106.25 kB / gzip 34.77 kB, `verify-single-file` OK (unchanged
  from the T-011-02-01 baseline; no production code touched).
- `grep -rn "DEFECT" src/`: one hit — a historical narrative comment in
  `claim-window-race.tap.svelte.test.ts`'s own file header describing what the
  ORIGINAL characterization ticket (T-011-01-01) did. Not a live marker on any
  assertion; every real `// DEFECT:` block was already flipped to `FIXED (...)` by
  T-011-02-01/-02-02, verified again here. The AC's "no `// DEFECT:` markers remain"
  clause was already satisfied before this ticket started — this ticket's own job
  was the parameterized-coverage half of the AC.

## Critical issue for human attention (pre-existing, out of scope, not fixed here)

**`src/core/game.dynamics.test.ts`'s full-seed-domain property test
(`fc.integer({min:0,max:0xffffffff})`, `numRuns: 8`, no pinned seed) is flaky and
caught a real, pre-existing core-engine bug during this session's Research phase**:
seed `-1266320619` produced `RangeError: riichi by seat 2 with -1500 points, fewer
than the 1000-point stick` — a real gap in `src/core/record.ts`'s `applyRiichi`
(or the policy feeding it) that lets a riichi declaration through without enough
points to cover the stick. Reproduced once; three immediate reruns of the isolated
file, plus one more at the end of this ticket's own work, all passed clean (the
property only samples 8 random 32-bit seeds per run, so this is a real but rare
gap in the input domain, not a deterministic failure). This is **unrelated to
E-011's view/drive-only scope** — the same category as T-011-02-01 review.md's own
flagged `furitenSeal`/`waits` crash on a player's successful claim. **Neither bug
was fixed by this ticket or its predecessors; both should become their own tickets
before the next real playtest**, since an under-stick riichi is a real, if
statistically rare, reachable state for a bot to land in.

## Other open concerns

1. **The ron-vs-ron atamahane case has no interactive fixture** — only pure-
   function (`drive.test.ts`) and SSR/component (`app.terminology.coverage.ssr.
   test.ts`) coverage, both using a synthetic (non-mined) `HandAction`/
   `WindowOutcome` pair. design.md Decision 5 records this as a deliberate scope
   cut: mining two simultaneous ron offers on the same discard, where the player's
   own is not the earliest in rotation, is a materially harder search than the
   "claim + one ron" shape this ticket's mining pass actually found (a 50000-seed
   scan for the simpler shape succeeded at seed 85; the atamahane shape was not
   attempted at real mining cost). A future ticket wanting the fully interactive
   proof needs its own dedicated mining pass.
2. **The new interactive fixture's own guard loop (200) is generous but untested
   at its edge** — it happened to reach the target window at 78 actions, well
   under the guard. No regression risk today; noted only because a future bot-
   policy change (research.md's own standing caveat, restated from every prior
   mined-fixture suite in this repo) could shift this fixture's turn count or
   break it outright, the same accepted risk every other mined seed in this repo
   already carries.
3. **`.riichi .pass` selector fix in `window-outcome-notice.tap.svelte.test.ts`'s
   shared `step()` driver** (progress.md's own documented deviation): the
   pre-existing helper hardcoded `[aria-label="not yet"]`, which is
   terminology-dependent (`RiichiPrompt`'s decline button's aria-label is itself
   `term('notYet')`). Caught immediately by the first `zh-hant` run of the
   pre-existing win-case scenario and fixed by switching to the stable `.riichi
   .pass` class selector. This ONE file's driver was fixed; `houtei-dismissal.tap.
   svelte.test.ts`'s own near-identical `step()` (out of this ticket's scope, never
   run under `zh-hant`) still has the same latent, currently-inert bug — worth
   fixing in the same pass if that file is ever terminology-parameterized too, but
   not touched here (not in this ticket's Structure/Plan scope, and the file
   currently only runs romaji, where the literal string is still correct).
4. **A fourth near-identical `step()`/`driveUntil()`-shaped driver now exists**
   (this ticket added none — the new fixture reuses `window-outcome-notice.tap.
   svelte.test.ts`'s own pre-existing `step()`) — research.md's own standing note
   from T-011-01-01/-02-02 design docs: worth a second look at extraction if a
   fifth near-identical copy ever appears. Still below this repo's own threshold
   today.

## Nothing else is outstanding

No TODOs, no `.skip`/`.todo`, no known-failing assertions in this ticket's own
scope. `just test`, `just check`, and `just build` are all green. The ticket's
Acceptance Criterion is met: no `// DEFECT:` markers remain, and the outcome notice
plus fresh-prompt beat now have parameterized coverage across chi/pon/ron windows
× both terminologies — split proportionately across the pure-function, SSR/
component, and full-interactive layers per design.md's own reasoning about where
each combination's cost/confidence tradeoff actually lands. The two critical items
for human attention are both pre-existing, out-of-scope `src/core/` bugs
(the under-stick riichi and the prior `furitenSeal`/`waits` crash) flagged above and
in T-011-02-01's own review.md — neither is new to this ticket, and neither was
fixed here.
