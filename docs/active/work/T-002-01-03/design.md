# T-002-01-03 — Design: deal four starting hands

Decisions for dealing 4×13 from the live wall: API shape, chunk convention, seat
representation, return shape, and hand ordering. Grounded in research.md; each decision
lists what was rejected and why.

## 1. API shape — a pure deal function over the live wall array

**Chosen: `dealHands(live: readonly TileId[]): Deal`** — a pure function that takes the
122-tile live wall from `partitionWall` and returns four hands plus the remaining live
wall, all as fresh arrays.

```ts
interface Deal {
  hands: readonly [TileId[], TileId[], TileId[], TileId[]]  // indexed by Seat, E S W N
  live: TileId[]                                             // 70 tiles, live[0] = dealer's first draw
}
```

Composition: `dealHands(partitionWall(buildWall(seed)).live)`. T-002-01-04's fold will do
exactly this chain.

Rejected alternatives:

- **B: `dealHands(partition: WallPartition)`** — couples the deal to a struct it reads
  one field of, and forces property tests to build full partitions to test dealing.
  Passing exactly what is consumed matches `partitionWall(wall)` taking the raw wall.
- **C: `dealFromSeed(seed)` convenience** — re-bundles shuffle + partition + deal into an
  opaque step; T-002-01-04 is the designated place where the full composition becomes a
  named public entrypoint (the fold). Adding a second composed entry now would create two
  public spellings of the same derivation.
