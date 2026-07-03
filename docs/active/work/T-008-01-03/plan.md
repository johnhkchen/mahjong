# T-008-01-03 — payment-tables-and-noten-bappu — Plan

Ordered, independently-verifiable steps. Each is small enough to commit atomically.

## Step 1 — scaffold `src/core/settlement.ts`: types, constants, small helpers

Write the module header comment (purpose, the reading-selection responsibility,
the published payment table cited by name/numbers per research.md §3), the
`SeatDeltas` type, constants (`DEALER_SEAT`, `ROUND_WIND`, the base tiers,
`NOTEN_BAPPU_POT`, `YAKUMAN_SET`), and the small pure helpers: `windKindOf`,
`roundUp100`, `winOf`, `yakumanBaseOf`, `standardBaseOf`. No public export yet.

**Verify:** `just check` (tsc) passes — no runtime behavior to test in isolation
yet.

## Step 2 — reading selection and win-type payment splits

Implement `pricedReadingsOf`, `bestBaseOf`, `ronDeltas`, `tsumoDeltas`. These cover
the `'agari'` half of `settlementOf`.

**Verify:** `just check` passes; still no test file (these are private, verified
transitively once `settlementOf` exists in Step 4).

## Step 3 — ryuukyoku noten-bappu

Implement `tenpaiFlagsOf`, `notenBappuOf`.

**Verify:** `just check` passes.

## Step 4 — the public `settlementOf` dispatcher + `src/core/settlement.test.ts`

Wire `settlementOf(state: TableState): SeatDeltas` per structure.md §2's dispatch,
export it as the sole public function alongside `SeatDeltas`. Write the test suite
per structure.md §3:

1. **AC-literal fixture** — 30fu/4han non-dealer ron 7700, dealer ron 11600. Build
   via a hand-typed `TableState` slice: pick a concrete winning hand shape known by
   hand to be exactly 30fu/4han (e.g. one closed ron with a kanchan wait, a
   yakuhai triplet, tanyao-breaking terminal — concrete tiles chosen and the fu/han
   arithmetic shown in a comment BEFORE the assertion, never derived from a first
   run), fold it into a `TableState`-shaped object with `phase: 'agari'`, `win: {by:
   'ron', winner, from, tile, yaku}`, matching `hands`/`melds`/`doras`/`live`.
   Assert non-dealer winner → 7700 delta; re-run with `winner: 0` (dealer) → 11600.
2. **Kiriage-boundary note** — same fixture, comment explicitly ties the 7700/11600
   result to "NOT 8000/12000" (what a kiriage-mangan table would give), so the
   design decision is a checked fact, not prose.
3. **Tsumo splits** — the same 30fu/4han hand's tsumo variant (win.by: 'tsumo'):
   non-dealer tsumo → dealer pays 3900, others pay 2000 each (hand-computed:
   1920×2=3840→3900; 1920×1=1920→2000); dealer tsumo → all three pay 3900 with the
   same base — wait, need a genuinely dealer-winner base; reuse the same 1920 base,
   assert each non-dealer pays roundUp100(1920*2)=3900.
4. **Yakuman payment** — a hand-typed single-yakuman win (`state.win.yaku =
   ['tsuuiisou']` or similar single-name array — the settlement path only reads
   `yaku` via `yakuOf(win)` re-derived from `concealed`/`melds`, so the fixture's
   concealed tiles must be a REAL tsuuiisou-shaped hand, not just a `win.yaku`
   label): non-dealer ron 32000, dealer ron 48000; non-dealer tsumo 8000/8000/16000
   split; dealer tsumo 16000-all.
5. **Mangan-cap edge** — a real 4han40fu hand (concrete tiles, fu/han hand-derived
   in a comment) asserts to the SAME payment as a genuine 5han/mangan hand (7700→
   actually mangan non-dealer ron is a flat 8000, dealer 12000 — assert those
   values, proving the >2000 cap fired, not the formula's raw 2560).
6. **Reading-selection fixture** — a hand whose tiles admit two different
   `decomposeAgari` readings with different yaku (e.g. a chiitoitsu-shaped hand
   that is ALSO valid standard-form with its own yaku — a ryanpeikou-adjacent
   shape), asserting the max-base reading's points win, with BOTH readings' fu/han
   computed by hand in the comment so the "why this one wins" is checkable.
7. **Ryuukyoku, 0/1/2/3/4 tenpai** — five `TableState` fixtures (`phase:
   'ryuukyoku'`), hand/meld combinations picked for a known shanten (0 = tenpai;
   any positive value = noten — a hand missing two tiles from any complete shape is
   trivially noten, no need to hit a precise shanten number), asserting the five
   rows of research.md §3's table.
8. **Guard** — `phase: 'playing'` throws `RangeError`.

**Verify:** `npx vitest run src/core/settlement.test.ts` green first (fast
iteration), then barrel export (Step 5) and the full suite.

## Step 5 — barrel export

Add `export * from './settlement'` to `src/core/index.ts`, after the existing
`export * from './han'` line (settlement sits one tier above han/fu, matching the
file's dependency-ordered tail).

**Verify:** `just check` (confirms no import cycle, the barrel re-export
type-checks) and `just test` (full suite, confirms nothing else broke), both green.

## Step 6 — full-suite verification pass

Re-run `just test` and `just check` from a clean state. Confirm:
- No `src/core/` file gained a DOM/Svelte import.
- `settlement.ts` exports exactly `settlementOf` and `SeatDeltas` (spot check via
  `index.ts`'s re-export and a grep for `export` in `settlement.ts`).
- Every fixture's expected number in `settlement.test.ts` traces to a comment
  derived from research.md §3's table, not from a first failing run.

**Verify:** both commands exit 0. This step produces no code change unless a
regression surfaces.

## Testing strategy summary

- **Unit-only**, fixture-based, matching `fu.test.ts`/`han.test.ts`'s house style —
  no separate integration test through a real `foldRecord`-produced `HandRecord`;
  hand-built `TableState`-shaped objects are the fixture unit (heavier than a bare
  `WinContext`/`Win`, but `settlementOf`'s real input IS a `TableState`, so testing
  one level lower would under-test the `winOf` reconstruction logic, the riskiest
  new code this ticket adds).
- Every fixture's expected number is hand-derived in a comment from research.md
  §3's table before the assertion — never reverse-engineered from a first failing
  run.
- `just check` after Steps 1–3 (cheap, catches type drift early); `just test` is
  the Step 4/6 gate.

## Commit boundaries

Target: (1) scaffold + pricing/split helpers + noten-bappu helpers (Steps 1–3, one
commit — all private, only jointly verifiable once wired), (2) dispatcher + tests
green (Step 4), (3) barrel export (Step 5), folding Step 6 into commit 3 if nothing
surfaces (no separate empty commit for a clean verification pass, per the sibling
tickets' own precedent).
