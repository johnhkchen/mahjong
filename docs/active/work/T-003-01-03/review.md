# T-003-01-03 — Review: turn-loop-property-suite

Self-assessment and handoff. The ticket converts property rigor from static wall
facts to dynamics: a random-legal-sequence generator driven by `legalActions` proves
conservation, determinism, and termination over trajectories the tsumogiri-shaped
suites cannot reach.

## What changed

```
CREATED  src/core/dynamics.test.ts   (+261 lines, tests only)
CREATED  docs/active/work/T-003-01-03/{research,design,structure,plan,progress,review}.md
```

No runtime source was touched: `foldRecord` and `legalActions` (from prior tickets)
already export everything needed; the barrel is unchanged; the generator is
deliberately test-local (bots — the future runtime consumer of random play — are a
later epic that will design its own surface).

Commits: `c3d95ab` (generator + conservation), `2a2ca9d` (determinism), `3941461`
(termination), `466a58e` (mutation matrix), plus this artifacts commit.

## How it works (30 seconds)

`playRecord(seed, choices)` drives a game by repeatedly folding the growing record
and picking the next action from `legalActions` — one fc-supplied choice integer per
post-draw point (the only point offering >1 action). All randomness is fast-check's,
so failures shrink; state only ever advances by refolding, so no step logic is
reimplemented (design §3: no third authority). `gameArb` yields partial games with
an optional dangling draw; `fullGameArb` supplies exactly 70 choices so the walk
runs until the offered set empties. A hard 142-action bound inside `playRecord`
turns any future non-terminating turn loop into a thrown error, not a hung run.

## Acceptance criteria traceability

| AC clause | Where proven |
|---|---|
| fast-check properties over random legal action sequences | all four describes consume `gameArb`/`fullGameArb`, both driven by `legalActions` |
| hands + ponds + live + dead partition 136 distinct ids at every prefix | `conservation over random play`: exhaustive prefix walk, length + Set-size both 136 |
| folding the same record twice yields deeply-equal TableState | `fold determinism over random play`: double fold, `toEqual`, freshness spot-checks |
| every randomly generated full game terminates in ryuukyoku rather than looping | `termination`: exactly 140 actions, phase ryuukyoku, empty live/offered set; the loop bound is the anti-hang guarantee |
| randomly mutated (illegal) sequences throw | `mutated sequences throw`: five one-rule-outside operators, each asserting offered-set absence + RangeError |
| just test green | 89 tests green; `just check` also green (0 errors) |

**One documented interpretation**: the AC's "hands + ponds + live + dead" cannot
hold at post-draw prefixes — the frozen `TableState` contract holds the drawn tile
apart from all four zones. The suite checks the five-zone partition (including
`drawn`), which reduces to the AC's literal four-zone form at every pre-draw prefix.
This matches the existing conservation property in record.test.ts. (design.md §4)

## Test coverage assessment

New ground actually reached: tedashi-bearing records (hands permuted by play) now
flow through conservation, determinism, termination, and mutation — previously only
one seed-1 example test exercised the tedashi branch of `applyAction`. Mutation
operators collectively hit every guard in the step: wrong seat, out-of-sequence
draw/discard, unheld tile, action-after-end.

Non-vacuity was verified, not assumed: tampering `allZones` (dropping the dead wall)
failed the conservation property on fc's first run; termination asserts exact counts
so a generator that silently stops early fails; fc's rejection-ratio guard bounds
`fc.pre` discards in the mutation properties.

Timing: suite went from 81 tests/~0.5s to 89 tests/~0.95s test time (~0.6s vitest
wall) — well under the ~2.5s budget. The documented dial is the conservation
property's `numRuns: 50`; everything else runs fc's default 100.

## Gaps and open concerns

- **Choice distribution is uniform over the offered set.** Random play never
  *prefers* tsumogiri or tedashi; both occur constantly (P(tsumogiri) = 1/14 per
  turn), but adversarial patterns (e.g. always discarding the oldest hand tile) are
  not specifically targeted. Acceptable: the properties are invariants, and fc
  shrinking plus 70-turn games give dense coverage of both branches.
- **`gameArb` generation cost is O(n²) per value** (refold per step). Measured cost
  is negligible today; if the action vocabulary grows (calls/riichi), regenerate the
  timing measurement — the dials are `numRuns` values, and the design forbids
  sampling prefixes (AC says every prefix) before reducing runs.
- **Mutation operators are one-rule-outside by construction.** Compound corruption
  (two mutations that re-legalize each other) is untested — and untestable in
  general (a mutated sequence that folds legally is by definition a legal record).
  The agreement suite's exhaustive 548-candidate anchor (T-003-01-02) remains the
  backstop that offered ⇔ folds.
- **Interior deletion is not an operator** (design §7): deleting a suffix yields a
  legal record (nothing to assert), and interior deletion desynchronizes at the same
  guards duplicate/type-flip already hit. Noted for a future vocabulary where
  deletion could re-legalize differently.

## Nothing needing urgent human attention

No runtime behavior changed; no contract was widened; no TODOs remain in the code.
The one judgment call worth a reviewer's eye is the five-zone AC interpretation
(table above, design.md §4) — it follows the frozen TableState invariant and the
existing record.test.ts precedent.
