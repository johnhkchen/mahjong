# Research — T-009-01-01 riichi-declaration-lock-and-stick

## 1. Ticket text and dependency

AC: folding a riichi declaration locks the seat (post-riichi discards forced tsumogiri, its
claim offers vanish) and moves 1000 into the pot; the next win settles the pot to the winner
and a ryuukyoku carries it to the following hand; illegal riichi (open hand, noten, <1000
points, no draws left) throws by action index; the agreement suite (legal.test.ts /
legal.win.test.ts style) covers the new offers.

`depends_on: [T-008-03-02]`, `status: done`. That ticket wired `App.svelte` to `GameRecord`/
`foldGame` (game.ts) so a session now carries `scores`/`dealer` across hands via `hands:
HandAction[][]`, unrelated in code surface to this ticket but establishing that GameRecord
already threads real per-hand state (seed derivation, running scores) hand-to-hand — the
mechanism this ticket's pot-carry will extend.

Sibling story tickets (S-009-01, not yet started, all `depends_on: [T-009-01-01]` or later):
`T-009-01-02` (riichi/double-riichi/ippatsu yaku + uradora pricing), `T-009-01-03` (temporary +
riichi furiten completion), `T-009-01-04` (riichi property suite). **This ticket is scoped to
the mechanic only — lock, forced tsumogiri, no-calls, the stick/pot movement, and the
legality gate — NOT the riichi yaku itself (no han/scoring), NOT furiten extensions.** Those
are separate, dependent tickets by design; `yaku.ts`'s and `han.ts`'s own header comments
already say "no riichi declaration exists in the action vocabulary yet" and defer the whole
riichi yaku family and ura-dora to "when it does."

`T-009-02-01`/`T-009-02-02` (bot riichi policy, dynamics suite) and `T-009-03-01` (the UI
tenpai/riichi prompt) all `depends_on: [T-009-01-01]` too — meaning this ticket's engine
surface (the new `HandAction` member, `legalActions` offers, and whatever `SeatView` fields a
future bot policy needs) must be self-sufficient for those tickets to build on without
touching `record.ts`/`legal.ts` again.

## 2. The action-log vocabulary today (`record.ts`)

