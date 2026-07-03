# Structure — T-009-01-02 riichi-yaku-family-and-uradora

No new files. Six existing `src/core/` files change shape; their test files widen.
Order below is dependency order (a file only changes after everything it imports
has its new shape defined) — also the intended commit order for Implement.

## 1. `src/core/yaku.ts`

- Add `export type RiichiStatus = 'none' | 'riichi' | 'double'` near `WindKind`.
- `WinContext` gains two readonly fields: `riichi: RiichiStatus`, `ippatsu:
  boolean` — placed after `roundWind` (end of the circumstance-field group), each
  with a one-line doc comment stating what folds them (declare-time status /
  no-call-since-declare-or-own-next-discard window).
- `YakuName` gains `'riichi' | 'double-riichi' | 'ippatsu'`.
- `STANDARD_YAKU_NAMES` gains the three names, positioned right after
  `'menzen-tsumo'` (before `'pinfu'`) — catalog order is a documented contract
  (`standardYakuOf`'s own doc comment: "deterministic order is contract"), so this
  insertion point is a real decision, not incidental: riichi is conventionally
  listed first among circumstantial yaku, and this ordering is exercised by
  `settlement.ts`'s `YakuLine[]` output and any UI/test asserting yaku order.
- Three new predicates (`riichiYaku`, `doubleRiichiYaku`, `ippatsu` — named to
  avoid shadowing the `ippatsu` field access, e.g. function `ippatsuYaku`),
  inserted in the predicates section near `menzenTsumo` (same circumstance-only
  family).
- `STANDARD_YAKU` table gains three rows in the same position as the name list
  entries: `{ name: 'riichi', test: riichiYaku }`, `{ name: 'double-riichi', test:
  doubleRiichiYaku }`, `{ name: 'ippatsu', test: ippatsuYaku }`.
- Module header comment: remove/update the sentence "The riichi family (riichi,
  double riichi, ippatsu) is deliberately absent... " — it is no longer true;
  replace with a short note that the family is now present (T-009-01-02) and
  circumstance-only, no decomposition read.

## 2. `src/core/yakuman.ts`

- `Win` interface gains the same two fields as `WinContext`: `riichi:
  RiichiStatus` (imported from `./yaku`), `ippatsu: boolean` — placed after
  `roundWind`, mirroring `WinContext`'s field order exactly (both interfaces
  duplicate the same circumstance-field shape already; this ticket just widens
  both copies in lockstep).
- `yakuOf`'s per-reading `WinContext` assembly (the loop near the bottom) spreads
  `win.riichi`/`win.ippatsu` onto each `ctx` alongside the existing spread of
  `source`/`lastTile`/`seatWind`/`roundWind` — one line added to that object
  literal, no logic change.
