# Design — T-009-03-02: furiten badge and yakuless notice

## Decision 1 — new core queries live in `legal.ts`, not a new module

**Chosen:** add two exported functions to `src/core/legal.ts`:

```ts
export function furitenSeal(state: TableState, seat: Seat): TileId | null
export function yakulessTenpai(state: TableState, seat: Seat): boolean
```

Both reuse `legal.ts`'s existing PRIVATE helpers directly, in the same file:
`waits` (already imported), `winYaku` (the shared Win-assembly point),
`isMenzen`, `kindOf`, `SEAT_COUNT`. No new imports, no new module.

**Rejected: a new `src/core/furiten.ts` module.** Research found that every
piece of machinery these two queries need (`windKindOf`/`ROUND_WIND`-driven
`winYaku`, `riichiStatusOf`, `isMenzen`) already lives in `legal.ts`, private.
The codebase's established doctrine (legal.ts's own header) is to RESTATE
gates independently ACROSS module boundaries (never import record.ts's guard
logic into legal.ts) — but that doctrine is about cross-module independence,
not about avoiding reuse within one file. A new module would have to restate
4-5 helpers that already exist two lines away, for no independence benefit
(there is no second "authority" to stay locked against here — these are new
queries, not a second implementation of an existing gate).

**Rejected: widening `SeatView`.** `tenpaiHint` takes `SeatView`, but
`riichiPrompt`/`winChoice`/`settleWindow` already take `TableState` directly
and scope their own output to one seat — an equally established precedent.
Widening `SeatView` to carry `tempFuriten`/`riichiFuriten` would touch
`seatview.ts`, `seatview.test.ts`, and `seatview.fairplay.test.ts` for two
booleans the new queries can read straight off `TableState` instead — the
`TableState`-direct route costs nothing extra and the fair-play boundary
(SeatView's whole reason to exist) is not in play: both new facts are only
ever computed for the app's own player seat, never used to build another
seat's view of a hidden zone.

## Decision 2 — `furitenSeal` returns a physical `TileId`, not a `TileKind`

The ticket's own Context example ("you discarded 6p") and `RiichiPrompt`'s
existing precedent (`tile: TileId`, rendered via `<Tile id={tile} />`) both
point at a physical tile, not an abstract kind string. `Tile.svelte`'s `id`
prop only accepts `TileId | 'back' | FlowerKind` — feeding it a bare
`TileKind` string would silently fall through every face branch (all keyed off
`kindOf(id)`, which stays `null` for a non-numeric `id`) and render a blank
ivory chip with only the hidden `.kind` text matching by coincidence. Returning
the actual sealing `TileId` (found while scanning the pond anyway — the scan
already touches physical tiles kind-first) reuses `Tile.svelte` exactly as
`RiichiPrompt` does, with no widening of its contract.

## Decision 3 — `furitenSeal`'s scan: own pond first, then rotation order, only widening when a fold-tracked flag is set

```
seatWaits = waits(hand, melds)                         // current wait kinds
ownSeal   = first tile in state.ponds[seat] whose kind ∈ seatWaits
if ownSeal found → return it                            // BASIC furiten
if neither tempFuriten[seat] nor riichiFuriten[seat] → return null   // not furiten
scan state.ponds[(seat+1)%4], [(seat+2)%4], [(seat+3)%4] in that order
  for the first tile whose kind ∈ seatWaits → return it  // TEMP/RIICHI furiten
return null   // active but no match found — see the documented gap below
```

This is not a bare "any pond, any wait-kind match" scan — that shortcut is
**wrong** for the temp/riichi component. Research confirmed `sealPassedWins`
(record.ts:843) only marks temp/riichi furiten from a genuine missed win on
ANOTHER seat's discard, at the moment it happened; a same-kind tile sitting in
another seat's pond from BEFORE this seat was even tenpai never triggered a
seal and must not be reported as one. Gating the widened scan behind the
fold-tracked booleans (`tempFuriten`/`riichiFuriten`) — which are the sole
authorities for that judgment (record.ts's own doctrine, restated here as a
read, never recomputed) — keeps the query correct: the own-pond scan alone
recomputes `discardFuriten`'s real test exactly (any self-discard of a
current-wait kind, at any point in the hand, unconditionally IS basic
furiten — that one *is* a pure recomputation, matching `discardFuriten` in
`legal.ts` line for line), while the widened scan only ever runs to NAME a
seal the fold has already certified.

