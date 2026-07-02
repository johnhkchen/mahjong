# T-002-01-04 — Design: hand-record fold entrypoint

Decisions for the hand-record type and the fold entrypoint: record shape, the empty
action vocabulary, folded-state shape, naming/placement, guards, and tests. Grounded in
research.md; each decision lists what was rejected and why.

## 1. Record shape — the minimal keystone pair

**Chosen:**

```ts
export type HandAction = never // the action vocabulary is empty in this slice; see §2

export interface HandRecord {
  seed: number                        // canonical domain [0, 2^32); normalized >>> 0 by the rng
  actions: readonly HandAction[]      // ordered action log — today, necessarily []
}
```

Exactly what architecture.md §1 says a hand *is*: a seed plus an ordered action list —
nothing else. The seed's numeric contract is rng.ts's, verbatim; the fold adds no
validation (external seeds are the future log-parser boundary's job, the frozen
precedent from rng.ts/tiles.ts).

Rejected alternatives:

- **Richer envelope** (`ruleset`, `version`, `dealer`, timestamps) — versioning and
  metadata belong to the *serialized notation* layer (its own future tickets); putting
  them on the in-memory record would freeze fields this epic has no forcing function to
  get right. The record stays the irreducible pair; an envelope can wrap it later
  without breaking the fold's signature.
- **Wall order as the seed** (storing the 136-tile permutation directly) — architecture
  glosses seed as "the wall order" because the frozen rng makes them equivalent; storing
  the number keeps records kilobyte-scale and leans on the already-golden-tested
  `buildWall`. The permutation is derivable; the seed is authoritative.

## 2. Action element type — `never`, the honest empty union

**Chosen: `export type HandAction = never`**, documented as "no action kinds exist yet;
draw/discard/call tickets widen this union". Consequences:

- `actions: readonly never[]` accepts exactly one value shape: the empty array. The
  type system itself states the current engine capability — AC (a)'s "empty action
  log" is not just the tested case, it is the *only well-typed* case.
- Later tickets replace one line (`never` → a discriminated union) and every existing
  signature (`HandRecord`, `foldRecord`) is textually unchanged. Widening a union is
  the natural, non-breaking extension direction.

Rejected alternatives:

- **Placeholder discriminated union** (stub `{ type: 'draw', … } | { type: 'discard', … }`)
  — the action encoding *is* the replay contract (architecture.md §2); freezing field
  names and shapes now, before the draw/discard tickets have done their design, is
  exactly the premature freeze this workflow exists to prevent. A wrong stub would
  either break stored records later or lock in a bad encoding.
- **Generic parameter** (`HandRecord<A>`) — pushes the vocabulary decision onto every
  consumer and makes the barrel export a family, not a contract. The engine has one
  action vocabulary; it is not caller-configurable.
- **No exported action type** (inline `readonly never[]`) — works today but leaves
  future tickets renaming an anonymous position instead of widening a named type;
  naming the extension point is the cheap part of this ticket's job.

## 3. Folded-state shape — `TableState`, the AC list verbatim

**Chosen:**

```ts
export interface TableState {
  hands: readonly [TileId[], TileId[], TileId[], TileId[]]  // seat-indexed (Seat: 0=E…3=N), draw order
  live: TileId[]        // 70 post-deal live-wall tiles; live[0] = the dealer's first draw
  dead: TileId[]        // 14 tiles, frozen layout per WallPartition.dead
  doraIndicator: TileId // the flipped physical tile — dead[INITIAL_DORA_INDICATOR_INDEX]
  dora: TileKind        // doraKindOf(kindOf(doraIndicator)) — what AC (a) calls "mapped dora"
}
```

- **Seats** are the hand tuple's index — T-002-01-03 already decided seat identity is
  `Seat = 0 | 1 | 2 | 3` in E/S/W/N order, and `Seat` is already public. A separate
  `seats` field would duplicate that decision; the AC's "four hands, seats" is
  satisfied by the seat-indexed tuple plus the exported `Seat` type.
- **Dora is carried both ways**: the physical indicator (`TileId`, what the table
  shows) and the mapped kind (`TileKind`, what scores) — the AC asks for both, and the
  pair saves every consumer (render, hints, scoring) from re-deriving the mapping.
  Singular, not arrays: `partitionWall` deliberately exposes only the initial
  indicator; kan-flip plurality is those tickets' design to make.
- **`TableState` is a derived view, not a frozen contract.** The *record* and the
  conventions that map it to tiles (rng stream, wall orientation, deal map) are the
  replay format; the in-memory state shape may grow fields (discard piles, melds,
  turn) in later tickets without invalidating any stored hand. The doc comment says so
  explicitly, to keep future tickets from treating shape changes as contract breaks.

