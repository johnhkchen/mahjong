# T-005-01-02 — tenpai-waits — Design

Decisions with rationale, grounded in research.md. Four decisions: module placement
(D1), the exhaustion convention (D2), API shape (D3), derivation algorithm (D4), plus
the test strategy (D5).

## D1. A new module, `src/core/waits.ts`

**Options**: (a) extend agari.ts; (b) new sibling module importing it.

**Chosen: (b) new `src/core/waits.ts`.** agari.ts's own header declares waits a
*consumer*: "Waits, the yaku catalog, and the tsumo/ron fold are all consumers of
this module; none of them re-derive decomposition." The one-module-per-concern
pattern is how core is organized (wall/dora/deal/record/legal/agari), the purity gate
and barrel absorb new modules at zero cost, and -01's review handed this ticket off
expecting exactly a consumer module. Extending agari.ts was rejected because it
would reopen a closed, reviewed module for code that reads meld CONTENT — agari.ts's
documented posture is melds-for-arity-only, and mixing the two postures in one file
blurs its sharpest contract line. Also concurrency: -03 may be in flight; disjoint
new files minimize contested surface (the barrel's +1 line is the only shared touch).

File name `waits.ts` over `tenpai.ts`: the primary export is the waits list; tenpai
is its emptiness read (D3), the same relationship isAgari has to decomposeAgari.

## D2. Exhaustion convention: exclude kinds all four of whose copies are visible to the hand itself

**The question** (AC: "exhausted kinds — all four copies visible to the hand —
handled per documented convention"): when a kind structurally completes the hand but
all four physical copies are already in the hand's own concealed tiles + melds, is it
a wait?

**Options**:

- **(a) Include** — waits is purely structural; callers filter physical
  availability. Rejected: every named consumer would need the same filter. Ron
  legality would offer a claim that can never fire (harmless but false), and tenpai
  teaching would misreport the Tenhou-style formal-tenpai rule: a hand whose EVERY
  structural wait is self-exhausted is noten. "Noten hands return empty waits" (AC)
  then forces each caller to re-derive exhaustion — the datum stops being one datum.
- **(b) Exclude kinds with all 4 copies visible to the hand (concealed + own melds'
  tiles, claimed included)** — **chosen.** One list serves all three named readers
  unchanged: ron (an excluded kind can never be discarded by an opponent — all its
  copies are here), furiten (an excluded kind can never be in the own pond — same
  arithmetic), and tenpai (`waits.length > 0` IS formal tenpai under the Tenhou-style
  rule, the mainstream convention). The pure function has exactly the visibility it
  needs: its own tiles. Kinds exhausted by OTHER seats' ponds/melds/indicators are
  NOT excluded — that is live-tile counting, requires table-wide state this function
  deliberately does not take, and does not affect formal tenpai under the same rule.
- **(c) Return `{kind, exhausted}` pairs or two lists** — rejected as speculative
  richness: no current consumer wants the exhausted remainder. If the teaching epic
  later wants "you are waiting on 1m but hold all four", it can query decomposeAgari
  directly (the -01 header names that exact capability as the reason the decomposer
  is kind-level). Extend-only precedent: adding a second export later is cheap.

**Copy counting**: a meld consumes `claimed` (when present) plus every `own` tile —
chi/pon 3 copies across kinds, kan forms 4 copies of one kind. Both self-exhaustion
producers from research §3 fall out: four concealed copies flanked by run material,
and an own kan/pon of an otherwise-waited kind.

## D3. API shape

```ts
export function waits(concealed: readonly TileKind[], melds: readonly Meld[]): TileKind[]
export function isTenpai(concealed: readonly TileKind[], melds: readonly Meld[]): boolean
```

- **Kind-level in and out**, matching decomposeAgari; fold-side callers map
  `kindOf` at the boundary (-01's handoff note). `concealed` is the seat's 13 −
  3·melds concealed tiles — NO drawn/claimed tile; this is the between-turns hand.
- **Result order**: ascending TILE_KINDS order, documented as contract (the
  legalActions/decomposeAgari precedent). Falls out of the kind loop for free.
- **Empty result IS the noten signal** — no separate null (the decomposeAgari
  precedent), and per D2 "noten" includes the all-waits-self-exhausted hand.
- **Arity guard**: melds > 4 or concealed ≠ 13 − 3·melds throws RangeError naming
  both numbers, in waits' OWN message ("waits requires N concealed tiles with M
  melds, got K"). Guarding here rather than letting decomposeAgari throw matters:
  the inner query is 14-based and its message ("requires 11 … got 10") would
  misname the caller's actual mistake by one tile.
- **Purity**: inputs never mutated, fresh array per call, same input ⇒ same output.
- **`isTenpai` is the emptiness read** of waits — mirrors isAgari over
  decomposeAgari, one code path, no faster divergence-prone shortcut. The AC's
  tenpai/noten language gets a named home and the teaching epic a stable hook.

## D4. Derivation: the 34-kind completion loop over decomposeAgari

**Chosen**: count the hand's visible copies per kind once; for each of the 34 kinds,
skip it when `visible[k] ≥ 4` (D2 filter — also a free optimization), otherwise ask
`isAgari([...concealed, kind], melds)`; collect hits in TILE_KINDS order.

**Why**: it is the AC's own definition made executable — "every kind in waits
completes agari and every kind outside it does not" is literally this loop — and the
performance envelope is pre-cleared (research §1: ~µs per decompose; 34 queries ≈
tens of µs; -01's review explicitly blessed "-02's 34-queries-per-hand loops").
Correctness rides entirely on the already-property-verified decomposer; no rule is
restated, so no divergence can open between agari's and waits' ideas of a win.

**Rejected — bespoke wait-shape analysis** (classify tanki/shanpon/ryanmen/kanchan/
penchan from the 13-tile shape directly, or read waits off partial decompositions):
faster, but restates the set-forming rules the decomposer already owns, in exactly
the divergence-prone way core's double-entry convention reserves for contract pairs
locked by agreement suites — and nothing here needs the speed. The double-entry
convention (legal.ts vs record.ts) exists where two modules state the same TURN
rules for independence; waits is a *derived quantity* of agari, not an independent
statement of it (the -01 header: consumers "never re-derive decomposition").

**Rejected — early-exit isAgari variant**: -01's review already weighed and declined
a second, faster predicate; the budget holds without it.

## D5. Test strategy (the AC's property suite + convention fixtures)

- **Oracle**: decomposeAgari itself. The AC defines waits IN TERMS of agari
  completion, and -01 verified the decomposer against an independent brute-force
  reference — so the property layer checks the biconditional (kind ∈ waits ⇔
  completes agari ∧ visible < 4) without re-importing the reference. The
  implementation runs the same loop, so the property alone is near-tautological;
  independence comes from FIXTURES with hand-derived expected wait lists (every
  classic wait shape, multi-waits, both exhaustion producers) and from
  construction-guaranteed assertions that never consult the module or the oracle.
- **Positive-dense generator — winner-minus-one**: build a 14-tile winner (the -01
  builder pattern upgraded per below), remove one tile; the result is tenpai by
  construction and its waits MUST contain the removed kind (its visible count
  dropped to ≤ 3; the re-add is a known agari). That containment assertion is
  implementation-independent anti-vacuity.
- **Meld-content-aware builder**: agari.test.ts's FAKE_MELDS are arity-only stubs
  with arbitrary tile ids — unusable here, since waits reads meld tile KINDS.
  The upgraded builder draws meld sets from the same 4-copy budget as concealed
  sets and materializes real Meld objects (pon/chi/ankan and the other kan forms,
  ids via tileId with running copy indices), so property hands are
  wall-consistent and kan melds exercise 4-visible-via-meld exhaustion naturally.
- **Negative-dense generator**: random 13 − 3·melds multiset draws (mostly noten ⇒
  empty waits), biconditional checked over all 34 kinds.
- **Fixtures** (hand-derived in comments): tanki, shanpon, ryanmen, kanchan,
  penchan; junsei chuuren (9 waits) and 13-sided kokushi (13 waits — the maximum);
  chiitoitsu single wait incl. the not-four-of-a-kind rule; both exhaustion
  producers (1111m-flanked, ankan-blocked ryanmen); the all-waits-exhausted NOTEN
  hand (pon of a kind + its tanki); order, purity, guards, isTenpai.
