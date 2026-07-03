# Design — T-009-01-02 riichi-yaku-family-and-uradora

## Decision 1 — riichi/double-riichi/ippatsu are ordinary catalog yaku, in `yaku.ts`

**Chosen.** Add three names to `YakuName`/`STANDARD_YAKU_NAMES`: `'riichi'`,
`'double-riichi'`, `'ippatsu'`. Give them circumstance-only predicates over
`WinContext`, exactly like the existing `menzenTsumo`/`haitei`/`houtei`/`rinshan`/
`chankan` predicates (none of which touch the decomposition). Catalog position:
directly after `menzen-tsumo` (another circumstance-only, closed-hand-only yaku) —
riichi is conventionally listed first among circumstantial yaku in published tables.

**Rejected: a separate module for riichi yaku.** yaku.ts's own header says the
catalog is "the closed set of non-yakuman yaku predicates" and its riichi-family
paragraph explicitly anticipated this: "the riichi family... is deliberately
absent: no riichi declaration exists in the action vocabulary yet, and `YakuName`
widens extend-only when it does." That precondition is now satisfied
(T-009-01-01). A separate module would fork the one catalog `standardYakuOf`/
`hanOf`/`ScoreBreakdown.yaku` all iterate, breaking the "one table, one aggregator"
invariant `yakuman.ts`'s header relies on.

## Decision 2 — new `WinContext`/`Win` fields: `riichi: RiichiStatus`, `ippatsu: boolean`

```ts
export type RiichiStatus = 'none' | 'riichi' | 'double'
```

Added to both `Win` (yakuman.ts) and `WinContext` (yaku.ts), alongside `source`/
`lastTile`/`seatWind`/`roundWind` — the existing circumstance-field group. `yakuOf`
already spreads every `Win` field onto each per-reading `WinContext` verbatim; no
change to that spreading logic, just two more fields riding along.

**Chosen: one 3-way union over two booleans.** `riichi` and `double-riichi` are
mutually exclusive by rule (a double riichi is never ALSO priced as a plain
riichi — the iipeikou/ryanpeikou disjoint-by-construction precedent). A union
makes the "exactly one of three" invariant a type fact instead of a documentation
promise two independent booleans could violate (`riichi: true, double: true` would
be nonsense and compile fine). Matches `source`'s own 4-way union precedent in the
same interface.

**Rejected: two booleans (`riichi`, `doubleRiichi`).** Threading two flags through
three assembly sites means twice the chance one site sets them inconsistently
(e.g. forgets `doubleRiichi` implies `riichi`). A union is assigned once per site.

Predicates:
```ts
function riichiYaku(ctx: WinContext): boolean { return ctx.riichi === 'riichi' }
function doubleRiichiYaku(ctx: WinContext): boolean { return ctx.riichi === 'double' }
function ippatsu(ctx: WinContext): boolean { return ctx.ippatsu }
```
No decomposition or melds read at all — these are the simplest predicates in the
catalog, matching `chankan`'s one-liner.

## Decision 3 — `TableState` gains `doubleRiichi` and `ippatsu`, both `[boolean;4]`

`state.riichi` (existing, T-009-01-01) is untouched — it remains "is this seat
locked," consumed pervasively by `legal.ts`/`settlement.ts`. Two NEW parallel
per-seat boolean arrays, matching its own shape and the codebase's established
style for per-seat facts (TileKind/boolean arrays, never a union array):

- `doubleRiichi: readonly [boolean, boolean, boolean, boolean]` — set once, at
  declare time, permanent for the hand (mirrors `riichi` itself: no seat can
  declare twice, so this never needs to be un-set).
