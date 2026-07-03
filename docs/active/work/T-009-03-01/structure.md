# Structure — T-009-03-01 tenpai-riichi-prompt

## Files modified

### `src/app/drive.ts`

Add two exports, placed after `winChoice` (same "one relevant offer/fact for `player`"
family) and before `tapDiscard`:

- `interface RiichiPrompt { readonly tile: TileId; readonly declare: HandAction;
  readonly decline: HandAction }` — the two `offered` elements a riichi decision point
  presents, both concrete `HandAction`s (never constructed, always looked up).
- `function riichiPrompt(state: TableState, offered: readonly HandAction[], player:
  Seat): RiichiPrompt | null` — null unless `offered` holds a `riichi` action for
  `player`; otherwise resolves `declare`/`decline` via `discardPolicy(seatView(state,
  player), offered)` per design.md Decision 2, falling back to `offered.find` for
  whichever of the pair `discardPolicy` didn't directly return.
- `function tenpaiHint(view: SeatView): number | null` — null when not mid-decision
  (`view.drawn === null`), already locked (`view.riichi[view.seat]`), or shanten is 0;
  otherwise `shanten([...view.hand, view.drawn].map(kindOf), view.melds[view.seat])`.

New imports needed in drive.ts: `discardPolicy` (policy.ts, already re-exported via
`../core`), `shanten` (shanten.ts, same barrel), `SeatView` (type-only), `TableState`
(already imported).

No changes to any existing drive.ts export — `tapDiscard`, `forcedAction`,
`settleWindow`, etc. are untouched; the riichi decision point was already a
wait-on-player state by construction (research.md), so nothing about the auto-advance
loop's classification changes.

### `src/app/RiichiPrompt.svelte` (new file)

Stateless presentational component, sibling to `ClaimPrompt.svelte`. Props:

```ts
let {
  tile,
  ondeclare,
  ondecline,
}: {
  tile: TileId
  ondeclare?: () => void
  ondecline?: () => void
} = $props()
```

Markup: an `<aside class="prompt riichi" role="group" aria-label="riichi prompt">`
(same landmark pattern as `ClaimPrompt`'s `aria-label="call or pass"`), containing:
- a header line: `you're tenpai — declare riichi?` plus the tile (`<Tile {id={tile}}
/>`) so the player sees exactly which discard is in question;
- three stakes lines, each its own `<p>` with a stable `aria-label` for the SSR tests to
  target individually (`aria-label="stake hand-locks"` / `"stake stick"` /
  `"stake yaku"`), text drawn from the ticket verbatim: "hand locks — every later turn
  is an automatic discard of whatever you draw", "a 1000-point stick moves to the table
  pot — the next winner takes it", "riichi is its own yaku, and a win flips the
  uradora indicators for a chance at more";
- two buttons, reusing `ClaimPrompt`'s `.call`/`.pass` visual register (min 44px touch
  targets, same palette) — `aria-label="declare riichi"` calling `ondeclare`, and
  `aria-label="not yet"` calling `ondecline`.

Styling: copy `ClaimPrompt`'s `<style>` block's palette/sizing constants for `.prompt`,
buttons, and touch targets (`#124534`/`#2e7d4f`/`#eaf3ee`, 2.75rem min height) so the two
prompts read as one visual family; the stakes `<p>` lines use `HandEnd.svelte`'s small-
caption register (`font-size: 0.7rem`, `letter-spacing: 0.08em`).

### `src/app/App.svelte`

- Import `RiichiPrompt` and `riichiPrompt`/`tenpaiHint` from `./drive`.
- New derived values, placed beside the existing `prompt`/`win`:
  ```ts
  const riichi = $derived(riichiPrompt(table, offered, PLAYER))
  const hint = $derived(
    riichi === null ? tenpaiHint(seatView(table, PLAYER)) : null,
  )
  ```
  (guarding `hint`'s computation behind `riichi === null` is a presentation-cheapness
  choice, not a correctness requirement — `tenpaiHint` already returns `null` whenever
  shanten is 0, which is exactly when `riichi` would be non-null; the guard just avoids
  a redundant `shanten` call on every reactive re-run while a riichi offer is live).
- Needs `seatView` imported from `../core` (not currently imported in App.svelte —
  drive.ts uses it internally, but App.svelte calls `riichiPrompt`/`tenpaiHint`
  directly with `table`/a fresh `seatView(table, PLAYER)` the same way it already calls
  `legalActions(table)` itself rather than through a drive.ts wrapper).
- New handlers, beside `claim`/`pass`/`takeWin`:
  ```ts
  function declareRiichi() {
    if (riichi === null) return
    activeHand().push(riichi.declare)
  }
  function declineRiichi() {
    if (riichi === null) return
    activeHand().push(riichi.decline)
  }
  ```
- The `.console` block gains the `{:else if}` branches from design.md Decision 4,
  inserted between the existing `ClaimPrompt` branch and the closing `{/if}`.

## Files created (tests)

- `src/app/drive.test.ts` — extend (not a new file) with a `describe('riichiPrompt')`
  and `describe('tenpaiHint')` block, following the file's existing frozen-seed-anchor
  convention (scan for a seed reaching player tenpai post-draw with a closed hand and
  ≥1000 points; reuse an existing anchor if one already lands there, else mine one the
  same way the file's header documents).
- `src/app/app.ssr.test.ts` — extend with a `describe('riichi prompt view (SSR)')`
  block rendering `RiichiPrompt` directly against the same seed anchor's derived props
  (mirroring the existing "win prompt view (SSR)" block's structure), plus a
  `describe('tenpai hint (SSR)')` covering the pre-tenpai case via `render(App, ...)` or
  a hand-authored mid-hand fixture.
- `src/app/app.controls.svelte.test.ts` or a new `app.riichi.tap.svelte.test.ts` —
  end-to-end: mount `App`, drive to a riichi-eligible state (extending
  `driveToHandEnd`'s generic-driver style with a riichi-declaring or riichi-declining
  variant), assert the folded action's type and that the hand subsequently forces
  tsumogiri (declare path) or continues taking normal taps (decline path).

## Ordering

1. drive.ts additions (pure, unit-testable in isolation via `drive.test.ts`) — no view
   dependency, can be verified first.
2. `RiichiPrompt.svelte` (pure presentational, SSR-testable against hand-authored
   props, no App.svelte wiring needed yet).
3. `App.svelte` wiring (derived values, handlers, console branch) — depends on both.
4. Tests, threaded alongside 1–3 rather than deferred to the end (drive.ts unit tests
   land with step 1, SSR tests with step 2, end-to-end with step 3).

No files are deleted. No changes to `src/core/*` — every fact this ticket needs
(`shanten`, `discardPolicy`, `seatView`, `legalActions`'s riichi offers) already exists
and is already exported through `src/core/index.ts`.
