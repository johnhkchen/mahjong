# T-006-01-02 fair-play-property-tests — Design

## The decision in one paragraph

Add one new test suite, `src/core/seatview.fairplay.test.ts`, that makes both AC
clauses executable as properties over three state sources of increasing richness
(tsumogiri folds via fc, call-dense greedy games, agari-ended win-carrier games). The
equivalence clause is tested by **surgical hidden-pool permutation**: deep-copy a
folded TableState, collect the observing seat's hidden pool (three other hands, other
seat's drawn, all of live, unflipped dead), permute it as a bijection back into the
same slots, and assert `seatView(mutant, seat)` deep-equals `seatView(original, seat)`.
Two permutations are applied per state: **rotate-by-1** (deterministically non-identity
— kills vacuity) and a **seeded Fisher–Yates shuffle** (variety; fc shrinks the seed).
The no-leak clause is tested as **set inclusion**: `exposedTileIds(view) ⊆
publicIds(state, seat)`, both sides computed independently of the projection's
internals, over every prefix of the call-dense and win corpora and over the fc
tsumogiri domain. No runtime code changes.

## Decisions and alternatives

### 1. How to obtain "two TableStates that differ only in hidden tiles"

**A. Surgical permutation of a folded state (chosen).** Fold a real record, deep-copy,
permute the hidden pool slot-for-slot. Pros: exact — the two states differ in hidden
tiles *and nothing else*, by construction; covers permutations across zones (a live
tile swapped into an opponent's hand), which is the strongest reading of "differ only
in hidden tiles"; O(1) extra folds. The mutant may not be reachable from any record,
but `seatView` is documented pure/total over TableState, and fair-play-by-construction
is a claim about the projection as a function — the AC's "fold to identical SeatViews"
is satisfied by folding ONE record and deriving the sibling, with the sibling's
public part identical by construction (asserted, see §4).

**B. Two records engineered to agree publicly.** E.g. two seeds whose folds share all
public zones. Rejected: such pairs essentially never exist by chance and constructing
them means writing an inverse-fold — a large machine proving nothing more than A.

**C. Wall-tail permutation replayed through foldRecord.** Permute the un-drawn live
suffix + unflipped dead in the *wall*, replay the same action log. Rejected as the
primary vehicle: attractive (both states are record-reachable) but the same action
log is only replayable if no future draw changes — i.e. only the not-yet-drawn suffix
may move, and any later prefix fold would diverge; it tests less (never moves hidden
tiles between opponents' hands and the wall) at more cost (a second full fold per
check). Revisit only if a reviewer wants record-reachability; the AC does not ask.

### 2. What exactly is the hidden pool for seat s

Per the TableState conservation partition (research §TableState):
`hands[t]` for the three `t ≠ s`, `drawn` iff `turn !== s && drawn !== null`, all of
`live` (order AND identity are hidden — only the count is public), and the unflipped
part of `dead` (ids not in `doraIndicators`). Flipped indicators stay fixed — they are
public. Ponds, melds, and own hand/drawn are untouched. `drawnFrom` is metadata, not a
tile id; unchanged. Scalars unchanged. The pool is permuted as one bag ACROSS zones —
the strongest sibling: an opponent's hand tile may become a wall tile and vice versa.

### 3. Which permutations

- **rotate-by-1**: pool slot i receives pool[(i+1) % n]. All 136 ids are distinct, so
  for pool size ≥ 2 this changes EVERY hidden slot — non-vacuity is structural, not
  statistical, matching the house rule "call density is a pinned fact, never an fc
  statistic". Pool size ≥ 2 holds at every reachable state (three opponents hold 13ish
  tiles even at wall exhaustion... at minimum, opponents' hands are non-empty at every
  prefix of every corpus we use — asserted by the non-vacuity guard rather than argued).
- **seeded shuffle**: `shuffleInPlace(createRng(permSeed), pool)` — core's own frozen
  rng kit, so the mutant is reproducible arithmetic; `permSeed` comes from fc where fc
  drives, from a small fixed list on the deterministic corpora. A shuffle can be
  identity by chance; that is why rotate-by-1 exists — the shuffle adds variety, the
  rotation guarantees teeth. No identity-check/retry logic needed.

### 4. Guarding the surgery itself (the mutant must be a valid sibling)

Three one-time structural assertions over corpus states, so the equivalence property
can't silently test a broken mutant: (a) the mutant conserves all 136 distinct ids
across the six zones (`allZones` replica); (b) the mutant's PUBLIC part is unchanged
(own hand, ponds, melds, doraIndicators, scalars — compared field-by-field against
the original); (c) under rotation, the mutant's hidden zones all differ from the
original's (non-vacuity pinned as fact). These are tests of test infrastructure —
cheap, and the dynamics precedent (corpus coverage assertions) blesses the pattern.