- `ippatsu: readonly [boolean, boolean, boolean, boolean]` — set true at declare
  time, reset to false either globally (any call folds anywhere) or individually
  (the declaring seat's own next discard folds without a win) — a transient
  per-declaration window, unlike the other two permanent facts.

**Rejected: derive both post-hoc from the action log at win time**, scanning
`record.actions` for calls/discards between the declare index and the win index.
Rejected because `TableState` carries no actions array (a fold is memoryless
beyond its accumulated fields, `record.ts`'s own "table state is always derived by
folding" doctrine) — reconstructing index order from final `melds`/`ponds` shape
alone is strictly harder and less direct than updating two flags incrementally at
the exact three points where the rules change them, mirroring how `state.riichi`
itself is already tracked incrementally rather than derived.

**Rejected: a single monotonic `anyCallMade: boolean` field for the double-riichi
gate.** Not needed — `state.melds.every((m) => m.length === 0)` is an exact,
already-available proxy ("has any call folded yet," since only calls ever push a
meld), computed on demand at declare time. Adding a redundant field the codebase
would have to keep in lockstep is unjustified duplication.

## Decision 4 — where each flag is mutated in `record.ts`

- **`applyRiichi`** (after all existing guards pass, alongside the existing
  `state.riichi[seat] = true` / `state.pot += RIICHI_STICK` lines): compute
  `const double = state.ponds[seat].length === 0 && state.melds.every((m) => m.length === 0)`
  (read BEFORE `performDiscard` pushes this discard into the pond — the "first
  discard" check needs the pre-discard pond), set `doubleRiichi[seat] = double`
  and `ippatsu[seat] = true`.
- **`applyClaim`** (chi/pon, end of function): `state.ippatsu = [false, false,
  false, false]`. A locked seat can never itself be the actor here (`legal.ts`
  already withdraws its claim offers, and `record.ts`'s own fold would need a
  matching guard — see Decision 6), so this only ever fires for an UNLOCKED
  seat's call, exactly the "someone else called" case that breaks every currently
  open window.
- **`applyKanTail`** (shared tail of daiminkan/ankan/shouminkan, one insertion
  covers all three kan forms): same one-line reset, at the end.
- **`applyAction`'s `discard` case**, only when `state.riichi[action.seat]` is
  already true entering the action (i.e., this is a locked seat's forced
  tsumogiri, NOT the declaring action itself — the declare is the separate
  `'riichi'` case): after `performDiscard` returns, `ippatsu = [...ippatsu]` with
  `[action.seat] = false`. This is "one uninterrupted go-around completed without
  a win" — the window closes for that seat only, others' windows (if any)
  untouched.

**Convention adopted, stated explicitly (a genuine ruleset choice, not a codebase
fact): ANY call — chi, pon, daiminkan, shouminkan, or ankan — breaks ippatsu.**
Some published rule sets exempt concealed kan; this codebase picks the simpler,
common, uniform rule (every call-family function shares one behavior) rather than
special-casing ankan. Documented in `record.ts`'s own comment at the reset site,
not just here, since a future reader of `applyKanTail` needs the same rationale
without returning to this file.

## Decision 5 — uradora: mirror `doraIndicators`/`doras` exactly, one slot over

New `TableState` fields, populated identically to their dora counterparts:
- `uraDoraIndicators: TileId[]` — `[dead[5]]` at `foldRecord`'s initial assembly
  (mirrors `doraIndicators: [doraIndicator]`), then `applyKanTail` pushes
  `state.dead[7 + kansBefore]` (mirrors the dora push at `state.dead[6 +
  kansBefore]`, read at the identical pre-shift moment — research.md §5 verifies
  both indices resolve to the frozen original layout).
- `uradora: TileKind[]` — `doraKindOf(kindOf(indicator))` per entry, mirroring
  `doras`.

**Rejected: expose via `SeatView`.** Real riichi keeps ura-dora hidden until a
riichi win reveals it; `seatview.ts`'s header explicitly flags "ura indicators at
showdown" as a future, EXTEND-ONLY widening, not something to do reflexively now.
Nothing in this ticket's AC requires SeatView exposure (fixtures pin engine-level
pricing, not a UI reveal), and adding it prematurely would need the "any ticket
widening those must re-audit the fair-play property" work seatview.ts's header
calls for — out of scope. TableState itself is already full-information (never
fair-play-audited), so storing ura there costs nothing; only SeatView's projection
is the fairness boundary.

## Decision 6 — no fold-time guard needed for "locked seat cannot call"

`applyClaim`/`applyDaiminkan`/`applyAnkan`/`applyShouminkan` do not currently
reject a call FROM a locked seat at fold time (only `legal.ts` withholds the
OFFER) — this is pre-existing T-009-01-01 scope, not this ticket's to fix. Ippatsu
tracking does not depend on this guard existing: a locked seat calling (if ever
folded directly, bypassing legality) would still correctly break OTHER seats'
ippatsu windows via the same reset code, and would trivially make no sense for the
caller's own analysis since a locked seat's hand cannot open (closed-hand riichi
invariant, unrelated to this ticket). Not introducing a new guard here keeps this
ticket's diff scoped to yaku pricing, per its own AC.

## Decision 7 — han pricing table entries

`YAKU_HAN` gains three rows, closed/open identical (the existing
menzen-tsumo/pinfu/iipeikou precedent for closed-hand-only yaku):
```ts
riichi: { closed: 1, open: 1 },
'double-riichi': { closed: 2, open: 2 },
ippatsu: { closed: 1, open: 1 },
```
`hanOf`'s `Readonly<Record<YakuName, ...>>` type makes this a compile error if
skipped — no separate exhaustiveness test needed beyond `tsc`.

## Decision 8 — ura-dora pricing: reuse `doraHanOf`, gate on `state.riichi[winner]`

`doraHanOf(win, doraKinds)` is already fully generic (research.md §4). At both
settlement call sites (`bestReadingOf` via `bestBaseOf`/`bestReadingOf`,
consumed by `settlementOf`/`scoreBreakdownOf`), add a second `doraHanOf(win,
state.uradora)` call, included only when `state.riichi[ended.winner]` is true —
0 otherwise (uradora never prices a non-riichi win, the AC's own wording).

**Chosen: a NEW `ScoreBreakdown.uraDoraHan: number` field, separate from
`doraHan`.** `han = sum(yaku lines) + doraHan + uraDoraHan`. Pedagogically distinct
from ordinary dora (this is a teaching-first game — "you got 2 dora and 1
ura-dora" is a clearer post-hand review line than a merged number), and matches
the codebase's own extend-only-fields discipline for `ScoreBreakdown` (T-009-01-01
already added `pot` this same way).

**Rejected: fold ura-dora into the existing `doraHan` number.** Cheaper to
implement (one array concatenation instead of a second field) but loses the
distinction a review screen wants, and `pricedReadingCandidatesOf`/`bestReadingOf`
would need to thread an "is this reading's winner in riichi" fact down into
functions that currently take only `(win, doraKinds)` — awkward compared to
computing both numbers once in `settlementOf`/`scoreBreakdownOf`, where
`state.riichi[winner]` is already in scope, and summing them into the existing
`han` total there.

Concretely: `bestReadingOf`/`pricedReadingCandidatesOf` keep taking a single
`doraKinds` list (their existing signature, untouched) — callers pass
`state.riichi[winner] ? [...state.doras, ...state.uradora] : state.doras` for the
BASE-POINTS computation (han total must include ura-dora to price correctly), and
`scoreBreakdownOf` separately computes `doraHanOf(win, state.doras)` and
(conditionally) `doraHanOf(win, state.uradora)` to populate the two distinct
`ScoreBreakdown` fields without re-deriving `bestReadingOf`'s own internal
selection twice. `PricedReading` (settlement.ts's own internal type) gains a
`uraDoraHan` field alongside its existing `doraHan`, threaded the same way
`doraHan` already is.

## Decision 9 — `winOf`/`legal.ts`'s `winYaku` supply the new fields from `TableState`

Both re-derive, for seat `s`:
```ts
const riichiStatus: RiichiStatus = !state.riichi[s] ? 'none' : state.doubleRiichi[s] ? 'double' : 'riichi'
```
`ippatsu: state.ippatsu[s]`. Third copy in `record.ts`'s `applyWinTail` (already
has `winner` in scope). Three independent inline computations, per the
established isMenzen-style duplication convention (research.md §3) — no shared
helper module.
