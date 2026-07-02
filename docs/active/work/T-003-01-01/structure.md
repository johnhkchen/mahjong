# T-003-01-01 — Structure: draw-discard-step-function

The blueprint: which files change, the exact public shapes, internal organization,
and ordering. Code comes in Implement; this is the shape of the code.

## Files

| File | Change | Contents |
| --- | --- | --- |
| `src/core/record.ts` | **modified** | Widen `HandAction`, grow `TableState`, add private `applyAction`, rewrite `foldRecord`'s body + doc comments |
| `src/core/record.test.ts` | **modified** | Update 4 existing tests, replace 1, add the new draw/discard/ryuukyoku/throw suites |
| `src/core/index.ts` | untouched | `export * from './record'` already re-exports everything |
| everything else | untouched | tiles/rng/wall/dora/deal and all of `src/app/` are unaffected (additive TableState growth) |

No files are created or deleted. The whole ticket is one module + its test file —
the contract layer rewires in place.

## `src/core/record.ts` — target shape

Internal order (top to bottom), replacing the current file's order like-for-like:

### 1. Imports

Adds `Seat` and `STARTING_HAND_SIZE` to the existing same-directory imports
(purity gate: `./` siblings only). `SEAT_COUNT` needed for turn arithmetic.

### 2. `HandAction` (replaces `type HandAction = never`)

```ts
export type HandAction =
  | { readonly type: 'draw'; readonly seat: Seat }
  | { readonly type: 'discard'; readonly seat: Seat; readonly tile: TileId }
```

Doc comment must state, in this order: (1) this encoding is now part of the replay
contract — frozen, extend-only (future members: calls, riichi, agari); (2) the seat
tag is deliberate redundancy so wrong-seat corruption fails loudly instead of folding
silently; (3) draw records no tile — the seed's wall order is the single authority
for what is drawn; (4) discard's `tile` is the physical TileId (tsumogiri ⇔
`tile === drawn` at fold time), id-range validation stays at the log-parser boundary.

### 3. `HandRecord` — unchanged shape

Only the "today, necessarily empty" doc sentence on `actions` is rewritten: the log
is now a real draw/discard sequence.

### 4. `TableState` — four added fields

Existing five fields keep their doc comments verbatim. Appended:

```ts
ponds: readonly [TileId[], TileId[], TileId[], TileId[]]
turn: Seat
drawn: TileId | null
phase: 'playing' | 'ryuukyoku'
```

Doc comments carry the load-bearing facts: ponds are per-seat **in discard order**
(fresh arrays per fold, like hands); `turn` is the seat whose action is expected next
(left at the last discarder once ended); `drawn` is held apart from the 13-tile hand
and is null between turns — every tile id lives in exactly one of hands/ponds/drawn/
live/dead; `phase` is a widenable literal union — `'ryuukyoku'` exactly when
`live.length === 0` (agari tickets extend the union).

### 5. `applyAction(state, action, index): void` — module-private, NOT exported

The per-action step. Signature takes the fold-local mutable state (an internal
`FoldState` alias or the TableState literal being built — implementer's choice, but
it mutates in place and returns nothing), the action, and the log index for error
messages. Body is the D4/D5 machine, checks in this exact order:

1. phase guard → `RangeError` "…action after the hand ended…"
2. `switch (action.type)` with a `default` throw (unknown type — the old guard's
   fail-loud spirit for untyped-JS corruption)
3. seat-vs-turn guard (shared by both arms, before arm-specific checks)
4. **draw arm**: throw if `drawn !== null` (out of sequence); throw if `live` empty
   (defense-in-depth; unreachable via legal folds); else `drawn = live.shift()`
5. **discard arm**: throw if `drawn === null`; tsumogiri (`tile === drawn`) → push to
   `ponds[turn]`; else `indexOf` in `hands[turn]` — miss throws, hit removes via
   `splice` and **appends** the old `drawn` to the hand (draw-order preservation);
   then `drawn = null`; then ending: `live.length === 0` → `phase = 'ryuukyoku'`,
   else `turn = ((turn + 1) % SEAT_COUNT) as Seat`

