# T-008-01-01 — fu-calculation — Research

What exists, where, and how it connects. Descriptive only; the design phase decides.

## 1. The ticket

Compute fu from a winning decomposition + win context: base 20, closed-ron +10, tsumo
+2, wait/pair/set fu by type (open/closed triplet vs kan, terminals/honors, yakuhai
pair), pinfu's 20 (tsumo) / 30 (ron) convention, chiitoitsu's fixed 25, round up to 10.
Pure `src/core/` module over the existing agari decomposition; explicitly no han, no
points — those are T-008-01-02 (han-values-and-dora-counting) and T-008-01-03
(payment-tables-and-noten-bappu), both `depends_on: [T-008-01-01]`.

## 2. What already exists to build on

**`src/core/agari.ts`** — `decomposeAgari(concealed, melds)` returns every distinct
reading of a win as `AgariDecomposition`:
- `standard`: `{ pair: TileKind, sets: readonly ConcealedSet[] }`, `ConcealedSet` is
  `{type:'run', start}` or `{type:'triplet', kind}`. `sets.length` is always
  `4 - melds.length` (a kan is ONE set regardless of physical tile count).
- `chiitoitsu`: `{ pairs: readonly TileKind[] }` — seven distinct pairs.
- `kokushi`: `{ pair: TileKind }` — thirteen orphans + one doubled kind.

A hand may satisfy multiple forms at once (ryanpeikou-shaped hands are both
`standard` and `chiitoitsu`); `decomposeAgari` returns a LIST, one entry per reading.
Fu, like `standardYakuOf`, must operate over ONE reading at a time — the caller
(a later scoring ticket) picks which reading(s) to price, mirroring how `WinContext`
already carries a single `decomposition`.

**`src/core/yaku.ts`** — `WinContext` is the exact "(decomposition, win context)"
shape the ticket names:
```
{ decomposition, melds, winningKind, source, lastTile, seatWind, roundWind }
```
`source: 'wall'|'rinshan'|'discard'|'chankan'` subsumes tsumo (wall/rinshan) and ron
(discard/chankan). `melds` are the winner's exposed `Meld[]` from `record.ts`.

Private helpers in `yaku.ts` a fu module needs equivalents of (none exported —
`yakuman.ts` already re-implements its own `allKindsOf` rather than importing
`yaku.ts`'s `allKinds`, establishing the per-module-local-helper convention this
codebase uses instead of cross-module coupling for internals):
- `isMenzen(melds)`: every meld is `ankan` (ankan does not open a hand).
- `isTsumo(ctx)`: `source === 'wall' || 'rinshan'`.
- `combinedSets(ctx)`: concealed sets + melds mapped to `ConcealedSet` shape
  (`meldSetOf`: chi→run, pon/kan forms→triplet, kind-level only).
- `isYakuhaiKind(ctx, kind)`: dragon, or equals `seatWind`, or equals `roundWind` —
  used for pinfu's "pair is not yakuhai" gate. Fu's pair-fu needs the SUM variant
  (double wind pair scores both seat-wind and round-wind fu, +2 each = +4), not this
  boolean OR.
- `completesRyanmen(start, winning)`: true for a two-sided (ryanmen) completion of
  run `start`; the run-fu-is-0 case. Reusable almost verbatim for kanchan/penchan
  detection (whatever isn't ryanmen and isn't a run-edge case).
