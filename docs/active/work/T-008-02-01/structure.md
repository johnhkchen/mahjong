# T-008-02-01 — game-record-and-continuation-fold — Structure

File-level changes, module boundaries, public interface. The blueprint, not code.

## 1. Files touched

| File | Change |
|---|---|
| `src/core/game.ts` | NEW — the whole module |
| `src/core/game.test.ts` | NEW — the test suite |
| `src/core/index.ts` | MODIFIED — one line, `export * from './game'`, appended last |

No other file changes. `record.ts` (`HandRecord`, `HandAction`, `foldRecord`, `TableState`),
`settlement.ts` (`settlementOf`, `SeatDeltas`), `deal.ts` (`SEAT_COUNT`), `yaku.ts`
(`WindKind`) are read-only dependencies. `record.ts`'s private `ROUND_WIND`/`windKindOf`
and `settlement.ts`'s duplicated copies are UNCHANGED — this ticket does not thread a round
wind into `foldRecord` (design.md's scope cut; round wind stays East throughout, per the
ticket's own text).

## 2. `src/core/game.ts` internal organization

Top-of-file comment block: module purpose (the record contract one level up — "fold-only
authority, same as the hand level"), the engine-seat-is-already-dealer-relative fact
research.md §2 establishes (why no `record.ts` change is needed), the per-hand seed
derivation's collision-free proof sketch (design.md Decision 3), and the renchan scope cut
(Decision 5) — same voice as `record.ts`/`settlement.ts`'s own headers.

**Imports.** Type-only where possible:
- `type { HandAction, HandRecord, TableState } from './record'`, value `foldRecord`
- `type { Seat } from './deal'`, value `SEAT_COUNT`
- `type { WindKind } from './yaku'`
- value `settlementOf`, type `SeatDeltas` from `./settlement`

**Types.**
```ts
/** A persistent identity across a whole game — distinct from Seat (dealer-relative, per
 * hand). Player 0's identity never changes; which engine Seat they occupy each hand does. */
export type Player = 0 | 1 | 2 | 3

/** A game is its seed plus one action log per hand played so far (including the active,
 * possibly still-`'playing'`, hand as the last element). No hand stores its own seed —
 * handSeedOf derives it, so there is never a second authority to disagree with the first. */
export interface GameRecord {
  readonly seed: number
  readonly hands: readonly (readonly HandAction[])[]
}

/** The game as it stands after folding a record — a DERIVED VIEW, like TableState. */
export interface GameState {
  /** Four seat scores indexed by Player, starting at STARTING_SCORE each. */
  readonly scores: readonly [number, number, number, number]
  /** The active (last) hand's dealer, as a persistent Player identity. */
  readonly dealer: Player
  /** Each Player's current wind for the active hand — seatWinds[dealer] is always '1z'. */
  readonly seatWinds: readonly [WindKind, WindKind, WindKind, WindKind]
  /** The active hand's folded TableState — engine-Seat-indexed (0 = this hand's dealer);
   * map its seats to Players via `dealer` (seat s is player (dealer + s) % SEAT_COUNT). */
  readonly table: TableState
}
```

**Constants.**
- `STARTING_SCORE = 25000` (the "Taiwan guardrail" convention `deal.ts` set: name every
  such value even though only one ruleset uses it today).
- `GOLDEN_RATIO_32 = 0x9e3779b1` — the odd mixing constant for `handSeedOf` (design.md
  Decision 3), documented inline with the injectivity argument.

**Per-hand seed derivation.**
```ts
export function handSeedOf(gameSeed: number, handIndex: number): number
```
Guards `handIndex` as a non-negative integer (the `nextInt`/`dealHands` precedent — a
programmer error inside the engine fails loudly). Body: `((gameSeed >>> 0) ^
Math.imul(handIndex + 1, GOLDEN_RATIO_32)) >>> 0`.

**Player ⇄ Seat conversion** (module-private, mirroring `record.ts`/`settlement.ts`'s own
duplicated small-helper convention):
- `playerOfSeat(dealer: Player, seat: Seat): Player` — `((dealer + seat) % SEAT_COUNT) as Player`.
- `seatOfPlayer(dealer: Player, player: Player): Seat` — `((player - dealer + SEAT_COUNT) % SEAT_COUNT) as Seat`.
- `nextPlayer(player: Player): Player` — `((player + 1) % SEAT_COUNT) as Player`.
- `windKindOf(seat: Seat): WindKind` — `` `${seat + 1}z` `` (the `record.ts`/`settlement.ts`
  duplicate, duplicated again here per that established precedent).
- `seatWindsOf(dealer: Player): readonly [WindKind, WindKind, WindKind, WindKind]` — for
  each `player` 0..3, `windKindOf(seatOfPlayer(dealer, player))`.

**The public entrypoint.**
```ts
export function foldGame(record: GameRecord): GameState
```
Per design.md Decision 4's sketch: guard `record.hands.length === 0` (throws — a game
needs at least the active hand's entry, even if its action list is empty); loop hands
left to right threading `dealer` (starts at Player `0`); for each hand, derive its seed via
`handSeedOf`, fold via `foldRecord`; if `phase === 'playing'` it must be the last hand
(else throw — Decision 6) and folding stops there without a dealer-rotation decision or a
score update for that (unended) hand; otherwise accumulate `settlementOf`'s deltas into
`scores` through `playerOfSeat(dealer, seat)`, and — unless this was the last hand — decide
the next hand's dealer (`dealerWon` check, Decision 5) before continuing. Returns `{
scores, dealer, seatWinds: seatWindsOf(dealer), table }` using whichever `dealer`/`table`
were current when the loop stopped (the active hand's, never a prediction beyond it).

## 3. Test file organization (`game.test.ts`)

1. **`handSeedOf` — pure, no engine involvement.**
   - Determinism: same `(gameSeed, handIndex)` twice → identical result.
   - Spot values: a couple of hand-computed `Math.imul`/XOR results, verified by literal
     arithmetic in a comment (not reverse-engineered from the function's own output).
   - Injectivity spot-check: for several fixed `gameSeed`s, `handIndex` `0..999` (or a
     `fast-check` property over a larger sampled range) produces 1000 distinct seeds —
     backed by the Decision 3 proof comment, not treated as a statistical accident.
   - Guard: negative/non-integer `handIndex` throws.

2. **`foldGame` — single-hand games (no rotation observable, the base case).**
   - A one-hand `GameRecord` (`hands: [[]], seed: <anything>`) folds to `dealer: 0`,
     `seatWinds` the identity `['1z','2z','3z','4z']`, `scores` all `STARTING_SCORE`,
     `table.phase === 'playing'`.
   - Purity: folding the same `GameRecord` twice is deeply equal (`toEqual`, the AC's own
     wording).

3. **`foldGame` — dealer win → renchan (mined).**
   A `gameSeed` mined so `handSeedOf(gameSeed, 0)`'s self-played hand ends `'agari'` with
   `win.winner === 0`. `GameRecord = { seed: gameSeed, hands: [hand0Actions, []] }`. Assert
   `dealer === 0` (unchanged), `seatWinds` still the identity, `scores` equal
   `STARTING_SCORE` plus `settlementOf(hand0State)`'s own deltas applied seat-for-seat
   (dealer 0 ⇒ identity mapping), `table.phase === 'playing'` (the trailing empty hand).

4. **`foldGame` — non-dealer win → rotation (mined).**
   A `gameSeed` mined so hand 0 ends `'agari'` with `win.winner !== 0`. Assert `dealer ===
   1`, `seatWinds === ['4z','1z','2z','3z']` (player 0 now North, player 1 now East, ...),
   scores per the same remap-and-add arithmetic as case 3.

5. **`foldGame` — ryuukyoku → rotation (mined).**
   A `gameSeed` mined so hand 0 ends `'ryuukyoku'`. Assert `dealer === 1`, same seatWinds
   as case 4, scores from `settlementOf`'s noten-bappu deltas.

6. **`foldGame` — two real hands compose (mined, renchan then rotation).**
   A `gameSeed` mined so hand 0 is a dealer win (renchan) AND hand 1 (folded with dealer
   still Player 0, per the carry-over) is a non-dealer win. `GameRecord = { seed, hands:
   [hand0Actions, hand1Actions, []] }`. Assert the FINAL `dealer` is Player 1 (hand 1's
   rotation, on top of hand 0's carried-over dealer), `scores` reflect BOTH hands' deltas
   accumulated through their respective dealers (hand 0 under dealer 0, hand 1 also under
   dealer 0 — renchan means the mapping doesn't change between them), and `table` is hand
   1's ended `TableState` at the trailing-`[]` slot (the just-finished hand, since the last
   real entry is index 1, then an empty index-2 entry represents the newly dealt hand 2).

7. **Guards.**
   - `hands: []` throws `RangeError`.
   - A record with an unended (`phase: 'playing'`) hand NOT in the last position throws
     `RangeError` (construct by taking a real mined hand-0 action log, truncating it
     mid-play, and appending another hand after it).

## 4. Mining notes (documented in-file, not a separate artifact)

Each mined `gameSeed` gets a comment stating: what index/outcome it was searched for, and
that a throwaway script (not committed) ran the same local self-play driver as this file
over a small integer range to find it — the `TSUMO_SEED`/`FOUR_KAN_SEED`/`CORPUS_SEEDS`
precedent (`win.test.ts`, `selfplay.test.ts`) restated for this module.
