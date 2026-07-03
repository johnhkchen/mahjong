# T-008-01-03 — payment-tables-and-noten-bappu — Design

Options, tradeoffs, decision with rationale. Grounded in research.md.

## Decisions (summary)

1. New module `src/core/settlement.ts`, sibling to `fu.ts`/`han.ts`, one public
   function: `settlementOf(state: TableState): SeatDeltas` where `SeatDeltas =
   readonly [number, number, number, number]`.
2. `settlementOf` re-derives everything from `TableState` fields directly — it does
   NOT trust `state.win.yaku` (the union) for pricing. It rebuilds a `Win` object
   (research.md §2) and re-runs `decomposeAgari` + `standardYakuOf` per reading.
3. Non-kiriage base-points table (research.md §3): han 1–4 formula-and-cap, han 5/
   6-7/8-10/11-12 fixed tiers, han ≥13 flat-8000-per-13 (yakuman). Chosen because
   the AC's own fixture number (7700/11600 for 30fu/4han) IS the non-kiriage
   result — not a free choice, a fact read off the ticket text.
4. Reading selection: for non-yakuman wins, price EVERY `decomposeAgari` reading
   whose own `standardYakuOf`/chiitoitsu-yaku list is non-empty, add dora han
   (reading-independent) to each, and take the MAX base-points reading — the
   favorable-interpretation convention `fu.ts` (wait attribution) and `yaku.ts`
   (`concealedTripletCount`'s ron adjustment) already established, generalized from
   "one ambiguous slot" to "one ambiguous whole-hand reading."
5. Yakuman wins skip reading selection entirely: `yakuOf`'s supersession already
   guarantees a pure-yakuman name list; sum `hanOf` over it (13 per name, stacking)
   and price via the flat yakuman tier. No fu, no dora (yakuman scoring ignores
   both, standard rule).
6. Ryuukyoku: per-seat tenpai via `shanten(hand, melds) === 0`, then the fixed
   0/1/2/3/4-tenpai noten-bappu split (research.md §3).
7. `phase === 'playing'` throws `RangeError` — settlement on an unended hand is
   caller corruption, matching the codebase's domain-inapplicable-input convention.

## A — Trust `state.win.yaku`, sum `hanOf` over it directly

Simplest possible implementation: `han = sum(hanOf(name, melds) for name of
state.win.yaku) + doraHanOf(win, doras)`; no re-decomposition, no per-reading
comparison. Pros: trivial, and `state.win.yaku` is already exactly what the fold
computed and stored — reusing it feels like respecting the existing contract
rather than duplicating work.

**Rejected.** `state.win.yaku` is `yakuOf`'s UNION across every reading (yakuman.ts's
own header: aggregated as "every yaku some reading supports," explicitly deferring
per-reading selection to a later ticket — this one). Two readings of the same
14-tile hand can require mutually exclusive concealed-set shapes (e.g. one reading
groups three tiles as a run supporting `iipeikou`'s duplicate-run count, a different
reading of the SAME tiles groups them differently and does not), so summing han
across names drawn from different readings can price a combination no single legal
decomposition ever produces — an overcounting bug, not a rounding quirk. Concretely:
a hand that is pinfu-shaped under one reading (contributing pinfu's 1 han, gated on
an all-run, non-yakuhai-pair, ryanmen-complete reading) and also happens to satisfy
`sanshoku-doujun` only under a DIFFERENT run-grouping of the same tiles would, under
option A, price both han values simultaneously — a total no valid single hand
reading actually supports. `fu.ts` and `han.ts`'s own review/design docs both flag
this gap by name and explicitly assign it to this ticket; taking the shortcut here
would leave the flagged gap unresolved under a different ticket ID.

## B — Re-derive per reading, sum-then-max across `decomposeAgari`'s readings — CHOSEN

