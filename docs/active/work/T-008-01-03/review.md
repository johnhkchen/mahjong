# T-008-01-03 — payment-tables-and-noten-bappu — Review

Handoff summary: what changed, test coverage, open concerns. All six RDSPI
phases (Research, Design, Structure, Plan, Implement, Review) completed in this
pass.

## 1. What changed

| File | Change | Commit |
|---|---|---|
| `src/core/settlement.ts` | NEW (~230 lines) — `settlementOf(state): SeatDeltas`, plus the `SeatDeltas` type | `272adb3` |
| `src/core/settlement.test.ts` | NEW (~380 lines) — 17 tests, 8 `describe` blocks | `272adb3` |
| `src/core/index.ts` | +1 line, `export * from './settlement'` | `ca97f7d` |

No existing file's behavior changed. `fu.ts`, `han.ts`, `yaku.ts`, `yakuman.ts`,
`agari.ts`, `shanten.ts`, `record.ts`, `tiles.ts`, `deal.ts` are read-only
dependencies. `docs/active/tickets/T-008-01-03.md` shows `phase: implement` in
the working tree — that transition predates this session (already present in
the initial git status) and was not made here; no ticket frontmatter was edited
in this session, per the task's explicit instruction.

## 2. What `settlementOf` computes

One function, `TableState` in, four per-seat deltas out, always summing to
zero:

- **`phase === 'agari'`**: rebuilds a `Win` object from `TableState` fields
  (`winOf` — the pre-completion hand, the winning tile's zone, `drawnFrom` for
  tsumo / `'discard'` for ron, `live.length === 0` for haitei/houtei), then
  prices it. If `yakuOf`'s supersession rule flags any yakuman, the total han
  is summed flat across the yakuman names (13 each, stacking) and priced at
  8000-per-13. Otherwise, EVERY `decomposeAgari` reading that carries at least
  one yaku of its own is priced independently (its own `standardYakuOf` names
  + shared dora han → total han; `fuOf` on that same reading → fu; both through
  the base-points tier table), and the MAXIMUM base-points reading wins. The
  base is then split by ron (discarder pays base×6 dealer / ×4 non-dealer) or
  tsumo (dealer pays double from everyone, or the non-dealer split), rounded up
  to the next 100 throughout.
- **`phase === 'ryuukyoku'`**: per-seat tenpai via `shanten(...) === 0`
  (every hand is quiescent at this moment — no seat holds an undischarged
  drawn tile), then the fixed 3000-point noten-bappu split by tenpai count
  (0/4 → none; 1 → 3000/-1000; 2 → 1500/-1500; 3 → 1000/-3000).
- **`phase === 'playing'`**: throws `RangeError` — settlement on an unended
  hand is caller corruption.

## 3. The load-bearing design decision: re-derive readings, don't trust `state.win.yaku`

`state.win.yaku` (what `record.ts`'s `applyWinTail` already stores, via
`yakuOf`) is the UNION of every decomposition reading's yaku — correct for
legality (one reading needs only one yaku to permit the win) but WRONG for
pricing, since different readings of the same tiles can carry mutually
exclusive yaku. `settlementOf` deliberately ignores `state.win.yaku` for
pricing and re-runs `decomposeAgari` + `standardYakuOf` itself, per reading,
taking the max. This was flagged as an open question by BOTH prior tickets in
this epic (`fu.ts`'s and `han.ts`'s own review/design docs name T-008-01-03 as
the ticket that must resolve it) — this is the ticket that resolves it, and
`settlement.test.ts`'s "reading selection" fixture is built specifically to
catch a regression to the union-based shortcut: a hand that is both a strong
honitsu+ryanpeikou standard reading (haneman, base 3000) and a weak chiitoitsu
reading (base 400) prices correctly at 3000 — NOT chiitoitsu's 400, and
critically not the union bug's 4000 (which a naive `Σ hanOf(state.win.yaku)`
implementation would compute: honitsu 3 + ryanpeikou 3 + chiitoitsu 2 = 8 han,
baiman). All three values are distinct, so this single fixture discriminates
three plausible-but-wrong implementations from the correct one.

## 4. Test coverage

17 tests, covering the AC bullet plus every design decision that needed its
own regression guard:

1. The AC's own literal numbers — 30fu/4han, 7700 non-dealer ron / 11600
   dealer ron — 2 tests, with the kiriage-boundary contrast (NOT the
   would-be 8000/12000) stated in the comment.
2. Tsumo splits, via the same hand's tsumo variant (menzen-tsumo pushes it to
   mangan) — dealer/non-dealer — 2 tests.
3. The mangan CAP (distinct from the mangan TIER above): a real 4han40fu hand
   whose raw formula (2560) is capped to 2000 — 2 tests.
4. Yakuman payment, ron (tsuuiisou, chosen to avoid an incidental suuankou
   stack) — 2 tests.
5. Yakuman payment, tsumo (ryuuiisou, a DIFFERENT hand shape than #4,
   specifically because an all-honor 4-triplet shape completed by self-draw
   would stack a second yakuman) — 2 tests.
6. Reading selection — the union-bug/chiitoitsu-bug/correct-answer
   discriminator described in §3 — 1 test.
7. Noten-bappu across all five tenpai counts (0/1/2/3/4) — 5 tests.
8. The unended-phase guard — 1 test.

Every expected number is hand-derived in a comment against research.md §3's
table before the assertion. One fixture-construction bug was caught and fixed
during verification (a wrong `winningKind` producing an invalid 14-tile
multiset, thrown correctly by the module as "not a win" — not a wrong number,
so not a case of adjusting an expectation to match a first run); documented in
progress.md.

Full-suite results: `npm run test` — 659/659 passed (28 files, no
regressions). `npm run check` (svelte-check + tsc) — 0 errors, 0 warnings, 184
files.

**Coverage gaps, by design**:
- No fixture exercises "kazoe yakuman" (13+ han reached through ordinary yaku
  plus dora, no yakuman predicate firing) — the formula prices it correctly
  (the merged `baseOf`'s han ≥13 branch has no special-case for "how the hand
  got there"), but nothing asserts this explicitly. Flagged in progress.md.
- No integration test through a real `foldRecord`-produced `HandRecord` — every
  fixture is a hand-built `TableState`-shaped object (constructing a wall/deal
  that lands on a chosen han/fu is impractical). This matches `fu.test.ts`'s
  own precedent of testing one level below the full fold, but one level higher
  than those tickets since `settlementOf`'s real input IS `TableState`.

## 5. Open concerns / TODO for later tickets

- **No honba, no riichi sticks.** Neither exists in `TableState` yet — this
  settlement prices exactly one hand's base payment. A future match/round
  epic must layer both on top of `settlementOf`'s result, not inside it.
- **Kazoe yakuman is implicit, not stated.** Worth an explicit ruleset
  decision (and fixture) once this matters — right now it "just works" as a
  formula consequence of the merged `baseOf` function, not a deliberate rule
  choice anyone signed off on.
- **The reading-selection max is a MEANINGFUL performance/complexity tradeoff
  worth a second look**: for hands with many `decomposeAgari` readings (rare
  in practice — most hands have 1, occasionally 2), `pricedReadingsOf` reruns
  `standardYakuOf` and `fuOf` per reading. No performance concern at today's
  scale (a hand has at most a handful of readings), but worth knowing this
  exists if a future property-test ticket (the T-008-01-04 lineage) stress-
  tests scoring over large random hand populations.

## 6. Critical issues

None found. `just check` and `just test` are both clean; no DOM/Svelte import
was introduced; the public surface is exactly the two symbols (`settlementOf`,
`SeatDeltas`) design.md specified.
