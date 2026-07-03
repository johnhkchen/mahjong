# Design — T-009-01-01 riichi-declaration-lock-and-stick

## Decision 1 — riichi is one atomic `HandAction` (declare + discard), not two actions

**Chosen**: widen `HandAction` with
`{ type: 'riichi'; seat: Seat; tile: TileId }` — same shape as `discard`, one new
discriminant. Folding it validates riichi legality, THEN performs exactly the discard
(tsumogiri or tedashi) that `discard` would, THEN locks the seat and adds the stick to the pot.

**Why**: the physical action is one motion — turn the tile sideways and discard it — and
every other multi-effect step in this vocabulary (chi/pon: claim + meld in one action) is
already atomic by the same reasoning (record.ts's header: "the seat tag is deliberate
redundancy," "the claimed tile is derivable... recording it is the seat-tag redundancy
again"). A hand that reaches an illegal riichi (noten, open, poor, no draws left) must throw
BEFORE any mutation — atomicity is what makes "throws instead of folding silently" clean:
there is no half-declared, half-discarded state to unwind.

**Rejected: a bare `{ type: 'riichi'; seat }` declare-only action, followed by an ordinary
`discard`.** Two log entries per declaration doubles the action count for every riichi (matters
for `T-009-01-04`'s action-bound arithmetic) and reintroduces exactly the "obligation between
two actions" shape `mustDiscard` already models for calls — but riichi's follow-up discard has
a STRICTER constraint (must leave/keep tenpai per the chosen tile, forced tsumogiri from then
on) that a bare boolean flag can't express as cleanly as validating the whole discard
atomically. Also: what enforces that no OTHER action (a chi, a second declare) sneaks in
between "declare" and "discard"? The atomic-action design has no such gap to guard.

## Decision 2 — `TableState` gains `riichi` (lock flags) and `pot` (running stick total);
score input arrives via a new, optional fold-context parameter — NOT via `HandRecord`

**Chosen**:
- `TableState.riichi: readonly [boolean, boolean, boolean, boolean]` — Seat-indexed, all
  `false` from a fresh deal, seat `i` flips permanently `true` the moment its riichi action
  folds. Mirrors `hands`/`ponds`/`melds`'s existing tuple shape.
- `TableState.pot: number` — starts at the incoming carried pot (see below), `+= 1000` per
  riichi action folded. Mirrors `doraIndicators`'s "starts at one value, grows through the
  fold" shape.
- `foldRecord(record: HandRecord, context?: RiichiContext): TableState`, where
  `interface RiichiContext { readonly scoresIn: readonly [number, number, number, number];
  readonly potIn: number }`, defined in `record.ts` next to `HandRecord`. Omitted `context`
  defaults to `{ scoresIn: [25000, 25000, 25000, 25000], potIn: 0 }` — a **fresh, first hand of
  a fresh game**, exactly the assumption `settlement.ts`'s existing `STARTING_SCORE_DISPLAY`
  already makes for a standalone hand.
- `TableState` itself does NOT store `scoresIn` — the gate reads `context.scoresIn[seat]`
  directly inside `applyRiichi`/`legalActions`'s own local closure over the same context.
  Actually: `legalActions(state)` takes no context parameter (research.md §9's hard
  constraint) — so `scoresIn` MUST live on `TableState` for `legalActions` to read it (see
  §"scoresIn placement" below). Correcting: `TableState` gains a THIRD new field,
  `scoresIn: readonly [number, number, number, number]` — the context's `scoresIn` copied
  through verbatim (never mutated across the fold; a seat can riichi at most once, so no
  running decrement is needed — the gate is a single point-in-time comparison against the
  hand's OWN starting total).

**Why an optional fold-context parameter, not a widened `HandRecord`**: `HandRecord`'s own
doc-comment is stronger than `TableState`'s ("this pair and nothing else," vs. TableState's
"may grow fields... extend-only") — it is explicitly the REPLAY FORMAT, and the wall/action log
alone already fully determines tile identities forever. Score/pot context is not part of what
makes the WALL replay deterministic; it is supplied by whichever game-level fold is running
this hand, exactly the same way `handSeedOf` computes a hand's `seed` and hands it to a
FRESH `{ seed, actions }` object without `HandRecord`'s TYPE ever growing a "how was this seed
derived" field. `foldRecord`'s existing single-argument call sites (15+ files) all keep
compiling unchanged; only `game.ts` needs the second argument.

**Rejected: widen `HandRecord` with optional `scoresIn`/`potIn` fields.** Structurally this
also leaves every existing `{ seed, actions }` literal type-valid (TypeScript doesn't require
optional fields), so it was a close call. Rejected because a `HandRecord` is meant to be a
freestanding, storable, replayable unit ("a bug report is a hand log") — silently defaulting
its score/pot context on read is more surprising for a stored/loaded record than for a
transient function-call parameter that's obviously "extra input the caller must supply for
full fidelity," and it keeps `HandRecord`'s shape exactly what `record.ts`'s own header says it
is, unchanged by this ticket.

**Rejected: no score gate in the fold at all; defer "<1000 points" entirely to a driver-level
convention (undocumented in the engine).** The AC explicitly requires an illegal riichi
(named, "<1000 points") to throw BY ACTION INDEX from folding the record — that is `record.ts`'s
job specifically (every other illegal-action case in this codebase throws from `applyAction`,
never from a caller-side convention). Not implementing the gate in the fold would leave the
ticket's own acceptance criterion unmet.

## Decision 3 — `legal.ts` restates the same four gates independently, per its own doctrine

**Chosen**: a new `riichiOffers(state)` in `legal.ts`, following the "re-state, don't import
record.ts guard logic" rule the module's header already commits to. For each of the same 14
discard candidates `discardOffers`-equivalent code already iterates (13 hand tiles + drawn),
compute: `!state.riichi[seat]` (not already locked), `isMenzen(state.melds[seat])` (closed,
duplicated locally per the established `windKindOf`/`isMenzen` precedent), `state.scoresIn[seat]
>= RIICHI_STICK`, `state.live.length > 0`, and — the per-tile test — `shanten(remaining 13
kinds, melds) === 0`. Every candidate tile passing all five is its own
`{ type: 'riichi', seat, tile }` offer (mirrors ordinary discards: one offer per qualifying
tile, not a single collapsed action).

**Why per-tile, not a single flag-style offer**: a hand can (rarely) be tenpai-preserving from
more than one discard (e.g. a hand with two independent complete-shape excess tiles) — treating
riichi as "an alternate form of SOME of the 14 discards" (exactly parallel to how `tsumo` is "an
alternate form of the just-drawn tile") keeps the enumeration a pure per-candidate predicate,
no separate aggregate step, and the offered order stays the frozen "one action literal per
legal choice" contract every other offer in this module already follows.

**Rejected: reuse `discardPolicy`'s `shantenAfterDiscard` from `policy.ts` by importing it.**
`legal.ts` importing from `policy.ts` (or vice versa) would cross the "legality is a full-state
concern, policy consumes only offered+SeatView" layering `seatview.ts`'s header establishes;
each module already independently restates tiny per-candidate shanten loops (precedent:
`policy.ts` and `settlement.ts`'s `tenpaiFlagsOf` do this too, for their own different
purposes). A one-line local helper in `legal.ts` costs nothing and stays consistent.

## Decision 4 — the lock suppresses claim eligibility and kan offers, but never ron

**Chosen**: `claimOffers(state)`'s three seat-scan loops (pon, daiminkan, chi) each add a
`!state.riichi[seat]` guard alongside the existing "does this seat hold the copies" check.
`legalActions`'s `drawn !== null` branch, when `state.riichi[state.turn]` is true, returns
exactly `[{ type: 'discard', seat, tile: drawn }, ...tsumoOffer(state)]` — skipping the 13
hand-tile discard offers, `riichiOffers` (already locked), `ankanOffers`, and
`shouminkanOffers` entirely, rather than adding a fourth `!state.riichi[seat]` guard inside
each of those three functions separately.

**Why one branch-level short-circuit over three internal guards**: every one of the
suppressed offer classes (13 hand discards, ankan, shouminkan) is ALREADY iterated inside the
same `drawn !== null` branch that already special-cases `state.turn`/`drawn` — a single early
return there is one guard read once, versus three near-duplicate guards scattered across
`ankanOffers`/`shouminkanOffers`/the hand-discard map with more surface for one to be missed on
a future edit. `ronOffers`/`tsumoOffer` are untouched by construction (called from a different
branch shape / kept in the reduced return) — nothing needs a "but not for wins" carve-out.

**Rejected: gate inside `ankanOffers`/`shouminkanOffers` themselves.** Marginally more
defensive (correct even if some future caller invokes them out of `legalActions`'s own
branching), but no such caller exists today, and the branch-level cut is the smaller, more
legible diff for what the AC actually asks for ("the riichi seat makes no calls").

## Decision 5 — the fold reuses one shared discard-tail helper for `discard` and `riichi`

**Chosen**: extract the existing `discard` case body's three-arm hand/pond mutation plus its
shared phase/turn/claimable tail (record.ts:814-863) into a private
`performDiscard(state, seat, tile, index, action)` (name TBD in Structure), called from both
the ordinary `discard` case and the new `applyRiichi`. `applyRiichi` calls it, then sets
`state.riichi[seat] = true; state.pot += RIICHI_STICK`.

**Why**: this is the ONLY way to guarantee the riichi discard's turn-advance/claimable-window/
ryuukyoku-phase-flip behavior can never drift from ordinary discard's — the exact
"one authority for what folds" discipline `record.ts`'s header already states for every other
shared tail (`applyKanTail`, `applyWinTail`).

## Decision 6 — `settlementOf`/`scoreBreakdownOf` apply riichi-stick deltas through one shared
private function; the per-hand zero-sum contract is explicitly revised

**Chosen**: a new private `riichiStickDeltas(state): SeatDeltas` in `settlement.ts`:
`-RIICHI_STICK` for every seat with `state.riichi[seat]`, else `0`. Both `settlementOf` and
`scoreBreakdownOf` compute their existing base deltas (`ronDeltas`/`tsumoDeltas`/
`notenBappuOf`) exactly as today, add `riichiStickDeltas(state)` element-wise, and — agari
only — add `state.pot` to the winner's delta. `ryuukyoku` leaves `state.pot` untouched in the
delta (it is not distributed; it carries via `game.ts`, Decision 7). The module header's
"always summing to zero" claim is corrected in place to state the real invariant precisely:
per-hand deltas sum to `potIn` on an agari ending (the incoming carried pot, since this hand's
OWN new sticks cancel against the pot they fed) and to `-1000 × (declarations this hand)` on a
ryuukyoku ending — conservation instead holds at `sum(scores) + pot`, constant at 100000,
across hand boundaries (verified algebraically below).

**Conservation check** (both endings, `k` = riichi declarations this hand, `potIn` = incoming
pot): agari sum = `0 (ron/tsumo base) + (-1000k) (sticks) + (potIn + 1000k) (pot to winner) =
potIn`. Ryuukyoku sum = `0 (noten-bappu base) + (-1000k) = -1000k`; the NEXT hand's `potIn` is
`state.pot = potIn + 1000k`. Either way, `sum(scores after) + pot(after) === sum(scores before)
+ pot(before)` exactly — the invariant `T-009-01-04` will assert, satisfied by construction.

**Why one shared function, not independent per-caller logic**: `scoreBreakdownOf`'s own header
already states the discipline this decision extends: "the two functions can never disagree on
a payment." A riichi stick is a payment fact exactly like a ron/tsumo transfer; computing it
twice independently is exactly the drift risk that header exists to prevent.

**Rejected: distribute the pot even on ryuukyoku, split like noten-bappu.** Not the real rule
(sticks are UNCLAIMED on a draw, they sit for the next winner) and directly contradicted by the
AC's own wording: "a ryuukyoku carries the pot forward."

## Decision 7 — `game.ts` threads `scoresIn`/`potIn` per hand and exposes `GameState.pot`

**Chosen**: `foldGame` gains a local `let pot = 0` alongside its existing `let dealer`/`scores`.
For hand `index`, before folding it: `scoresIn = seatWindsOf`-style remap —
`[0,1,2,3].map(seat => scores[playerOfSeat(dealer, seat)])` (the exact `playerOfSeat` formula
already used for the settlement-delta remap, one line further down the same loop body) — call
`foldRecord({ seed: handSeedOf(...), actions: record.hands[index] }, { scoresIn, potIn: pot })`.
After computing `state` and (if ended) `settlementOf(state)`'s deltas: `pot = state.phase ===
'agari' ? 0 : state.pot` becomes next iteration's carried value. `GameState` gains
`readonly pot: number`, set to `table!.pot` at the end (the active hand's own current pot,
already correctly threaded whether the active hand is still `'playing'` or already ended).

**Why remap scores the same way the settlement-delta loop already does**: `game.ts`'s header
already documents Seat-vs-Player as "the key fact this module leans on" — `scoresIn` needs
Seat-indexing (matching `TableState`'s own Seat-relative convention) computed from the
Player-indexed running `scores`, exactly mirroring the existing delta-application line
(`scores[playerOfSeat(dealer, seat)] += deltas[seat]`) run in the opposite direction.

## Decision 8 — `SeatView` gains `riichi` and `pot` (public facts); NOT `scoresIn`

**Chosen**: `SeatView` widens with `riichi: readonly [boolean, boolean, boolean, boolean]` and
`pot: number`, copied straight through in `seatView`'s projection (both are already-public
`TableState` facts, exactly like `ponds`/`melds`/`doraIndicators`). `scoresIn` is NOT exposed.

**Why**: a riichi lock (a sideways discard) and the stick pot (visible sticks on the table) are
real, always-visible facts at a physical table — withholding them from `SeatView` would be the
fairness boundary hiding PUBLIC information, the opposite of its purpose. `scoresIn` is left
off because no dependent ticket's stated AC needs it (`T-009-02-01`'s bot policy text: "declare
whenever riichi is offered" — a pure `offered`-set scan, needing no score awareness) and it
would be new, unrequested scope; `seatview.fairplay.test.ts`'s hidden-tile-permutation property
is unaffected either way (neither field carries tile identity), so this is a pure YAGNI call,
reversible extend-only later if a future ticket needs it.

## Decision 9 — the "at least one draw remaining" gate reads `state.live.length > 0`

**Chosen**: identical field, identical predicate `kanAllowed` already uses for its own
"is there a tile to move to the dead wall" check — read at declaration time (before this
discard is folded), in both `legal.ts`'s offer gate and `record.ts`'s fold-time guard.

**Why**: the ticket text calls this "a documented convention," not the full real-rules "wall
must hold ≥4 tiles" nuance — this codebase already has a precedent for exactly this kind of
simplification (`ROUND_WIND` fixed at East, `record.ts`'s own headers). `live.length > 0` is the
cheapest, already-precedented field read that captures "the wall is not already exhausted" —
correct enough for a single-hand slice with no round/honba structure, and named exactly by the
ticket's own parenthetical.

## Testing strategy (elaborated in plan.md)

Four layers: (1) `record.test.ts` — fold-level riichi mining a real seed to a genuine
closed-tenpai state, asserting the lock/pot/discard-tail mutation and every named illegal-
riichi throw; (2) `legal.test.ts`/`legal.win.test.ts` — the offer-side agreement suite,
asserting offered riichi actions always fold and the lock suppresses claims/kans but not ron;
(3) `settlement.test.ts` — riichi-stick delta + pot-to-winner fixtures, hand-authored per-seat
deltas; (4) `game.test.ts` — a two-hand fixture proving `potIn`/`GameState.pot` threads across
a ryuukyoku boundary. `seatview.test.ts` gets two new field assertions on existing fixtures.