- **D: destructive `splice` off the input** (per `buildWall`'s "callers may consume
  destructively") — same rejection as in T-002-01-02 §1: derivations in this codebase
  are pure; fresh slices at n=122 cost nothing and make determinism/purity properties
  trivially testable.

No RNG access anywhere — the wall order already encodes the entire deal (research.md
§3.2, "a hand is its record").

## 2. Chunk convention — physical 4-4-4-1 interleave, frozen

**Chosen: the real riichi deal procedure.** Three rounds in which each seat, East first,
takes 4 consecutive tiles from the head of the live wall, then one final round of 1 tile
each:

- Round r ∈ {0,1,2}, seat s ∈ {0..3}: `hands[s]` gets `live[16r + 4s .. 16r + 4s + 3]`
- Final single: `hands[s]` gets `live[48 + s]`
- Tiles consumed: `live[0..51]`; remaining live wall: `live.slice(52)` (70 tiles).

So East's hand is live indices {0-3, 16-19, 32-35, 48}, South's {4-7, 20-23, 36-39, 49},
and so on — 13 each, and every prefix of consumption is in E/S/W/N order, which is the
AC's "hands arrive in E/S/W/N seat order" made concrete.

Rejected: **contiguous 13-tile blocks** (`hands[s] = live.slice(13s, 13s+13)`) — simpler
index math, statistically identical (the wall is a uniform permutation), but it deviates
from how every physical table and the major digital linearizations (Tenhou-style) deal.
The precedent is T-002-01-02 §3: where the rules leave the engine a free convention, pick
the one that mirrors the physical procedure, then freeze it. Fidelity pays off later:
post-hand review and any deal animation can narrate the real procedure, and goldens can
be cross-checked against reference implementations that share the convention. The index
math (`16r + 4s`) is still a one-line pure computation.

Once shipped this convention is **frozen** like the RNG stream and wall orientation — it
determines which tiles land in which hand for every stored seed. The golden test (§6)
pins it.

## 3. Seat representation — index 0–3 with a documented `Seat` type

**Chosen:** `export type Seat = 0 | 1 | 2 | 3` and `SEAT_COUNT = 4`, documented as
E/S/W/N dealer order: 0 = East (dealer) … 3 = North. Hands are a 4-tuple indexed by
`Seat`.

Rejected: **string seats** (`'E' | 'S' | 'W' | 'N'`) — pretty in logs but forces mapping
tables everywhere hands are iterated; the honor-kind doc in tiles.ts already anchors the
E,S,W,N ordering convention (1z–4z). **A full seat module** (wind-of-seat, rotation) —
belongs to the future round-progression tickets; this ticket needs only an index and its
documented meaning. **No type at all** — T-002-01-04 must expose "four hands, seats" in
the fold's public contract; naming the index type now, in the module that creates the
asymmetry, beats retrofitting it.

## 4. Validation and constants

- `dealHands` throws `RangeError` unless `live.length === LIVE_WALL_SIZE` (122). Dealing
  only ever happens at hand start from a full live wall; anything else is engine
  corruption — the loud-guard precedent (`nextInt`, `partitionWall`). Requiring exactly
  122 (not ≥ 52) is the strictest check available and costs nothing.
- Input is `readonly TileId[]`; TileId values are not validated (log-parser-boundary
  rule, tiles.ts).
- Constants exported from the new module:
  - `STARTING_HAND_SIZE = 13`
  - `SEAT_COUNT = 4`
  - `DEAL_SIZE = SEAT_COUNT * STARTING_HAND_SIZE` (52) — derived so the identity is
    visible in code, the `LIVE_WALL_SIZE = TILE_COUNT - DEAD_WALL_SIZE` precedent.
  - (Post-deal live size, 70, stays an arithmetic consequence — no constant; nothing
    downstream addresses it by name yet.)

## 5. Hand tile order — draw order, never sorted

Each hand preserves the order its tiles came off the wall. Sorting is presentation
(players sort for comfort; the app or a helper can sort by kind index later) and
canonicalizing here would erase record information — "a hand is its record" says the
derived state mirrors the procedure, and downstream review/animation of the deal wants
the true sequence. A future presentation helper can sort; a sorted engine hand could
never recover draw order. (With the 4-4-4-1 convention, draw order within a hand is
ascending live-wall index, so this costs nothing and is deterministic anyway.)

## 6. Module placement — new `src/core/deal.ts`

Dealing is a *consumer* of the wall, not part of building it; `wall.ts`'s header
explicitly hands deal order to "later tickets" as a consumer concern. The dora.ts
precedent (new concern → small sibling module) applies: `deal.ts` imports only
`./tiles` (types/TILE_COUNT arithmetic not needed — just `TileId`) and `./wall`
(`LIVE_WALL_SIZE`), passing the purity gate. `src/core/index.ts` gains
`export * from './deal'`.

Rejected: extending `wall.ts` — the partition belonged there because it re-reads the
same sequence it builds; the deal is the first *consumer* and starts the chain that
draw/discard tickets will extend, better begun in its own module than accreted onto a
frozen file.

## 7. Test design (the AC, itemized)

New `src/core/deal.test.ts`, existing idioms (`seedArb`, one property per invariant):

1. **Conservation property** (∀ seed) — the AC's core clause: deal
   `partitionWall(buildWall(seed))`, then `[...hands[0..3], ...deal.live, ...dead]` has
   length 136 and 136 distinct ids; each hand is exactly 13; remaining live is 70.
2. **Seat-order property** (∀ seed) — hands match the documented index map: for each
   seat s, `hands[s]` equals `[live[4s..4s+3], live[16+4s..], live[32+4s..], live[48+s]]`
   flattened. This pins both "E/S/W/N order" and the 4-4-4-1 convention.
3. **Determinism property** (∀ seed) — two full `dealHands(partitionWall(buildWall(seed)).live)`
   chains deep-equal, with fresh (non-identical) arrays.
4. **Purity property** (∀ seed) — `dealHands` does not mutate its input.
5. **Guard test** — lengths 0, 52, 121, 123, 136 all throw RangeError (52 included to
   prove "≥ deal size but not a full wall" is still rejected).
6. **Golden test** — seed 1's four hands and the first few remaining live tiles pinned to
   concrete values, captured once and cross-checked by an independent derivation
   (recompute from the frozen `buildWall(1)` prefix machinery via a throwaway script),
   named so a failure reads "the deal convention moved — every stored seed's hands are
   now wrong." Never regenerate.
7. `purity.test.ts` passes unchanged (auto-globs the new module; imports are
   `./`-siblings only).

## 8. What this design deliberately leaves undone

No dealer first-draw, no turn rotation, no seat winds beyond the index doc, no action-log
types (T-002-01-04), no sorting/presentation helpers, no app changes (T-002-02-01). The
public surface grows by one function, one interface, one type alias, and three constants.
