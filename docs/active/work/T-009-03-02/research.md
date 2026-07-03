# Research — T-009-03-02: furiten badge and yakuless notice

## Scope recap

Two "why can't I win" teaching signals, per the ticket's Context:

1. A **furiten badge** naming the sealing tile kind and noting tsumo still wins,
   shown whenever any furiten variant (basic/temporary/riichi) gates the seat.
2. A **yakuless notice** at a tenpai hand whose ron would carry no yaku
   ("no yaku — this hand can only win by tsumo; riichi would fix this").

AC requires both facts to come from **exported core queries** — grep-checkable:
no `waits`/`yakuOf`/shanten-shaped computation inside `src/app/`.

## Furiten: what the engine already tracks

`TableState` (record.ts:205-395) carries three independent furiten facts, but
none is exported as a queryable "is this seat furiten, and by what tile" fact:

- **Basic (discard) furiten** — `discardFuriten(state, seat)` in `legal.ts:124`,
  a **private, unexported** helper: `waits(hand, melds).some(kind => ownPond.has(kind))`.
- **Temporary furiten** — `state.tempFuriten: readonly [boolean,boolean,boolean,boolean]`
  (record.ts:357), true from the moment ANY seat's discard completes this seat's
  hand with a yaku and it isn't ronned, cleared on this seat's own next draw
  (`clearTempFuriten`, record.ts:559).
- **Riichi furiten** — `state.riichiFuriten` (record.ts:364), set alongside
  `tempFuriten` when the seat is already locked; never clears for the rest of
  the hand.

All three OR together in `ronOffers`'s gate (`legal.ts:152`):
`discardFuriten(state, seat) || state.tempFuriten[seat] || state.riichiFuriten[seat]`.
This is the one true "is seat furiten right now" predicate; it is not exported
in this form anywhere.

**Which pond holds the sealing tile.** `sealPassedWins` (record.ts:843-858) only
ever marks `tempFuriten`/`riichiFuriten` for seats *other than* the discarder
(`for k = 1..SEAT_COUNT-1 from discarder`) — so the sealing tile for temp/riichi
furiten is always sitting in **another** seat's pond, never the sealed seat's own.
Basic furiten's sealing tile is, symmetrically, always in the seat's **own** pond.
Consequence: scanning **all four ponds** for a tile whose kind is a current wait
covers all three kinds uniformly, with no special-casing needed — provided the
seat is confirmed furiten by the OR above first (a wait ↔ pond-kind match can
exist without furiten being active only if... it can't: any pond-kind match by
definition satisfies at least the basic clause. So the scan is really just
"where" to point the badge, not an independent furiten test).

**Existing fixture.** `legal.win.test.ts:149-151` already pins `FURITEN_SEED =
23798`: seat 1 dealt tenpai on 6p/9p, tsumogiris its own 6p at turn 9 — self-pond
(basic) furiten from turn 21 on. This literally matches the ticket's Context
example ("you discarded 6p"). `legal.win.test.ts:289-365` (record.test.ts:749-784
too) exercises temp/riichi furiten fixtures inline (built via `foldRecord` +
scripted actions, not named seed constants) — reusable patterns, not reusable
constants.

## Yakuless: what the engine already computes

`legal.ts`'s `winYaku` (private, `legal.ts:93-110`) and `record.ts`'s
`completesWithYaku` (private, `record.ts:804-826`) both assemble a `yakuOf` call
from a `TableState` + seat + candidate winning kind + source. Neither is
exported. `yakuOf` itself (`yakuman.ts:259`) is exported and takes a `Win`
object (concealed kinds + melds + winningKind + source + lastTile + seatWind +
roundWind + riichi + ippatsu) — the shared vocabulary every win-assembly point
already reuses.

`legal.win.test.ts`'s own `ronGates`/`tsumoGates` oracle (lines 57-112) is the
precedent for computing yaku-existence independently of legal.ts, over the same
`yakuOf` input shape — and its `YAKULESS_SEED = 12754` fixture already pins a
seat-2 completion with **zero** yaku (turn-1 tsumogiri from seat 1, no offer,
fold throws) — reusable as an anchor for a "no yaku on this wait" fixture,
though it is a RON gate at a specific historical turn, not a live tenpai state
to probe interactively; may need its own fixture for a *live* tenpai check.

**menzen-tsumo is unconditional for a closed hand.** `yaku.ts:267`:
`menzenTsumo(ctx) = isTsumo(ctx) && isMenzen(ctx.melds)` — no shape requirement
beyond closed + self-drawn. So a closed, tenpai hand **always** has ≥1 yaku via
tsumo, regardless of whether its ron completion(s) carry any yaku. This is what
licenses the notice's "can only win by tsumo" framing without a separate tsumo
probe.

