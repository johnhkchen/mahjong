# T-008-02-01 — game-record-and-continuation-fold — Design

Options, tradeoffs, and the chosen approach, grounded in research.md.

## Decision 1 — `GameRecord` stores hand action logs only, never per-hand seeds

**Chosen**: `GameRecord = { seed: number; hands: readonly (readonly HandAction[])[] }`.
Each hand's own seed is ALWAYS derived (`handSeedOf(record.seed, index)`), never stored
alongside the actions.

**Rejected: `hands: readonly HandRecord[]`** (storing `{seed, actions}` per hand, reusing
the existing `HandRecord` shape verbatim). This creates exactly the "second authority"
problem `record.ts`'s own header spends a whole comment block warning against (draw
records no tile, tsumo records no tile, ron records no winner — "recording it would
create a second authority that could disagree with the first"). A stored per-hand seed
that disagrees with `handSeedOf(gameSeed, index)` has no principled resolution — which
wins? Never storing it removes the question. This is also strictly less data to persist
in `localStorage` (architecture.md's only persistence mechanism) — a whole game's replay
needs only ONE seed plus every hand's actions, mirroring the hand level's own economy (one
seed, one action list).

## Decision 2 — a distinct `Player` type, not a reused `Seat`

**Chosen**: `export type Player = 0 | 1 | 2 | 3` — structurally identical to `Seat` (same
literal domain) but a separate named type. `Seat` means "this hand's engine-relative
position, 0 = this hand's dealer" (frozen by `dealHands`/`windKindOf`); `Player` means "a
persistent identity across the whole game, stable while dealer rotates around it."

**Rejected: reuse `Seat` for both.** The codebase already distinguishes structurally
identical domains by name whenever the MEANING differs (`WindKind` is a string union no
different in shape from any other tagged string; `CopyIndex` is `0|1|2|3` just like `Seat`
but denotes "which physical copy of a tile kind," never mixed with a seat index in any
signature). Two functions in this module — `seatOfPlayer`/`playerOfSeat` — exist
specifically to convert between these two frames; giving them distinctly-typed parameters
means a reviewer (or `tsc`, informally, through variable-name-driven review even without
nominal branding) can see at a glance which frame a value is expressed in. This module
introduces the first player-vs-engine-seat distinction the codebase has needed — TypeScript
won't enforce it structurally (no branding is used anywhere in this codebase — `TileId` is
a bare `number`), but the naming precedent (`TileKind` vs `TileId`, `WindKind`) says name
the distinct domain concept anyway.

## Decision 3 — per-hand seed derivation: XOR with an odd-multiplier mix, not addition or stream-advance

**Chosen**:
```ts
const GOLDEN_RATIO_32 = 0x9e3779b1 // odd — multiplication mod 2^32 is a bijection
function handSeedOf(gameSeed: number, handIndex: number): number {
  return ((gameSeed >>> 0) ^ Math.imul(handIndex + 1, GOLDEN_RATIO_32)) >>> 0
}
```
**Provably collision-free** (not just empirically unlikely), the AC's exact wording: for a
FIXED `gameSeed`, the map `handIndex ↦ Math.imul(handIndex + 1, K) mod 2^32` is a bijection
on `Z/2^32Z` because `K` is odd (odd numbers are units in that ring — multiplication by a
unit is invertible, hence injective); XORing by the fixed `gameSeed` is a bijection too
(XOR by a constant is its own inverse). The composition of two bijections is a bijection,
so `handIndex ↦ handSeedOf(gameSeed, handIndex)` is injective for every `handIndex` in
`[0, 2^32)` — no two hand indices in the same game can ever derive the same seed, for any
game seed. This is a mathematical guarantee `game.test.ts` states in a comment and spot-
checks, mirroring `rng.ts`'s own CONTRACT FREEZE precedent (a derivation whose exact bits
matter forever, because a stored `GameRecord`'s replay depends on it).

