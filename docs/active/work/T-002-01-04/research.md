# T-002-01-04 — Research: hand-record fold entrypoint

Descriptive survey of what exists and what constrains this ticket. No solutions here
(that is design.md).

## 1. The ticket in one line

Make "a hand is its record" running code: define the hand-record type (seed + ordered
action log) and the fold entrypoint (record in → table state out) as core's public
contract that every later epic reads.

Acceptance criteria, itemized:

- (a) Folding a record with an **empty action log** yields the table state: live/dead
  wall, dora indicator **+ mapped dora**, four hands, seats.
- (b) Property test **"same seed → identical deal"** passes under `just test`.
- (c) Property test **"same record → same folded state (deep-equal across repeated
  folds)"** passes under `just test`.
- (d) The **fold and record types are exported from `src/core/index.ts`**.

`depends_on: [T-002-01-01, T-002-01-03]` — both satisfied: `doraKindOf` is committed
(dfb2088) and `dealHands` is committed (256efb3), with T-002-01-02's `partitionWall`
(89a90e5) beneath them. All conventions this fold composes are already frozen.

## 2. What exists in `src/core/` today

Six runtime modules plus tests; the zero-DOM rule is enforced executably by
`purity.test.ts` (runtime modules import only `./`-siblings).

| File | Contents relevant to this ticket |
| --- | --- |
| `src/core/rng.ts` | mulberry32 kit under CONTRACT FREEZE — the output stream is part of the replay format. Seeds are "any JS number … normalized with `>>> 0`"; the canonical seed domain is integers in [0, 2^32). External seeds "are validated at the log-parser boundary" — a boundary that does not exist yet and is *not* this ticket (this fold is an internal entrypoint, not a parser). |
| `src/core/tiles.ts` | `TileId` (int 0–135), `TileKind`, `kindOf(id)` to decode a physical tile to its kind. Import-free foundation. |
| `src/core/wall.ts` | `buildWall(seed)` → frozen 136-tile permutation; `partitionWall(wall)` → `WallPartition { live: TileId[] (122, draw order), dead: TileId[] (14, documented layout), doraIndicator: TileId (dead[4]) }`. Both pure, loud `RangeError` guards, CONTRACT FREEZE blocks. |
| `src/core/dora.ts` | `doraKindOf(indicator: TileKind): TileKind` — kind-level indicator→dora cycle (T-002-01-01). Physical indicator tiles "are decoded upstream with `kindOf()`" per its header — i.e. the caller (this ticket) does `doraKindOf(kindOf(id))`. |
| `src/core/deal.ts` | `Seat = 0 \| 1 \| 2 \| 3` (E/S/W/N dealer order), `SEAT_COUNT`, `STARTING_HAND_SIZE`, `DEAL_SIZE`, `Deal { hands: readonly [TileId[] ×4] (seat-indexed, draw order, never sorted), live: TileId[] (70, live[0] = dealer's first draw) }`, `dealHands(live)` with the frozen 4-4-4-1 index map. |
| `src/core/index.ts` | The barrel — core's public face; app code imports only from here. Currently `export * from` tiles/rng/wall/dora/deal. A new module must be added here to satisfy AC (d). |

There is no record, action, log, or fold code anywhere in the repo
(`grep -ri 'record\|action\|fold' src/` matches only comments). The full pre-fold
composition already exists as a *test helper*: `deal.test.ts` defines
`dealFor(seed) = dealHands(partitionWall(buildWall(seed)).live)` — exactly the chain
T-002-01-03's design §1 said "T-002-01-04's fold will do".

## 3. Frozen conventions this ticket inherits (may not reinterpret)

1. **RNG stream** (rng.ts): seed → uint32 stream is the replay format's foundation.
2. **Wall orientation** (wall.ts): dead wall = last 14 tiles; live wall consumed
   front-to-back; initial dora indicator = `dead[4]` = `wall[126]`.
3. **Deal convention** (deal.ts): 4-4-4-1 interleave, seats 0–3 = E/S/W/N, hands in
   draw order, remainder = `live.slice(52)` (70 tiles).
4. **Purity of derivations**: pure functions over `readonly` inputs, fresh arrays out,
   no RNG draws outside `buildWall`, loud `RangeError` on corrupt engine-internal input,
   no validation of values that will be checked at the (future) log-parser boundary.
5. **Golden tests**: seed-1 values pinned once, cross-checked independently at capture
   time, never regenerated. Already pinned: wall prefix `[64, 53, 95, 45, …]`, dead wall
   `[80, 41, 88, 6, 24, …]`, indicator `24`, all four seed-1 hands, remaining live
   prefix `[100, 60, 14, 66]`.

## 4. What the architecture docs say the record/fold must be

`docs/knowledge/architecture.md` §1–§2 (the keystone):