Every throw message includes the action index and the offending specifics
(expected seat vs got, the tile id, etc.) — a log is a bug report.

### 6. `foldRecord(record): TableState` — guard replaced by the loop

Builds the dealt state exactly as today (build → partition → deal → dora), now with
the four new fields' post-deal values (`ponds: [[],[],[],[]]`, `turn: 0`,
`drawn: null`, `phase: 'playing'`), then:

```ts
record.actions.forEach((action, i) => applyAction(state, action, i))
return state
```

Doc comment updates: the "non-empty-log guard IS the step function" paragraph is
replaced by the real step's contract — pure at the contract level (record never
mutated, fresh arrays out, same record → same state forever), per-action validation
throws `RangeError` with the log index, replay/undo/review remain folds over
prefixes. The "folding an EMPTY action log yields the freshly dealt table" sentence
survives — it is still true and still the app's boot path.

## `src/core/record.test.ts` — target shape

Keeps `seedArb`, `recordOf`, and the existing describe block for empty-log facts;
adds helpers and two new describe blocks.

### New helpers (top of file)

- `turnActions(state-free)`: build a legal `[draw, discard]` pair list is NOT
  derivable without folding — instead the canonical helper is
  `tsumogiriRecord(seed, turns)`: fold incrementally is unavailable (no exported
  step), so the helper computes actions *from the wall directly*: seat cycle
  `i % 4`, drawn tile = `live[i]` of the empty-log fold — tsumogiri-only logs are
  fully predictable from the deal. This keeps tests honest (expected values derived
  from frozen upstream contracts, not from the code under test).
- `maximalRecord(seed)` = `tsumogiriRecord(seed, 70)` — the 140-action full hand.

### Existing tests, edits

1. explicit-composition property → expected literal gains the four post-deal fields
2. same-seed deal — unchanged
3. freshness property → add `ponds` tuple + per-seat pond array freshness
4. record-not-mutated → also run over a non-empty tsumogiri record
5. conservation → identity becomes hands + ponds + drawn(0|1) + live + dead = 136,
   checked over empty AND non-empty records
6. **"rejects non-empty log" — deleted**, superseded by the throw matrix below
7. seed-1 frozen golden — byte-for-byte untouched, must stay green

### New describe: "draw/discard step" (AC (a), (b))

- interleaved tsumogiri fold (property over seeds, a handful of turns): ponds match
  the wall-derived expectation per seat, `turn` is `turns % 4`, `drawn` is null after
  a discard / the exact `live[i]` tile after a dangling draw, hand tedashi case:
  discard a hand tile → pond gets it, hand contains the former drawn tile at the END,
  hand length still 13
- maximal record (property over seeds): `phase === 'ryuukyoku'`, `live` empty,
  ponds sum to 70, `turn === 1` (South discards last), `drawn === null`
- "exactly when": the 139-action prefix (last discard missing) still has
  `phase === 'playing'` with empty `live`… **no** — live empties at the 70th *draw*
  (action 139 of 140, index 138): assert the prefix after the last draw has
  `live.length === 0` ∧ `phase === 'playing'`, and one discard later it's ryuukyoku
- fold determinism: same non-empty record twice → deep-equal states, fresh arrays

### New describe: "illegal actions throw" (AC (c))

RangeError matrix, each from a legally-reachable state: wrong-seat draw, wrong-seat
discard, draw-after-draw, discard-before-draw, discard of a tile in nobody's hand,
discard of a tile in the WRONG seat's hand, any action after ryuukyoku, unknown
action type (the old corrupt-record cast test, retargeted).

## Ordering of changes

Single commit is acceptable (one module + tests are one atomic contract change), but
the plan splits engine-then-tests into reviewable steps; tests cannot precede the
types (the test file imports the widened `HandAction`). `just test` and `just check`
must be green at the end of each plan step that claims green.
