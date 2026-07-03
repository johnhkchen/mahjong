# Plan — T-009-01-02 riichi-yaku-family-and-uradora

Five commits, each independently green (`just test` + `just check`), in dependency
order. Every `WinContext`/`Win` literal site in the existing suite is a compile-time
ripple the moment the interfaces widen — commit 1 must fix ALL of them in the same
commit (a partial fix leaves `tsc` red), even in files this ticket's own logic
never otherwise touches (`fu.test.ts`).

## Commit 1 — the yaku family, reachable in isolation

**Files:** `yaku.ts`, `yakuman.ts`, `han.ts`, plus every test file with a hand-built
`WinContext`/`Win` literal: `yaku.test.ts`, `fu.test.ts`, `han.test.ts`,
`yakuman.test.ts`, `legal.win.test.ts`, `settlement.property.test.ts`.

1. `yaku.ts`: add `RiichiStatus`, widen `WinContext`, widen `YakuName`/
   `STANDARD_YAKU_NAMES`, add the three predicates + `STANDARD_YAKU` rows, update
   the header paragraph (structure.md §1).
2. `yakuman.ts`: widen `Win`, thread the two fields through `yakuOf`'s per-reading
   spread (structure.md §2).
3. `han.ts`: add the three `YAKU_HAN` rows (structure.md §3) — `tsc` now compiles
   again (the `Record<YakuName, ...>` exhaustiveness check is the signal).
4. Fix every broken test-side literal, mechanically, defaulting `riichi: 'none'`,
   `ippatsu: false` everywhere an existing fixture doesn't care about the riichi
   family (preserves old behavior exactly — `'none'`/`false` is what an absent
   riichi family always implied before this ticket):
   - `yaku.test.ts`'s `ctxOf` helper (default params) + its one standalone ctx
     literal (~line 384).
   - `fu.test.ts`'s `ctxOf` helper.
   - `han.test.ts`'s `winOf` helper.
   - `yakuman.test.ts`'s `winOf` helper + its one standalone `Win` literal.
   - `legal.win.test.ts`'s win-context builder(s).
   - `settlement.property.test.ts`'s four standalone `WinContext` literals and one
     `Win` literal (no shared helper there — direct edits).
5. New coverage in `yaku.test.ts`, added to the catalog table (not appended
   separately — the table-driven sweep is the AC-enforcing mechanism):
   - `riichi`: positive (`riichi: 'riichi'`), negative (`riichi: 'none'`).
   - `double-riichi`: positive (`riichi: 'double'`), negative
     (`riichi: 'riichi'` — proves the two are exclusive: a `'riichi'` context
     must NOT also satisfy `double-riichi`'s predicate, and vice versa via the
     riichi case above).
   - `ippatsu`: positive (`riichi: 'riichi', ippatsu: true`), negative
     (`riichi: 'riichi', ippatsu: false`) — and one adversarial case,
     `riichi: 'none', ippatsu: true` (a WinContext construction that should
     never arise from a real fold, but the predicate itself must not require
     `riichi !== 'none'` implicitly if it never reads it — confirms the
     predicate is exactly `ctx.ippatsu`, nothing more, matching design.md's
     one-liner).
6. New rows in `han.test.ts`'s independently-spelled expected table: `riichi: 1`,
   `'double-riichi': 2`, `ippatsu: 1` (closed and open equal per design.md
   Decision 7).

Run `just test && just check`. This commit makes the three names priceable and
catalog-correct, but UNREACHABLE from any real fold (record.ts/legal.ts/
settlement.ts still never set `riichi`/`ippatsu` to anything but the old
implicit-absent shape) — a deliberately inert, fully-tested commit, mirroring
T-009-01-01's own commit 2 (`RiichiContext`/fields added, unused by any fold step
yet).

## Commit 2 — `record.ts`: fold-time tracking + uradora capture

**Files:** `record.ts`, `record.test.ts`.

1. `TableState`: add `doubleRiichi`, `ippatsu`, `uraDoraIndicators`, `uradora`
   (structure.md §4).
2. `foldRecord`: initialize all four in the state literal (`doubleRiichi`/
   `ippatsu` all-false, `uraDoraIndicators: [dead[5]]`, `uradora:
   [doraKindOf(kindOf(dead[5]))]`).
3. `applyKanTail`: push the ura-dora indicator/kind at `state.dead[7 +
   kansBefore]` (same pre-shift read point as the dora push, one line above it);
   reset `state.ippatsu` to all-false at the end.
