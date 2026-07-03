# T-008-03-01 — score-breakdown-screen — Research

Descriptive map of what exists and where. No proposals here.

## 1. The ticket in one sentence

Grow the existing bare-bones hand-end summary in `Table.svelte` into a full breakdown —
every yaku named with its han, the dora count, the fu/points line, and four updated seat
scores with the payment applied — plus a ryuukyoku screen showing tenpai/noten and the
bappu exchange. Everything must be read off the core scorer; no scoring arithmetic in
`src/app/`.

## 2. What the hand-end screen looks like today

`src/app/Table.svelte` (§"the hand-end screen", lines ~114-132) renders, inside the
`.center` card, an `{#if table.phase === 'agari' && table.win !== null}` block:

- A sentence: `"{wind}{ (you)} wins by {tsumo|ron}{ from {wind}}"`.
- The winning tile, in a region labeled `aria-label="winning tile"`.
- A bare `<ul aria-label="yaku">` of `table.win.yaku` names, no han, no fu, no points.

For `ryuukyoku` it renders one line: `<p class="ended">ryuukyoku — exhaustive draw</p>` —
no tenpai/noten breakdown, no bappu numbers.

There is **no score display anywhere** in the app today — no seat point totals, no
delta/payment line. `App.svelte` holds no score state; it only threads `seed`/`actions`
through `foldRecord`.

`src/app/app.ssr.test.ts`'s `describe('hand-end view (SSR)', ...)` (lines 316-367) pins the
CURRENT contract: the win sentence, the winning-tile region, and `won.win!.yaku` rendered
verbatim as `<li>` names. These assertions will need to change since the yaku list source
is changing (see §5).

## 3. `state.win.yaku` is the WRONG source for a priced breakdown

`TableState.win.yaku` (`record.ts` `applyWinTail`) is `yakuOf(win)` — `yakuman.ts`'s
aggregator, which **unions** `standardYakuOf` across *every* valid `decomposeAgari` reading
of the hand. This is correct for legality (one reading needs one yaku to win) but,
per `settlement.ts`'s own header (lines 8-25), **wrong for pricing**: summing han over
names drawn from mutually exclusive readings can price a total no single decomposition
ever produces (settlement.test.ts's Fixture 6, lines 332-364, is the load-bearing
regression: the union would total 8 han/baiman, but the correct priced reading is 6
han/haneman).

`settlement.ts` already solves this correctly, but keeps the solution **private**:
- `winOf(state)` (line 110) rebuilds the `Win` shape from a `TableState`.
- `pricedReadingsOf(win, doraHan)` (line 165) re-runs `decomposeAgari`, filters to
  non-kokushi readings that carry their own yaku (`readingYakuOf`, line 149), and returns
  each candidate reading's **base points only** (`baseOf(hanOfNames(...), fuOf(ctx))`) —
  discarding which yaku list and which fu produced that base.
- `bestBaseOf(win, doraKinds)` (line 186) takes `yakuOf(win)` for the yakuman short-circuit,
  else `Math.max(...pricedReadingsOf(...))` — again, only the number survives.
- `settlementOf(state)` (line 247) is the only export that matters today: four signed
  per-seat deltas, no yaku/han/fu detail.

**Implication for this ticket**: to show "every yaku with its han" correctly, the view
cannot read `table.win.yaku` (the union) or call `yakuOf` itself (recomputing in the app
would violate "no scoring arithmetic in `src/app/`", and would still be the wrong list).
Core needs a new exported function that returns the winning READING's own yaku list (with
han per name), its fu, its dora han, and the resulting per-seat deltas — i.e., a superset of
`settlementOf` that also surfaces what `bestBaseOf` currently throws away.

## 4. What `han.ts`/`fu.ts` already expose, and what they don't

- `hanOf(name: WinYakuName, melds): number` — one name's han, open/closed-aware. Already
  public, already what a per-yaku-name display line needs.
- `doraHanOf(win: Win, doraKinds): number` — total dora+kan-dora han for a win. Already
  public, already the "dora count" the AC asks for (it's a han count, not a physical-tile
  count, per the module's own doc comment on stacking).
- `fuOf(ctx: WinContext): number` — one reading's total fu. Public, but returns only the
  **total** — no itemized base/menzen/tsumo/wait/pair component breakdown. Building a
  component-level fu ledger (e.g. "base 20 + menzen 10 + wait 2 = 32 → 40") would require
  new return shape in `fu.ts` itself; nothing today exposes those intermediate numbers.
- `settlement.ts`'s `baseOf(han, fu): number` (line 139, already exported per T-008-01-04)
  is the tier table: mangan/haneman/baiman/sanbaiman/yakuman are each a **fixed base
  value** (2000/3000/4000/6000/8000×⌊han/13⌋) — fu-independent above han 5, and the
  formula below han 5 is capped at the mangan base (the "kiriage boundary" comment,
  lines 27-32, explains 30fu/4han prices 7700 via the raw formula, NOT kiriage-rounded to
  a flat mangan 8000).
- `ronDeltas`/`tsumoDeltas`/`roundUp100` (also exported per T-008-01-04) are the pure
  payment-split arithmetic settlementOf composes.

So the tier name ("mangan"/"haneman"/...) needed for the "mangan 8000"-style line is
recoverable purely by comparing a reading's `base` against the four named constants
(`MANGAN_BASE`/`HANEMAN_BASE`/`BAIMAN_BASE`/`SANBAIMAN_BASE`/`YAKUMAN_BASE`, all private to
settlement.ts today) — no new arithmetic, just a name lookup on a number core already
computed.

## 5. `game.ts` exists but is NOT wired into the app, and NOT a dependency here

`src/core/game.ts` (T-008-02-01, `status: done`, committed) defines `GameRecord`/
`GameState`/`foldGame`, with `STARTING_SCORE = 25000` (line 75) and per-Player running
`scores` derived by folding `settlementOf` deltas across hands, with dealer
rotation/renchan. **This ticket's `depends_on` is only `[T-008-01-03]`** (settlement, not
game.ts/T-008-02-01) — `App.svelte` still plays exactly one hand per session (`newGame()`
draws a fresh seed and empties `actions`; there is no `GameRecord`, no persisted
across-hands score, no dealer-rotation UI). Wiring the app to a persistent multi-hand
`GameRecord` is out of this ticket's scope (it belongs to whatever ticket wires `App.svelte`
to `game.ts`, not yet identified in the open backlog).

