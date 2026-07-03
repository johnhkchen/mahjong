# T-006-02-01 — standard-form-shanten — Design

Options, tradeoffs, decision. Grounded in research.md; structure.md draws the file
shapes.

## 1. The problem, precisely

Export from `src/core` a pure function returning the standard-form shanten of a
seat's concealed hand given its called melds: the minimum number of tile exchanges
to reach a hand that decomposes as `4 − melds` concealed sets plus a pair, with
tenpai = 0 and a complete hand = −1. Kind-level (copies never affect shape), melds
read for arity only (each call is one completed set, kan included), deterministic,
no mutation. Chiitoitsu/kokushi and the min-combinator are T-006-02-02; property
sweeps are T-006-02-03 — this ticket needs an exact algorithm and pinned fixtures.

## 2. Candidate approaches

### A. Block-count backtracker over the 34-kind counts array (chosen)

The classical exact formulation: search all disjoint decompositions of the counts
into `m` complete sets (triplet / run), `t` partial sets (pair-as-proto-triplet,
adjacent proto-run, gapped proto-run), and at most one reserved head pair, subject
to the block cap `m + t ≤ 4 − melds`; then

```
standardShanten = 8 − 2·melds − max(2m + t + head)
```

Backtrack kind-by-kind in TILE_KINDS order (the `searchSets` house style from
agari.ts): at the lowest nonzero kind, branch over every extraction anchored there
(triplet, run, head pair, partial pair, adjacent partial, gapped partial) plus the
"advance — leave the copies as floaters" branch; mutate-recurse-restore on a
borrowed counts array. All shapes are anchored at their lowest kind, so once the
search advances past kind k, nothing later can touch k — the invariant that makes
lowest-kind-first exhaustive without deduplication, exactly as in agari.ts.

- **Exactness**: the cap and the explicit head flag are what make the block formula
  exact; maximizing over ALL decompositions (a pair may serve as head, as partial,
  or feed a triplet — all branched) avoids every known greedy counterexample.
  Verified in research against the boundary fixtures: tenpai ryanmen → 0, complete
  → −1, 4-melds tanki → 0, scattered 13 → 8, no-head block-full shapes → correct by
  the tanki argument (a floater always pairs at the last exchange).
- **Complexity**: at most 5 extractions (4 blocks + head) each removing ≥ 2 tiles,
  ≤ 13 nonzero kinds to advance over; the tree is small (well under 10⁵ nodes for
  any legal hand, microseconds in practice). One cheap upper-bound prune
  (`value + 2·blocksLeft + headFree ≤ best` ⇒ cut) keeps the worst case tight for
  the T-006-02-03 fast-check sweeps and the policy's ~14 calls per AI turn.
- **House fit**: same counts representation, same suit-block guards
  (`k < 27 && k % 9 ≤ 6/7`), same mutate-recurse-restore discipline, same purity
  and RangeError contracts as agari.ts/waits.ts.

### B. Exchange-distance search probed through isAgari (rejected as implementation)

Define shanten operationally: BFS over "replace one tile with any of the 34 kinds",
depth d, until `isAgari`/`isTenpai` fires; shanten = d. Correct by definition and
maximally independent — but the branching factor is 13 tiles × 34 kinds per level,
so depth 3+ is already millions of probes; unusable for a per-turn policy datum.
This is EXACTLY what T-006-02-03 wants as the *reference oracle* on constrained
samples, which is a point in favor of NOT building the product function the same
way: the property test's independence (AC of -03) requires the implementation and
the reference to be different algorithms. Rejected for the module, reserved for
the -03 test-side reference.

### C. Precomputed per-suit lookup tables (tenhou/tomohxx style) (rejected)

Precompute, for every reachable 9-rank count vector, the best (sets, partials)
Pareto set per suit; combine four suit summaries. This is the fastest known exact
method — and heavy machinery: a table generator, ~10⁵-entry tables shipped in the
bundle (the singlefile budget pays for them), and a combination step whose
correctness itself needs the backtracker as oracle. The performance envelope here
(14 calls/turn, test sweeps) is orders of magnitude below where tables pay off.
Rejected: complexity and bundle weight bought nothing the envelope needs. The
module face keeps this swappable if profiling ever disagrees.