- `concealedTripletCount(ctx)`: counts concealed (anko) triplets/ankans, with the RON
  ADJUSTMENT — a triplet whose kind equals `winningKind`, completed by ron, is NOT
  concealed UNLESS a run in the same decomposition could equally have absorbed the
  winning tile (the "favorable interpretation" precedent: when a tile's placement is
  structurally ambiguous within one decomposition, resolve in the player's favor).
  Fu's per-set closed/open determination needs the SAME adjustment, at the level of
  "is THIS specific triplet open or closed for fu-rate purposes" rather than a count.
- `pinfu(ctx)`: closed, all-runs, non-yakuhai pair, ryanmen-completed. This is a YAKU
  predicate (gates on `melds.length === 0`, i.e. fully closed — no calls at all,
  stricter than `isMenzen` which tolerates ankan). Fu's "pinfu-shape" check for the
  20/30 special-casing is the SAME shape test, independent of whether the win
  actually carries the `pinfu` yaku name (fu.ts must not import yaku names — the
  ticket scopes han/yaku entirely out of this module).

**`src/core/record.ts`** — `Meld` union: `chi`/`pon` (open, arity 2 `own`),
`daiminkan`/`shouminkan` (open kan, arity 3 `own`), `ankan` (closed kan, arity 4
`own`). Fu's set-fu table keys off exactly this five-way split collapsed to
open-triplet / closed-triplet / open-kan / closed-kan (chi contributes 0, always).

**`src/core/tiles.ts`** — `isHonor`, `isTerminal`, `isSimple` partition all 34 kinds;
the fu table's "simple vs terminal/honor" axis reads these directly. `rankOf`,
`suitOf`, `kindIndexOf` are the arithmetic primitives `completesRyanmen` and any
kanchan/penchan test need.

## 3. The standard fu table (external knowledge, not yet in this codebase)

| Component | Value |
|---|---|
| Base | 20 |
| Menzen ron (closed hand, won by ron) | +10 |
| Tsumo (except pinfu) | +2 |
| Open triplet (minko), simple | +2 |
| Open triplet (minko), terminal/honor | +4 |
| Closed triplet (anko), simple | +4 |
| Closed triplet (anko), terminal/honor | +8 |
| Open kan (minkan), simple | +8 |
| Open kan (minkan), terminal/honor | +16 |
| Closed kan (ankan), simple | +16 |
| Closed kan (ankan), terminal/honor | +32 |
| Pair: dragon | +2 |
| Pair: seat wind | +2 |
| Pair: round wind | +2 (stacks with seat wind if double wind: +4 total) |
| Wait: kanchan (closed/middle wait) | +2 |
| Wait: penchan (edge wait, 12→3 or 89→7) | +2 |
| Wait: tanki (pair wait) | +2 |
| Wait: shanpon, ryanmen | +0 |
| Round to next 10 (ceil), except chiitoitsu | — |
| Pinfu + ron | fixed 30 (20 base + 10 menzen, no other fu possible by shape) |
| Pinfu + tsumo | fixed 20 (the one case where tsumo's own +2 is suppressed) |
| Chiitoitsu | fixed 25, no rounding, no other components |
| Kuipinfu (open, all-runs, non-yakuhai pair, ryanmen ron) | 30 by convention — the
  raw sum (20 base, no menzen bonus since open, no set/wait/pair fu) is exactly 20,
  and 20-fu ron is reserved for closed pinfu; the open case is bumped to 30 rather
  than left at 20. (Kuipinfu TSUMO already rounds 20+2=22→30 naturally — no special
  case needed there.) |
| Kokushi | fu is not applicable — yakuman are priced flat, never by han×fu |

This table is external domain knowledge (standard Japanese riichi rules), not
derived from any file in the repo — Design must cite it as the "independently-stated
expected table" the acceptance criteria and T-008-01-04 (scoring-property-grid) both
require.

## 4. The wait-type ambiguity

Given ONE `AgariDecomposition` and a `winningKind`, the winning tile's "slot" is not
always unique: e.g. pair=5p with a run 456p (3 fives total) admits BOTH "winning tile
completed the pair (tanki)" and "winning tile completed the run via kanchan" as valid
pre-win 13-tile hands, from the identical 14-tile decomposition. `WinContext` carries
only the post-win decomposition + `winningKind`, not the pre-win hand, so this is a
real design question — not a data gap Research can resolve, but the fact must inform
Design (candidates: enumerate valid attributions and take the max-fu one, mirroring
`concealedTripletCount`'s already-established "favorable interpretation" precedent;
or pick one canonical rule-of-thumb attribution order).

## 5. Testing conventions

`yaku.test.ts` builds contexts through the REAL `decomposeAgari` (never hand-typed
fixtures) so a typo'd fixture fails as "not a win" rather than silently testing an
impossible shape; has `h()` mpsz-string sugar and `chi`/`pon`/`daiminkan`/
`shouminkan`/`ankan` meld builders using `tileId`. A fu test suite should reuse this
exact pattern — construct real hands, real decompositions, assert fu totals derived
in comments from the table above, never from module output.

## 6. Module boundary and exports

New file `src/core/fu.ts`, barrelled from `src/core/index.ts` (append one line,
matching the existing one-export-per-module list). No changes needed to `agari.ts`,
`yaku.ts`, `yakuman.ts`, or `record.ts` — fu.ts is a pure additional consumer of
`WinContext` (or a fu-local equivalent) and `Meld`, same tier as `yaku.ts` itself.
`just check` (svelte-check + tsc) and `just test` (vitest) are the verification
commands; no DOM/Svelte import is permitted in `src/core/`.
