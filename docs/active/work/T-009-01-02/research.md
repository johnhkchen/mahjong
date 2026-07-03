# Research — T-009-01-02 riichi-yaku-family-and-uradora

## 1. Scope of the ticket

Price four riichi-adjacent facts through the existing E-008 han/settlement pipeline:
riichi (1 han), double riichi (2 han, declared on the seat's first uninterrupted
discard), ippatsu (1 han, win within one uninterrupted go-around — any call kills
it), and uradora (under-indicators flip on a riichi win, counted like dora). Depends
only on T-009-01-01 (done — riichi declaration, lock, stick/pot). T-009-01-03
(furiten completion) is a sibling, not a dependency; T-009-01-04 (riichi property
suite) depends on this ticket.

## 2. What T-009-01-01 already built

- `record.ts`: `HandAction`'s `riichi` variant (atomic declare+discard),
  `TableState.riichi: [boolean,boolean,boolean,boolean]` (permanent lock, set in
  `applyRiichi`), `TableState.pot`, `RiichiContext` (`scoresIn`/`potIn` fold input),
  `RIICHI_STICK = 1000`.
- `legal.ts`: `riichiOffers` (per-candidate-discard tenpai probe), claim/kan
  suppression for a locked seat (`state.riichi[seat]` guards throughout
  `claimOffers`), forced-tsumogiri-only offer set post-lock.
- `settlement.ts`: `riichiStickDeltas`/`withRiichiSettlement` apply the -1000/seat
  stick cost and pot-to-winner overlay on top of ordinary ron/tsumo/noten-bappu
  payment. `ScoreBreakdown.pot` exposes the pot taken.
- `game.ts`: threads `pot`/`scoresIn` hand-to-hand via `foldGame`.
- `seatview.ts`: exposes `riichi`/`pot` as public per-seat facts (real riichi
  discards are turned sideways at the table — no fair-play concern).

None of T-009-01-01 touches yaku pricing: a riichi win today carries the SAME
`state.win.yaku` list it would have carried without riichi. This ticket's whole job
is to change that.

## 3. The yaku pipeline — three independent WinContext/Win assembly sites

`yaku.ts` defines `WinContext` (one decomposition + circumstance fields: `melds`,
`winningKind`, `source`, `lastTile`, `seatWind`, `roundWind`) and
`standardYakuOf(ctx)`, a pure table of `{name, test}` predicates in catalog order
(`STANDARD_YAKU_NAMES`). Circumstance-only predicates already exist
(`menzenTsumo`, `haitei`, `houtei`, `rinshan`, `chankan`) — they read `ctx.source`/
`ctx.lastTile` without touching the decomposition. This is the precedent riichi/
double-riichi/ippatsu fit: they are win-circumstance facts, not decomposition facts.

`yakuman.ts` defines `Win` (the whole-win version of the same circumstance fields,
pre-decomposition) and `yakuOf(win)`, the aggregator: checks yakuman first
(supersession), else unions `standardYakuOf` across every `decomposeAgari` reading.
`yakuOf` assembles one `WinContext` per reading, spreading `Win`'s circumstance
fields verbatim.

Three call sites build a `Win` (or inline the equivalent object for `yakuOf`)
independently — the codebase's established "duplicate the assembly, don't share it"
discipline (see `isMenzen`: five separate re-statements across
yaku.ts/han.ts/fu.ts/record.ts/legal.ts):

1. **`record.ts`'s `applyWinTail`** (used by both `applyTsumo`/`applyRon`) — the
   fold's own derivation, throws on non-completion/no-yaku.