### 5. Equivalence assertion

`expect(seatView(mutant, seat)).toEqual(seatView(original, seat))` — deep structural
equality over the whole view. Not field-by-field: the view type may widen later
(seatview.ts header names this ticket as the re-audit gate), and `toEqual` over the
whole object automatically drags any new field into the property — a widening that
leaks hidden state fails HERE without anyone remembering to update the test. This is
the re-audit mechanism the header promises.

### 6. No-leak clause: inclusion, not per-zone disjointness

seatview.test.ts already pins per-hidden-zone disjointness over tsumogiri states. This
ticket asserts the dual and stronger form — `exposedTileIds(view) ⊆ publicIds(state,
seat)` where `publicIds` = own hand ∪ own drawn (iff turn) ∪ ponds ∪ melds'
own+claimed ∪ flipped indicators — over the RICH sources (melds, kan-flipped
indicators, shortened walls, agari states with win records). Inclusion against an
independently-computed public set is total: any future view field carrying a tile id
outside the public zones fails regardless of which hidden zone it leaked from.
`exposedTileIds` is replicated from seatview.test.ts verbatim (test-local convention),
with an origin comment; if SeatView widens, both copies need the new field — and the
equivalence `toEqual` (§5) fails loudly if the widened field leaks, so the collector
copies rusting is not a silent hole.

### 7. State sources

1. **fc tsumogiri domain** (seed × turns × dangle × seat × permSeed): breadth over
   seeds and hand progress; replicates the -01 generator (research §generators).
2. **Greedy-call corpus, replicated `playGreedy`, seeds {0, 1, 2, 63, 67, 69}**: the
   three pinned ankan carriers under 100 (kan-dora flips, rinshan-shortened walls,
   dead-wall churn) plus three ordinary call-dense games. Every prefix × every seat —
   claim windows, mustDiscard, jumped turns, all four call forms appear (63/67/69
   carry the rare form; the others add chi/pon/daiminkan density; coverage inherited
   from dynamics' pinned facts, cited not re-asserted).
3. **Win corpus, replicated `playWinEager`, all eight pinned carriers**: agari states
   (win record populated, tsumo AND ron forms — 876/950 tsumo, rest rons) plus the
   ryuukyoku/houtei-adjacent tails; final fold × every seat, plus every prefix for the
   no-leak inclusion (win states are where `win.tile`/`claimable` interplay is
   richest).

Rejected: replicating `playRecord` (fc-driven full-offer sampler) — a third driver
adds fc plumbing without adding a state shape the corpora lack; the equivalence
property's strength comes from the permutation, not trajectory entropy.

### 8. File placement and naming

New sibling suite `src/core/seatview.fairplay.test.ts` (the `legal.win.test.ts`
dotted-aspect precedent). Rejected: growing `seatview.test.ts` — its header scopes it
to "the public/hidden partition of a single real state" and explicitly assigns the
hidden-permutation property to this ticket; separate concern, separate file. Rejected:
`fairplay.test.ts` without the module prefix — the suite is about seatview's
guarantee; the prefix keeps the pairing visible in a directory listing. Imports come
from `./index` (barrel), satisfying the purity gate's test-file rule.

### 9. What is deliberately out of scope

- No runtime/engine changes; no new exports from core. (If a leak is found, that's a
  bug against seatview.ts — none is expected; the -01 review found none.)
- No shared test-helper module: the test-local-generators convention is explicit
  (dynamics.test.ts header); a helpers module is a refactor ticket if a third suite
  ever needs the drivers.
- No ura-dora/riichi fields exist yet; when those tickets widen TableState/SeatView,
  §5's whole-object equality is the tripwire that forces the re-audit.

## Risks

- **Runtime cost**: greedy/win drivers re-fold per action (O(n²) per game) and the
  properties fold every prefix × 4 seats × 2 permutations. Mitigation: six greedy
  seeds + eight win carriers is ~1/10th of dynamics.test.ts's corpus work; if the
  suite exceeds ~2s, strided prefixes (every 3rd) on the no-leak pass are the lever —
  decided in Plan, measured in Implement.
- **Trajectory-shifting engine changes** strand the pinned corpus seeds (63/67/69
  ankan; the eight win carriers). Same posture as dynamics: the coverage facts are
  cited from there; re-mine there, and this suite follows.
- **Deep-equality over shared references** (`claimable`/`win`/meld records shared by
  reference between state and view): `toEqual` is structural, so sharing is invisible
  to it — correct here; aliasing discipline is -01's freshness suite's job, not this
  ticket's.
