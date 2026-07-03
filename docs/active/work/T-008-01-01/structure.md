# T-008-01-01 — fu-calculation — Structure

File-level changes, module boundaries, public interface. The blueprint, not code.

## 1. Files touched

| File | Change |
|---|---|
| `src/core/fu.ts` | NEW — the whole module |
| `src/core/fu.test.ts` | NEW — the test suite |
| `src/core/index.ts` | MODIFIED — one line, `export * from './fu'` |

No other file changes. `agari.ts`, `yaku.ts`, `yakuman.ts`, `record.ts`, `tiles.ts`
are read-only dependencies (type-only import of `WinContext` from `yaku.ts`; value
imports of `isHonor`/`isTerminal`/`isSimple`/`rankOf`/`suitOf`/`kindIndexOf` from
`tiles.ts`; `ConcealedSet`/`AgariDecomposition` types from `agari.ts`; `Meld` type
from `record.ts`).

## 2. `src/core/fu.ts` internal organization

Top-of-file comment block (module purpose, the two things it deliberately excludes —
han and points — same voice as `yaku.ts`'s header) followed by, in this order:

**Imports.** Type-only where possible: `type { WinContext } from './yaku'`,
`type { AgariDecomposition, ConcealedSet } from './agari'`, `type { Meld } from
'./record'`, `type { TileKind } from './tiles'` plus the value functions
(`isHonor`, `isTerminal`, `isSimple`, `rankOf`, `suitOf`, `kindIndexOf`).

**Constants.**
- `BASE_FU = 20`
- `MENZEN_RON_FU = 10`
- `TSUMO_FU = 2`
- `CHIITOITSU_FU = 25`
- `PINFU_RON_FU = 30`, `PINFU_TSUMO_FU = 20`, `KUIPINFU_RON_FU = 30` (named, even
  though some share a literal value — each documents a DIFFERENT rule, per the
  project's pattern of naming things for what they mean, not deduplicating
  same-valued constants that mean different things)
- Set-fu table: a small lookup keyed by `(closed: boolean, kan: boolean, valuable:
  boolean)` → fu, OR four named constants (`OPEN_TRIPLET_SIMPLE = 2`, etc.) — final
  shape decided in Plan against what reads clearest; either way all eight values
  from research.md §3's table are named, not inlined at call sites.
- `WAIT_FU = 2` (kanchan, penchan, and tanki all score the same +2 — one constant,
  three call sites, matching that `yaku.ts` doesn't invent three names for
  `yakuhaiOf('5z')`/`('6z')`/`('7z')`'s shared shape either).
- `PAIR_VALUE_FU = 2` (one occurrence per matching fact — dragon, seat wind, round
  wind — summed, so a double-wind pair naturally reaches 4 without a separate
  constant).

**Local structural helpers** (module-private, mirroring `yaku.ts`'s and
`yakuman.ts`'s own re-implementations rather than importing yaku.ts internals):
- `isMenzen(melds: readonly Meld[]): boolean` — every meld is `ankan`.
- `isTsumoSource(source: WinContext['source']): boolean` — wall or rinshan.
- `isValuableKind(ctx: WinContext, kind: TileKind): boolean` — dragon, seat wind, or
  round wind (the boolean OR form, for the pinfu-shape pair gate).
- `valuableFuOf(ctx: WinContext, kind: TileKind): number` — the SUM form for pair
  fu: `(dragon(kind)?2:0) + (kind===seatWind?2:0) + (kind===roundWind?2:0)`.
- `meldSetOf(meld: Meld): ConcealedSet` — copy of `yaku.ts`'s private helper
  (chi→run, everything else→triplet by kind).
- `completesRyanmen(start: TileKind, winning: TileKind): boolean` — copy of
  `yaku.ts`'s private helper, needed for both the pinfu-shape test and general
  ryanmen/kanchan/penchan wait classification.
- `runContainsAtEdge(start: TileKind, winning: TileKind): 'kanchan' | 'penchan' |
  null` — new: for a run NOT completed by ryanmen, decide kanchan (middle tile) vs
  penchan (12-wanting-3 or 89-wanting-7), both +2 so the distinction is for
  documentation/tests only, not a scoring difference — collapses to one WAIT_FU
  call either way, but keeping the classification named aids the fixture comments
  the AC requires ("pinning the classic traps").

**Set-fu-of-one-set.** `setFuOf(set: ConcealedSet, open: boolean): number` — 0 for
`run`; table lookup for `triplet` by `(open, isTerminal(kind)||isHonor(kind))`.

**Triplet openness resolution** (the ron-adjustment, generalized from
`concealedTripletCount`'s count to a per-set predicate):
`isTripletOpenForFu(ctx, set): boolean` — true if the set is a `Meld`-derived
triplet (always open) OR (concealed triplet AND ron AND `set.kind === winningKind`
AND no OTHER set in the decomposition is a run containing `winningKind`).

**Wait-fu-and-attribution.** The §2-design "enumerate candidates, take max" logic,
scoped to one function: `waitAndPairFuOf(ctx): number` — computes the fu
CONTRIBUTION specifically from the winning tile's slot (which set/pair it completed)
plus that slot's pair-fu-if-pair or upgraded-triplet-if-triplet, returning the max
across every structurally valid attribution. Concretely: build the candidate list
(tanki if `pair === winningKind`; triplet-completion if some set is a triplet of
`winningKind`; run-completion for every run set containing `winningKind`), compute
each candidate's (wait fu + any pair fu + any set-fu delta versus the "closed anko"
default), take the max total. Non-standard forms never call this (chiitoitsu/kokushi
short-circuit earlier).

**Base fu assembly.** `standardFuOf(ctx, decomposition): number` — sums base + menzen
-ron + tsumo + Σ(non-ambiguous set fu, i.e. every set/meld NOT holding the winning
tile, using ordinary closed/open rules) + the one ambiguous slot's contribution from
`waitAndPairFuOf`, then applies the two pinfu/kuipinfu overrides from design.md §4,
then rounds.

**The public entrypoint.**
```ts
export function fuOf(ctx: WinContext): number
```
Dispatches on `ctx.decomposition.form`: `'chiitoitsu'` → `CHIITOITSU_FU` directly;
`'kokushi'` → throws `RangeError` (design.md §5); `'standard'` → `standardFuOf`,
then `Math.ceil(raw / 10) * 10` (skipped for the two fixed-pinfu-fu paths, which are
already round numbers — rounding a value already `% 10 === 0` is a no-op so this can
just always run at the very end, keeping one rounding call site).

## 3. Test file organization (`fu.ts.test.ts` mirrors `yaku.test.ts`)

Reuse `yaku.test.ts`'s `h()` mpsz sugar, `up()`, and meld builders — either by
copy (matching the existing copy-not-import convention between `yaku.test.ts` and
any sibling test file; `agari.test.ts` and `yaku.test.ts` do not share a test-utils
module today) or a new tiny local copy in `fu.test.ts`. Contexts built through real
`decomposeAgari`, never hand-typed `AgariDecomposition` literals (research.md §5).

Fixture groups, one `describe` per AC bullet:
1. Pinfu tsumo 20 / pinfu ron 30 (closed, all-runs, non-yakuhai pair, ryanmen wait).
2. Chiitoitsu fixed 25 (any seven-pairs hand, tsumo and ron both give 25).
3. Open pinfu-shaped ron 30 (kuipinfu) — one chi meld, all-runs otherwise, ryanmen.
4. Closed ron +10 menzen fu — any non-pinfu closed hand, ron vs. tsumo compared.
5. Kan vs triplet fu — same kind, ankan vs ankou vs minkan vs minko, four values.
6. Round-up-to-10 — a hand whose raw sum lands on e.g. 42, asserted → 50.
7. (Beyond AC, needed for §2's ambiguity design) tanki-vs-kanchan overlap fixture —
   assert the max-fu attribution wins.
8. Kokushi → throws.

Every expected fu value is computed by hand in a comment from the table in
research.md §3 — never asserted against the module's own output (the `yaku.test.ts`
precedent).