2. **`settlement.ts`'s `winOf`** — rebuilds `Win` from an ended `TableState` for
   `bestReadingOf`/`pricedReadingCandidatesOf` (settlement re-derives
   `decomposeAgari` itself to price EVERY yaku-bearing reading, not just the
   fold's single recorded reading).
3. **`legal.ts`'s `winYaku`** — used by `ronOffers`/`tsumoOffer` to probe "would
   this win carry a yaku" before offering it.

Any new circumstance field on `Win`/`WinContext` must be threaded through all
three, independently (not via a shared helper) — the codebase's own precedent, and
`legal.ts`'s header explicitly states it: "nothing here imports record.ts guard
logic."

`fu.ts` only *reads* `WinContext` (fu is unaffected by riichi/ippatsu) — not a
fourth assembly site, no changes needed there.

## 4. Han pricing (`han.ts`)

`YAKU_HAN: Record<YakuName, {closed, open}>` is a flat lookup table, `hanOf(name,
melds)` picks the column by `isMenzen(melds)`. Yaku whose predicate *requires* a
closed hand (menzen-tsumo, pinfu, iipeikou, chiitoitsu, ryanpeikou) still carry an
`open` value — "the same value as `closed`... since `hanOf` has no way (and no
need) to tell 'impossible' apart from a real open value." Riichi requires a closed
hand by construction (`applyRiichi`'s `isMenzen` guard) — riichi/double-riichi/
ippatsu all fit this exact precedent: closed-only predicates, `open` column
unreachable, filled with the same value as `closed`.

`doraHanOf(win, doraKinds)` is fully generic: it takes ANY list of dora kinds and
prices every matching tile in the whole win (concealed + meld tiles), summed per
indicator. Nothing about it is dora-specific beyond the name — it can be called
again with a ura-dora kind list with zero changes. `dora.ts`'s `doraKindOf`
docstring already says "ura-dora indicators use this same mapping."

## 5. Dead-wall layout and ura-dora indicator positions (`wall.ts`, `record.ts`)

`wall.ts`'s `WallPartition.dead` documents the frozen 14-tile layout: `[0..3]`
rinshan draws, `[4,6,8,10,12]` dora indicators (initial flip at 4, kan flips walk
rightward), `[5,7,9,11,13]` ura-dora indicators, **each paired directly after its
dora indicator** — this is already load-bearing documentation, unused by any code
yet.

`record.ts`'s `applyKanTail` computes each kan's dora indicator as
`state.dead[6 + kansBefore]`, read from the CURRENT `state.dead` array **before**
that function's own `dead.shift()`/`dead.push()` mutate it. Because `kansBefore`
rinshan tiles have already been shifted off the front and an equal number of live-
wall tail tiles pushed to the back by earlier kans, `state.dead[6 + kansBefore]`
at read time equals ORIGINAL index `6 + 2*kansBefore` (verified by induction: after
`m` prior kans, `state.dead[j]` = original `dead[m + j]` for `j < 14 - m`). The ura
partner for that same kan sits one slot further: `state.dead[7 + kansBefore]` at
the SAME read moment equals original index `7 + 2*kansBefore` — captured at the
identical point in `applyKanTail`, before the shift, mirroring the dora capture
exactly.

The initial ura indicator (paired with `doraIndicator` at original index 4) is
original index 5 — captured once, at `foldRecord`'s initial state assembly,
mirroring `doraIndicators: [doraIndicator]`.

So: every kan's ura-dora indicator can be captured with the SAME shape of code as
its dora indicator, one array slot over, at the same fold moment — no new
wall-order derivation needed, just reading one more slot per flip.

## 6. What "declared on the seat's first uninterrupted discard" requires tracking

Double riichi's standard-rule precondition: the declaring seat's very first
discard of the hand (pond empty before this discard), AND no call (chi/pon/kan of
any form) has happened anywhere on the table before that moment. `TableState`
today tracks neither "has any call ever happened this hand" (a hand-wide monotonic
fact) nor per-seat "discard count so far" directly — though `state.ponds[seat]`
already carries the latter implicitly (`state.ponds[seat].length === 0` before the
riichi discard IS "this seat's first discard").

Ippatsu's precondition is narrower and per-declaration, not monotonic: valid from
declaration until EITHER (a) any call folds anywhere (breaks it for every seat
currently mid-window, not just the caller's target) or (b) the declaring seat's own
next discard folds without a win (one uninterrupted go-around completed). Because a
locked seat can make no calls itself (`legal.ts` already withdraws all its
claim/kan offers), the only actor that can break ippatsu after a declaration is a
DIFFERENT, still-unlocked seat's call, or the declaring seat's own next forced
discard. Multiple seats can be mid-ippatsu-window simultaneously (seat 0 declares,
seat 1 declares before seat 0's next turn, no intervening calls) — this is legal
real-rules mahjong and argues for a per-seat boolean array, not a single flag.

No existing TableState field tracks either fact — both are new fold-time state this
ticket must add, populated inside `record.ts`'s existing action-fold functions
(`applyRiichi`, `applyClaim`, `applyDaiminkan`, `applyAnkan`, `applyShouminkan`, the
`discard` case of `applyAction`).

## 7. Settlement / ScoreBreakdown surface (`settlement.ts`)

`bestReadingOf(win, doraKinds)` / `pricedReadingCandidatesOf` / `bestBaseOf` are the
only call sites that consume a dora-kind list (`state.doras`, passed in from
`settlementOf`/`scoreBreakdownOf`). `ScoreBreakdown` (the `T-008-03-01`
score-breakdown screen's type) has a single `doraHan: number` field, documented as
part of `han = sum(yaku lines) + doraHan`. Whether ura-dora becomes a second field
(`uraDoraHan`) or folds into the same `doraHan` total is a design decision (§8 of
design.md) — `ScoreBreakdown` is explicitly documented as widenable ("this shape
may grow fields... without invalidating any stored hand" is `TableState`'s framing,
and `ScoreBreakdown`'s own docstring calls it "a superset... sharing every
arithmetic step").

`settlementOf`/`scoreBreakdownOf` already read `state.riichi[seat]` directly (for
`riichiStickDeltas`) — the same field this ticket needs to gate ura-dora inclusion
is already in scope at that call site.

## 8. Test conventions observed

Every `*.test.ts` file in `src/core/` either (a) hand-derives expected numbers in a
comment from the rules and checks them against fixtures built through the REAL
`decomposeAgari`/`foldRecord` (never hand-typed intermediate shapes), or (b) mines
a seed offline (a throwaway, uncommitted script) for a specific real scenario and
hardcodes `seed: N` with a comment naming what was mined. `yaku.test.ts` runs a
table-driven sweep over `STANDARD_YAKU_NAMES` so an unadded catalog name fails
loudly. `record.test.ts` already has a `describe('riichi declaration folds')`
block using `RIICHI_SEED = 100` and a chi fixture at `seed: 1` — reusable anchors
for this ticket's own record.ts fixtures if their exact hand shapes fit (verify at
plan time; do not assume without re-checking the mined hand).

## 9. Constraints and invariants to preserve

- **Yaku-name catalog contract**: `YakuName` in `yaku.ts` is the ONLY place names
  live; `hanOf`'s `YAKU_HAN` table must cover every name (a missing entry is a
  runtime `undefined` lookup, no compile-time check ties them together directly —
  `hanOf`'s `Readonly<Record<YakuName, ...>>` type DOES force exhaustiveness at
  compile time, so adding to `YakuName` without adding to `YAKU_HAN` fails `tsc`).
- **Dora is never a yaku** (`han.ts`'s header: "must never become a member of
  WinYakuName") — ura-dora inherits this constraint identically; it must never
  gate the one-yaku win check.
- **Zero-sum settlement**: T-009-01-01 already broke the OLD "always sums to zero"
  invariant deliberately (pot/stick accounting) and replaced it with "scores + pot
  conserved at 4×25000 across hand boundaries" — this ticket adds no new money
  source, only reprices existing wins, so no new invariant is needed, only
  confirmation the existing one still holds with riichi yaku/ura-dora added to the
  han total.
- **Extend-only widening**: every prior ticket in this epic has grown `TableState`/
  `Win`/`WinContext`/`ScoreBreakdown` by adding fields, never changing existing
  ones' meaning — this ticket follows the same discipline.
