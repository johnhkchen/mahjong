# T-008-01-04 — scoring-property-grid — Research

What exists, where, and how it connects. Descriptive only; the design phase decides.

## 1. The ticket

The P5 crown the charter names: property tests over the whole scoring surface. AC text,
verbatim: a property/table suite covering every (han 1..13+, fu step) cell against an
independently-stated expected table (not re-derived from the implementation), both
dealer-ness × ron/tsumo; every settlement over random ended hands (fast-check) sums to
zero; fu invariants (pinfu 20/30, chiitoi 25, fu always a multiple of 10 except 25) and
the dora-never-a-yaku property hold. `just test` green. `depends_on: [T-008-01-03]`, done.

This is a test-only ticket (the ticket type is `task`, S-008-01's last item): no new
domain logic, but the AC's first clause ("every cell... against an independently-stated
expected table") is not fully satisfiable by the current module surface without a small
export change — see §4.

## 2. What already exists to build on

**`src/core/settlement.ts`** — `settlementOf(state: TableState): SeatDeltas`, the module
this ticket tests exhaustively. Internally: `baseOf(han, fu)` (private) implements the
whole published tier table in one function — yakuman flat tier (`han >= 13`), the four
fixed tiers (sanbaiman/baiman/haneman/mangan, han 11-12/8-10/6-7/5), and the `fu *
2^(2+han)` formula below that, capped at 2000. `roundUp100` (private) is `Math.ceil(x/100)
*100`. `ronDeltas(base, winner, discarder)` (private) pays `roundUp100(base * (winner ===
DEALER_SEAT ? 6 : 4))` from discarder to winner. `tsumoDeltas(base, winner)` (private)
splits `roundUp100(base*2)` (dealer-rate) / `roundUp100(base*1)` (non-dealer-rate) across
the three non-winning seats depending on both the winner's and each payer's dealer-ness.
`notenBappuOf(tenpai)` (private) is the ryuukyoku 3000-pot split. None of `baseOf`,
`roundUp100`, `ronDeltas`, `tsumoDeltas`, `notenBappuOf` is exported — `settlementOf` is
the module's only public face today (settlement.test.ts research.md §5 flagged this: "a
settlement test suite needs one more layer... Design must decide whether to hand-construct
TableState fixtures directly... or keep testing at a lighter level").

`settlementOf` is a two-branch dispatcher on `state.phase`: `'ryuukyoku'` →
`notenBappuOf(tenpaiFlagsOf(state))`; `'agari'` → `winOf(state)` rebuilds a `Win`, then
`bestBaseOf(win, state.doras)` picks the max-base reading (yakuman flat, or the best of
every yaku-bearing `decomposeAgari` reading via `pricedReadingsOf`), then `ronDeltas`/
`tsumoDeltas` on `state.win!.by`. `'playing'` throws.

**`src/core/settlement.test.ts`** — 8 hand-built fixture groups (30fu/4han AC numbers,
tsumo splits via mangan, the mangan CAP vs mangan TIER distinction, yakuman ron/tsumo,
reading-selection discrimination, ryuukyoku noten-bappu across every tenpai count, the
`phase: 'playing'` guard). Every fixture constructs a full `TableState`-shaped object by
hand (a `baseState()` helper plus `ronState`/`tsumoState`/`ryuukyokuState` builders,
`h()` mpsz sugar, `idsOf` for sequential copy indices) and asserts `settlementOf`'s exact
output, with every expected number hand-derived in a comment from research.md §3's table
*before* the assertion — the fu.test.ts/han.test.ts precedent this ticket must extend,
not replace. This file already covers 8 discrete (han, fu, dealer-ness, ron/tsumo) points
plus every noten-bappu tenpai count — a fixed sample, not a grid or a property.

**`src/core/fu.ts`/`fu.test.ts`**, **`src/core/han.ts`/`han.test.ts`** — both reviewed in
T-008-01-03's research.md §2 (still current, not re-derived here). Key facts this ticket
leans on: `fuOf(ctx: WinContext): number` operates on ONE `decomposeAgari` reading, fixed
25 for chiitoitsu, throws for kokushi, otherwise `standardFuOf` — base 20, menzen-ron +10,
tsumo +2, per-set/pair/wait fu, the two named pinfu overrides (20 tsumo / 30 ron), rounded
up to 10 (`Math.ceil(raw/10)*10`) except the two pinfu fixed values and chiitoitsu's 25.
`hanOf(name, melds): number` is a closed/open table lookup (`YAKU_HAN`), flat 13 for any
`YAKUMAN_NAMES` member. `doraHanOf(win, doraKinds): number` sums, per indicator, how many
matching-kind tiles the whole win holds (concealed + meld tiles). `doraHanOf` returns a
plain `number` — structurally incapable of satisfying the `WinYakuName`-based one-yaku
win gate (han.ts's header states this as the frozen invariant; han.test.ts's "dora never
satisfies the one-yaku win gate" fixture proves it for one hand).

**`src/core/yaku.ts`** — `standardYakuOf(ctx: WinContext): YakuName[]`, the per-reading
catalog evaluator (27 names, `STANDARD_YAKU_NAMES` frozen order). `pinfu(ctx)` (private,
not exported) requires `ctx.melds.length === 0` (fully closed — not just menzen; an ankan
also disqualifies pinfu the yaku, unlike menzen for the ron-fu bonus), every concealed set
a run, a non-yakuhai pair, and a ryanmen completion. `fu.ts`'s own `isPinfuShape` is a
*second*, independent restatement of the same shape test (duplicated, not shared) — the
codebase's small-helper-duplication convention applies here too. `standardYakuOf`'s
`pinfu` name in its output is therefore a ready-made, independently-derived oracle for
"is this reading pinfu-shaped," usable from a settlement/fu property test without
re-deriving `isPinfuShape` a third time.

**`src/core/yakuman.ts`** — `yakuOf(win: Win): WinYakuName[]`, the whole-win aggregator:
yakuman supersession, else the union of `standardYakuOf` across every reading. `Win` has
no `doraKinds` field at all — dora cannot influence `yakuOf`'s result by construction
(the type signature itself is evidence, independent of `doraHanOf`'s own behavior).

**`src/core/agari.ts`** — `decomposeAgari(concealed, melds): AgariDecomposition[]`, the
per-reading decomposer (`standard` pair+sets, `chiitoitsu` 7 pairs, `kokushi`). `isAgari`
is the boolean wrapper.

**`src/core/record.ts`** — `foldRecord(record: HandRecord): TableState`, the fold
entrypoint; `TableState.phase` ends at `'agari'` or `'ryuukyoku'` (or stays `'playing'`
mid-hand). `applyWinTail` enforces the one-yaku win gate at fold time — no logged action
can ever produce an ended `'agari'` TableState whose win carries zero yaku, so every real
folded `TableState` settlement sees is already yaku-gated upstream of `settlementOf`.

**`src/core/selfplay.test.ts`** — `selfPlay(seed): SelfPlayEnd`, a full four-seat AI-vs-AI
driver: folds `{seed, actions: []}`, reads `legalActions`, and at each step either
consults `callPolicy` over every offer-holding seat (claim-window arbitration: earliest
non-draw answer by offered order wins, ties broken by rotation — the frozen convention
restated in this file's own header) or `discardPolicy` at the turn seat, appending the
chosen action and re-folding. Terminates within `ACTION_BOUND` actions (a `throw` if not,
never silently) at `state.phase === 'agari'` or when `legalActions` is empty (i.e.
`'ryuukyoku'` with no houtei ron available). A 40-seed corpus (seeds 0..39) is proven to
hit both `'agari'` and `'ryuukyoku'`, both `tsumo` and `ron` wins, and folded claims — the
non-vacuity tallies. A `fc.integer({min:0,max:0xffffffff})` property additionally drives
10 random seeds through the same double-play-and-bound check (determinism/termination
only — it does not call `settlementOf`). This driver is the ready-made source of REAL,
rule-legal ended `TableState`s for a zero-sum property test: every ended state it
produces already satisfies every invariant `foldRecord`/`applyWinTail`/legality enforce
(one-yaku gate, valid decomposition, valid dora/meld bookkeeping), so a settlement
zero-sum property over its output tests `settlementOf` against real reachable game states,
not synthetic ones.

**`src/core/shanten.property.test.ts`** — the codebase's existing fast-check property
suite precedent: a hand-rolled brute-force reference (`refShanten`) checked for agreement
against the module under test, `fc.record`/`fc.array`/`fc.nat`/`fc.integer`/
`fc.shuffledSubarray` arbitraries, `numRuns` in the 60-250 range for hand-shaped
generators, `{timeout: 60_000}` on the heaviest suites. Also contains a full winner-
construction toolkit (`buildWinner`, `buildMelds`, `buildTenpaiParts`, `SET_CANDIDATES`,
`ALL_KINDS`) for generating real, complete 14-tile winning hands (with or without real
melds) from `fc.nat`-indexed choices modulo the currently-legal candidate set — no
rejection loop, deterministic given the arbitrary's sampled integers. This is a second
ready-made generator this ticket could reuse (duplicated locally, per the file-local-
helper convention every test file in this codebase already follows — no shared
test-utils module exists anywhere in `src/core/`).

## 3. The published payment table (external domain knowledge)

Already fully restated in `docs/active/work/T-008-01-03/research.md` §3 (base-points tier
table, payment-split table, noten-bappu table) — not re-derived here; that document is
this ticket's own source for the "independently-stated expected table" the AC requires,
and remains accurate against the current `settlement.ts` (unchanged since -03 shipped).

## 4. The gap: no exported seam for a pure (han, fu) → base-points grid

The AC's first clause asks for a grid over "every (han 1..13+, fu step) cell." Two ways
to get there against the CURRENT module surface:

- **Through real hands**: construct a `TableState` (or `Win`) for each grid cell whose
  yaku/fu combination actually reaches that exact (han, fu) pair. This is what
  `settlement.test.ts` already does for 8 points. Scaling this to "every" han/fu step is
  impractical — many (han, fu) pairs are unreachable by any legal hand (e.g. han=1 with
  fu=110 needs specific yaku+wait combinations that may not coexist), and some han values
  (e.g. 9, 10) require yaku stacking that is fiddly to hand-construct reliably.
- **Through the formula directly**: call `baseOf(han, fu)` with synthetic integers,
  bypassing hand construction entirely. This is the natural "grid" shape the AC describes
  (a table indexed by han × fu, not by hand shape) — the han.ts/fu.ts precedent already
  tests `hanOf`/`fuOf` this way (table-driven over names/contexts, not over full games).
  `baseOf` is not currently exported.

`ronDeltas`/`tsumoDeltas` have the same shape problem for the "dealer-ness × ron/tsumo"
half of the grid: both already take `(base: number, ...)`, not han/fu or a `TableState` —
testing them directly against a payment-split formula needs no hand construction at all,
only an export.

This gap — and how to close it — is Design's first decision.

## 5. Testing conventions this ticket must follow

Every existing scoring test file (`fu.test.ts`, `han.test.ts`, `settlement.test.ts`)
hand-derives its expected numbers in a comment from the published table BEFORE the
assertion, never from a first run of the module under test — and states this explicitly
in its own file header. `shanten.property.test.ts` is the only existing fast-check
property file in `src/core/`; its structure (reference/generator section, then
`describe`/`it` blocks each wrapping one `fc.assert(fc.property(...), {numRuns})`) is the
precedent this ticket's property tests should follow. No shared test-utils module exists;
every file duplicates the `h()` mpsz sugar and any meld builders it needs locally.

## 6. Verification commands

`just test` (`npm run test` → `vitest run`) and `just check` (`svelte-check` + `tsc
--noEmit`) through the flox toolchain, exactly as prior scoring tickets. No DOM/Svelte
import permitted anywhere in `src/core/` — `purity.test.ts` already gates this
mechanically for every file this ticket touches.