Rebuild `Win` from `TableState` (research.md §2), call `decomposeAgari` again, and
for each reading with `form !== 'kokushi'` (kokushi is never priced by fu/han —
it's always yakuman-gated) build a `WinContext`, compute that reading's own yaku
list (`standardYakuOf(ctx)` for `'standard'`, the literal `['chiitoitsu']` for
`'chiitoitsu'` — `chiitoitsu` the yaku is definitionally the form itself, per
`yaku.ts`'s own `chiitoitsu` predicate), skip readings with an empty yaku list (a
reading dora alone cannot rescue — restated at reading granularity, see Rejected-C
below), then price `han = Σ hanOf(name, melds) + doraHanOf(win, doras)` and `fu =
fuOf(ctx)` (25 fixed for chiitoitsu, never separately computed) through the base-
points table, and take the reading with the maximum base points.

Costs one extra `decomposeAgari` call (already O(small) — hands are ≤14 tiles) plus,
per reading, one `standardYakuOf` and one `fuOf` call — all functions already built
for exactly this per-reading shape. This is the direct, correct generalization of
what `fuOf` and `standardYakuOf` already document as their own contract ("operates
over ONE reading... aggregating across readings is a later caller's job"): this
ticket IS that later caller. Chosen.

## C — Skip the "reading must carry its own yaku" filter; price every reading including empty-yaku ones (using dora alone)

Simpler filter logic (no filter at all) — price every standard/chiitoitsu reading,
even ones where `standardYakuOf(ctx)` is empty, using only `doraHanOf` as that
reading's han.

**Rejected.** The one-yaku win gate (`yakuman.ts`'s header, `record.ts`'s
`applyWinTail`) is explicit: "Dora is not, and must never become, a member of
WinYakuName... the one-yaku win gate... only ever inspects that union" — dora prices
a win, it cannot BE the win's yaku. That rule is normally enforced at the whole-hand
level (some reading must contribute a name to the union for the fold to have
allowed the win at all), but once this ticket introduces PER-READING selection, the
same rule must be re-enforced per reading, or a hand could get priced through an
empty-yaku reading whose only "value" is dora — silently smuggling a dora-only win
back in through the scoring side door after the legality side correctly blocked it
on the aggregate. Filtering `readingYaku.length === 0` readings out of the
max-selection is the direct restatement of the existing rule at the new
granularity, not a new invented rule.

## D — Compare readings by (han, fu) tuple lexicographically instead of computed base points

Pick the reading with the highest han first, using fu only to break ties.

**Rejected.** Not equivalent to maximizing actual points: a lower-han, high-fu
reading can outscore a higher-han, low-fu reading below the han-5 mangan floor
(e.g. 3han70fu bases at `70×32=2240`, capped to 2000 — same as flat mangan — while a
theoretical 4han20fu reading of the same tiles bases at `20×64=1280`, strictly
LESS). Comparing the fully-computed base-points value (which already folds in the
cap/tier logic) is both simpler to implement (one number to compare, not a tuple
with cap-aware tie-breaking) and the only comparison that is actually correct
against what gets paid. Chosen instead: compute `basePointsOf(han, fu)` per reading
and compare that scalar directly (Decision 4).

## E — Reuse `state.win.yaku` ONLY for the yakuman-supersession check, still re-derive readings for the non-yakuman path

Check `state.win.yaku[0]` (or any element) against `YAKUMAN_NAMES` membership to
decide "is this a yakuman win" without re-deriving anything, THEN branch: yakuman →
sum `hanOf` over `state.win.yaku` directly (safe — yakuman predicates are whole-win
multiset facts, not per-reading, so no cross-reading contamination is possible
there); non-yakuman → re-derive per Decision 4.

**Chosen, folded into Decision 4/5 above** (not a separate rejected option — this is
the actual shape of the implementation). The supersession rule guarantees a
yakuman-flagged `state.win.yaku` is homogeneous (only yakuman names, `yakuman.ts`'s
own header: "never mixed with standard yaku"), so reading `state.win.yaku` once, up
front, to decide the branch is safe and saves a full re-derivation pass on the
yakuman path, where fu/dora don't even apply.

## Ryuukyoku noten-bappu: computed live vs. read from a hypothetical stored field

`TableState` has no `tenpai` field anywhere — it must be computed. The only
candidate is `shanten(state.hands[seat].map(kindOf), state.melds[seat]) === 0` for
each of the four seats at the ryuukyoku moment. Considered adding a `tenpai:
readonly boolean[]` field to `TableState` itself (computed once, in `foldRecord`,
cached) — rejected as out of this ticket's file-change scope: research.md §6 and
this epic's convention (every prior sub-ticket in S-008-01 stayed a pure additional
consumer, zero `record.ts` edits) both point toward computing it locally in
`settlement.ts` instead, matching `fu.ts`/`han.ts`'s own "duplicate a small
derivation locally rather than widen an unrelated module's contract" precedent.

## Rejected: exporting `basePointsOf`/`SeatDeltas`-internals as public data

Matches `han.ts`'s own "Rejected: exporting the raw table as data" precedent —
nothing downstream needs direct introspection of the base-points table today; a
future teaching-UI ticket ("your hand is 4 han 30 fu = 7700") can add a narrower,
purpose-built export additively without this ticket over-exposing internals now.
`SeatDeltas` (the tuple type) IS exported, since it is the function's own return
shape and callers need to name it, mirroring `AgariDecomposition`/`ConcealedSet`
being exported from `agari.ts` for the same reason.
