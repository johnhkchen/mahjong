# T-006-03-04 — determinism-termination-harness — Plan

## Steps

### Step 1 — mine the corpus (no committed artifact)

Write a scratch script (scratchpad, not the repo) or a provisional version of the
driver and run seeds 0..39 once each, collecting per-seed: end phase, action
count, claims folded, win form (tsumo/ron), winner, winning-tile kind, and
wall-clock per seed. Outputs decide:

- corpus size: smallest 0..N (N ≥ 39) where agari ≥ 1, ryuukyoku ≥ 1, claims ≥ 1,
  tsumo ≥ 1, ron ≥ 1 — widened past 39 only if a tally is zero;
- the three anchor seeds (one ron-agari, one tsumo-agari, one ryuukyoku) and
  their frozen literals;
- the runtime budget comment's honest numbers.

Verification: the mining run itself completes without a driver throw on every
seed (a RangeError here is a real finding — stop and investigate before writing
tests around it).

### Step 2 — `src/core/selfplay.test.ts`: driver + corpus suite (commit 1)

Per structure §§1–6: header doctrine, imports from `./index` + tooling,
re-stated constants, `selfPlay(seed)` with the two soundness guards,
`firstDivergence`, and the corpus suite (double-play every seed; byte-identity
via whole-record `JSON.stringify`; ended phase; explicit bound expect; aggregate
non-vacuity expects with the widen-don't-weaken comment).

Verification before commit:
- `npx vitest run src/core/selfplay.test.ts` green; isolated runtime noted
  (~≤10s target; if far over, shrink corpus and re-run Step 1 sizing).
- Deliberate-failure spot checks (run locally, not committed):
  (a) corrupt the driver's arbitration (e.g. skip the offered-index comparison)
  → an anchor-to-be fact changes / corpus still passes replay — confirms replay
  alone does NOT pin arbitration (motivates anchors);
  (b) make the driver append a constructed (non-offered) action → the membership
  guard throws — the guard is live.

Commit: `T-006-03-04: self-play harness — corpus determinism and termination`.

### Step 3 — anchors + fc layer (commit 2)

Per structure §§7–8: three mined-anchor tests (literals from Step 1, win facts
re-read from the folded end state as the double-key), then the fc sampled-seed
property (numRuns 10, full seed domain, same three assertions as the corpus).

Verification before commit:
- `npx vitest run src/core/selfplay.test.ts` green.
- Deliberate-failure spot check: flip one anchor literal (length off by one) →
  the anchor test fails naming the seed — the anchor has teeth. Revert.
- `just test` (full suite) green — proves no interference with policy.test.ts's
  rehearsal or the purity gate (the new file's imports must pass the gate).
- `just check` clean.

Commit: `T-006-03-04: mined anchors and sampled-seed property`.

## Testing strategy

Everything in this ticket IS test code; the strategy is therefore about the
tests' own soundness:

- **Unit-level**: none needed — the driver is exercised end to end by every
  suite; its two guards are its self-tests (spot-checked by deliberate failure
  in Steps 2–3, per the codebase's teeth-checking habit).
- **Integration-level**: the corpus suite (policy pair × legality × fold over
  whole games, twice per seed) and the fc layer (same, sampled domain).
- **Regression pinning**: the three anchors freeze composed behavior for named
  seeds; any future policy/legal behavior change re-mines them deliberately.
- **Non-vacuity**: aggregate tallies asserted as facts (agari, ryuukyoku,
  claims, tsumo, ron all ≥ 1 across the corpus).

## Verification criteria (the AC, mapped)

| AC clause | Where proven |
|---|---|
| "harness drives all four seats via the policy" | driver: every decision from discardPolicy/callPolicy over per-seat views; membership guard |
| "same seed replays a byte-identical action log end to end" | corpus suite + fc layer: serialized whole-record equality of two independent runs |
| "every seeded full-botted game reaches an ended phase (agari or ryuukyoku)" | corpus + fc: endPhase assertion; non-vacuity proves both phases occur |
| "within the bounded turn count" | driver tripwire + explicit `length ≤ ACTION_BOUND` expect |
| "asserted across a sample of seeds" | 40-seed literal corpus + 10 fc-sampled seeds |

## Risks / contingencies

- **A mining throw (driver RangeError on some seed)**: would mean the reference
  arbitration re-statement or a policy contract is wrong — halt, diagnose
  against playPolicy's behavior on the same seed, fix the harness (or file the
  core bug — core changes are out of scope per design; a real engine bug would
  bounce back through Lisa).
- **Zero rons in any affordable corpus**: rons need a bot discarding into
  another bot's wait — plausible but not guaranteed in 40 seeds. Contingency:
  widen stepwise (0..59, 0..79…) while runtime allows; if still zero at the
  budget edge, swap tail seeds for individually-mined ron seeds (literal corpus,
  documented as mined — the drive.test.ts seed-mining precedent) rather than
  weakening the check.
- **Runtime blowout**: shrink corpus, keep non-vacuity by mined-seed
  substitution as above.
