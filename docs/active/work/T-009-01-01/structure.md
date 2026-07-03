# Structure — T-009-01-01 riichi-declaration-lock-and-stick

## Files modified (no new files, and no `src/app/` changes — this is core-only, per S-009-03's
own separate UI tickets)

### `src/core/record.ts`

**New exports:**
- `RiichiContext` interface: `{ readonly scoresIn: readonly [number, number, number, number];
  readonly potIn: number }`, placed directly above `HandRecord`.
- `RIICHI_STICK = 1000` (exported `const`, so `settlement.ts`/`game.ts` and tests reference the
  one number, not a re-typed literal).

**`HandAction` union**: add
`| { readonly type: 'riichi'; readonly seat: Seat; readonly tile: TileId }` — placed after
`discard`, before `chi` (declaration order in the union mirrors "closest in shape to
`discard`," matching the doc-comment's per-member rationale style; exact position does not
affect behavior, only readability of the union).

**`TableState` interface**: add three fields, after `win` (the last existing field):
- `riichi: readonly [boolean, boolean, boolean, boolean]`
- `pot: number`
- `scoresIn: readonly [number, number, number, number]`

Each gets a doc-comment following the existing per-field style (what it means, when it
changes, Seat-indexing note).

**New private helpers** (near the existing per-seat helpers, e.g. after `windKindOf`):
- `isMenzen(melds: readonly Meld[]): boolean` — the fourth codebase copy of this predicate
  (yaku.ts/han.ts/fu.ts precedent), doc-commented with the duplication rationale one-liner
  those three already use.
- `RIICHI_STICK` reference (defined once, exported — see above; not re-declared here).

**Refactor**: extract the `discard` case body of `applyAction` (current lines ~814-863) into
a private function, e.g.:

```ts
function performDiscard(state: TableState, seat: Seat, tile: TileId, index: number, verb: string): void
```

(`verb` parametrizes the three existing error message strings — `'discard'` for the ordinary
case, `'riichi'` for the new one — so error text stays exact: e.g. `"action ${index}: riichi of
tile ${tile}, which seat ${seat} does not hold"`.) The function performs exactly the three
existing arms (mustDiscard/tsumogiri/tedashi) plus the shared phase/turn/claimable tail,
mutating `state` in place, returning nothing. `applyAction`'s `discard` case becomes
`performDiscard(state, action.seat, action.tile, index, 'discard')`.

