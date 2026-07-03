# Structure — T-008-03-02 next-hand-new-game-controls

No `src/core/` changes (design.md Decision 3's rejected alternative — no new export). Six files
touched: two rewritten in place (`App.svelte`, `HandEnd.svelte`), one widened by two optional
props (`Table.svelte`), one fixture-updated (`app.ssr.test.ts`), two new test files.

## `src/app/App.svelte` — MODIFIED

State block (replaces the current `seed`/`actions` pair):
```ts
function drawSeed(): number { ... }        // unchanged
function bootSeed(): number { ... }        // unchanged
const { initialSeed = bootSeed() } = $props()
let gameSeed = $state(initialSeed)
let hands = $state<HandAction[][]>([[]])
const record = $derived<GameRecord>({ seed: gameSeed, hands })
const game = $derived(foldGame(record))
const table = $derived(game.table)
const offered = $derived(legalActions(table))
const seatScores = $derived(
  [0, 1, 2, 3].map((seat) => game.scores[(game.dealer + seat) % 4]) as [
    number, number, number, number,
  ],
)
```
`prompt`/`win`/`dismissed` — unchanged, still derived from `offered`/`table`/`PLAYER`.

Handlers: `tap`, `claim`, `pass`, `takeWin` — bodies unchanged except every
`actions.push(x)` → `hands[hands.length - 1].push(x)`.

New:
```ts
function newHand() {
  if (table.phase === 'playing') return // defensive no-op; the button is gated on this too
  hands.push([])
}
```
Changed:
```ts
function newGame() {
  gameSeed = drawSeed()
  hands = [[]]
  dismissed = false
}
```
`$effect` body: unchanged (`forcedAction(table, offered, PLAYER)`, still reads `table`/`offered`
which are now sourced from `game.table` instead of a direct `foldRecord` call — no signature
change at the call site).

Imports: add `foldGame`, `type GameRecord` from `'../core'`. Template: `<Table {table} ontap={tap}
scores={seatScores} onnext={newHand} />` (two new props on the existing element).

## `src/app/Table.svelte` — MODIFIED (additive only)

Props widen: `let { table, ontap, scores, onnext }: { table: TableState; ontap?: (tile: TileId)
=> void; scores?: readonly [number, number, number, number]; onnext?: () => void } = $props()`.
One line changes in the template: `<HandEnd {table} onnext={onnext} />` →
`<HandEnd {table} {scores} {onnext} />`. Nothing else in this file changes — no per-seat loop
logic, no new derived values (design.md Decision 2).

## `src/app/HandEnd.svelte` — MODIFIED

Props widen: `let { table, scores, onnext }: { table: TableState; scores?: readonly [number,
number, number, number]; onnext?: () => void } = $props()`.

New derived: `const displayScores = $derived(scores ?? breakdown?.scores)` — used everywhere the
markup currently reads `breakdown.scores` (the one `{#each breakdown.scores as score, seat}`
loop becomes `{#each displayScores ?? [] as score, seat}`; `displayScores` is only read inside the
existing `{#if breakdown !== null}` guard, where it is always defined given the `??` fallback).

New markup, appended after the `.scores` list, still inside `{#if breakdown !== null}`:
```svelte
{#if onnext}
  <button type="button" class="next-hand" onclick={onnext}>next hand</button>
{/if}
```
New CSS rule `.next-hand` — same visual register as `App.svelte`'s existing `.new-game` button
(reuse its declarations: font/border/padding/44px min touch target), scoped locally since
`.svelte` files don't share style blocks.

## `src/app/app.ssr.test.ts` — MODIFIED (one fixture) + EXTENDED (new cases)

- Line ~57-58 (`describe('dealt-table view (SSR)')`): import `handSeedOf` from `'../core'`;
  change `const table = foldRecord({ seed: BOOT_SEED, actions: [] })` to
  `const table = foldRecord({ seed: handSeedOf(BOOT_SEED, 0), actions: [] })` (equivalently
  `foldGame({ seed: BOOT_SEED, hands: [[]] }).table` — either is correct; the direct
  `handSeedOf` form keeps the diff smallest since every other assertion in that block already
  reads off `table` unchanged).
- `describe('hand-end view (SSR)')` / `describe('wall-exhausted table view (SSR)')`: add cases
  rendering `Table` with an explicit `scores` prop (arbitrary distinct values, e.g.
  `[40000, 20000, 20000, 20000]`) and asserting the rendered scores list reflects THOSE values,
  not `breakdown.scores` — proves the override path. Existing cases in these blocks (no `scores`
  passed) continue to assert `breakdown.scores` unchanged — the fallback-path regression check,
  free.
- `describe('no hand-end region while playing (SSR)')`: add an assertion that no `next-hand`
  button/aria-label-equivalent renders on the freshly dealt boot (already implicitly covered by
  "no yaku/points/scores region," but the button needs its own explicit check since it isn't
  inside those regions).
- New cases (either new `describe` blocks in this file, or the mount test below — button
  PRESENCE is SSR-testable, button CLICK is not): assert `next-hand` renders when `onnext` is
  passed on an ended hand, and does not render when `onnext` is omitted.

## `src/app/hand-end.tap.svelte.test.ts` — NEW

Mirrors `table.tap.svelte.test.ts`'s `mount`/`flushSync` pattern. Mounts `Table` (not `HandEnd`
directly — `Table` is the component `App` actually renders, and it owns the prop-forwarding this
ticket adds) against the existing won/exhausted `TableState` fixtures
(`foldRecord({ seed: 542630, actions: [...] })`, reused verbatim from `app.ssr.test.ts`'s
existing anchors), with a spy `onnext`. Click the `next-hand` button (`document.querySelector` by
class or text), assert the spy was called exactly once. One case each for the agari and
ryuukyoku endings — proves the click reaches through `Table`'s forwarding into `HandEnd`'s own
handler, the one thing SSR structurally cannot test.

## `src/app/app.controls.svelte.test.ts` — NEW

`vi.useFakeTimers()`, `mount(App, { target, props: { initialSeed: SEED } })`. A generic driver
function `driveToHandEnd(container)`: loop (capped iterations) —
`await vi.advanceTimersByTimeAsync(BOT_DELAY_MS); flushSync()`; if a `next-hand` button is now
present, stop; else if a `tsumo` or `ron ...` button is present, click it (tsumo always available
to take — taking a win is a valid, hand-ending choice, simpler than declining for this generic
driver); else if a `pass` button is present, click it; else if a `discard ...` button under
`aria-label="drawn tile"` is present, click it (tsumogiri); else continue looping. Two assertions
after reaching hand end: click `next-hand`, assert score conservation (sum 100000) and a fresh
deal (wall/hand tile counts back at their dealt values); click `new-game` (the existing header
button, `aria-label`/class unchanged), assert scores are back to `[25000,25000,25000,25000]` and
the table is `phase === 'playing'` again with no `next-hand` button present.