**Rejected: `seed = (gameSeed + handIndex) >>> 0`.** Also provably injective for a fixed
`gameSeed` (addition by a fixed value is a bijection on `Z/2^32Z` too) — a legitimate,
simpler alternative. Rejected only for weaker seed avalanche: adjacent hand indices would
start `createRng` from adjacent 32-bit states, and while mulberry32's own mixing (per
`rng.ts`) is a reasonable per-call bit-mixer, an odd-multiplier XOR is the standard
technique (the same shape as `splitmix32`'s stream-derivation step) for turning a counter
into well-separated seeds, and costs nothing extra to write.

**Rejected: draw the *n*-th value off one `createRng(gameSeed)` stream via `nextInt`.**
Requires re-running `handIndex + 1` rng steps to derive hand *handIndex*'s seed (not O(1)),
and `nextInt`'s rejection-sampling loop over mulberry32 has no proven injectivity argument
(mulberry32's cycle structure is not analyzed in this codebase, nor generally guaranteed
full-period) — this fails the "collision-free," not just "deterministic," bar the golden-
ratio mix satisfies algebraically.

## Decision 4 — `foldGame` walks hands left to right, threading one mutable `dealer: Player`

**Chosen** (sketch; full detail in structure.md):
```ts
export function foldGame(record: GameRecord): GameState {
  if (record.hands.length === 0) throw new RangeError(...)
  let dealer: Player = 0
  const scores: [number, number, number, number] = [START, START, START, START]
  let table!: TableState
  for (let index = 0; index < record.hands.length; index++) {
    const state = foldRecord({ seed: handSeedOf(record.seed, index), actions: record.hands[index] })
    const isLast = index === record.hands.length - 1
    if (state.phase === 'playing') {
      if (!isLast) throw new RangeError(...) // a mid-game hand must be ended
      table = state
      break
    }
    const deltas = settlementOf(state)
    for (let seat = 0; seat < SEAT_COUNT; seat++) scores[playerOfSeat(dealer, seat)] += deltas[seat]
    table = state
    if (isLast) break
    dealer = state.phase === 'agari' && state.win!.winner === 0 ? dealer : nextPlayer(dealer)
  }
  return { scores, dealer, seatWinds: seatWindsOf(dealer), table }
}
```
`dealer`/`seatWinds` returned describe the ACTIVE (last) hand's dealer — i.e. "who is
dealing right now," never a prediction of the hand after next. This is the natural reading
for a UI: after folding a game through hand *h*, you want to know who dealt hand *h*, not
who deals hand *h+1* (that only exists once a new empty action list is appended for it —
which the driver does explicitly, by appending `[]`, before it starts logging hand *h+1*'s
actions).

**Rejected: return the PREDICTED next dealer instead of the active hand's.** Less useful to
a caller mid-hand (a post-hand review screen wants to say "East was Player 2 this hand,"
not "Player 3 deals next" while the current hand is still `phase: 'playing'`). The
prediction is one `nextPlayer`/renchan check away from what this design already computes
internally — a caller who genuinely wants "who deals next" can fold a `GameRecord` with an
appended empty hand and read `dealer` from that, which is exactly the shape the driver
naturally builds anyway (append `[]`, deal, then start logging that hand's actions).

**Rejected: separate `dealerOf(record, index): Player`, no dealer thread inside `foldGame`
proper.** Would force every caller wanting the CURRENT dealer to also call `foldGame`
first anyway (to know the record isn't malformed) — no real separation of concerns gained,
and it fragments the "one entrypoint, everything derived" shape `settlementOf`/`foldRecord`
both already establish.

## Decision 5 — renchan scope: dealer win only, no honba, no dealer-tenpai-ryuukyoku carry

**Chosen**: `dealerWon = state.phase === 'agari' && state.win!.winner === 0` is the ONLY
renchan trigger; every other ended hand (non-dealer win, any ryuukyoku regardless of who
was tenpai) rotates the dealer by exactly one player. Matches the ticket's own AC wording
verbatim ("repeats on a dealer win... rotates otherwise") and `settlement.ts`'s existing,
already-shipped scope cut ("No honba, no riichi sticks: neither exists in `TableState`
yet"). No honba counter is introduced by this ticket (scores/dealer/winds cover the AC;
honba is a payment-size modifier the settlement layer doesn't compute yet, so a game-level
honba count would have nowhere to be consumed).

**Rejected: dealer-tenpai-ryuukyoku also renchans (the full real-rules behavior).** More
faithful to real riichi, but the ticket's AC text explicitly narrows to "dealer win renchan,
rotate otherwise" — adding the tenpai-ryuukyoku carve-out is scope the ticket didn't ask
for and `tenpaiFlagsOf` (private to `settlement.ts`, not exported) would need exposing just
for this. Left for a future ticket if the owner wants full-fidelity renchan.

## Decision 6 — malformed-record guard: only the LAST hand may be unended

**Chosen**: iterating hands left to right, any hand at `phase === 'playing'` that is NOT
the last element throws `RangeError` — a `GameRecord` where an earlier hand never finished
is corruption (there is no way to have legitimately started a later hand). Matches the
established "loud throw on domain-inapplicable/corrupt input" convention (`settlementOf`'s
own `phase === 'playing'` throw, generalized one level).

**Rejected: silently stop folding at the first unended hand, ignoring any hands after it.**
Silent truncation hides a real bug in whatever produced the record (the "no second
authority, throw loudly instead of guessing" principle `record.ts`'s whole vocabulary is
built on).

## Decision 7 — testing strategy: real bot-driven hands, seed-mined per the `win.test.ts`/`selfplay.test.ts` precedent

Research §5 flagged the open question directly. `settlement.ts`'s own tests get away with
hand-typed `TableState` fixtures because settlement's INPUT is a `TableState`; `foldGame`'s
input is real `HandAction[]` logs that must actually fold to a real ended `TableState`
through the real `foldRecord`/AI stack — there is no lower-effort fixture level that still
exercises the real seed derivation and the real `settlementOf` call. Chosen approach,
mirroring `selfplay.test.ts`'s own house style (a local, duplicated self-play driver;
`win.test.ts`'s "fixtures were seed-mined" precedent):

1. A small self-play helper (`discardPolicy`/`callPolicy` over `legalActions`/`seatView`,
   copied — not imported — from `selfplay.test.ts`'s `selfPlay`, per that file's own stated
   doctrine of "the codebase locks independent statements by test rather than sharing
   them") drives one full hand from a given seed to `'agari'` or `'ryuukyoku'`.
2. Candidate `gameSeed` values are searched offline (a throwaway script, deleted before the
   final commit) for ones where `handSeedOf(gameSeed, 0)` self-plays to each of the three
   needed outcomes (dealer win, non-dealer win, ryuukyoku) — and one joint case where
   indices 0 AND 1 both resolve to specific outcomes, to prove renchan composes across two
   REAL hands, not just one transition. Mined constants are hard-coded with comments naming
   what was mined and why (the `TSUMO_SEED`/`FOUR_KAN_SEED` precedent).
3. Each mined `GameRecord` pairs its real hand-0 (and hand-1, for the composition case)
   action log with a trailing empty `[]` "hand just dealt" entry, so `foldGame`'s returned
   `dealer`/`seatWinds` are observable without needing a second real hand played out.
4. Expected `scores` are hand-computed in a comment as `STARTING_SCORE + settlementOf`'s
   OWN real output (already fully tested elsewhere) remapped through the by-hand dealer —
   this tests the remapping/accumulation arithmetic, not `settlementOf`'s correctness
   (out of scope, already covered by `settlement.test.ts`).
5. `handSeedOf` itself gets direct unit + property coverage (determinism, the injectivity
   argument spot-checked over a large sample, no engine involvement).

**Rejected: hand-crafted minimal `HandAction` scripts (à la `win.test.ts`'s `TSUMO_SEED`
scripted turns) instead of full bot self-play.** Would require mining a specific dealt hand
shape by hand for each of three-plus scenarios (as `win.test.ts` did for its win-detection
suite) — much more mining effort than reusing the already-competent bots, which reliably
produce all three outcome kinds over a small seed range (`selfplay.test.ts`'s own corpus
note: "seeds 0..39 hold 37 agari... 3 ryuukyoku").

## Module placement

New file `src/core/game.ts`, barrel-exported last in `src/core/index.ts` (after
`settlement.ts` — `game.ts` depends on both `record.ts` and `settlement.ts`, the deepest
dependency chain in the barrel so far).