- "A hand *is* its event list: a **seed** (the wall order) plus an **ordered list of
  actions** — draws, discards, and calls (chi/pon/kan/riichi). Table state is always
  derived by **folding the pure engine over the actions**. Nothing else is
  authoritative."
- Replay = fold over a log *prefix*; undo = drop last action + re-derive; review = fold
  + analysis. All are *future consumers* of this entrypoint.
- The engine's interface is "log in → legal actions / next state out"; property tests
  run over log round-trips. The *serialized notation* (Tenhou-style text) is a separate
  concern from the in-memory record type — the notation contract has its own future
  tickets; nothing in the current epic defines a text format.

CLAUDE.md invariants repeat this and add: seeded randomness, full hands
deterministically simulatable, action log as the public contract between core and app.

## 5. The action-vocabulary gap (the central tension)

The record type must carry "an ordered list of actions", but **zero action kinds exist
in the engine today**: no draw, no discard, no call, no riichi. The only table
transition core can compute is the deal itself, which is *not* an action — it is the
seed's own derivation (T-002-01-03: "no RNG access — the seed already encodes the
entire deal"). So the only *foldable* record right now is one with an empty action log,
which is exactly what AC (a) tests. How to type "an action list whose element type has
no inhabitants yet, but will grow" is the key design question — it decides how
draw/discard/call tickets later extend the contract without breaking this one.

## 6. Neighboring tickets — the boundary this ticket must not cross

| Ticket | Relationship |
| --- | --- |
| T-002-01-01 dora-mapping (done) | Producer: `doraKindOf` supplies AC (a)'s "mapped dora". |
| T-002-01-03 deal (done) | Producer: `dealHands` supplies the four hands + post-deal live wall. Research §5 there anticipated this ticket owning "the full composition … as a named public entrypoint". |
| T-002-02-01 render-dealt-hand | First consumer: app-side, reads "the player's 13 dealt tiles" through this fold. Confirms the folded state must expose hands addressable by seat. |
| S-002-02 (next story) | Whatever draws/discards look like, they will extend the action vocabulary and the fold's step function. This ticket defines the container they extend, not the actions themselves. |
| Future log-parser / notation tickets | Will validate external input (seeds, tile ids, action well-formedness) at the parse boundary. This fold assumes in-program, well-typed records. |

Out of scope: any concrete action kind (draw/discard/call/riichi), turn order, legal-
action computation ("log in → *legal actions*" is a later interface layer), text
serialization of the log, undo/replay helpers, seat winds/rotation, app code,
localStorage persistence.

## 7. Testing idioms available

- fast-check 4.8.0 + vitest 4; `seedArb = fc.integer({min: 0, max: 0xffffffff})`; one
  named property per invariant; `expect(x).not.toBe(y)` freshness checks; explicit
  RangeError guard tests; goldens named as contract alarms with capture-provenance
  comments. Tests import from `./index` (exercising the public barrel — which also
  gives AC (d) an executable check for free).
- `just test` auto-globs `src/**/*.test.ts`; `just check` = svelte-check + tsc strict.
- `purity.test.ts` auto-globs new core modules; comments must not contain quoted
  bare-package-looking specifiers (it scans raw source including comments).
- Prior-suite state: 7 test files, 44 tests, all green at 15571be.

## 8. Assumptions and open questions for Design

- **Action element type today**: `never` (empty union — the type system itself says "no
  actions exist yet"), a placeholder discriminated union, or an opaque type parameter?
  Each has different extension ergonomics for S-002-02.
- **Record shape**: `{ seed, actions }` minimal pair vs. richer envelope (ruleset/
  version fields). Architecture says seed + ordered actions; versioning smells like the
  notation layer's problem.
- **Folded-state shape**: what exactly is "table state" at this stage — post-deal hands
  + remaining live + dead + indicator + mapped dora is the AC list; is the dealt-ness
  implicit (empty log ⇒ freshly dealt table) and are seats just the hand tuple's index
  (the T-002-01-03 decision) or a separate field?
- **Dora representation**: indicator is a physical `TileId`; the mapped dora is
  kind-level (`doraKindOf` is kind→kind). Carry both? Under what field names?
- **Fold naming**: `foldRecord` / `foldHand` / `replay`… and module placement — new
  sibling `record.ts` (the dora/deal precedent) vs. extending an existing module.
- **Runtime guard for non-empty logs**: types can say "empty only", but JS callers can
  cast; does the fold throw loudly on an action it cannot interpret (the corruption
  precedent) or is that unreachable-by-construction and left to later tickets?
- **Determinism property overlap**: "same seed → identical deal" already exists in
  deal.test.ts against `dealHands`; the AC re-asks it *through the fold* — presumably
  because the fold is the surface every later epic reads.