4. `applyClaim`: reset `state.ippatsu` to all-false at the end.
5. `applyRiichi`: compute `double` BEFORE calling `performDiscard` (needs the
   pre-discard pond length); after the existing `state.riichi = locked` line, set
   `state.doubleRiichi`/`state.ippatsu` (copy-array-then-assign, matching the
   existing `locked` pattern).
6. `applyAction`'s `'discard'` case: after `performDiscard`, if
   `state.riichi[action.seat]` was already true entering this action, close that
   seat's ippatsu window.
7. `applyWinTail`: build `riichi`/`ippatsu` for `winner` (design.md Decision 9)
   and add to the `yakuOf(...)` call.

### Test strategy — mined, never hand-built (the record.ts convention)

Mine seeds with a throwaway script (not committed) that drives `foldRecord`/
`legalActions` directly, per the `win.test.ts`/`legal.win.test.ts` precedent.
Needed scenarios, each named by what it proves:

- **Double riichi, positive**: `RIICHI_SEED = 100`'s existing
  `describe('riichi declaration folds')` fixture (`riichiPrefix = [draw seat 0]`,
  then `RIICHI`) is ALREADY this case — seat 0's very first action of the whole
  hand, zero prior discards, zero melds anywhere. Reuse it; add
  `expect(state.doubleRiichi).toEqual([true, false, false, false])`. No new
  mining needed.
- **Double riichi, negative (not first discard)**: same seed, prefixed with one
  extra full uneventful go-around (four `draw`+`discard` pairs, seat 0's second
  turn) before seat 0 riichis — `doubleRiichi[0]` must be `false`,
  `riichi[0]` still `true`. Derivable from the existing mined seed's real hand —
  no new mining, just a longer, still-legal action prefix (verify tenpai still
  holds at the later declare point; re-probe with `legalActions`/`shanten` if the
  drawn tiles shift it — if they do, mine a fresh seed for this case instead of
  forcing an artificial prefix).