**Riichi always yields a yaku.** `yaku.ts:271-280`: `riichiYaku`/`doubleRiichiYaku`
key off `ctx.riichi` alone, no shape requirement. So once `state.riichi[seat]`
is true, ron is never yakuless (riichi itself is the yaku) — the notice is moot
for an already-locked seat, matching `tenpaiHint`'s own early-out
(`drive.ts:318-323`) on `view.riichi[seat]`.

**Riichi-offer overlap.** `riichiOffers` (`legal.ts:188-205`) offers riichi to
ANY closed, unlocked, ≥1000-point seat with a tenpai-preserving discard —
**regardless of whether the resulting wait has any yaku** (riichi itself
supplies one). So for a seat that is closed, tenpai, and can afford the stick,
`riichiPrompt` (drive.ts:281-307) already fires and — per App.svelte's render
cascade (prompt → riichi → hint) — would visually pre-empt a console-slot
notice. The yakuless notice is only ever the RIGHT thing to show in the console
slot when riichi is NOT offered for some other reason (below 1000 points, most
plausibly) — or the notice belongs somewhere else entirely (see Design).

## The view layer: existing seams

- **`SeatView`** (`seatview.ts`) is the fair-play-boundary projection every hint
  is meant to read (its own header). It does **not** currently expose
  `tempFuriten`/`riichiFuriten`, nor any furiten-derived fact. Widening it is
  extend-only per its own doctrine, but two dependent test suites
  (`seatview.test.ts`, `seatview.fairplay.test.ts`) would need new coverage for
  any added field.
- **`drive.ts`** functions are NOT uniformly SeatView-shaped: `tenpaiHint(view:
  SeatView)` is, but `riichiPrompt(state: TableState, offered, player)` and
  `winChoice`/`settleWindow` etc. take the full `TableState` directly and scope
  their own output to one seat. Precedent exists either way; the SeatView
  route is the stricter "hint" convention but not the only one used for
  per-seat derived facts already wired into App.svelte.
- **`App.svelte`**'s console slot (`App.svelte:185-200`) is a single reserved
  region rendering, in priority order: the claim/win prompt, else the riichi
  prompt, else the plain shanten-hint text. It has no other slot today for an
  ambient status fact that should persist across turns regardless of whose turn
  it is (furiten and yakuless-tenpai are both such facts — they don't only
  apply "at this seat's own decision point" the way the hint and riichi prompt
  do).
- **`Table.svelte`** is a pure presentational component (`table: TableState` in,
  markup out, `ontap`/`scores`/`onnext` callbacks) with per-seat regions
  (`.seat.you` etc., `Table.svelte:96-115`) but currently renders no per-seat
  derived status besides the riichi lock's implicit sideways-pond effect
  (deferred; not yet visible) and the turn marker. It reads no drive.ts
  function today — everything it shows is a raw `TableState` field.
- **`RiichiPrompt.svelte`** is the most recent precedent for a small,
  computation-free presentational component wired through a drive.ts selector
  and asserted via SSR test (`app.ssr.test.ts`) — the shape to imitate for a
  `FuritenBadge`/`YakulessNotice` component pair.

## Test conventions observed

- Core exports get colocated `*.test.ts` unit suites (`waits.test.ts`,
  `yaku.test.ts`, `legal.win.test.ts`'s agreement-suite style) with named,
  never-regenerated seed constants and a comment block explaining the mined
  geometry.
- App-level SSR assertions (`app.ssr.test.ts`) either drive `App` at
  `initialSeed` (fresh deal only — no `actions` prop exists) or render a
  presentational component (`Table`, `ClaimPrompt`, `RiichiPrompt`) directly
  against a hand-authored/folded `TableState`, to reach mid-hand or
  wall-exhausted states without threading dozens of turns through `App` itself.
  This is the only practical way to SSR-assert a state 21+ turns deep
  (`FURITEN_SEED`'s geometry) without new App plumbing.
- `drive.test.ts` unit-tests drive.ts selectors directly against folded states
  built the same way (`foldRecord({ seed, actions })`), asserting identity
  (`toBe`) against `offered`/`legalActions` elements where relevant, plus an
  independent oracle recomputation.

## Open questions carried into Design

1. Where does each new core query live — a new module, or exported additions
   to `legal.ts` (which already owns `discardFuriten`)?
2. Should the queries take `SeatView` (widening it) or `TableState` + `Seat`
   directly (the `riichiPrompt` precedent, no SeatView change)?
3. Where do the badge/notice render — the console slot (turn-gated, competing
   with the riichi prompt/hint), or a new always-visible region near the
   player's hand/pond (ambient, independent of whose turn it is)?
4. Exact yakuless predicate: all current waits yakuless, or "at least one"? —
   research favors "all," since "no yaku" is only true copy when every ron
   completion is yakuless.
