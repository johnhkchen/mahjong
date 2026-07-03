# T-008-01-03 — payment-tables-and-noten-bappu — Structure

File-level changes, module boundaries, public interface. The blueprint, not code.

## 1. Files touched

| File | Change |
|---|---|
| `src/core/settlement.ts` | NEW — the whole module |
| `src/core/settlement.test.ts` | NEW — the test suite |
| `src/core/index.ts` | MODIFIED — one line, `export * from './settlement'` |

No other file changes. `fu.ts`, `han.ts`, `yaku.ts`, `yakuman.ts`, `agari.ts`,
`shanten.ts`, `record.ts`, `tiles.ts`, `deal.ts` are read-only dependencies.

## 2. `src/core/settlement.ts` internal organization

Top-of-file comment block (module purpose, the reading-selection responsibility it
takes on from `fu.ts`/`han.ts`, the published payment table cited by name and
number — same voice as the sibling modules' headers) followed by, in this order:

**Imports.** Type-only where possible:
- `type { TableState, Meld } from './record'`
- `type { Seat } from './deal'`
- `type { AgariDecomposition } from './agari'`, value `decomposeAgari`
- `type { Win, WinYakuName } from './yakuman'`, value `yakuOf`, `YAKUMAN_NAMES`
- `type { WinContext, WindKind } from './yaku'`, value `standardYakuOf`
- value `hanOf`, `doraHanOf` from `./han`
- value `fuOf` from `./fu`
- value `shanten` from `./shanten`
- value `kindOf`, type `TileKind` from `./tiles`

**Types.**
```ts
export type SeatDeltas = readonly [number, number, number, number]
```

**Constants.**
- `DEALER_SEAT: Seat = 0`
- `ROUND_WIND: WindKind = '1z'` (duplicated from `record.ts`, same frozen-East
  rationale, same comment)
- Base-points tier table as a small ordered list of `{minHan, maxHan, base}` or as
  a direct function (`standardBaseOf` below) — final shape decided in Plan; likely
  a function since han 1–4's formula isn't a flat lookup (fu-dependent), so a mixed
  table+formula reads clearer as branches in one function than a lookup table with
  a formula escape hatch.
- `MANGAN_BASE = 2000`, `HANEMAN_BASE = 3000`, `BAIMAN_BASE = 4000`,
  `SANBAIMAN_BASE = 6000`, `YAKUMAN_BASE = 8000` — named per research.md §3, each
  documenting a different rule tier even though some are simple multiples.
- `NOTEN_BAPPU_POT = 3000`
- `YAKUMAN_SET: ReadonlySet<string>` — duplicated membership set from
  `YAKUMAN_NAMES`, mirroring `han.ts`'s own private `YAKUMAN_SET` (per-module
  duplication precedent, `han.ts`'s header comment on `allKindsOf`).

**Local structural helpers** (module-private):
- `windKindOf(seat: Seat): WindKind` — `` `${seat + 1}z` `` — duplicated from
  `record.ts`'s private helper.
- `roundUp100(points: number): number` — `Math.ceil(points / 100) * 100`.
- `winOf(state: TableState): Win` — reconstructs the `Win` object per research.md
  §2: `concealed` from `state.hands[winner]` + the winning tile's kind, `melds`
  from `state.melds[winner]`, `source` from `state.drawnFrom` (tsumo) or
  `'discard'` (ron), `lastTile` from `state.live.length === 0`, `seatWind` from
  `windKindOf(winner)`, `roundWind` from `ROUND_WIND`. Throws if `state.win` is
  `null` (caller corruption — dispatched from `settlementOf` only when `phase ===
  'agari'`, where `win` is guaranteed non-null by `TableState`'s own type, so this
  is a totality note, not a new runtime guard).

**Base-points formula.**
- `standardBaseOf(han: number, fu: number): number` — han ≥13 →
  `YAKUMAN_BASE * Math.floor(han / 13)`; han 11–12 → `SANBAIMAN_BASE`; han 8–10 →
  `BAIMAN_BASE`; han 6–7 → `HANEMAN_BASE`; han 5 → `MANGAN_BASE`; else →
  `Math.min(fu * 2 ** (2 + han), MANGAN_BASE)`. One function, every tier from
  research.md §3, called for BOTH the yakuman path (with `fu` unused/irrelevant —
  actually see below, yakuman skips this and goes straight to a dedicated
  `yakumanBaseOf`) — reconsidered: keep two tiny functions instead of one with an
  unused parameter for the yakuman branch:
  - `yakumanBaseOf(han: number): number` — `YAKUMAN_BASE * Math.floor(han / 13)`.
  - `standardBaseOf(han: number, fu: number): number` — the han 1–12 tiers only
    (never called with han ≥13; the caller branches before choosing which
    function to call, so no dead tier lives inside either function).

**Reading pricing (the non-yakuman path).**
- `pricedReadingsOf(win: Win, doraHan: number): number[]` — for every
  `decomposeAgari(win.concealed, win.melds)` result with `form !== 'kokushi'`:
  build the per-reading yaku list (`standardYakuOf(ctx)` for `'standard'`, literal
  `['chiitoitsu']` for `'chiitoitsu'`), skip if empty, else compute `han = Σ
  hanOf(name, win.melds) + doraHan` and `fu = fuOf(ctx)`, push
  `standardBaseOf(han, fu)`. Returns the list of every valid reading's base points
  (never empty when called on a legal non-yakuman win — see design.md's Decision 4
  totality argument).
- `bestBaseOf(win: Win): number` — `yaku = yakuOf(win)`; if `yaku.some(name =>
  YAKUMAN_SET.has(name))`: `yakumanBaseOf(Σ hanOf(name, win.melds) for name of
  yaku)`; else: `Math.max(...pricedReadingsOf(win, doraHanOf(win, win-doras)))`
  (doras threaded in from the caller — `bestBaseOf` itself takes `doraKinds` as a
  second parameter since `Win` carries no dora list of its own; see the actual
  signature below).

Actual signature: `bestBaseOf(win: Win, doraKinds: readonly TileKind[]): number`.

**Win-type payment split.**
- `ronDeltas(base: number, winner: Seat, discarder: Seat): SeatDeltas` — payment =
  `roundUp100(base * (winner === DEALER_SEAT ? 6 : 4))`; winner +payment,
  discarder −payment, others 0.
- `tsumoDeltas(base: number, winner: Seat): SeatDeltas` — dealer-wins branch (each
  of the other 3 pays `roundUp100(base*2)`) vs non-dealer-wins branch (seat 0 pays
  `roundUp100(base*2)`, the other two non-winner non-dealer seats each pay
  `roundUp100(base*1)`); winner receives the sum of whatever the other three paid.

**Ryuukyoku noten-bappu.**
- `tenpaiFlagsOf(state: TableState): readonly [boolean, boolean, boolean, boolean]`
  — `shanten(state.hands[seat].map(kindOf), state.melds[seat]) === 0` per seat.
- `notenBappuOf(tenpai: readonly boolean[]): SeatDeltas` — count `tenpaiCount =
  tenpai.filter(Boolean).length`; 0 or 4 → all zero; otherwise look up
  (tenpaiSeat gain, notenSeat loss) from research.md §3's table and assign per
  seat by its own flag.

**The public entrypoint.**
```ts
export function settlementOf(state: TableState): SeatDeltas
```
Dispatches on `state.phase`: `'playing'` → throws `RangeError`
("settlementOf: the hand has not ended — phase is 'playing'"); `'ryuukyoku'` →
`notenBappuOf(tenpaiFlagsOf(state))`; `'agari'` → build `win = winOf(state)`,
`base = bestBaseOf(win, state.doras)`, then `state.win!.by === 'ron' ?
ronDeltas(base, state.win!.winner, state.win!.from) : tsumoDeltas(base,
state.win!.winner)`.

## 3. Test file organization (`settlement.test.ts`)

Two fixture styles, matched to what's being tested:

1. **Base-points + payment-split arithmetic** — tested through `settlementOf`
   against small hand-built `TableState`-shaped objects (not the full `foldRecord`
   pipeline — constructing a real `HandRecord` whose wall/deal happens to produce a
   specific han/fu hand is impractical; a literal `TableState` object satisfying
   the interface, `hands`/`melds`/`doras`/`win`/`live`/`phase` populated directly,
   mirrors `fu.test.ts`'s own "build through the real function, but keep the
   scaffolding minimal" spirit at one level up). Groups, one per AC bullet:
   - 30fu/4han non-dealer ron = 7700; dealer ron = 11600 (the AC's own literal
     numbers — the load-bearing regression fixture).
   - Kiriage-boundary documentation: the SAME 30fu/4han base (1920) is asserted to
     NOT equal a kiriage-mangan payout (8000/12000), i.e. the 7700/11600 fixture
     above already proves non-kiriage; an explicit comment ties the two together
     rather than a separate silent assertion.
   - Tsumo splits: non-dealer tsumo dealer-pays/others-pay asymmetry; dealer tsumo
     all-pay-equal.
   - Yakuman payment: single yakuman ron (32000/48000) and tsumo (8000-all /
     16000-all-dealer) splits.
   - Mangan-cap edge case: 4han40fu (2560 raw) prices as flat mangan (2000 base).
2. **Reading selection** — a hand-built `TableState` (or a bare `Win`, tested via a
   thin exported-for-test seam? NO — keep `settlementOf`'s public surface to one
   function per design.md's "Rejected: exporting internals" call; test through
   `settlementOf` with a full `TableState` whose winner's hand is chosen so two
   different `decomposeAgari` readings exist with different yaku/fu, asserting the
   HIGHER one wins) — one dedicated test proving the max-across-readings behavior
   is real, not just documented.
3. **Ryuukyoku noten-bappu** — a `TableState` with `phase: 'ryuukyoku'` and
   hand-picked `hands`/`melds` per seat landing at each of 0/1/2/3/4 tenpai counts,
   asserting the table's five rows directly.
4. **Guard**: `phase: 'playing'` throws.

Every expected number is hand-derived in a comment from research.md §3's table
before the assertion, per the sibling modules' testing convention.
