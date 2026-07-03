# T-006-02-03 — brute-force-reference-property-tests — Design

Test-only ticket: no shipped code changes. The design decisions are (1) the
reference formulation, (2) its copy-cap semantics, (3) how the shanten⇔waits
clause is stated around the known exhaustion divergence, (4) sample
distributions, (5) file placement.

## D1. Reference formulation: W-enumeration over the definitional formula

**Chosen**: implement the definitional statement directly —

    refShanten(H, m) = min over winning multisets W of Σ_k max(0, W[k] − H[k]) − 1

where W ranges over every concealed winning shape compatible with meld count
m: standard form (a multiset of `4 − m` sets from the 55 legal set shapes,
plus a pair kind), and for `m === 0` also chiitoitsu (7 distinct kinds × 2)
and kokushi (the 13 orphan kinds + one duplicated orphan). Since
Σ max(0, W−H) = |W| − Σ min(H[k], W[k]), the recursion just maximizes overlap.

Equivalence argument (goes in the suite header, the agari.test.ts precedent):
a hand with `missing` tiles absent from some W reaches tenpai in
`missing − 1` exchanges (draw all but one missing tile, discard non-W tiles —
arities balance at both 13−3m and 14−3m), and no shorter path exists because
one exchange adds at most one tile of any W. −1 for complete hands and 0 at
tenpai fall out of the same formula, so BOTH module arities are covered by one
reference with no special-casing.

**Structurally different from the shipped algorithm** — the module never
enumerates targets; it maximizes a block count over decompositions of the
tiles it HOLDS with a cap-and-head correction. The reference enumerates the
hands it could BECOME. Agreement is evidence, not tautology (the agari.test.ts
standard). The reference consults no module function — not `isAgari`, not
`countsOf`, nothing from `src/core` beyond `TILE_KINDS`/`kindIndexOf`-level
tile vocabulary.

**Rejected — exchange-distance search** (recursive discard×draw to tenpai):
faithful but infeasible; branching ≈ 13×34 per level and random 13-tile hands
reach shanten 8. Would force the very sample constraint the W-enumeration
avoids, and a memoized version is more code and subtler to review.

**Rejected — a second independent shanten algorithm** (e.g. per-suit DP):
fast, but it is another clever algorithm, not a brute-force reading of the
definition; a shared misconception could pass both. The crown wants the dumb
one.

## D2. Copy-cap semantics: W is UNCAPPED (shape distance, the module's frozen convention)

The module reads KIND-level shape distance: `standardShanten('123m456p789s2222z')
= 0` via tanki on a fifth 2z — a completion no physical wall can deliver
(research §3). A reference that caps W at 4 copies per kind would read ≥ 1
there and the agreement property would fail on a convention mismatch, not a
bug. So W enumeration allows repetition freely (the same set shape may appear
up to 4−m times; overlap `min(H[k], W[k])` never rewards the excess, so silly
W never win the min — they are harmless, and the cap-free rule is simpler to
state and review). The exhaustion edge this convention creates against `waits`
is exactly clause 2 of the AC, handled in D4 — NOT smoothed over inside the
reference.

## D3. Reference internals (specification; code lives test-side only)

All reference functions operate on 34-slot count arrays built test-locally.

- `refStandardBest(H, setsLeft)`: recursion over set-candidate indices in
  non-decreasing order (the 55-entry `SET_CANDIDATES` table, already the
  house pattern), maintaining W-counts and incremental overlap (+1 per added
  copy of kind k iff `W[k] < H[k]`). At the leaf, add the best pair gain over
  all 34 kinds: `min(H[p], W[p]+2) − min(H[p], W[p])`. One sound prune only:
  abandon a branch when `overlap + 3·setsLeft + 2 ≤ best` (3 per remaining
  set + 2 for the pair is the ceiling on what remains — too simple to be
  wrong; it never prunes an optimum).
- `refChiitoiBest(H)`: chiitoitsu overlap = Σ min(H[k], 2) over 7 DISTINCT
  chosen kinds; kinds absent from H contribute 0 and are interchangeable, so
  exhaustively enumerate subsets of the ≤13 distinct present kinds up to size
  7 (≤ C(13,7) = 1716 — dumb and exact; no greedy argument to trust).
- `refKokushiBest(H)`: 13 candidate pair kinds; overlap = Σ_{orphans}
  min(H[k], 1) + (min(H[p], 2) − min(H[p], 1)).
