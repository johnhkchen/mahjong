# T-008-03-01 — score-breakdown-screen — Design

Grounded in research.md. One decision per section; rejected options recorded.

## Decision 1 — where the priced-reading detail lives: extend `settlement.ts`, not a new module

**The question**: the view needs the winning reading's own yaku list (with han),
dora han, fu, tier name, and per-seat deltas/scores — none of which `settlementOf`
surfaces today (research.md §3). Where should the code that recovers this detail live?

- **A. A new `src/core/breakdown.ts` module** that re-implements reading selection
  independently. Rejected: this is exactly the union-vs-best-reading bug settlement.ts's
  own header warns about (research.md §3) — a second implementation of "pick the
  max-base reading" is a second place for that logic to drift out of sync with
  `settlementOf`'s.
- **B. Extend `settlement.ts` in place**, refactoring its existing private
  `pricedReadingsOf`/`bestBaseOf` so the reading-selection logic has ONE implementation
  that both `settlementOf` (unchanged, deltas only) and a new export
  (`scoreBreakdownOf`, full detail) consume. **Chosen.** `settlement.ts` already frames
  itself as "the payment epic's entrypoint" (module header) that fu.ts/han.ts defer
  scoring-aggregation to; a breakdown that must select the SAME reading `settlementOf`
  prices belongs beside the function it must never disagree with. This is the
  T-008-01-04 precedent (Decision 1 there: export existing private pure functions
  rather than duplicate them) applied one level up — refactor so the selection logic is
  computed once, read twice.

Concretely: `pricedReadingsOf` changes its internal return type from `number[]` (base
points only) to an array of small candidate records carrying `{ yaku, doraHan, han, fu,
base }`; a new `bestReadingOf(win, doraKinds)` picks the max-`base` candidate (or builds
the yakuman candidate directly from `yakuOf(win)`); `bestBaseOf` becomes a one-line
wrapper (`bestReadingOf(...).base`) so `settlementOf`'s existing behavior, and every
existing settlement.test.ts assertion on `settlementOf`'s numbers, is untouched byte-for-
byte. No existing export (`settlementOf`, `baseOf`, `roundUp100`, `ronDeltas`,
`tsumoDeltas`) changes signature or behavior.

## Decision 2 — the new export's shape: a discriminated `ScoreBreakdown` union, not two separate functions

**The question**: one function returning one shape, or the phase split expressed as two
entrypoints (`agariBreakdownOf`/`ryuukyokuBreakdownOf`)?

