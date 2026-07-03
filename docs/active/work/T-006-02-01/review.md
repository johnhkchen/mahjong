# T-006-02-01 — standard-form-shanten — Review

Self-assessment and handoff. What changed, how it is covered, what a human
reviewer should look at.

## 1. What changed

| File                       | Change   | Size                                    |
| -------------------------- | -------- | --------------------------------------- |
| `src/core/shanten.ts`      | created  | ~150 lines (half doc comments)          |
| `src/core/shanten.test.ts` | created  | ~185 lines, 18 tests, 6 describe blocks |
| `src/core/index.ts`        | modified | +1 barrel line                          |

One code commit: `db1a388`. No app files, no changes to agari/waits/tiles, no
ticket-frontmatter edits (lisa's). RDSPI artifacts committed separately.

**The export**: `standardShanten(concealed: readonly TileKind[], melds:
readonly Meld[]): number` — standard-form (four sets + pair) shanten; −1
complete, 0 tenpai, up to 8; accepts both 13 − 3·melds and 14 − 3·melds
arities; melds arity-only (each call discounts one required set); pure,
deterministic, RangeError on wrong arity or > 4 melds. The plain `shanten`
name is deliberately unclaimed — T-006-02-02's min-of-three combinator takes it.

**The algorithm**: the classical block-count maximum — backtrack over the
34-kind counts, extracting sets (triplet/run, +2), partials (pair, adjacent,
gapped proto-run, +1) and at most one head pair (+1) under the cap
`sets + partials ≤ 4 − melds`; `shanten = 8 − 2·melds − max`. Lowest-kind-first
with an advance branch (the agari.ts searchSets argument extended to six
shapes), mutate-recurse-restore, one trivially-safe upper-bound prune.

## 2. Acceptance-criteria check

- ✅ "src/core exports a standard-form shanten function returning an integer" —
  `standardShanten` via the barrel.
- ✅ "unit tests pin known hands (complete = −1/0-away, tenpai, 1-shanten,
  13-tiles-apart)" — 14-tile winner → −1; ryanmen/tanki/shanpon → 0; broken-head
  ryanmen → 1; `147m147p147s1234z` → 8 (the scattered worst case).
- ✅ "with called-meld counts reducing required sets" — the discount block walks
  tenpai at 1/2/3 melds and −1/0 at 4 melds over shrinking remainders.

`just test`: 19 files / 466 tests green. `just check`: 0 errors, 0 warnings.

## 3. Test coverage assessment

Covered: the four AC anchors; both arities (including 0 → −1 on drawing the
wait); meld discount at every meld count; the exactness edges the design called
out (pair-as-head vs pair-as-partial vs pair-feeding-triplet; the block cap on
the six-pairs hand — standard reads 3 where chiitoitsu will read 0, pinned with
a comment saying the divergence is the point); both RangeError messages
verbatim; purity/determinism. Expected values are all rule-derived in comments
(block decomposition + realizing exchange sequence), several echoing
waits.test.ts fixtures pinned independently there.

**Gaps, known and scoped**:

- **No property sweep** — by ticket design. T-006-02-03 brings the brute-force
  exchange-distance reference and the `shanten === 0 ⟺ isTenpai` biconditional.
  Until it lands, exactness rests on the fixture set plus the formula argument
  in design.md §2.A/§4.5. This is the one place a subtle bug could hide (a
  missing branch interaction on a shape no fixture exercises); the tension
  block was chosen to hit the known counterexample classes, but "known" is
  doing work in that sentence. The -03 oracle is the backstop.
- 3-shanten-and-deeper intermediate rungs (4–7) unpinned — the ladder pins 0,
  1, 2, 8; intermediate values arrive free with -03's sweep.
- Kan-specific arity (a hand with kans still owes 14 − 3·melds concealed at the
  drawn arity) is covered only implicitly through the FAKE_MELDS stub list
  containing an ankan/shouminkan at counts ≥ 3 — arity is arity; no separate
  fixture felt warranted.

## 4. Open concerns for a human reviewer

1. **The exactness argument** (the load-bearing one): design.md §2.A claims the
   cap + explicit-head + exhaustive-disjoint-decomposition formulation is exact,
   including the no-head-blocks-full case (the tanki argument) and the
   same-kind head+partial-pair infeasible combo (weakly dominated by the triplet
   branch, argued in research/design). If you review one thing, review that
   reasoning against `bestValue`'s seven branches — a wrong formula here
   poisons the policy and every teaching prompt downstream, and the property
   crown that would catch it is two tickets out.
2. **Exhaustion stays out** (design §4.3): shanten 0 on a hand whose every wait
   is self-exhausted while `isTenpai` says false (waits' formal-tenpai
   convention). The -03 AC says "constrained samples" — that reconciliation is
   deliberately deferred, and the -03 author should read waits.ts's header and
   this module's header together before writing the biconditional.
3. **Performance is argued, not measured**: the envelope reasoning (≤ 5
   extractions, ≤ 13 nonzero kinds, prune) says microseconds; the 18-test suite
   runs in noise. If -03's fast-check sweep feels slow, the prune ordering is
   the first knob. No memoization was added — deliberately, purity-simple first.
4. **Third `countsOf` copy** (design §4.4): agari.ts, waits.ts, shanten.ts each
   hold the 5-line builder. Flagged as future cleanup; promoting it into
   tiles.ts would touch two verified modules and slightly blur tiles' charter —
   a judgment call someone may want to overrule when a fourth copy threatens.

## 5. Deviations from plan

One: the two preferred code commits folded into one (`db1a388`) — Steps 3–5
completed in a single sitting, the explicitly allowed case; recorded in
progress.md. Also noted there: a barrel-edit race with the parallel
T-006-01-01 thread (seatview), resolved by re-read; my commit carries only the
shanten line.

## 6. Downstream handoff

- **T-006-02-02**: extend `shanten.ts` in place — chiitoi/kokushi counters +
  the `shanten` combinator; `standardShanten` stays exported (its AC compares
  forms). The header comment already reserves the name.
- **T-006-02-03**: build the exchange-distance reference TEST-SIDE (design
  §2.B) — do not reuse `bestValue`; independence is the property's value.
- **T-006-03-01** (policy): both arities are live via the barrel; score the
  14-tile view, compare candidate 13-tile discards.

TL;DR: exact-by-argument block-count standard shanten, house-style module +
fixture suite, all green, AC met; the formal exactness proof-by-property is
scheduled two tickets out and the design kept the oracle independent for it.