Consequence: "four updated seat scores with the payment applied" can only mean, within
this ticket's scope, **this one hand's** settlement applied to the standard starting total
(25000 each) — not a persisted running total. `game.ts`'s `STARTING_SCORE` constant is
private to that module; importing `game.ts` from `settlement.ts` would create a cycle
(`game.ts` already imports `settlementOf` from `settlement.ts`).

## 6. Ryuukyoku internals already computed, also private

`tenpaiFlagsOf(state)` (settlement.ts line 218) and `notenBappuOf(tenpai)` (line 227) are
the private helpers `settlementOf` calls for the `'ryuukyoku'` phase. Both are already
correct and tested (settlement.test.ts Fixture 7, lines 366-402, pins all five tenpai-count
splits). The screen needs the same two facts (which seats were tenpai, and the resulting
deltas) that these functions already compute — again gated behind `settlementOf`'s
deltas-only return.

## 7. Component conventions in `src/app/`

- Every `.svelte` file is a **stateless, presentational** component: one prop object in,
  markup out, no derived game facts beyond display sorting (`Table.svelte`'s header
  comment, lines 5-12) or string formatting (`ClaimPrompt.svelte`'s `callName`, a pure
  vocabulary lookup, not a computation).
- SSR tests (`app.ssr.test.ts`) render through the real Svelte compiler via
  `svelte/server`'s `render`, asserting on `aria-label`s and rendered text — never classes
  or DOM structure — so components stay free to restructure internally. New UI needs new
  `aria-label` regions following this same test style (`regionTokens`/`tileTokensOf`
  helpers already exist and are reusable).
- Motion/animation is opt-in CSS (`@media (prefers-reduced-motion: no-preference)`),
  applied to the existing `.win-summary`/`.center > .ended` reveal — any new breakdown
  markup should fit the same reveal treatment rather than inventing a new one.
- `SEATS` (Table.svelte lines 36-41) is the wind-name lookup by engine Seat index (0=East
  the player, 1=South, 2=West, 3=North) — the natural table for labeling four seat scores.

## 8. Test conventions relevant to this ticket

- `settlement.test.ts` builds hand-authored `TableState` fixtures directly (`ronState`/
  `tsumoState`/`ryuukyoku­State` helpers) rather than folding real records, because
  constructing a wall/deal that lands on a specific han/fu combination is impractical
  (file header, lines 1-12). Any new settlement-layer test for a breakdown function should
  reuse this same fixture style and can reuse the exact fixtures already in the file
  (PINFU_HAND_13, MANGAN_CAP_HAND_13, TSUUIISOU_HAND_13, the Fixture-6 reading-selection
  hand, TENPAI_HAND/NOTEN_HAND) to assert the SAME numbers are now also visible as
  yaku/han/fu/limit-tier detail, not just the deltas.
- `app.ssr.test.ts` folds real seeded records (`foldRecord`) and drives them to real win/
  ryuukyoku endings via mined action sequences (seed 542630 tsumo, seed 3951 ron, seed
  1038928 houtei ryuukyoku, `dealt.live` tsumogiri-to-exhaustion for a wall-out
  ryuukyoku) — the hand-end/ryuukyoku SSR describe blocks are the natural place to extend
  coverage for the new breakdown markup, reusing the same anchors.

## 9. Constraints and assumptions carried into Design

- No riichi in the action vocabulary yet (yaku.ts's own header) — no riichi sticks, no
  ura-dora, no honba: `settlement.ts`'s existing "prices exactly one hand's base
  settlement" scope is unchanged by this ticket.
- Kiriage mangan is deliberately not applied (settlement.ts header) — the breakdown must
  not silently introduce it while formatting the "fu/points line."
- `core/` stays framework-agnostic and DOM-free; all new logic for selecting/exposing the
  priced reading belongs in `src/core/settlement.ts` (or a sibling core module), never in
  `src/app/`.
- The grep-checkable AC clause ("no scoring arithmetic in `src/app/`") means: no han/fu/
  points/limit-tier computation in `.svelte` files. Simple presentational reads (picking a
  wind name by seat index, joining strings) are the existing precedent for what *is*
  allowed in the view.