**Chosen**: one function, `scoreBreakdownOf(state: TableState): ScoreBreakdown`, mirroring
`settlementOf`'s own single-entrypoint-with-internal-phase-branch shape (settlement.ts line
247) — the view has exactly one `TableState` and one phase to branch on, so a single call
matches the one `{#if table.phase === ...}` branch already in `Table.svelte`. `ScoreBreakdown`
is a discriminated union on a new `kind: 'agari' | 'ryuukyoku'` field (deliberately not
reusing `TableState.phase`'s literal type, which also has `'playing'` — a breakdown is
domain-inapplicable mid-hand, matching `settlementOf`'s own throw for that case).

Shape:

```ts
export type LimitName = 'mangan' | 'haneman' | 'baiman' | 'sanbaiman' | 'yakuman'

export interface YakuLine {
  readonly name: WinYakuName
  readonly han: number
}

export type ScoreBreakdown =
  | {
      readonly kind: 'agari'
      readonly winner: Seat
      readonly by: 'ron' | 'tsumo'
      readonly from: Seat | null       // null for tsumo
      readonly yaku: readonly YakuLine[]
      readonly doraHan: number
      readonly han: number             // sum of yaku.han + doraHan
      readonly fu: number | null       // null when limitName !== null
      readonly limitName: LimitName | null
      readonly points: number          // the winner's total gain (deltas[winner])
      readonly deltas: SeatDeltas
      readonly scores: SeatDeltas      // STARTING_SCORE + deltas, per seat
    }
  | {
      readonly kind: 'ryuukyoku'
      readonly tenpai: readonly [boolean, boolean, boolean, boolean]
      readonly deltas: SeatDeltas
      readonly scores: SeatDeltas
    }
```

Throws `RangeError` on `state.phase === 'playing'`, matching `settlementOf`'s existing
guard (same message convention).

**Rejected**: adding `deltas`/`scores` only (dropping the raw `deltas` once `scores` exists).
Kept both — `deltas` is what settlement.test.ts's existing fixtures already assert against
(so a new breakdown test can assert `deltas` equals the SAME literal arrays already in that
file, then separately assert `scores[i] === STARTING_SCORE_FOR_DISPLAY + deltas[i]`), and
the view only ever needs `scores`. Keeping both costs one field, not a new concept.

## Decision 3 — `points`: the winner's total gain, not a per-payer breakdown

**The question**: the AC's example line is `"30fu 4han 7700"` — for a RON, 7700 is simply
`deltas[winner]`. For TSUMO, real parlors often print a split ("2000/4000" dealer/non-dealer,
or "4000 all" when both payer rates match) — should `points` encode that split?

- **A. Per-payer split fields** (`dealerPays`/`otherPays` or similar). Rejected: this is
  new business logic (which seats pay which rate) that `ronDeltas`/`tsumoDeltas` already
  encode correctly in `deltas` — deriving a *labeled* split would mean re-deriving "who is
  the dealer" and "which seats are which rate" a second time for display, when the same
  fact is already sitting in `deltas` per seat. It also has no anchor in the ticket's own
  example line, which shows one number.
  Reads two arrays of length 4 and derives labeling — plausible, but not required by the
  AC, and the ticket's own worked example never shows a split. Deferred as unnecessary
  scope for this ticket; `deltas` remains available on the breakdown for a future ticket
  that wants a payer-by-payer view.
- **B. `points = deltas[winner]`** — the winner's total gain, a single number that reads
  correctly for both ron and tsumo, dealer and non-dealer, and is exactly what the AC's
  own example illustrates (7700 IS fixture 1's `deltas[winner]`, verified against
  settlement.test.ts's existing assertion `[-7700, 7700, 0, 0]`). **Chosen.**

## Decision 4 — `limitName`: derived by comparing `base` to the four tier constants, `fu: null` when a limit applies

Per research.md §4, `MANGAN_BASE`/`HANEMAN_BASE`/`BAIMAN_BASE`/`SANBAIMAN_BASE`/
`YAKUMAN_BASE` already exist as private constants; a `limitNameOf(base): LimitName | null`
helper does one equality-chain lookup (`base >= YAKUMAN_BASE` → `'yakuman'`, else exact
match against the other four, else `null`) — no new arithmetic, just naming a number
`baseOf` already produced. This also correctly names the MANGAN CAP case (settlement.test.ts
Fixture 3: a 4han/40fu hand whose raw formula exceeds 2000 and is capped to the mangan
base) as `'mangan'`, since the check is on the resulting `base` value, not on `han` — exactly
matching `baseOf`'s own cap semantics (research.md §4) without re-implementing the cap.

When `limitName !== null`, `fu` is set to `null` in the breakdown, matching the ticket's own
example format (`"mangan 8000"` shows no fu/han, vs `"30fu 4han 7700"` for the non-limit
case) — the view branches on `limitName` to choose which line format to render, never
computing the branch condition itself (it just reads a nullable field).

**Rejected**: distinguishing "double yakuman" / "triple yakuman" by han thresholds beyond
13. `han.ts`'s own header states yakuman pricing is "single-yakuman valuation only" in this
codebase (research.md, han.ts lines 65-66) — stacking multiple *simultaneous* yakuman names
already flows through `baseOf`'s existing `⌊han/13⌋` multiplier with no separate name for
it, and inventing display names for a scoring nuance the engine doesn't yet model by name
is out of scope. `limitName` returns `'yakuman'` for any `base >= YAKUMAN_BASE`.

## Decision 5 — "fu itemized" reading: the fu total is its own field, not a component ledger

**The question**: "itemized" could mean (a) fu is stated as its own number alongside han
(vs. folded silently into the points line), or (b) a full component breakdown ("base 20 +
menzen 10 + wait 2 = 32 → 40fu").

**Chosen: (a).** `fu.ts`'s `fuOf` (research.md §4) returns only a total — no intermediate
values are computed or retained anywhere in the call chain (`standardFuOf`'s locals are
function-scoped and discarded). Reading (b) would require widening `fu.ts`'s return shape
from `number` to a structured ledger, a change to an already-shipped, already-tested
(T-008-01-01) module's public contract, for a presentation nicety the AC's own worked
example (`"30fu 4han 7700"`) does not ask for — the example shows fu as one number beside
han, not a component list. Rejected as scope creep; `fu: number | null` on the breakdown
satisfies "itemized" as "its own stated figure."

## Decision 6 — seat scores: `STARTING_SCORE` duplicated in `settlement.ts`, not imported from `game.ts`

Per research.md §5, this ticket's dependency is `T-008-01-03` only; `game.ts` (T-008-02-01)
is not wired into `App.svelte` and importing its `STARTING_SCORE` into `settlement.ts` would
create an import cycle (`game.ts` already imports from `settlement.ts`). `settlement.ts`
gains its own `STARTING_SCORE_DISPLAY = 25000` constant with a comment naming `game.ts`'s
identical constant as the precedent (the codebase's established small-constant-duplication
convention — `DEALER_SEAT`/`ROUND_WIND`/`windKindOf` are each already duplicated across
`record.ts`/`game.ts`/`settlement.ts` with exactly this kind of cross-referencing comment).
`scoreBreakdownOf` computes `scores` as `deltas.map(d => STARTING_SCORE_DISPLAY + d)` once,
inside core — the view never adds anything, keeping the "no scoring arithmetic in
`src/app/`" AC clause true even for the addition step, not just the han/fu computation.

**Rejected**: having the view compute `25000 + delta` itself. Even though addition is
trivial, the AC's grep-checkable framing ("the view renders scorer output") reads more
robustly if `src/app/` contains zero numeric operations on point values at all — a future
grep for `+` near `score`/`points` in `src/app/` should find nothing, not "well, only
addition, which is fine." Doing the addition in core costs one array `.map`.

## Decision 7 — ryuukyoku breakdown: reuse `tenpaiFlagsOf`/`notenBappuOf` verbatim

`scoreBreakdownOf`'s `'ryuukyoku'` arm calls the SAME private `tenpaiFlagsOf(state)` and
`notenBappuOf(tenpai)` helpers `settlementOf` already calls (research.md §6) — zero new
logic, just surfacing `tenpai` (currently discarded after computing deltas) alongside the
deltas it already produces.

## Decision 8 — view: a new `HandEnd.svelte` component, not more inline markup in `Table.svelte`

**The question**: `Table.svelte` is already ~430 lines with a dense `.win-summary` block;
does the breakdown grow inline, or move to its own component?

- **A. Grow the existing inline block in `Table.svelte`.** Rejected: the breakdown adds a
  yaku-with-han list, a dora line, a fu/points line with two format branches, a ryuukyoku
  tenpai/noten + bappu block, and a four-seat score row — roughly doubling the markup in
  an already-dense file, and mixing "the live table" concern with "the hand-end report"
  concern in one component.
- **B. A new, separate stateless component**, the shape every other distinct concern
  already uses (`ClaimPrompt.svelte`, `Tile.svelte`) — a stateless, single-prop,
  presentational component is the established shape. **Chosen.**
  `HandEnd.svelte` takes `{ table: TableState }` as its one prop (the same
  `{ table }` shape `Table.svelte` itself takes), calls `scoreBreakdownOf(table)`
  internally (one core call, the same pattern `Table.svelte` already uses for
  `kindOf`/`kindIndexOf` reads — calling a pure core function from a component is not
  "scoring arithmetic in the view," it's the view consuming the scorer's output), and
  renders nothing when `table.phase === 'playing'`. `Table.svelte`'s `.center` block
  replaces its inline `win-summary`/ryuukyoku-line markup with `<HandEnd {table} />`,
  keeping SEATS-style wind-name labeling consistent by importing the same `SEATS`-shaped
  wind list (duplicated locally per the existing per-file-duplication convention, or
  passed as a prop — see structure.md).

## Decision 9 — existing SSR test updates are in-scope, not a breaking change to avoid

`app.ssr.test.ts`'s `'hand-end view (SSR)'` block currently asserts `won.win!.yaku` names
render verbatim (research.md §2). Since the breakdown's yaku list is now the PRICED
reading's own list (not `state.win.yaku`'s union), these assertions are updated in this
ticket to read from the same fixtures via the new breakdown, not left pointing at the old,
now-superseded union-based rendering. For every fixture in the test file today (seed 542630
tsumo, seed 3951 ron) the priced reading's yaku list and the union are identical (both are
simple hands with one valid decomposition), so the rendered names are unchanged — only the
assertion's *source* of truth moves from `won.win!.yaku` to `scoreBreakdownOf(won).yaku`.