- **Double riichi, negative (a call intervened)**: the existing seed-1 chi
  fixture (`review.md`'s "real chi fixture") already has a call before any
  riichi — declare riichi on a seat AFTER that chi folds; `doubleRiichi` must be
  `false` even if it's that seat's own first discard.
- **Ippatsu tsumo, positive**: mine a seed where, immediately after a riichi
  declare, the SAME seat's very next draw is a winning tile with no intervening
  call (search: fold the riichi prefix, then scan forward one draw, check
  `isAgari`/`legalActions` offers `tsumo`).
- **Ippatsu ron, positive**: mine a seed where, after a riichi declare, a
  DIFFERENT seat's next discard is ronnable by a third seat before the declarer's
  own next turn (does not require the declarer to be the winner).
- **Ippatsu, negative (own go-around passes)**: extend the ippatsu-tsumo seed's
  prefix by one more full go-around with no win, confirm `ippatsu[declarer]` is
  `false` at that point (probe via a `tsumo`-shaped win later in the SAME hand if
  the mined seed supports it, else assert the flag directly — `TableState`
  fields are ordinary test-readable data, no need to force a second win).
- **Ippatsu, negative (a call intervened)**: mine or reuse a seed where a
  non-declaring seat pons/chis between the declare and an otherwise-winning
  moment; confirm `ippatsu[declarer]` is `false` and (if a win fixture exists at
  that point) `state.win.yaku` excludes `'ippatsu'`.
- **Uradora indicator positions**: reuse or extend a multi-kan mined fixture
  (`dynamics.test.ts`'s "greedy-call corpus (kans first...)" pattern, or mine a
  fresh 1–2 kan seed) asserting `state.uraDoraIndicators` equals the frozen
  original-index set `[dead[5], dead[7], dead[9], ...]` computed independently
  from the RAW pre-fold wall (`partitionWall(buildWall(seed)).dead`), never from
  `state.dead` post-fold (that array has been shifted — the point of the test is
  proving the shift-compensated read is correct, so the expected value must come
  from an independent, un-shifted source).
- **Win-tail yaku inclusion**: extend an existing or newly-mined win fixture so
  `state.win.yaku` contains `'riichi'` (or `'double-riichi'`/`'ippatsu'`) exactly
  when expected, and never otherwise (a plain tsumo/ron with no riichi in the
  prefix must NOT gain these names — regression coverage for the threading, not
  just the new-path cases).

Run `just test && just check` — this is the commit where riichi yaku first become
reachable from a real fold; if any mining search comes up empty for a given
scenario within reasonable effort, fall back to a documented smaller assertion
(e.g. flag-state-only, no full win) rather than blocking the commit — note the gap
in `progress.md` for review.md to surface.

## Commit 3 — `legal.ts`: winYaku threading

**Files:** `legal.ts`, `legal.test.ts`/`legal.win.test.ts` (confirmation, not new
mechanics).

1. `winYaku`: add `riichi`/`ippatsu` fields (design.md Decision 9, parameterized
   by the probed `seat`).
2. Confirm (do not need to newly invent) that a mined ippatsu/riichi-eligible win
   from commit 2's fixtures is OFFERED by `legalActions` at the right point —
   reuse those seeds rather than mining a third set. Add one assertion per mined
   scenario already available: the win offer exists, and its priced yaku (via a
   follow-up `settlementOf`/`scoreBreakdownOf` call once commit 4 lands — note as
   a forward reference if commit 3 lands before commit 4 in a single sitting, or
   simply reorder so this assertion is added alongside commit 4's fixtures
   instead of duplicated here).

Run `just test && just check`.

## Commit 4 — `settlement.ts`: pricing, the AC's own fixtures

**Files:** `settlement.ts`, `settlement.test.ts`, `settlement.property.test.ts`
(base-state builder only — already touched for compile-greenness in commit 1;
re-verify no NEW literal sites appeared).

1. `winOf`: add `riichi`/`ippatsu` (Decision 9).
2. `PricedReading`/`pricedReadingCandidatesOf`: add `uraDoraHan`.
3. `bestReadingOf`/`bestBaseOf`: add the `uraDoraKinds` parameter.
4. `settlementOf`/`scoreBreakdownOf`: pass `state.riichi[ended.winner] ?
   state.uradora : []` at both call sites.
5. `ScoreBreakdown`: add `uraDoraHan`; `scoreBreakdownOf`'s return literal
   includes it.
6. `settlement.test.ts`: extend `baseState()` with the four new fields
   (all-false/empty defaults — this file builds `TableState` BY HAND, no mining
   needed here, per its own header). New fixtures, each with a hand-derived
   comment BEFORE the assertion (this file's own established discipline):
   - A riichi (non-double) ron win: `riichi: [..., true at winner, ...]`,
     `doubleRiichi` all false, confirm `+1 han` from `'riichi'` in `reading.yaku`.
   - A double-riichi win: confirm `+2 han`, and that `'riichi'` (singular) is
     ABSENT from `reading.yaku` (mutual exclusion, priced not just cataloged).
   - An ippatsu win: `riichi[winner] = true`, `ippatsu[winner] = true`, confirm
     `+1 han` from `'ippatsu'` stacking with the riichi han.
   - A riichi win with `uradora` set to kinds actually held: confirm
     `uraDoraHan > 0` and `doraHan` (ordinary dora) computed independently —
     the two numbers must be separately correct, not just their sum.
   - A NON-riichi win with `state.uradora` populated (gate-off case): confirm
     `uraDoraHan === 0` regardless of held tiles matching — the gate, not the
     counting, is under test.
   - A zero-sum-plus-pot regression: a riichi+ippatsu+uradora win alongside an
     unrelated seat's stick in the pot, confirming `settlementOf`'s deltas still
     satisfy the documented conserved-total invariant (research.md §9) with the
     new han sources folded into a real payment.

Run `just test && just check`. This is the commit that satisfies the AC's own
sentence: "Fixtures pin riichi/double-riichi/ippatsu han... uradora counted only
on riichi wins... pot-inclusive zero-sum settlements."

## Commit 5 — confirmation pass (the T-009-01-01 precedent)

No production code changes expected. Re-run the full suite several times
(`settlement.property.test.ts`/`dynamics.test.ts`/`game.dynamics.test.ts` are
unseeded property suites — T-009-01-01's review.md found a real gap only on this
kind of un-seeded re-run). If a gap surfaces, fix it here with its own small,
documented commit rather than silently folding the fix into an earlier one.

## Out of scope (confirmed against the AC, not deferred silently)

- `SeatView` ura-dora exposure (design.md Decision 5 — no AC clause needs it).
- Fold-time rejection of a locked seat's own call (design.md Decision 6 —
  pre-existing T-009-01-01 scope).
- Temporary/riichi furiten (T-009-01-03, a sibling ticket, independent).
- The dedicated riichi property suite (T-009-01-04, depends on this ticket).
