# T-006-01-01 seatview-projection — Design

## The decision in one paragraph

Add a new core module `src/core/seatview.ts` exporting `interface SeatView` and
`seatView(state: TableState, seat: Seat): SeatView` — a pure, per-call-fresh projection
whose type contains **no field that can hold hidden information**: one `hand` (the
observing seat's), one `drawn` (the observing seat's or null), and a `wallCount` number
where TableState has a tile array. The view carries the ticket's enumerated public
facts plus the remaining public-by-construction TableState facts (`claimable`,
`mustDiscard`, `doras`, `win`), because omitting them would force future consumers
(bots, hints, defense reads) back onto full TableState — the exact channel this ticket
exists to close. Field names mirror TableState wherever the meaning is unchanged.

## Options considered

### 1. What form does the projection take?

**A. A new struct type built by a function (chosen).** `seatView(state, seat)` returns
a fresh `SeatView` object with copied arrays. Fair play is then *structural*: the type
has no slot for other hands or wall ids, so a consumer typed against SeatView cannot
express a peek. This is what -02's property test quantifies over, and it matches the
vision's "opponents see only what a player in that seat could see."

**B. A filtered TableState (same shape, censored contents)** — e.g. other hands
replaced by empty arrays, live truncated. Rejected: the *type* still has four hands and
a live array, so "no peeking" becomes a runtime convention, not a construction. -02's
"no tile id outside the public zones ever appears" would hold, but the story's
"fair-play-by-construction" would not — a bot could still be written against the
censored fields and silently break when the censoring changes.

**C. A live wrapper (getters over the state).** Rejected: TableState arrays are
fold-fresh but mutable; a lazy view aliases engine internals and its answers change if
anyone folds-in-place or mutates. Also harder to serialize (bots-as-data, review
tooling, tests do deep equality). The codebase convention everywhere is eager fresh
arrays ("fresh per fold/call" on every producer); follow it.

### 2. Which fields are in?

The ticket enumerates a floor: own hand, own drawn, all ponds, all melds, flipped dora
indicators, wall count, turn, phase. Three groups needed a call:

**Included — the remaining public facts of TableState:**

- `dora` / `doras`: derived kinds of the flipped indicators; public by derivation.
  Included because TableState carries them and every indicator consumer wants the
  mapped kind, not the indicator arithmetic.
- `claimable`: the fresh discard open to claims — the most public fact on the table
  (it is literally the tile everyone is being asked about). A bot deciding a call and
  a "safe tile" hint both need it; reconstructing it from ponds is impossible
  (staleness is not pond-visible).
- `mustDiscard`: a claim happened in the open; the table visibly waits on the caller's
  discard. Needed to interpret `drawn === null` on one's own turn correctly.
- `win`: at agari the win is declared openly — winner, source, tile, yaku are announced
  table facts (the hand-end screen already shows them to the player). A SeatView that
  goes blank at agari would push every end-of-hand consumer back to TableState.
- `seat`: the view records whose view it is. Self-describing views cost one field and
  save every consumer from carrying `(view, seat)` pairs; -02's "identical SeatViews
  for a given seat" comparison also wants the seat pinned in the value.

**Excluded — hidden or leak-adjacent:**

- Other seats' hands, `live` as an array, `dead` in any form. `wallCount: number`
  replaces `live`; nothing replaces `dead` (its public content — flipped indicators —
  is already `doraIndicators`; rinshan/ura remainders are hidden).
- Another seat's `drawn`: hidden identity. `drawn` in the view is
  `state.turn === seat ? state.drawn : null` — null both "between turns" and "someone
  else holds a draw". The *fact* that the turn seat holds a draw is public in real
  play, but modeling it (`turnHoldsDraw: boolean`) is speculative — no consumer needs
  it yet; a later ticket can widen the view (derived-view precedent: widening never
  invalidates anything).
- `drawnFrom`: in lockstep with `drawn`, so it follows the same rule — but no consumer
  of the view needs the source of one's own draw yet (tsumo legality is legal.ts's
  job over full state). Omitted; widenable later.
