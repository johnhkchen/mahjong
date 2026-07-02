# T-004-01-01 — chi-pon-claim-fold-semantics — Research

Descriptive map of what exists, where, and how it connects. No solutions proposed here.

## The ticket in one line

Give the fold its first interruption semantics: extend `HandAction` with chi/pon claims
and `TableState` with per-seat melds, so a fresh discard becomes claimable, the turn
jumps to the caller (who must then discard), and illegal claims throw `RangeError`
naming the action index — the log staying the single authority throughout.

## Scope boundaries drawn by sibling tickets

E-004's DAG splits the call work cleanly; this ticket is the *fold* half only:

- **T-004-01-02 (kan, depends on this)** adds daiminkan/ankan/shouminkan, rinshan draws
  from `dead[0..3]`, and kan-dora flips. Its AC names the conservation formula
  `hands + melds + ponds + drawn + live + dead == 136` — so melds introduced *here*
  must slot into that partition.
- **T-004-01-03 (legalActions claim offers, depends on this + kan)** grows the *offered*
  half. **This ticket does not touch `legal.ts`** — between the two tickets the fold
  will accept chi/pon actions that `legalActions` doesn't yet offer, which the epic's
  ordering deliberately tolerates.
- **T-004-01-04 (dynamics property suite)** extends `dynamics.test.ts` to sample claims.
  This ticket only needs to keep the existing dynamics suite green.
- **T-004-02-01/02 (app drive + UI)** later consume the melds/claim-window state shape.

Acceptance is in `record.test.ts`: seeded logs containing chi (left neighbor only) and
pon (any seat) fold to exposed melds, a claimed-tile mark in the discarder's pond, turn
jumped to the caller who must then discard, deterministic pon-over-chi resolution from
the record, and RangeError (naming the index) for wrong-tile / wrong-seat /
stale-discard claims.

## The fold today (src/core/record.ts, 213 lines)

### HandAction (record.ts:30) — the frozen, extend-only vocabulary

`{type:'draw', seat}` | `{type:'discard', seat, tile: TileId}`. The doc block freezes
three conventions that constrain any extension:

- **Every action carries the acting `seat`** — deliberately redundant; a wrong-seat
  action is corruption and the fold throws loudly (the exact mechanism the AC's
  wrong-seat-claim case needs).
- **`draw` records no tile** — the seed's wall order is the single authority; recording
  a tile would create a second authority. (A claim is different in kind: the claimed
  tile is already public in a pond, and the consumed tiles are hand-private choices —
  there is no wall-order authority for *which copies* a claimer exposes.)
- **Extend-only**: "calls, riichi, and agari tickets add members; existing members
  never change shape."

### TableState (record.ts:58) — a derived view, explicitly growable

`hands` (4 × draw-ordered, never sorted), `live`, `dead`, `doraIndicator`, `dora`,
`ponds` (4 × discard-ordered — "the order IS the pond's meaning (future defense reads
depend on it)"), `turn`, `drawn`, `phase: 'playing' | 'ryuukyoku'`. The doc block says
outright: "this shape may grow fields (discard piles, melds, turn) in later tickets
without invalidating any stored hand." Melds are pre-announced.

Documented invariant: "Every tile id lives in exactly one of hands / ponds / drawn /
live / dead at all times" (record.ts:87-89) — the conservation partition that both the
record.test.ts and dynamics.test.ts suites assert with 136-count + Set-uniqueness.

### applyAction (record.ts:118) — the turn cycle and its throw style

A switch over action type, mutating fold-local state. The cycle: `drawn === null` → the
turn seat draws `live[0]`; `drawn !== null` → the turn seat discards (tsumogiri pushes
the drawn tile to the pond; tedashi splices the hand tile out, **appends** the drawn
tile, pushes to pond); after a discard, empty live wall → `phase = 'ryuukyoku'`, else
`turn` advances `(turn+1) % 4`. Every guard throws
``RangeError(`action ${index}: …`)`` — wrong seat, out-of-sequence draw/discard, unheld
tile, action after end, unknown type. The unknown-type default arm catches untyped-JS
corruption (tested with a `'riichi'` literal — still unknown after chi/pon are added).

**Key structural fact for claims:** after a discard the fold *forgets* it. Nothing
records which tile was discarded last or whether the next seat has since drawn — the
state cannot currently distinguish "fresh discard, claimable" from "stale". Also,
`turn` is advanced to the next rotation seat *immediately* on discard, and the pair
`(drawn === null, at-start-of-turn)` is the only pre-draw shape; a post-claim
"must discard without drawing" state is not expressible.

### foldRecord (record.ts:197) — the entrypoint

Builds wall → partition → deal → dora, then `actions.forEach(applyAction)`. Pure, fresh
arrays out, record never mutated. Replay/undo/review are folds over prefixes.

## The tile domain (src/core/tiles.ts)