`HandAction` is a closed, frozen-format discriminated union (draw/discard/chi/pon/daiminkan/
ankan/shouminkan/tsumo/ron) — explicitly "extend-only" (module header: "calls, riichi, and
agari tickets add members; existing members never change shape"). No riichi member exists.
Each call form is atomic: it validates against an open window, mutates hand/melds, and leaves
an explicit obligation (`mustDiscard`) for a FOLLOW-UP discard action — except win forms, which
end the hand outright. There is no precedent for an action that both declares something AND
performs a discard in the same atomic step; chi/pon come closest (claim + meld, discard
deferred), but riichi's real-table shape is "declare and discard together, right now."

`applyAction`'s dispatch (record.ts:780-897) is a switch over `action.type`; the ordinary
`discard` case (814-863) has three arms — mustDiscard's claim-discard-from-hand, tsumogiri
(`tile === state.drawn`), and tedashi (hand tile leaves, drawn tile appended) — then a shared
tail: if `live.length === 0` the phase flips to `'ryuukyoku'`, else the turn advances
E→S→W→N and the discard opens `state.claimable`. This tail logic is exactly what a riichi
action's own discard half must reuse.

`TableState` (record.ts:162-272) has no notion of scores or sticks at all. Its per-seat arrays
(`hands`, `ponds`, `melds`) are all `readonly [T, T, T, T]` Seat-indexed tuples — the shape any
new per-seat riichi-lock array would follow. `foldRecord(record: HandRecord): TableState` takes
exactly one argument; `HandRecord` is `{ seed, actions }`, documented as "this pair and
nothing else" — nothing external is threaded into a fold today.

## 3. Score/pot are entirely absent below the game layer — the central gap

`settlement.ts`'s own header is explicit: *"No honba, no riichi sticks: neither exists in
TableState yet (no match/round structure, no riichi declaration in the action vocabulary —
han.ts's own header), so this prices exactly one hand's base settlement."* `settlementOf`
(350-363) returns four deltas that **always sum to zero** today (module header: "points
change hands, never appear or vanish") — ron/tsumo payments and noten-bappu are both zero-sum
by construction.

`game.ts`'s `foldGame` (148-182) is the only place a *running* score exists
(`GameState.scores`, Player-indexed, starting at `STARTING_SCORE = 25000` each, accumulated
hand-by-hand via `settlementOf`'s deltas remapped Seat→Player through the per-hand `dealer`).
Nothing below `game.ts` has ever needed to read a running score before — the AC's "≥1000
points" riichi gate is the *first* rule that requires per-hand fold logic (which lives in
`record.ts`/`legal.ts`, operating on one `TableState`) to know a fact that today only exists one
layer up, in `GameState`.

There is no "pot" concept anywhere (`grep -rn "pot\b" src/core/*.ts` outside `.test.ts` only
turns up unrelated "noten-bappu pot" prose in `settlement.ts`). Carrying a stick pot across
hands (the AC's "ryuukyoku carries the pot forward through the GameRecord fold") is new
plumbing in `game.ts` on top of what T-008-03-02 already built for scores/dealer/seed.

## 4. `legal.ts`'s offer/fold independence, and what riichi needs to check

`legal.ts`'s header states its defining discipline: it **never imports record.ts guard logic**
— every rule legality enumerates is *re-stated* independently, locked to the fold only by the
agreement test suite (`legal.test.ts`, `legal.win.test.ts`). Riichi's offer function must
follow this: recompute closed-hand-ness, tenpai, score, and live-wall facts itself, not call
into whatever `record.ts`'s own `applyRiichi` guard uses internally (though both may share the
same *predicate* implementations by value, per the `isMenzen` precedent below — sharing an
export is different from importing "guard logic").

`isMenzen(melds)` — "a hand is closed iff its only melds are ankan" — is independently
duplicated verbatim in `yaku.ts`, `han.ts`, and `fu.ts` already (three copies, `grep -n
isMenzen` confirms). This is a *documented, deliberate* convention in this codebase (see
`policy.ts`'s and `settlement.ts`'s duplicated `windKindOf`/`ROUND_WIND` with the same framing:
"matching the established codebase convention of duplicating tiny per-seat formulas across
modules rather than widening a module's public surface"), not an oversight. A fourth/fifth copy
in `record.ts` and `legal.ts` for the riichi gate follows this precedent directly.

`shanten(concealed, melds)` (shanten.ts) returns `0` at tenpai; `settlement.ts`'s
`tenpaiFlagsOf` already computes exactly the closed-hand-agnostic "is this seat tenpai"
predicate for noten-bappu. Riichi's own gate is narrower and per-tile: "does removing THIS
candidate tile leave the 13-tile hand at shanten 0" — the same shape `discardPolicy`
(policy.ts) already computes per candidate discard for its own tie-break (`shantenAfterDiscard`,
policy.ts:82-91), just for a different purpose (tie-break vs. legality gate). No shared helper
exists between `policy.ts` and `legal.ts` today — each module restates its own shanten-per-
candidate loop, consistent with the "restate, don't share guard logic" convention.

Neither `record.ts` nor `legal.ts` currently imports `./shanten` (checked via grep on both
files' import blocks). Adding that import is new but unremarkable — `shanten.ts` itself only
imports `./tiles` and `type { Meld } from './record'` (type-only, so no runtime circularity if
`record.ts` imports `{ shanten }` as a value from `./shanten`).

## 5. `legalActions`'s frozen enumeration order and what riichi may touch

The module's own doc-comment (legal.ts:249-289) freezes exactly two positions across tickets:
"the draw-first / 14-discard-prefix positions stay stable" — and explicitly sanctions
index-shifting elsewhere, citing its OWN precedent: a prior ticket "shifted the claim-block and
kan-block indices by inserting the win offers ahead of them — within the promise, which froze
only those two positions." A new riichi offer block inserted after the 14 discards (before
tsumo/ankan/shouminkan) is exactly this same sanctioned move, and the doc-comment already
anticipates it by name: *"riichi tickets grow this enumeration (and this module)."*

`claimOffers` (154-199) enumerates chi/pon/daiminkan for every non-discarder seat with no
per-seat eligibility gate today (only "does this seat hold the copies"). "The riichi seat makes
no calls" requires excluding riichi-locked seats from this scan. `ronOffers` (114-125) is seat-
scanned identically but must NOT be touched — ron stays offered to a riichi-locked seat (the
AC's explicit "win offers excepted").

`ankanOffers`/`shouminkanOffers` (207-247) both gate on `kanAllowed(state)` (live wall +
rinshan-tile-remaining) only, per-seat-agnostic today (always the turn seat, since kans are
own-turn-only). "Kan after riichi is disallowed in this slice" requires an additional
`!state.riichi[seat]` gate on both, OR simply skipping both calls in `legalActions`'s
drawn-branch when the turn seat is locked.

## 6. `SeatView`'s fair-play boundary and what future tickets will need from it

`seatview.ts`'s doctrine: every field is a "legitimate," fully public fact (ponds, melds, dora
indicators, phase, claimable, mustDiscard, win) or the seat's own concealed tiles — nothing
hidden ever leaks. A riichi lock (physically: a sideways tile in the pond) and the stick pot
(physically: sticks visible on the table) are BOTH fully public real-world facts. `T-009-02-01`
("bot-riichi-policy") depends only on this ticket and says its policy still reads "nothing
beyond SeatView" — meaning any table fact its policy needs (at minimum, "is riichi offered,"
which comes from `offered: HandAction[]`, not `SeatView`) must already be exposed here if it
needs anything beyond the offered-set membership test every other policy arm already uses.

`seatview.fairplay.test.ts` quantifies "hidden-tile-permutation invariance" over the WHOLE
`SeatView` object (`toEqual`, deliberately not field-by-field) — any field widening is
automatically dragged into that equivalence check. Widening `SeatView` with public,
non-tile-identity data (booleans/numbers) cannot fail that specific test (it permutes tile
identities only), but the suite is the correct one to re-run once riichi fields land.

## 7. Existing conservation invariants this ticket must not silently break

`settlement.ts`'s docstring: `SeatDeltas` "always summing to zero." `game.dynamics.test.ts:206`
pins `state.scores.reduce(...) === 4 * STARTING_SCORE` — i.e. **total player score is invariant
at 100000**, exactly because per-hand deltas sum to zero today. A riichi stick that leaves a
seat's score but sits in an un-claimed pot (surviving a ryuukyoku) necessarily breaks
*this exact* per-hand zero-sum property — money can sit on the table, outside every seat's
score, between hands. `T-009-01-04`'s own (not-yet-started) AC already names the corrected
invariant directly: *"points + pot always sum to 4×25000."* This ticket's settlement changes
must preserve THAT invariant, not the older zero-sum-per-hand one — the older one becomes
false exactly when a riichi stick is placed and the hand ends without a winner.

`scoreBreakdownOf` (settlement.ts:378-409) is documented to share every arithmetic step with
`settlementOf` "so the two functions can never disagree on a payment" — any riichi-stick delta
adjustment must be threaded through both, from one shared implementation, or the UI
(`HandEnd.svelte`, T-008-03-01) will silently disagree with the real running score the next
"next hand" reads from `GameState.scores`.

## 8. Test-authoring convention this ticket must follow

Every test file mines REAL seeds and replays real `HandAction` logs through `foldRecord`/
`legalActions` (record.test.ts's `tsumogiriRecord`/`maximalRecord`, legal.test.ts's
`fourKanChain`/`kanMaximalRecord280`) — no test hand-constructs a bare `TableState` object.
Reaching a genuinely closed-tenpai `TableState` for riichi fixtures will require either mining
a real seed to that shape (the established, if laborious, convention — `game.test.ts`'s header:
"game seeds MINED offline... not committed [the mining script]") or driving a short synthetic
tsumogiri-style record by hand toward a specific known-tenpai hand shape (cheaper, and already
how e.g. `legal.win.test.ts` likely sets up win fixtures — worth confirming in Plan).

## 9. Constraints carried into Design

- `HandRecord` should stay exactly `{ seed, actions }` — no test call site (`foldRecord({ seed,
  actions })`, ~15+ files) should need to change. Any new per-hand score/pot input must be an
  ADDITIONAL, optional parameter or field, defaulting to fresh-game values (25000 each, pot 0).
- `legalActions(state: TableState)` takes no second parameter — whatever the riichi score gate
  needs must be reachable FROM `state` alone, meaning `TableState` itself must carry it.
- The riichi HandAction folds an atomic declare+discard, reusing (via a shared internal helper)
  the exact tail logic `applyAction`'s `discard` case already has for phase/turn/claimable.
- `settlementOf` and `scoreBreakdownOf` must apply identical riichi-stick delta logic, sourced
  from one shared computation, matching their existing `bestReadingOf`/`ronDeltas`/`tsumoDeltas`
  sharing discipline.
- `game.ts` must thread a carried pot (and each hand's starting scores, Seat-remapped from its
  Player-indexed running total) hand-to-hand, mirroring the existing `handSeedOf`/dealer-
  rotation threading it already does.