**New private function**: `applyRiichi(state, action, index)` — the riichi fold, guard order
per design.md Decision 2/9:
1. `action.seat !== state.turn` → throw (wrong turn)
2. `state.mustDiscard` → throw ("riichi out of sequence — seat owes a claim discard")
3. `state.drawn === null` → throw ("riichi before seat drew")
4. `state.riichi[seat]` → throw ("seat is already in riichi")
5. `!isMenzen(state.melds[seat])` → throw ("open hand — riichi requires a closed hand")
6. `state.scoresIn[seat] < RIICHI_STICK` → throw ("fewer than 1000 points")
7. `state.live.length === 0` → throw ("no draws remain")
8. tile-held-or-drawn check (mirrors `performDiscard`'s own check, but must run BEFORE the
   shanten probe — computing shanten over a tile the seat doesn't hold is meaningless) → throw
   ("does not hold")
9. `shanten(remaining 13 kinds, melds) !== 0` → throw ("does not leave the hand tenpai — a
   riichi discard must keep tenpai")

Then: `performDiscard(state, action.seat, action.tile, index, 'riichi')`, then
`state.riichi[action.seat] = true; state.pot += RIICHI_STICK`.

**`applyAction`'s switch**: add `case 'riichi': { applyRiichi(state, action, index); return }`,
positioned after `case 'discard'` (mirrors the union's member order).

**`foldRecord`**: signature becomes
`foldRecord(record: HandRecord, context: RiichiContext = { scoresIn: [25000,25000,25000,25000],
potIn: 0 }): TableState`. Default-parameter, not `context?:` + manual `??` — simpler, same
effect, and keeps `context` non-optional inside the function body. Initialize
`state.riichi = [false, false, false, false]`, `state.pot = context.potIn`,
`state.scoresIn = context.scoresIn` in the object literal alongside the other fresh fields.

**New import**: `import { shanten } from './shanten'` (record.ts previously imported no
shanten symbols).

### `src/core/legal.ts`

**New private helpers:**
- `isMenzen(melds: readonly Meld[]): boolean` — the fifth copy, same duplication precedent.
- `RIICHI_STICK` — imported from `./record` (it is that module's exported constant, a shared
  numeric fact, not "guard logic" — consistent with legal.ts already importing `TableState`/
  `HandAction` types from `./record`).
- `riichiCandidates(state: TableState): HandAction[]` (or `riichiOffers`, matching the existing
  `ronOffers`/`claimOffers`/`ankanOffers` naming convention exactly — final name: `riichiOffers`)
  — the per-tile-candidate loop from design.md Decision 3, iterating the same 14-candidate set
  (13 hand tiles + drawn) `legalActions`'s own discard-offer map already iterates.

**New import**: `import { shanten } from './shanten'`.

**`claimOffers`**: each of the three seat-scan loops (pon at ~161, daiminkan at ~168, chi at
~183) gains `if (state.riichi[seat]) continue` (pon/daiminkan loops) or an equivalent guard on
the single fixed chi-claimant seat (the chi loop only ever considers one seat,
`window.seat + 1`; wrap its body in `if (!state.riichi[seat]) { ... }` instead of `continue`,
since there is no loop to continue past).

**`legalActions`**: the `drawn !== null` branch (current lines 308-315) becomes:

```ts
const drawn = state.drawn
if (state.riichi[seat]) {
  return [{ type: 'discard', seat, tile: drawn }, ...tsumoOffer(state)]
}
return [
  ...state.hands[seat].map((tile): HandAction => ({ type: 'discard', seat, tile })),
  { type: 'discard', seat, tile: drawn },
  ...riichiOffers(state),
  ...tsumoOffer(state),
  ...ankanOffers(state),
  ...shouminkanOffers(state),
]
```

**Doc-comment updates**: `legalActions`'s frozen-order comment gains one clause naming the new
riichi block's position (between the discard prefix and tsumo) and the locked-seat short-circuit
shape — following the same "extend-only, ticket X did Y" style already used for the win-offers
precedent it cites.

### `src/core/settlement.ts`

**New import**: `RIICHI_STICK` from `./record` (alongside the existing `Meld`/`TableState`
import from `./record`).

**New private function**: `riichiStickDeltas(state: TableState): SeatDeltas` — design.md
Decision 6's `-RIICHI_STICK` per locked seat.

**`settlementOf`**: after computing the existing `ryuukyoku`/`agari` base deltas, add
`riichiStickDeltas(state)` element-wise; on `agari`, add `state.pot` to `deltas[winner]`
before returning. (Ryuukyoku's `notenBappuOf` result is unchanged beyond the elementwise
add — no pot distribution.)

**`scoreBreakdownOf`**: identical elementwise addition applied to its own locally-computed
`deltas`, plus a new `pot: number` field on both members of the `ScoreBreakdown` union
(`state.pot` verbatim — "pot won" on agari, "pot carried" on ryuukyoku; same field name, the
`kind` discriminant supplies the reading).

**Header comment**: the "always summing to zero" claim (module header, and `SeatDeltas`'s own
doc-comment) is corrected in place per design.md Decision 6's algebra — replaced with the
`sum(scores) + pot` invariant statement, dated to this ticket.

### `src/core/game.ts`

**`GameState` interface**: add `readonly pot: number`.

**`foldGame`**: add `let pot = 0` alongside `dealer`/`scores`; inside the loop, before folding
each hand, compute `scoresIn` (design.md Decision 7's Seat-remap) and call `foldRecord(...,
{ scoresIn, potIn: pot })`; after settling an ended hand, update
`pot = state.phase === 'agari' ? 0 : state.pot`. Return object gains `pot: table!.pot`.

### `src/core/seatview.ts`

**`SeatView` interface**: add `riichi: readonly [boolean, boolean, boolean, boolean]` and
`pot: number`, doc-commented as public-fact fields (mirroring `ponds`/`melds`'s framing).

**`seatView`**: copy `state.riichi` (already a fresh readonly tuple per fold — no defensive
copy needed, matching how `state.claimable`/`state.win` are already passed through by
reference) and `state.pot` straight into the returned object.

### `src/core/index.ts`

No change needed — `export * from './record'` / `'./game'` / `'./settlement'` /
`'./seatview'` already re-export everything new (`RiichiContext`, `RIICHI_STICK`, the widened
`HandAction`/`TableState`/`GameState`/`SeatView`/`ScoreBreakdown`).

## Test files touched (all existing files widened, no new test files this ticket)

- `src/core/record.test.ts` — new `describe('riichi declaration folds')` block (lock/pot/tail
  mutation) and additions to the existing `describe('illegal actions throw instead of folding
  silently')` block for the five named illegal-riichi throws.
- `src/core/legal.test.ts` — new offer-side assertions: a riichi offer is present exactly when
  the per-tile gate holds; a locked seat's claim/kan offers vanish; ron stays offered. Extends
  the existing "offered actions fold" property test's action universe (it already iterates
  `legalActions`'s full output generically, so a `riichi`-typed offer folding correctly should
  fall out of the existing property once `foldRecord`/`applyAction` accepts it — confirm in
  Plan/Implement, no new property needed if so).
- `src/core/legal.win.test.ts` — confirm ron-still-offered-under-lock, if this file's own
  fixtures are the natural place (vs. `legal.test.ts`) — decided in Plan.
- `src/core/settlement.test.ts` — new fixtures: a riichi-locked winner recovers its own stick
  plus the pot; a riichi-locked ryuukyoku pays noten-bappu minus the stick, pot untouched in
  the delta.
- `src/core/game.test.ts` — a two-hand fixture: hand 0 ends ryuukyoku with one riichi
  declared, hand 1's `GameState.pot`/`scoresIn`-derived starting scores confirm the carry.
- `src/core/seatview.test.ts` — extend an existing fixture assertion with the two new fields.
- No changes to `src/core/policy.ts`, `selfplay.test.ts`, `dynamics.test.ts`,
  `game.dynamics.test.ts`, `purity.test.ts` are REQUIRED by this ticket (bots never choose an
  offered riichi today — neither policy branch recognizes `type: 'riichi'`, so self-play
  behavior is unchanged.: confirmed in Plan by running the full suite, not assumed).

## Ordering constraint

`record.ts` must land first (new `HandAction` member, `TableState` fields, `RiichiContext`,
`RIICHI_STICK` export) — every other file's change depends on symbols it exports. Within
`record.ts` itself: the `performDiscard` extraction (a pure refactor, behavior-preserving) should
be its own first commit, verified against the EXISTING test suite green before adding any new
riichi logic on top of it — isolates "did the refactor change behavior" from "is the new
behavior correct."