- `refShanten(hand, meldCount)`: `(14 − 3m) − bestOverlap − 1`, minimized
  across the applicable forms (special forms gated on `meldCount === 0`,
  mirroring the rule, independently of the module's gate).
- `refIsWin(hand14, meldCount)` := `refShanten(...) === −1` — the reference's
  own win predicate, used to enumerate STRUCTURAL waits in D4's properties.

Cost (research §5): worst case is meld 0 — C(58,4) = 424,270 leaves × O(34)
pair scan ≈ 15M simple ops ≈ tens of ms per sample before pruning; meld ≥ 1
collapses combinatorially (C(57,3) = 29k, C(56,2) = 1.5k …). numRuns are
budgeted per-property in Plan and measured during Implement (the T-006-01-02
perf-discipline precedent); the suite targets low single-digit seconds total.

## D4. The waits clause: split biconditional + pinned divergence fixtures

`shanten === 0 ⟺ isTenpai` is false in general (research §3), and shanten.ts's
header promises THIS ticket reconciles the two conventions. Stated as three
properties plus fixtures:

- **P-tenpai-sound** (unconstrained samples, REAL melds including ankan):
  `isTenpai(hand, melds) ⟹ shanten(hand, melds) === 0`. A physically
  arriving completion is in particular a shape completion — no constraint
  needed, strongest direction.
- **P-tenpai-complete** (constrained samples — the AC's word): over hands
  where NO kind has 4 visible copies (concealed + meld content),
  `shanten === 0 ⟹ isTenpai`, hence on these samples the full
  `(shanten === 0) === isTenpai` biconditional is asserted. The constraint is
  the bluntest sufficient one — if nothing is exhausted, waits probes every
  kind — and is trivially checkable sample-side.
- **P-exhaustion-explains** (unconstrained): whenever `shanten === 0` and NOT
  `isTenpai`, every structural wait is self-exhausted:
  `refIsWin([...hand, k]) ⟹ visible[k] ≥ 4` for all 34 k. This pins that the
  divergence is EXACTLY the exhaustion convention — no third cause.
- **Fixtures**: the two witnesses pinned with rule-derived comments —
  `123m456p789s2222z` (0 melds: shanten 0, waits [], noten) and kanchan-on-own-
  ankan (`ankan('3m')` + `24m456p789s55z`: shanten 0, waits [], noten). These
  document the convention boundary a reader of shanten.ts:8–11 is pointed to.

Real melds are required wherever `waits` is called (it reads meld content);
the builder is waits.test.ts's `buildTenpaiParts` pattern (shared 4-copy
budget). Where only shanten-vs-reference is asserted, FAKE arity melds
suffice (both sides read arity only) — using each precedent where it applies.

**Rejected — asserting `waits() === structuralWaits minus exhausted` here**:
that re-tests waits' own definition, already pinned in waits.test.ts against
isAgari over the same distributions. P-exhaustion-explains covers the one new
cross-module claim without duplicating that suite.

## D5. Sample distributions (the AC's "constrained samples")

Mirroring the agari.test.ts positive/negative-density strategy:

1. **Constructed winners** (FAKE melds, m 0–4, 14−3m tiles): near-tenpai
   positive density; anti-vacuity `shanten === −1` is construction-guaranteed.
2. **Winner minus one tile** (13−3m): tenpai-dense; anti-vacuity
   `shanten === 0` guaranteed (the removed kind completes the shape).
3. **k-perturbed winners** (k = 1..4 random replacements at 14−3m arity):
   the near-miss band, shanten ∈ [−1, k−1]; the bound is asserted as a
   generator self-test.
4. **Random multiset draws** (13 and 14 tiles, m = 0): the scattered/high-
   shanten band up to 8 — feasible because D1's reference handles all values;
   smaller numRuns (the expensive bucket).
5. **Real-meld tenpai/noten samples** for D4's properties: `buildTenpaiParts`
   winners minus one (tenpai-dense, ankan included) and random 13-tile hands
   (noten-dense, m = 0).

Agreement asserted at BOTH arities and every meld count reachable by each
bucket; every property test asserts `shanten === refShanten` (the combinator,
not standardShanten — the min-of-three is the ticket's subject; standard-only
agreement falls out on melded buckets where the gate makes them equal).

## D6. File placement: new `src/core/shanten.property.test.ts`

The dedicated-property-suite-per-ticket precedent (seatview.fairplay.test.ts).
shanten.test.ts stays the rule-derived fixture suite its header describes;
its "property sweeps are T-006-02-03" sentence gets updated to point at the
new file (one-line comment edit — the only touch to an existing file). The
new suite carries its own `h()`, `FAKE_MELDS`, `SET_CANDIDATES`, and real-meld
builder copies — per-file duplication is the established convention (research
§4), keeping test files self-contained.

## D7. No shipped-code changes; no new exports

The reference and builders are test-local (core is "big in tests, never ships
them"). `chiitoiShanten`/`kokushiShanten` stay private — the crown tests the
public face. If a disagreement surfaces during Implement, the fix is its own
judgment call (fix module if module is wrong; fix reference if the reference
misreads the convention) documented in progress.md — the plan does not
presume which.

## D8. Commit posture

Hold commits (work left staged in the tree, artifacts written), matching the
sibling T-006-02-02 precedent and its stated commit protocol: the suite
imports `shanten`, which does not exist at HEAD until -02's uncommitted
changes land, so any commit here would be broken at HEAD and would also
half-sweep another ticket's working-tree changes. Deviation from RDSPI's
"commit incrementally" is documented in progress.md with this rationale.

## Risks

- **Reference perf**: the m=0 random bucket could exceed budget → tune
  numRuns down / rely on the prune; measured in Implement, thresholds in Plan.
- **A real disagreement** (module inexactness on some degenerate shape) is a
  FINDING, not a test bug — the crown exists to surface it. Triage protocol
  in D7.
- **fast-check shrinking on slow references**: a failing case triggers many
  reference calls during shrink; acceptable — failures should be rare and
  shrinking is exactly when spending time is right.
