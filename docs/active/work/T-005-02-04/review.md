# T-005-02-04 — win-conservation-determinism-suite — Review

## What changed

One file of product-adjacent code, no engine changes, no new exports:

- **`src/core/dynamics.test.ts`** (modified, +~130 lines; commit 890a05f):
  - Header: the suite's trajectory sources go from two to three, naming the
    win-eager carrier corpus and why it exists (agari ends become a pinned fact,
    never an fc statistic — the greedy corpus's own doctrine applied to wins).
  - `playWinEager(seed)`: playGreedy's mirror image — take a win offer whenever
    one is present (rng picks among simultaneous rons, a legal recorder's choice
    under the multiple-ron convention), otherwise sample the full offered set
    uniformly by index with core's own `createRng`/`nextInt`; per-action refolds
    keep `foldRecord` the single authority; same `ACTION_BOUND` throw.
  - `WIN_CARRIER_SEEDS = [100, 277, 360, 626, 731, 834, 876, 950]` + `winCorpus`:
    every seed in the contiguous scan range 0..999 whose win-eager game ends in
    agari (the frozen-anchor convention — mined once, documented, never
    regenerate). 876/950 end in tsumo, the rest in window rons; winners span
    seats 0/1/2, yaku span yakuhai-hatsu/yakuhai-round-wind/tanyao, game lengths
    21..161 actions with several mid-wall ends.
  - `describe('wins over random play')` — four deterministic corpus tests:
    1. every carrier ends in agari, both `tsumo` and `ron` occur across the
       corpus (named failure per missing form), and `expectEndIdentities` holds
       on every win-ended log;
    2. `expectConserved` — the 136-tile six-zone partition at every prefix of
       every won game, through the ended state;
    3. double fold reproduces the identical `win` (winner/tile/yaku, the yaku
       list in the aggregator's deterministic order) and identical whole state;
    4. two-sided quiescence: `legalActions` returns `[]` on every won state, and
       a 9-form × 4-seat append menu (draw/discard/chi/pon/daiminkan/ankan/
       shouminkan/tsumo/ron) all throw via `assertMutantThrows` — pinning that
       the ryuukyoku→ron carve-out (houtei) never extends to agari and a second
       ron after a win throws.
- **`docs/active/work/T-005-02-04/`** — the five RDSPI artifacts (this file is
  the sixth).

## AC traceability

- "random seeded hands driven by index-sampled legalActions where a nonzero
  share end in tsumo or ron" → the carrier corpus: 8 wins per 1000 contiguous
  seeds under win-eager index sampling IS the share, frozen and asserted (test 1).
- "136-tile conservation partition holds through the ended state" → test 2.
- "replaying any log reproduces the same winner/tile/yaku" → test 3.
- "legalActions is empty after every win" → test 4 (plus the fold-side rejection
  the AC didn't ask for).

## Test coverage assessment

- `just test`: **407 tests / 19 files green** (4 new). New corpus load ≈ 30 ms.
- Anti-vacuity verified by mutation smoke check (documented in progress.md):
  substituting a ryuukyoku seed for a carrier fails 3 of 4 new tests loudly.
- Empirical grounding is honest: uniform sampling alone yields 3 wins/1000 (no
  tsumo); tsumogiri-eager yields zero in 300 — win-eagerness over the full
  offered set is the cheapest policy that reaches both forms (design.md §Options).

Gaps, deliberate:

- No driven **houtei-ron** or **rinshan-tsumo** carrier exists in 0..999; those
  win flavors keep their constructed anchors in `legal.win.test.ts`. The AC asks
  only for tsumo/ron ends.
- The nonzero share remains a mined fact, not a per-run measurement — rerunning
  the 1000-seed scan on every test invocation was rejected as a 3.5 s/run cost
  (design.md option 2).

## Open concerns

1. **Carrier drift (accepted, by design):** any trajectory-shifting engine change
   (riichi offers, yaku changes, offer-order growth) can strand a carrier in
   ryuukyoku. Failure is loud and names the seed; the remedy is a one-command
   scratchpad re-mine (protocol in design.md). Same exposure as the greedy
   corpus's ankan carriers and the seed-101033 four-kan chain.
2. **`just check` currently FAILS — pre-existing, not this ticket.** All 5
   svelte-check errors are in `src/core/mine.test.ts` / `src/core/mine2.test.ts`,
   untracked TEMPORARY probes ("Deleted after capture") from the concurrent
   T-005-02-03 session that appeared mid-flight. This ticket's file has zero
   problems in the same run. Left untouched (another thread's in-flight work);
   **needs human/lisa attention** if T-005-02-03 doesn't clean them up.
3. **Deviation from plan:** one code commit instead of the planned two — the
   describe block is a single cohesive insertion; all per-step verifications
   still ran (progress.md).

## Known limitations

- The corpus asserts both forms over the union, not per-seed end forms — a
  deliberate under-pin so legitimate derivation changes that shuffle which
  carrier wins how don't fail spuriously as long as both forms survive.
- `playWinEager` remains test-local (suite doctrine: bots are a later epic —
  E-006 picks up runtime random play with its own shape).