## 3. Decision: A — block-count backtracker

Grounds: exact with proof-shaped structure (cap + head flag + exhaustive
disjoint decompositions), the same algorithmic dialect as the verified agari
decomposer, fast enough by orders of magnitude, and it keeps B free to serve as
the independent oracle in T-006-02-03.

## 4. Sub-decisions

### 4.1 Name and signature: `standardShanten(concealed, melds): number`

`(readonly TileKind[], readonly Meld[])` — the agari/waits face verbatim. The
plain `shanten` name stays free for T-006-02-02's min-of-three combinator, which
the story AC names explicitly (`shanten(hand, melds)`). Melds pass as `Meld[]`
read for `length` only (the agari precedent, stated in the doc comment) rather
than a bare count: every caller (policy over SeatView, tests) already holds real
Meld lists, and a uniform face across the hand-reading trio beats a narrower
parameter type.

### 4.2 Arity: accept BOTH 13 − 3k and 14 − 3k concealed tiles

The AC's "complete = −1" requires the 14-side; between-turns reads and the -03
tenpai biconditional live on the 13-side; the discard policy needs both (score
the 14-tile view, compare candidate 13-tile results). decomposeAgari is 14-only,
waits is 13-only — shanten is the first module where both arities are genuinely
meaningful, and the block formula handles both without a branch (the 14th tile is
simply a floater unless it completes). Anything else throws RangeError naming the
two accepted counts (the established message discipline); melds > 4 throws.

### 4.3 Exhaustion stays out (shape, not copies)

Like agari and unlike waits, shanten reads no meld content and never discounts a
kind whose four copies are visible — it is a shape distance. The
`shanten === 0 ⟺ isTenpai` reconciliation with waits' exhaustion convention is
T-006-02-03's explicitly-scoped problem (its "constrained samples" phrasing), not
grounds to complicate the shape datum here. The module comment states the
convention so the -03 author inherits it deliberately.

### 4.4 Counts builder: third private copy

agari.ts and waits.ts each hold a private 5-line counts builder (deliberately —
waits' variant counts meld content, agari's doesn't). Promoting a shared export
into tiles.ts would touch two verified modules for a 5-line function and blur
tiles.ts's import-free "domain only" charter. Third private copy, one-line comment
acknowledging the precedent; flagged as a possible future cleanup in review.md.

### 4.5 Formula bookkeeping inside the search

Track `(setsUsed, partialsUsed, headUsed)`; legal extraction requires
`setsUsed + partialsUsed < 4 − melds` for any block, head independent. Value
`2·setsUsed + partialsUsed + headUsed`, maximized; result
`8 − 2·melds − best`. Bounds check: melds=0 complete 14 → 4 sets + head = 9 →
−1; 4 melds + pair → head only = 1 → 8 − 8 − 1 = −1; scattered 13 → 0 → 8.
Partial legality mirrors run legality: proto-runs only inside a numbered 9-block
(adjacent `k%9 ≤ 7`, gapped `k%9 ≤ 6`, both `k < 27`); honors pair only.

## 5. Testing shape (fixtures; properties are -03's)

Pinned hands with rule-derived expected values in comments (the house fixture
style): the four AC anchors (complete −1 at 14 tiles; tenpai 0 on classic shapes;
1-shanten; scattered-13 = 8) plus meld-discount cases (1-meld tenpai, 4-melds
tanki 0, 4-melds pair −1), both-arities coverage, head-vs-partial pair tension
shapes (the exactness edge), and the contract block (RangeErrors verbatim,
purity, determinism). No fast-check in this ticket.

## 6. Rejected-alternatives record

- B (probe BFS): correct but computationally unusable as product code; reserved
  as -03's independent oracle — sharing it would destroy the property's
  independence.
- C (suit tables): speed the envelope doesn't need, bought with a generator,
  bundle weight, and an oracle dependency on A anyway.
- Bare `meldCount: number` parameter: narrower type, but breaks the uniform
  hand-reading face and makes call sites translate for no gain.
- Single-arity (13 only): fails the AC's "complete = −1" without caller-side
  gymnastics; the discard policy would immediately need the 14 side.
- Promoting a shared countsOf: touches two verified modules out of scope (§4.4).
