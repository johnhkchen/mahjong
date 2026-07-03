# T-005-02-04 — win-conservation-determinism-suite — Design

## The problem, sharpened

Everything the AC asserts is ALREADY asserted somewhere — for states that random
trajectories rarely or never visit. The termination property's agari branch, the
conservation walk, and the double-fold determinism check all handle wins correctly,
but nothing guarantees a win ever flows through them: if T-005-02-02's offers
regressed to never-offered, the whole dynamics suite would stay green while its
agari coverage silently evaporated. The ticket's real deliverable is therefore
**pinned, non-vacuous win trajectories** through the existing invariants, plus the
win-specific assertions (winner/tile/yaku replay, post-win quiescence) named
explicitly on them.

## Options considered

### 1. Assert the share statistically inside the fc properties — REJECTED

Count agari ends across `fullGameArb` runs and assert > 0. Violates the suite's
own doctrine verbatim ("call density is a pinned fact, never an fc statistic"),
and fc's shrinking/run budget makes the count flaky by construction.

### 2. Module-load win-eager corpus over a wide contiguous range — REJECTED

The greedy-corpus shape: drive seeds 0..999 with a win-eager driver, assert both
end forms appear. Honest and drift-robust, but measured at ~3.5 s of module-load
work on every `just test` to reach 8 interesting games — 10× the greedy corpus's
cost for a per-run anti-vacuity fact that mined carriers pin equally loudly.
(A 600..999 sub-range halves it; still ~1.4 s for five carriers.)

### 3. Tsumogiri-eager corpus (static hands, wins only) — REJECTED

Measured: **zero** wins in 300 seeds. Static 13-tile hands almost never meet a
yaku-bearing non-furiten wait (the -02 mining had to scan thousands of seeds per
anchor). Also a degenerate sampler — it never exercises claims, so its trajectories
would be strictly narrower than the suite's declared trajectory space.

### 4. Teach playGreedy to take wins — REJECTED

playGreedy filters win offers deliberately: its corpus exists to guarantee
every-call-form coverage, and eager wins truncate games ("an eager win would
truncate games and starve the call coverage this corpus exists to guarantee").
Overloading it would trade one anti-vacuity guarantee for another.

### 5. Frozen mined win carriers driven win-eager — CHOSEN

The four-kan/haitei-anchor precedent, applied to wins: mine the carriers once from
a contiguous scan (documented range, "never regenerate"), freeze the seed list, and
re-drive them deterministically at module load with core's own rng. Scan results
(0..999, win-eager index sampling): tsumo carriers **[876, 950]**, ron carriers
**[100, 277, 360, 626, 731, 834]** — 8 games, ~30 ms total. Every AC clause then
runs over genuinely driven wins, and the anti-vacuity assertion is exact: every
carrier ends in agari, and both end forms appear in the corpus union.

Fragility trade-off, accepted with eyes open: any trajectory-shifting engine change
(a riichi ticket widening offers, a yaku change) can strand a carrier in ryuukyoku,
failing the corpus loudly and forcing a mechanical re-mine — exactly the exposure
the greedy corpus's ankan carriers (63/67/69) and the seed-101033 four-kan chain
already carry. Loud-and-cheap beats slow-and-robust here because re-mining is a
one-command scratchpad scan, while 3.5 s is paid on every test run forever.

## The driver: `playWinEager`

playGreedy's exact shape with the opposite filter:

```
pool = wins.length > 0 ? wins : legal      // wins = tsumo/ron offers
actions.push(pool[nextInt(rng, pool.length)])
```

- Same skeleton: refold per action (`foldRecord` stays the single authority), core
  `createRng`/`nextInt` (reproducible arithmetic, not fc), same `ACTION_BOUND` trip.
- When no win is offered it samples the FULL offered set uniformly by index — the
  same trajectory space as `playRecord`, so claims/kans churn hands exactly as the
  suite's doctrine requires (and churn is what CREATES wins — research §4).
- When several rons are simultaneously offered it picks among them with the rng —
  a legal recorder's choice under the multiple-ron convention (the fold accepts
  whichever single ron the log names).
- Termination: a ryuukyoku that offers a houtei ron gets it taken (win-eager), a
  houtei-less ryuukyoku offers nothing, an agari offers nothing — so the loop's
  "offered set empties" exit is reached in every case, as with playGreedy.

## The assertions (one new describe block, `wins over random play`)

Over `winCorpus = WIN_CARRIER_SEEDS.map(playWinEager)`:

1. **Non-vacuity (the share, pinned):** every corpus game ends `phase === 'agari'`
   with `win !== null`, and the union of `win.by` over the corpus contains BOTH
   `'tsumo'` and `'ron'`. A regression that stops offering wins turns a carrier
   into a ryuukyoku and fails here by name.
2. **Conservation through the ended state:** `expectConserved` (reused verbatim)
   over every corpus game — 136 distinct ids at every prefix INCLUDING the final
   won state; the winning tile never changed zone (tsumo: `drawn`; ron: pond).
3. **Replay reproduces the win:** fold each corpus record twice; the two `win`
   values are deeply equal and non-null — winner, tile, and the yaku list in the
   aggregator's deterministic order — and the states as wholes are deeply equal.
   (The whole-state check subsumes the triple; the explicit `win` assertion is the
   AC clause made legible.)
4. **Post-win quiescence, two-sided:** `legalActions(foldRecord(record))` is `[]`
   for every corpus game, and — the fold side — EVERY action form appended after
   the win throws, including `tsumo` and `ron` themselves: ron is the one form
   with an ended-phase carve-out (houtei folds out of ryuukyoku), so agari+ron
   throwing pins the carve-out as houtei-only, and a second ron after a win is the
   multiple-ron convention's documented rejection. Reuses the append-menu shape of
   the existing `append after ryuukyoku` operator, widened by the two win forms.
5. **End identities:** `expectEndIdentities` (reused verbatim — already win-aware:
   a tsumo leaves one discard obligation unmet, an agari ends mid-wall) over every
   corpus game, closing the arithmetic loop on win-ended logs.

No engine code changes. No new exports. The suite grows by one driver, one frozen
seed list, and one describe block in `dynamics.test.ts`; new-file placement was
rejected because every helper the block needs (`expectConserved`,
`expectEndIdentities`, `isWin`, `keyOf`, `ACTION_BOUND`) is deliberately
test-local to dynamics.test.ts, and record.test.ts at 1123 lines sets the size
precedent (~800 lines after this ticket).

## Mining protocol (Implement phase, scratchpad only)

Re-run the win-eager scan with the FINAL driver code over seeds 0..999, confirm
the carrier list and each carrier's end form, and freeze both in the test file's
comments (seed list + which carry tsumo). The scan script stays in the scratchpad
— per the -02 convention the constants are "mined by this ticket's scratchpad
scans... never regenerate," with the mining range documented at the constant.

## Risks

- **Carrier drift** (engine-legitimate changes shift trajectories): accepted above;
  failure mode is a loud corpus assertion naming the seed; remedy is re-mining.
- **Module-load cost creep:** 8 games ≈ 30 ms — negligible next to greedyCorpus.
- **Double-win ambiguity:** none — the driver plays exactly one win action and the
  fold ends the hand on it; assertion 4 pins that nothing else can follow.
- **Coverage honesty:** the corpus's rons include window rons only (no houtei
  carrier in 0..999, no rinshan-tsumo carrier); those forms keep their constructed
  anchors in legal.win.test.ts — this suite's business is driven trajectories, not
  every win flavor, and the AC asks only for tsumo and ron ends.
