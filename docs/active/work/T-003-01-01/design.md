# T-003-01-01 — Design: draw-discard-step-function

Decisions with rationale, grounded in research.md. The action encoding chosen here
joins the replay contract permanently (record.ts's own extension-point comment), so
each decision names what was rejected and why.

## D1. Action encoding: seat-tagged, minimally redundant

```ts
export type HandAction =
  | { readonly type: 'draw'; readonly seat: Seat }
  | { readonly type: 'discard'; readonly seat: Seat; readonly tile: TileId }
```

**Options considered:**

- **(a) Bare actions, no seat** (`{type:'draw'}`) — the acting seat is fully derivable
  from the turn pointer, so this is the most compact encoding. **Rejected**: the AC
  explicitly requires "folding a wrong-seat action throws loudly," which is only
  expressible if the log *records* who acted so the fold can cross-check it against
  who *should* act. A log is a bug report (architecture §2); a seat tag is exactly the
  redundancy that turns silent log corruption into a loud throw.
- **(b) Seat-tagged, draw carries no tile** — the drawn tile is derived from the
  seed's wall order (`live[0]` at draw time), never recorded. **Chosen.**
- **(c) Seat-tagged, draw also records the drawn tile** — Tenhou-style logs do this
  for human readability. **Rejected**: the keystone invariant is that the seed IS the
  wall order; recording the drawn tile creates a second authority that can disagree
  with the first, and every redundant field must be validated forever. Readability is
  the future text-serialization ticket's concern — it can render the derived tile.

The discard's `tile` field is a `TileId` (physical tile, 0–135), not a `TileKind`:
ponds and conservation are identity-level, and kind-level would be ambiguous across
the 4 copies. Id *range* validation stays at the future log-parser boundary (tiles.ts
rule); the fold validates *semantics* — the tile must actually be in the acting
seat's hand or be the drawn tile, which subsumes range checking for any log that folds.

## D2. The drawn tile is a separate `drawn` field, not a 14th hand element

**Options considered:**

- **(a) Draw pushes into `hands[turn]`** (hand oscillates 13↔14), with `drawn` as a
  derived annotation. Pro: the epic's conservation identity ("hands + ponds + live +
  dead == 136") holds verbatim at every prefix; discard is one uniform "remove from
  hand" rule. Con: `drawn` would duplicate a tile that is *also* in `hands` — two
  places in one state object claim the same tile, and the 13-tile hand shape invariant
  dissolves.
- **(b) `drawn: TileId | null` holds the tile exclusively; hands stay 13.** **Chosen.**

Rationale for (b):

- **Exclusive ownership** — every tile id lives in exactly one of hands / ponds /
  drawn / live / dead at all times. The conservation identity gains one term
  (`+ drawn (0 or 1)`) and T-003-01-03 owns writing it that way.
- **Physical fidelity** — riichi players hold the drawn tile apart from the wall of
  13; the view ticket (T-003-02) will render exactly that, and gets it as a field
  instead of re-deriving "the 14th element."
- **Tsumogiri is structurally crisp** — `action.tile === drawn` is tsumogiri; a tile
  from the hand is tedashi. That distinction is teaching- and defense-relevant later
  (tedashi reads), and this shape makes it a one-line derivation from any log.
- The epic names "drawn tile" as a first-class TableState growth field.

**Discard mechanics under (b):** tsumogiri (`tile === drawn`) → tile goes to the pond,
hand untouched. Tedashi (`tile` in hand) → remove it from the hand, **append `drawn`
to the end of the hand** — appending is what preserves "hands are in draw order, never
sorted" (deal.ts freeze; removal preserves relative order of the rest). Either way the
hand is 13 and `drawn` is null after every discard.

## D3. TableState growth (additive only)

```ts
ponds: readonly [TileId[], TileId[], TileId[], TileId[]]  // per-seat, discard order, fresh per fold
turn: Seat                                                // whose action is expected
drawn: TileId | null                                      // held apart from the 13; null between turns
phase: 'playing' | 'ryuukyoku'                            // widened by future agari tickets
```

Post-deal values (empty log): `ponds` four empty arrays, `turn: 0` (East draws first —
"the dealer's 14th is the first draw of play"), `drawn: null`, `phase: 'playing'`.
All existing fields keep their exact meaning — TableState is documented as a growable
derived view, and the frozen seed-1 golden keeps passing with these four additions.
`phase` is a string-literal union, not a boolean `ended`, because agari endings are a
known future widening and the ticket itself says "ended/ryuukyoku phase."

## D4. Turn/step state machine

Two alternating expectations per seat, cycling E→S→W→N:

- `drawn === null` ∧ `phase === 'playing'` → the only legal action is
  `{type:'draw', seat: turn}`. Effect: `drawn = live.shift()`.
- `drawn !== null` → the only legal action is `{type:'discard', seat: turn, tile}`
  with `tile === drawn` or `tile ∈ hands[turn]`. Effect: tile → `ponds[turn]`, hand
  fixup per D2, `drawn = null`, then **if `live.length === 0` → `phase = 'ryuukyoku'`
  (turn pointer left at the last discarder), else `turn = (turn + 1) % 4`.**

**Ryuukyoku trigger pinned:** the hand ends when the discard *following the draw that
emptied the live wall* completes — the fold is in the ended phase exactly when
`live.length === 0` (AC (b)); mid-turn after the 70th draw, `live` is empty but the
discard is still owed, and phase flips the moment it lands. 70 live tiles ⇒ a maximal
log is exactly 140 actions ending with South's (seat 1) 70th discard. No haitei/kan
subtleties exist yet — the dead wall is inert in this slice.

**Rejected alternative:** flipping to ryuukyoku on the draw that empties the wall.
That would strand a drawn tile in an ended state and contradict the physical rule
(the last discard happens; it is even ron-able in the future vocabulary).

## D5. Validation: every malformed or out-of-turn action throws RangeError

Check order inside the step (first failure wins, message includes the action's log
index and specifics):

1. `phase !== 'playing'` → "action after the hand ended"
2. unknown `type` (untyped-JS corruption) → "unknown action type" — the widened
   vocabulary keeps the old guard's spirit: never fold silently past an
   uninterpretable action.
3. `seat !== turn` → wrong-seat throw (AC (c)); catches any out-of-range seat too.
4. draw with `drawn !== null` → "draw out of sequence" (AC (c)); draw with empty
   `live` → defense-in-depth (unreachable through legal folds since phase already
   ended, but corruption fails loudly — nextInt precedent).
5. discard with `drawn === null` → "discard before drawing".
6. discard whose `tile` is neither `drawn` nor in `hands[turn]` → tile-not-in-hand
   throw (AC (c)).

`RangeError` keeps the established corruption-error type (nextInt, dealHands,
partitionWall, the old fold guard). A dedicated error class was considered and
rejected: no consumer branches on error type yet; introduce one when the log parser
(a real external boundary) exists.

## D6. Step function shape: private, mutating fold-local state

`foldRecord` builds the dealt state (fresh arrays, as today), then applies each action
via a module-private `applyAction(state, action, index)` that **mutates the fold-local
state in place**. Purity is preserved at the contract level — the record is never
touched, all arrays are fresh per fold, same record → same state forever; in-place
mutation of arrays no one else can see yet is invisible outside and avoids per-action
churn of six arrays.

**Not exported (yet):** the public contract is "log in → legal actions / next state
out" (architecture §2); exporting a stepper invites the app to hold non-authoritative
intermediate state, violating "nothing but the fold is authoritative."
T-003-01-02 (legal-actions-surface) owns the other half of the contract; its agreement
test can drive `foldRecord` over extended logs (n ≤ 140, refolding is trivially cheap),
and if it decides the stepper should be public, that is its design call to make.

**Module placement:** everything stays in `record.ts`. The action vocabulary, the
record, the state, and the fold are one contract layer; splitting a `step.ts` out now
would separate the step from the types it interprets for no consumer benefit. The
module stays well under the size where cohesion argues for a split.

## D7. Impact on existing tests (accepted, scoped)

- record.test.ts #1 (explicit-composition property) learns the four new post-deal
  field values; #3 (freshness) gains pond-array assertions; #5 (conservation) gains
  pond/drawn terms; #6 (rejects non-empty log) is **replaced** by the D5 throw matrix —
  the old test's *spirit* (uninterpretable ≠ silent) survives as the unknown-type case.
- The seed-1 frozen golden passes unchanged (additive fields aren't asserted by it);
  a maximal-log ryuukyoku case and an interleaved-actions case are new tests owned by
  this ticket. The full dynamic property suite (random legal sequences) is explicitly
  T-003-01-03's — this ticket ships example-based record tests plus modest properties
  that don't need a legal-sequence generator.
- App code compiles untouched: TableState growth is additive; App.svelte's empty-log
  fold and Table.svelte's reads are unaffected.
