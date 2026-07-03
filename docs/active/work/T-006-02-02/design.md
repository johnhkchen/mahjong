# T-006-02-02 — chiitoi-kokushi-min-combinator — Design

Options, tradeoffs, decision. Grounded in research.md.

## 1. The problem, precisely

Add `shanten(concealed, melds): number` to `src/core/shanten.ts`, returning
`min(standardShanten(concealed, melds), chiitoiShanten, kokushiShanten)`, where
the latter two apply only when `melds.length === 0` (both forms are closed-hand
by rule) and are computed over the same concealed counts. AC requires a
seven-pairs hand and a thirteen-orphans hand to each score lower via their own
form than via standard decomposition — i.e., the min must actually bind on both
forms, not just be structurally present.

## 2. Candidate approaches

### A. Closed-form linear scans for both special forms (chosen)

Chiitoitsu and kokushi shanten have exact, well-known O(34) formulas (research
§8) — no backtracking needed, unlike the standard form:

```
chiitoiShanten  = 6 − pairs + max(0, 7 − kinds)
kokushiShanten  = 13 − kokushiKinds − hasPair
```

Both computed from the same `countsOf(concealed)` array `standardShanten`
already builds. `pairs`/`kinds` are single passes over the 34 counts; kokushi
scans only the 13 kokushi indices. Each is O(34) with no recursion, no mutation,
no pruning — dramatically simpler than `bestValue`.

- **Correctness**: these are the standard closed-form results (research §8),
  cross-checked in Testing (§5 below) against `waits.test.ts`'s independently
  pinned chiitoi/kokushi tenpai fixtures and against `agari.ts`'s complete-hand
  behavior (`chiitoiShanten`/`kokushiShanten` must read −1 exactly where
  `chiitoitsuOf`/`kokushiOf` in agari.ts return non-null).
- **House fit**: same counts representation and arity constants
  (`TENPAI_TILE_COUNT`/`AGARI_TILE_COUNT`, already private in `shanten.ts`); no
  new backtracker to prove exact — the formulas are the well-established result,
  not a novel derivation like `bestValue`'s block-count formula was.
- **Cost**: two small private functions plus the combinator — the smallest
  correct addition.

### B. Extend `bestValue`'s backtracker to also branch chiitoi/kokushi shapes (rejected)

Fold chiitoi/kokushi into the same exhaustive search that computes
`standardShanten`, tracking three running maxima in one traversal. Rejected: the
three forms have incompatible block structures (chiitoi wants exactly-one-pair
credit per KIND with no runs/triplets; kokushi wants presence-only over a fixed
13-kind subset) — forcing them through one backtracker multiplies branch
complexity for no correctness or performance gain, since both special forms
already have exact O(34) closed forms that don't need search at all. This would
also violate the module's own precedent: `standardShanten`'s header explicitly
reserves `shanten` as a *combinator name*, implying composition of independently
correct sub-computations, not one fused search.

### C. Reuse `agari.ts`'s `KOKUSHI_KIND_INDEXES` by exporting it (rejected)

Export the private array from `agari.ts` and import it here instead of
redeclaring the 13 indices. Rejected for the same reason `countsOf` stays
triplicated (T-006-02-01 design §4.4, review §4 item 4): a 13-element literal
array is cheaper to duplicate with a one-line derivation comment than to widen
`agari.ts`'s public surface for one cross-module reuse. Both copies are provably
identical by construction (terminals of each numbered suit in `TILE_KINDS`
order, then all seven honors) — a fact stated in the duplicated comment, not
asserted by shared code. If a third module needs the same array, that is the
threshold to promote it (mirrors the `countsOf` judgment call already on
record).

### D. Export `chiitoiShanten`/`kokushiShanten` as public functions (rejected — kept private)

Give the two sub-forms their own exported names alongside `shanten` and
`standardShanten`. Rejected as unnecessary surface: research §7 confirms no
downstream ticket (T-006-02-03, T-006-03-01) consumes the sub-forms directly,
only the combinator. This mirrors the established `bestValue`/`standardShanten`
split — `bestValue` is a private implementation detail of the one public
`standardShanten` face; `chiitoiShanten`/`kokushiShanten` are private
implementation details of the one public `shanten` face. Both remain unit-testable
indirectly via `shanten(concealed, [])` fixtures (chosen concealed hands where
the special form strictly dominates pin the sub-formula's behavior without a
separate export). If a future ticket needs the sub-values directly (e.g. a
teaching prompt "N away from chiitoitsu"), exporting then is a one-line change
with no design cost paid now.

## 3. Decision: A — closed-form scans, folded into a private-helper + single-export shape (D)