- `doraIndicator` (singular): redundant with `doraIndicators[0]`; the singular field on
  TableState is a pre-kan-era convenience kept for compatibility. The view starts
  clean without it — but `dora`/`doras` both stay since both are kind-level facts.
  (Decision: include plural forms only; `doras[0]` is the initial dora.)

### 3. Copy depth and mutability

Arrays are **copied fresh per call** (`slice()` / array-literal rebuilds); `Meld`
objects, the `claimable` record, and the `win` record are **shared by reference** —
they are `readonly`-typed, never mutated after creation by the fold (shouminkan
replaces, never mutates), so sharing them cannot alias future engine mutation. The
per-seat meld *arrays* are copied (the fold pushes into them); their elements are safe.
All view fields are `readonly`, arrays typed `readonly TileId[]` etc. No
`Object.freeze` — the codebase never freezes runtime values; readonly types are the
convention (Meld, HandAction).

### 4. Validation

`seat` is a `Seat` by type; runtime range-checking is the log-parser boundary's job per
the TileId precedent (tiles.ts:19-21) — core trusts in-program callers. No guards.
`seatView` never throws.

### 5. Where does it live?

New sibling module `seatview.ts`, exported through the barrel. Rejected: growing
record.ts (933 lines already; the projection is a consumer of the fold, not part of the
record contract — separate concern, separate file, matches waits.ts/dora.ts precedent
of small focused consumers).

## The shape (blueprint for Structure)

```ts
export interface SeatView {
  readonly seat: Seat
  readonly hand: readonly TileId[]            // own concealed hand, draw order
  readonly drawn: TileId | null               // own drawn tile; null when not this seat's held draw
  readonly ponds: readonly [readonly TileId[], ×4]
  readonly melds: readonly [readonly Meld[], ×4]
  readonly doraIndicators: readonly TileId[]
  readonly doras: readonly TileKind[]
  readonly wallCount: number                  // live.length — the only wall fact
  readonly turn: Seat
  readonly phase: TableState['phase']
  readonly claimable: TableState['claimable']
  readonly mustDiscard: boolean
  readonly win: TableState['win']
}
export function seatView(state: TableState, seat: Seat): SeatView
```

## Testing approach (detailed in Plan)

Unit tests in `seatview.test.ts`, house style (fast-check over seeds, expectations from
frozen upstream contracts, an explicit tile-id collector over the view):

1. **AC positive**: own hand and drawn appear verbatim (fold a tsumogiri prefix where
   seat holds a draw; also a claim state via the record.test.ts fixture pattern for
   melds).
2. **AC negative**: collect every tile id the view can carry (hand, drawn, ponds flat,
   melds' own+claimed, doraIndicators, claimable.tile, win.tile) and assert
   disjointness from the state's other hands, live, and unflipped dead — the collector
   is explicit-field, not a recursive number scan, because `wallCount`/`turn`/`seat`
   are numbers that may collide with tile-id values.
3. **AC wall count**: `wallCount === state.live.length`, `typeof 'number'`, and the
   view has no `live`/`dead` properties (`'live' in view === false`).
4. **Freshness**: mutating the returned arrays does not touch the state (and vice
   versa: mutating state arrays after projection does not change the view).
5. **All four seats × property over seeds/turns**: for every seat, hand matches
   `state.hands[seat]`, drawn is null unless `turn === seat`.

The -02 ticket owns the hidden-permutation equivalence property; this ticket's tests
stay at "the projection of a real folded state exposes exactly the public zones."

## Risks

- **Type-level leak via `TableState['claimable']` etc.**: these indexed-access aliases
  keep the view in lockstep with TableState unions — if a later ticket widens `phase`
  or `win`, the view widens automatically. That is the derived-view intent, but it
  means the -02 property must re-audit any TableState widening. Documented in the
  module header.
- **Meld reference sharing**: safe today (melds never mutate in place). If a future
  fold ever mutates a meld object, the view aliases it. Mitigated by a comment pinning
  the assumption next to the copy.