- Module header: no changes needed (Win's own doc comment already says "the
  circumstance fields reuse WinContext's names and types verbatim" — still true).

## 3. `src/core/han.ts`

- `YAKU_HAN` gains three rows (Decision 7): `riichi`, `'double-riichi'`,
  `ippatsu`, each `{ closed: N, open: N }` per design.md. Insert in the same
  relative catalog-order position as `STANDARD_YAKU_NAMES` for readability
  (though `YAKU_HAN` is a `Record`, not order-sensitive at runtime).
- No signature changes to `hanOf`/`doraHanOf` — both are already fully generic
  over their inputs (research.md §4); ura-dora pricing reuses `doraHanOf`
  unchanged from its call sites in `settlement.ts`.

## 4. `src/core/record.ts`

- `TableState` interface gains two fields, placed directly after `riichi` and
  `pot` respectively (keeping the riichi-family fields grouped): `doubleRiichi:
  readonly [boolean, boolean, boolean, boolean]`, `ippatsu: readonly [boolean,
  boolean, boolean, boolean]`, `uraDoraIndicators: TileId[]`, `uradora:
  TileKind[]` (the latter two grouped with `doraIndicators`/`doras`).
- `foldRecord`'s initial `state` object literal: add `doubleRiichi: [false,
  false, false, false]`, `ippatsu: [false, false, false, false]`,
  `uraDoraIndicators: [dead[5]]`, `uradora: [doraKindOf(kindOf(dead[5]))]`
  (mirrors the existing `doraIndicators`/`doras` initial entries one line above).
- `applyKanTail`: two insertions — push the ura-dora indicator/kind alongside the
  existing dora push (`state.dead[7 + kansBefore]`, doraKindOf-mapped), and reset
  `state.ippatsu = [false, false, false, false]` at the end (Decision 4 — covers
  all three kan forms in one place since all three call this shared tail).
- `applyClaim` (chi/pon): one insertion, `state.ippatsu = [false, false, false,
  false]` at the end (after `state.mustDiscard = true`).
- `applyRiichi`: two insertions before the final `state.pot += RIICHI_STICK` line
  — compute `double` (Decision 4's exact expression, read `state.ponds[seat]`
  BEFORE `performDiscard` runs — so this computation must happen before the
  existing `performDiscard(...)` call, not after), then after locking
  (`state.riichi = locked`), set `state.doubleRiichi`/`state.ippatsu` via the
  same copy-array-then-assign pattern already used for `state.riichi`.
- `applyAction`'s `'discard'` case: after the existing `performDiscard` call,
  `if (state.riichi[action.seat])` (already true entering this branch — the guard
  above it already required `action.tile === state.drawn` for a locked seat, so
  this is always the locked-seat forced-tsumogiri path when true) set that seat's
  `ippatsu` entry to `false` via copy-array-then-assign.
- `applyWinTail`: build `riichi`/`ippatsu` for the `winner` seat (Decision 9's
  expression) and add them to the object passed into `yakuOf`.
- Module header / `HandAction`'s `riichi` doc comment: append a short clause
  noting double-riichi/ippatsu eligibility is now derived at declare/call time
  (T-009-01-02), pointing at the new fields, so a future reader does not have to
  rediscover the mechanism from the diff alone.

## 5. `src/core/legal.ts`

- `winYaku` helper: build the same `riichi`/`ippatsu` fields (Decision 9's
  expression, parameterized by whichever `seat` is being probed — `winYaku`
  already takes `seat` as a parameter) and add them to the `yakuOf(...)` call's
  object literal.
- No other changes — `ronOffers`/`tsumoOffer`/`riichiOffers`/legality's turn-cycle
  logic is untouched; only the win-yaku probe's inputs widen.

## 6. `src/core/settlement.ts`

- Import `RiichiStatus` is NOT needed directly (settlement never constructs the
  union by hand outside `winOf`); `winOf` needs it.
- `winOf`: add `riichi`/`ippatsu` fields to the returned `Win` object (Decision 9).
- `PricedReading` interface: add `uraDoraHan: number` alongside `doraHan`.
- `pricedReadingCandidatesOf(win, doraHan)`: signature gains a second parameter
  `uraDoraHan: number` (both are plain numbers already selected by the caller,
  consistent with the existing single-`doraHan`-parameter shape — no `TableState`
  threading into this function). Each pushed candidate's `han` sum includes both;
  each candidate object carries `uraDoraHan` alongside `doraHan`.
- `bestReadingOf(win, doraKinds)`: gains a second parameter, `uraDoraKinds:
  readonly TileKind[]` (defaults not used — every call site passes explicitly,
  matching the existing no-default-params style in this module). Computes
  `doraHanOf(win, uraDoraKinds)` alongside the existing `doraHanOf(win,
  doraKinds)` call, passes both into `pricedReadingCandidatesOf`. The yakuman
  early-return branch is untouched (yakuman ignores dora and ura-dora alike,
  already documented).
- `bestBaseOf`: gains the same second parameter, forwarded to `bestReadingOf`.
- `settlementOf`/`scoreBreakdownOf`: at their `bestBaseOf`/`bestReadingOf` call
  sites, pass `state.riichi[ended.winner] ? state.uradora : []` as the new
  argument (Decision 8 — ura-dora only prices a riichi win; an empty array is a
  clean "gate closed" rather than a boolean flag threaded an extra layer deep).
- `ScoreBreakdown`'s `'agari'` variant: add `uraDoraHan: number` field next to
  `doraHan`; update its doc comment's `han` formula
  (`sum(yaku) + doraHan + uraDoraHan`).
- `scoreBreakdownOf`'s return object literal: add `uraDoraHan: reading.uraDoraHan`.
- Module header: append a short paragraph (mirroring the existing RIICHI STICKS
  paragraph already in this file) documenting that ura-dora only prices when
  `state.riichi[winner]` is true, and is a second, separate han number from
  ordinary dora — pointing at design.md Decision 8 for the rationale, per this
  file's own established habit of citing the ticket that added each behavior.

## 7. Test files (widened, no new files)

- `yaku.test.ts` — the catalog's table-driven per-yaku sweep (research.md §8)
  MUST gain three rows or the existing "every catalog name gets a case" table
  fails by omission; a positive + adversarial-negative fixture for each of the
  three new names, built through real `WinContext` construction.
- `han.test.ts` — three new `YAKU_HAN` table rows in its independently-spelled
  expected table (the `dora.test.ts` "second spelling" precedent this file's own
  header names); `doraHanOf` itself needs no new cases (unchanged function).
- `record.test.ts` — extend `describe('riichi declaration folds')` with
  `doubleRiichi`/`ippatsu` fixtures (mined seeds, see plan.md), plus new win-tail
  fixtures pinning `state.win.yaku` includes `'riichi'`/`'double-riichi'`/
  `'ippatsu'` at the right moments and NOT otherwise; ura-dora indicator/kind
  fixtures pinning the exact `dead[5]`/`dead[7+2i]` positions against a real kan
  sequence (reusing this ticket's own mined multi-kan fixture if one already
  exists, else mining fresh).
- `legal.test.ts` / `legal.win.test.ts` — the win-offer agreement suite needs at
  least one case proving a would-be-ippatsu/riichi win is OFFERED (not silently
  withheld by a `winYaku` regression) and one proving the offer set is unaffected
  when ippatsu has already broken (still offered, just priced differently at
  settlement — legality never gates on yaku IDENTITY, only yaku PRESENCE, so this
  is mostly a confirmation case, not new legality logic).
- `settlement.test.ts` — hand-authored fixtures pinning: a riichi win's
  `uraDoraHan`/`doraHan` as two distinct numbers, an ippatsu win's extra han, a
  double-riichi win's 2-han line, a non-riichi win with a nonzero `state.uradora`
  array confirming `uraDoraHan` stays 0 (the gate itself), and a zero-sum-plus-pot
  regression confirming `settlementOf`'s conserved-total invariant (research.md
  §9) still holds with the new han sources folded in.
- `settlement.property.test.ts` — no new properties required by the AC, but the
  existing zero-sum-plus-pot property must still pass unmodified over the wider
  han space (confirmation run, not a new assertion).