Rejected: **re-using `Deal` + `WallPartition` nested** (`{ deal, partition }`) — leaks
construction history into the state shape and double-carries the pre-deal live wall;
consumers want the table as it stands, not the derivation tree.

## 4. The fold — `foldRecord(record: HandRecord): TableState`

```ts
foldRecord = record → buildWall(record.seed) → partitionWall → dealHands → assemble
```

- Composes the three frozen derivations, then assembles `TableState` with
  `dora: doraKindOf(kindOf(partition.doraIndicator))`. No RNG draws beyond
  `buildWall`'s own; no mutation of the record; fresh arrays out (the sub-derivations
  already guarantee this; the assembly adds none that share structure with input).
- **The deal is not an action.** Folding the empty log still deals: the deal is the
  seed's own derivation (T-002-01-03), so the initial state of the fold *is* the dealt
  table. This is AC (a)'s exact semantics.
- **Loud guard on non-empty logs**: types make non-empty logs unrepresentable, but JS
  callers can cast, and records will eventually arrive from storage. Until action
  tickets land, `if (record.actions.length > 0) throw new RangeError(…)` — the
  nextInt/partitionWall corruption precedent: an action the engine cannot interpret
  must never fold silently into a wrong state. Action tickets replace this guard with
  the real step function; the guard is the step function for an empty vocabulary.

Naming — rejected: `replayHand` (replay is a *consumer* of the fold, over log
prefixes); `foldHand` (the thing folded is the record; "hand" will be wanted for the
13-tile concept); `deriveTableState` (accurate but severs the name from the
architecture's own vocabulary — "table state is derived by folding").

## 5. Module placement — new `src/core/record.ts`

The dora/deal precedent: new concern → small sibling module. The record/fold is the
*contract layer* above wall/deal, not part of either; wall.ts and deal.ts stay frozen.
Imports (purity-gate compliant, `./`-siblings only): `./tiles` (`TileId`, `TileKind`,
`kindOf`), `./rng` (nothing — buildWall owns the rng), `./wall` (`buildWall`,
`partitionWall`), `./dora` (`doraKindOf`), `./deal` (`dealHands`, hand tuple type
shape). Barrel gains `export * from './record'` — dependency order, after `./deal`.
Name-collision check: `HandAction`, `HandRecord`, `TableState`, `foldRecord` collide
with nothing exported today.

Rejected: extending `deal.ts` (the fold consumes the deal; T-002-01-03 §8 explicitly
left the "named public entrypoint" to this ticket as its own concern) and `index.ts`
itself (the barrel re-exports, never defines — its header says so).

## 6. Test design (the AC, itemized)

New `src/core/record.test.ts`, existing idioms (`seedArb`, imports via `./index` —
which makes AC (d) executable):

1. **Empty-log fold = the dealt table** (∀ seed) — AC (a): `foldRecord({seed,
   actions: []})` deep-equals the state assembled by an explicit
   buildWall → partitionWall → dealHands → doraKindOf∘kindOf composition written out
   in the test. Pins every field, including `dora`.
2. **Same seed → identical deal** (∀ seed) — AC (b), named verbatim: two records built
   independently from the same seed fold to deep-equal `hands`.
3. **Same record → same folded state** (∀ seed) — AC (c), named verbatim: repeated
   folds of *one* record object deep-equal, with fresh (`not.toBe`) `hands`, each
   `hands[s]`, `live`, `dead`.
4. **Fold does not mutate the record** (∀ seed) — snapshot compare of the actions
   array and seed.
5. **Conservation through the fold** (∀ seed) — hands + live + dead = 136 distinct ids
   (ties the public entrypoint to the global invariant end-to-end).
6. **Guard** — a record whose actions array is non-empty (cast past `never`) throws
   RangeError.
7. **Golden** — seed 1 folded: all four hands equal the deal.test.ts pinned literals,
   `dead` equals the wall.test.ts pinned dead wall, `doraIndicator === 24`,
   `dora === '8m'` (24 → kind `7m` → dora `8m`, cross-checked by hand against
   tiles.ts's canonical kind order and dora.ts's cycle), `live.slice(0, 4)` equals
   `[100, 60, 14, 66]`. Every literal is *reused* from already-frozen goldens plus one
   hand-derived kind — no new capture procedure needed; the golden proves the fold
   assembles the frozen parts without reshuffling them.

## 7. What this design deliberately leaves undone

No action kinds, no legal-action computation, no text notation/parser, no replay/undo
helpers (they are folds over prefixes — trivial once actions exist), no seat
winds/rotation, no discard piles/melds/turn field in `TableState` (added when the
first action needs them), no app code. The public surface grows by two types, one
interface, and one function.