**Documented gap, accepted as scope-bounded:** `tempFuriten`/`riichiFuriten`
seal ron regardless of later hand changes and clear only on this seat's own
next draw (record.ts:559) — a call (chi/pon) folded by this seat *during* the
sealed window is not a clearing event, and could reshape `waits()` away from
the sealed kind before the seat's next draw. In that narrow case `furitenSeal`
returns `null` even though `ronOffers` still withholds the seat's ron. Every
furiten fixture in the codebase today (`legal.win.test.ts`, `record.test.ts`)
is pure tsumogiri with no calls, so this gap is untested and, per the ticket's
own scope (a badge naming a discard, not a from-scratch furiten re-architecture),
left as a documented limitation rather than solved — solving it would need
threading the actual sealing tile through `TableState` at seal time
(`sealPassedWins`'s own site), a wider change than this ticket's AC asks for.

## Decision 4 — `yakulessTenpai`'s predicate: ALL current waits yakuless, closed hand only

```ts
if (state.riichi[seat]) return false        // riichi itself is a yaku — moot
if (!isMenzen(state.melds[seat])) return false  // "riichi would fix this" needs eligibility
const seatWaits = waits(...)
if (seatWaits.length === 0) return false    // not tenpai
return seatWaits.every(kind => winYaku(state, seat, kind, 'discard').length === 0)
```

**Why ALL, not ANY.** The copy is "no yaku" — unconditionally true copy only
when every possible ron completion is yaku-less; if even one wait carries a
yaku, ron would sometimes win, and "no yaku" would misinform.

**Why closed-hand only.** The notice's second clause, "riichi would fix this,"
presupposes riichi eligibility. An open (called) hand can never declare
riichi (`riichiOffers`'s own `isMenzen` gate, `legal.ts:191`) — showing this
exact copy on an open, yakuless-tenpai hand would promise a fix that does not
exist. Scope: this ticket's notice is the closed-hand case only; an open
yakuless hand is a different (unaddressed) teaching moment.

**Why this needs no separate "tsumo works" check.** `menzenTsumo` in `yaku.ts`
(`isTsumo(ctx) && isMenzen(ctx.melds)`, no further shape requirement) is
unconditional for a closed hand — so a closed tenpai hand always wins by tsumo
regardless of whether its ron completions carry a yaku. The notice's "can
only win by tsumo" clause is licensed by this fact alone, not by re-probing
`winYaku` for the tsumo case.

**Interaction with `riichiPrompt`.** For an unlocked, closed, tenpai seat that
can also afford the stick, `riichiOffers` already offers riichi regardless of
whether the resulting wait has a yaku (riichi itself supplies one) — so
`riichiPrompt` fires first in `App.svelte`'s render cascade and the notice
never gets a turn in the console slot at that exact moment. This is
correct, not a bug to route around: the notice's whole value is explaining an
otherwise-silent gap in the offered set, and riichi is the offered escape
hatch from that exact gap — the two signals do not compete for attention, they
sequence (yakuless notice while playable elsewhere/priced out, riichi prompt
the moment the fix is affordable). See Decision 5 for where each one renders.

## Decision 5 — render as ambient per-seat status, in `Table.svelte`, computed by `App.svelte`

Both facts are TRUE OR FALSE across many turns, independent of whose turn it
currently is — unlike the console slot's claim/win prompt, riichi prompt, and
shanten hint, which only ever mean something at the seat's own decision point.
Cramming them into the turn-gated console slot would either hide them most of
the time (wrong — furiten should read the instant it seals) or require a new
gating condition that doesn't track the actual fact.

**Chosen:** `App.svelte` computes both as `$derived` values from `table`
directly (the same pattern already used for `seatScores`, `prompt`, `win`,
`riichi`, `hint`):

```ts
const furitenTile = $derived(furitenSeal(table, PLAYER))
const yakuless = $derived(yakulessTenpai(table, PLAYER))
```

...and passes them as two new plain-value props into `Table.svelte`
(`furitenTile: TileId | null`, `yakulessTenpai: boolean`), which renders them
inside its existing `{#if seat.you}` block, near the hand — Table.svelte's
established "read a field, render a fact" pass-through convention (`scores`/
`onnext` already work this way). Table.svelte imports NEITHER `waits` nor
`yakuOf` nor any drive.ts selector for this — it only reads the two prop
values, same as it already reads `table.riichi`/`table.turn` directly. This
keeps the "no wait/yaku computation in src/app" grep-check literally true:
grepping `src/app/` for `waits(` or `yakuOf(` still returns nothing.

**Rejected: a new `FuritenBadge.svelte`/`YakulessNotice.svelte` component
pair, wired into the console slot.** `RiichiPrompt.svelte` is that shape, but
it is an interactive PROMPT (two buttons, one decision) at a turn-gated
moment — the badge/notice are passive, ambient, always-on-when-true facts
with no interaction. A dedicated component buys nothing over two `{#if}`
blocks already living where `Table.svelte` prints every other per-seat fact,
and avoids the console slot's cascading-priority problem entirely (no need to
decide "badge vs. hint vs. riichi prompt" ordering — they render in
different places, so they never compete for the same pixels).

## Decision 6 — badge copy stays kind-agnostic, dropping "you discarded"

The ticket Context's illustrative copy — "you discarded 6p" — is only
literally true for BASIC (self-pond) furiten. For temp/riichi furiten the
sealing tile was discarded by ANOTHER seat and this seat merely passed on
ronning it; "you discarded" would misattribute agency. Chosen copy, uniform
across all three kinds:

> 振聴 — ron is sealed on **{tile}**; tsumo still wins

`{tile}` renders via `<Tile id={furitenTile} />` (Decision 2). "Tsumo still
wins" is unconditionally true per `legal.ts`'s own doctrine (`tsumoOffer`:
"No furiten gate: furiten restricts ron only, never the self-draw").

Yakuless notice copy is used verbatim from the ticket Context (already
kind-agnostic — it never names a specific wait, so no rewrite needed):

> no yaku — this hand can only win by tsumo; riichi would fix this

## Test plan sketch (detailed in plan.md)

- Core unit tests for `furitenSeal`/`yakulessTenpai`, reusing `legal.win.test.ts`'s
  named seed fixtures (`FURITEN_SEED = 23798` for basic furiten;
  `YAKULESS_SEED = 12754`, already dealt-tenpai-yakuless with zero actions, for
  `yakulessTenpai`) plus one hand-authored temp-furiten fixture (mirroring
  `record.test.ts`'s existing inline pattern) to exercise the widened scan.
- SSR tests rendering `Table.svelte` directly against folded states built the
  same way `app.ssr.test.ts` already does for mid-hand states — no new App
  plumbing (`App` still only accepts `initialSeed`).