`TileId` = 0..135, `kindOf(id)` → `TileKind` (mpsz: `'1m'`…`'7z'`), `suitOf`,
`rankOf` (null for honors), `kindIndexOf` (canonical 0..33). Chi legality (three
consecutive ranks, one numbered suit, honors excluded) and pon legality (same kind,
distinct physical copies) are directly expressible with these helpers — nothing new is
needed from the tile layer. Copies of a kind are distinct ids (`copyOf`), so a claim
naming *physical* tiles is unambiguous about which copies leave the hand (red-five
distinctions arrive later but are already id-distinct).

## Seats and rotation (src/core/deal.ts)

`Seat = 0|1|2|3` (E,S,W,N), `SEAT_COUNT = 4`. Turn rotation is `(turn+1) % 4`. "Left
neighbor" in riichi (the only seat allowed to chi) is the discarder's shimocha — the
next seat in rotation: chi caller `c` claims from discarder `(c+3) % 4`, equivalently
`c === (discarder+1) % 4`, which is exactly the seat the fold already advances `turn`
to after a discard.

## The offered half (src/core/legal.ts) — read-only context

`legalActions(state)` enumerates: ended → `[]`; `drawn === null` → the turn seat's
single draw; `drawn !== null` → 14 discards. Explicitly extend-only, with claim
enumeration assigned to T-004-01-03. Consequence to respect: at a claim-window state
(post-discard, pre-draw) `legalActions` keeps offering the rotation seat's draw — the
fold must keep accepting that draw (an unclaimed discard just plays on).

## Test surfaces that constrain the change

- **record.test.ts (325 lines)** — wall-derived expectations over tsumogiri records;
  frozen seed-1 goldens (East's hand `[64, 53, …]`, first draws `[100, 60, 14, 66]`,
  South's hand starts `98`); an empty-log fold asserted against a *complete* TableState
  literal (any new field must appear there); conservation asserts every hand stays 13
  tiles (true only for meld-free records); an illegal-actions suite built on
  `expectThrows(prefix, bad, fragment)`. New claim tests land in this file per the AC.
- **legal.test.ts (230 lines)** — the agreement suite. "Offered ⇒ folds" stays sound
  (claims only *add* accepted actions). The negative side ("outside ⇒ throws") tests
  only draw/discard candidates, all of which must keep throwing; the 548-candidate
  partition at seed 1 never reaches a claim-window-with-legal-claim state for those
  candidates' sake — claims don't change draw/discard legality at any state.
- **dynamics.test.ts (261 lines)** — random-legal trajectories via `legalActions`, so
  no claim is ever generated; conservation uses `allZones` (hands/ponds/drawn/live/
  dead — extended by T-004-01-04, but must not silently miss meld tiles *this* ticket
  introduces if hands shrink); mutation operators splice draw/discard mutants only.
- **purity.test.ts** — core files must stay platform-import-free.
- **app.ssr.test.ts / drive.test.ts** — compile-level consumers of `TableState`
  (`hands`, `ponds`, `turn`, `drawn`, `phase` in Table.svelte; `legalActions` output in
  drive.ts). Additive TableState fields don't disturb them; `just check` covers it.

## Riichi domain facts the AC encodes

- **Chi**: only the discarder's right-hand neighbor (next in turn order) may chi, and
  only to complete a run — claimed kind + two hand kinds forming three consecutive
  ranks in one numbered suit (honors can never be chi'd).
- **Pon**: any non-discarder seat holding two copies of the discarded kind.
- **Precedence**: a pon outranks a simultaneous chi. In a *record*, only the claim that
  actually happened is logged — "pon-over-chi resolution is deterministic from the
  record" means the log is the resolution; the fold replays whichever single claim the
  record contains against the same fresh discard.
- **After a claim** the caller exposes the meld (claimed tile + two hand tiles),
  does **not** draw, and must discard; play then continues from the caller's right.
- **Staleness**: a discard is claimable only until the next seat draws (or another
  claim consumes it). The current fold ends the hand the moment the wall-emptying
  discard lands (`phase = 'ryuukyoku'`), so the last discard is never claimable —
  which matches the standard rule that no chi/pon is allowed on the final discard.
- **Pond semantics**: the claimed tile physically leaves the pond for the meld, but
  the pond *position* stays meaningful (furiten and defense reads treat a claimed
  discard as still discarded). The AC's "claimed tile is marked in its discarder's
  pond" asks the fold to keep that fact legible in TableState.

## Constraints carried into Design

1. The record stays the only authority: melds, claim windows, and turn jumps must all
   be *derived by folding*, never stored beside the record.
2. HandAction is extend-only and every action carries its seat; new members must throw
   on wrong seat/tile/timing with `RangeError` naming the index.
3. The 136-tile partition must stay airtight once melds exist — every id in exactly
   one zone, with T-004-01-02's formula already naming melds a zone.
4. `hands` stay draw-ordered and never sorted; ponds stay discard-ordered with their
   order meaningful; existing frozen goldens and the empty-log TableState literal must
   keep folding byte-identical modulo the new fields.
5. `legal.ts` untouched; existing legal/dynamics suites must stay green unmodified in
   spirit (only additive TableState-shape edits where literals are asserted).