Grounds: the formulas are exact and standard (no derivation risk comparable to
`bestValue`'s), O(34) and trivially fast, and the private/public split matches
the module's own existing discipline exactly. B is unjustified complexity; C
repeats a cleanup judgment call already made and documented; D's rejection just
formalizes "don't export what nothing consumes yet."

## 4. Sub-decisions

### 4.1 Signature: `shanten(concealed: readonly TileKind[], melds: readonly Meld[]): number`

Identical shape to `standardShanten` — the AC names it `shanten(hand, melds)`
verbatim, and the module header (T-006-02-01, line 6) already promises this
exact face. `standardShanten` stays exported unchanged (its own AC — "score off
its own form" — plus T-006-02-01's tests compare forms explicitly).

### 4.2 Arity and meld validation: delegate to `standardShanten`, do not re-validate

`shanten` calls `standardShanten(concealed, melds)` first — this both computes
the standard-form term AND performs melds ≤ 4 / arity validation once, via the
existing RangeError messages (same text, no new message strings to keep in
sync). Chiitoi/kokushi are only evaluated when `melds.length === 0`; at that
point `concealed.length` is already known to be 13 or 14 (validated above),
which is exactly the arity `chiitoiShanten`/`kokushiShanten` need — no separate
arity check inside either helper. This avoids the double-validation drift risk
that would exist if each of the three computations independently checked arity.

### 4.3 `chiitoiShanten(counts: readonly number[]): number` — private, takes counts not kinds

Takes the already-built `counts` array (not raw `concealed`) since the
combinator builds it once and passes it to all three computations — avoiding
three redundant `countsOf` passes over the same hand. One linear scan over the
34 slots: `pairs += 1` where `counts[k] >= 2`, `kinds += 1` where `counts[k] >= 1`
(both naturally bounded by the scan, no explicit `min(7, ...)` cap needed since a
13/14-tile hand cannot produce `pairs > 7` or `kinds > 13`). Returns
`6 - pairs + Math.max(0, 7 - kinds)`.

### 4.4 `kokushiShanten(counts: readonly number[]): number` — private, same counts input

Reuses the 13 kokushi indices as a private `const` (design §2.C — deliberate
duplication of `agari.ts`'s array, one-line derivation comment: "terminals of
each numbered suit, TILE_KINDS order, then all seven honors" — matches
`agari.ts`'s own comment). Single pass over the 13 indices: `kinds += 1` where
`counts[k] >= 1`, `hasPair = true` if any `counts[k] >= 2`. Returns
`13 - kinds - (hasPair ? 1 : 0)`.

### 4.5 The combinator body

```
export function shanten(concealed, melds): number {
  const standard = standardShanten(concealed, melds)  // validates arity/melds
  if (melds.length > 0) return standard
  const counts = countsOf(concealed)
  return Math.min(standard, chiitoiShanten(counts), kokushiShanten(counts))
}
```

`countsOf` (already private in the module) is called once more here — a second
pass distinct from the one `standardShanten` performs internally (that one is
mutated/restored inside `bestValue`'s recursion and not exposed). Not worth
threading a shared counts array across the `standardShanten` call boundary: it
would require changing `standardShanten`'s signature or adding an internal
overload for one extra `countsOf` call (O(13) tiles, negligible) — the module's
own precedent (`agari.ts`'s `standardDecompositions` vs `chiitoitsuOf`/
`kokushiOf` inside `decomposeAgari`) already calls `countsOf` once and threads
the SAME array to all three sub-computations there, but that thread happens
because `decomposeAgari` builds counts itself rather than delegating to a public
sibling function the way `shanten` delegates to `standardShanten`. Accepting one
extra O(13)-tile pass is the simpler, still-negligible cost of keeping
`standardShanten` a clean single-purpose call rather than exposing an
internal-counts-sharing seam.

### 4.6 Why `melds.length > 0` short-circuits before building counts

Chiitoi/kokushi are zero-meld forms by rule (research §6, `agari.ts`'s own doc
comment). Building `counts` and running the two O(34)/O(13) scans when they
cannot possibly apply is pure waste — cheap either way, but the short-circuit
also documents the rule inline (a reader sees the meld gate before the
computation, not after).

## 5. Testing shape

New `describe` blocks in `shanten.test.ts` for the `shanten` combinator
specifically (not touching the existing `standardShanten` blocks):

- **Chiitoitsu binds**: a seven-distinct-pairs 14-tile hand and its 13-tile
  tenpai precursor, where standard form reads worse (reuse the
  `1122m3344p5566s7z`-style shape already commented in `standardShanten`'s tests
  as the chiitoi-vs-standard divergence point — standard reads 3, chiitoi reads
  0/−1).
- **Kokushi binds**: the 13-kokushi-kinds-once tenpai hand and the all-14
  complete kokushi hand (mirrors `waits.test.ts`'s and `agari.test.ts`'s
  independently-pinned kokushi fixtures) — standard form on that hand is far
  worse (no sets/pairs anywhere but the doubled kind).
- **Standard wins**: at least one ordinary hand (e.g. a `standardShanten`
  fixture already at 0 or −1) where `shanten === standardShanten` — the min
  doesn't always come from the special forms.
- **Meld gate**: a hand with ≥1 meld where `shanten === standardShanten` exactly
  (chiitoi/kokushi never evaluated — implicitly proven since those forms are
  structurally impossible with melds present, but worth one explicit fixture).
- **Arity/RangeError passthrough**: one fixture confirming `shanten` throws the
  same message `standardShanten` would for bad arity/meld-count (proves the
  delegation in §4.2, not a duplicated message).
- **Purity**: same unmutated-inputs/repeat-call-identical pattern as
  `standardShanten`'s contract block.

No fast-check/property sweep here — T-006-02-03 owns that, per its own AC and
per the standardShanten precedent (T-006-02-01 explicitly deferred it).

## 6. Rejected-alternatives record

- B (fused backtracker for all three forms): incompatible block structures,
  no benefit over independent closed forms that are already exact.
- C (export `KOKUSHI_KIND_INDEXES` from agari.ts): repeats a cleanup call
  already deferred for `countsOf`; duplication is cheaper than widening a
  verified module's surface for one reuse.
- D (export the two sub-form functions): no consumer needs them yet; mirrors
  `bestValue`'s privacy, reversible later at zero cost.
- Threading a shared counts array through `standardShanten` (avoiding the
  second `countsOf` pass): would require changing a just-shipped, tested public
  signature for a negligible (13-tile) performance gain — rejected on
  cost/benefit.
