# T-003-02-01 — render-ponds-turn-and-phase — Review

Handoff summary: what changed, how it's covered, what a human should look at.

## What changed

Two source files, three commits, zero core changes:

| Commit | File | Change |
|---|---|---|
| 38b8dac | `src/app/app.ssr.test.ts` | +91/−2: fixtures, helpers, two new describe blocks |
| 6551110 | `src/app/Table.svelte` | +60/−11: ponds, turn marker, drawn tile, ryuukyoku banner |
| (final) | `docs/active/work/T-003-02-01/*` | the six RDSPI artifacts |

Untouched by design: `src/core/**` (T-003-01-01 already provides every field),
`src/app/App.svelte` (still folds the boot record with an empty log; record mutation is
T-003-02-02), `src/app/Tile.svelte` (reused as-is for pond and drawn tiles).

### Table.svelte, concretely

- **Ponds**: each seat renders `table.ponds[i]` as a flat `<ul aria-label="{wind} pond">`
  in fold order — the view never sorts a pond ("the order IS the pond's meaning").
  Labels are lowercase on purpose: the existing test asserts each capitalized wind word
  appears exactly once, and `"east pond"` stays out of its way. Empty ponds render as
  empty lists with a min-height so the felt grid doesn't jump at the deal.
- **Turn marker**: `aria-current="true"` + a `class:active` underline on seat `i` when
  `table.phase === 'playing' && i === table.turn`. The phase gate is deliberate: after
  ryuukyoku the fold parks `turn` at the last discarder, and presenting that as "to act"
  would be a false fact. Inactive seats get no attribute at all (undefined, not "false").
- **Drawn tile**: rendered only for the player (East) when `turn === 0 && drawn !== null`,
  as a chip **outside** the hand `<ul>` with `aria-label="drawn tile"` — mirroring core,
  which holds `drawn` apart from the 13-tile hand. Opponents' draws never render:
  concealed information at a riichi table (a presentation decision documented in-template).
- **Ryuukyoku**: a `role="status"` banner ("ryuukyoku — exhaustive draw") in the center
  panel, read from `table.phase` — never inferred from `live.length === 0`. The `{#if}` is
  the widening point for future agari endings.
- The component stays stateless and derives no game facts; its only computation remains
  the player-hand display sort. No new `$derived`, no events, no state.

### app.ssr.test.ts, concretely

- `tsumogiriTurns(live, n)` builds a legal all-tsumogiri script from the empty fold's
  live wall (turn k = seat k%4 draws/discards `live[k]`) — the engine's frozen wall
  convention read through the public fold, not reimplemented.
- **Mid-hand fixture**: 8 complete turns with East's first discard swapped to tedashi of
  a dealt tile, then a pending 9th draw. Yields: every pond 2 tiles, East's pond in an
  order only the log explains, East to act with a drawn tile, wall at 61.
- **Exhausted fixture**: 70 tsumogiri turns → `phase === 'ryuukyoku'`, wall at 0.
- Both render `Table` directly via its one-prop contract (`render(Table, { props })`);
  the existing five App-rendering tests are byte-identical and still cover App→Table
  wiring. `regionTokens(body, label, closeTag)` slices a labeled element by indexOf and
  fails loudly on a missing label, so a renamed aria label can't pass as empty-vs-empty.

## Acceptance criteria → tests

> app.ssr.test renders a hand-authored mid-hand record and asserts all four ponds appear
> with tiles in discard order, the active seat is marked, and the wall counter matches
> live.length; rendering a wall-exhausted record shows the ryuukyoku end state.

- "all four ponds … in discard order" → *renders all four ponds with their tiles in
  discard order*: per-pond **ordered** deep-equal against `midHand.ponds[i].map(kindOf)`;
  the tedashi makes order a real observable, not an accident of draw sequence.
- "active seat is marked" → *marks exactly the active seat*: exactly one
  `aria-current="true"`, positioned in East's (the turn seat's) slice of the document.
- "wall counter matches live.length" → *counts down the live wall*: body contains
  `"61 tiles left"` sourced from `midHand.live.length` (sanity-pinned to 61).
- "wall-exhausted record shows the ryuukyoku end state" → *shows the ryuukyoku end state
  with the wall at zero* + *marks no seat as active once the hand has ended*.
- Beyond the AC: the drawn tile renders apart from a still-13-token hand (the fold's
  tile-partition made visible), and all pre-existing suites stay green.

Gates: `just test` 81/81 (was 72), `just check` 0 errors / 0 warnings, `just build`
single-file OK (42.65 kB inlined).

## Coverage assessment and gaps

- The stateless view is fully specified by SSR string assertions; there is no behavior
  outside markup-from-prop. Content-and-aria-only charter held — no class or structure
  assertions were added (`class:active` is untested visual courtesy, intentionally).
- **Gap (accepted)**: opponents'-draw concealment is asserted only implicitly (the
  per-region assertions plus hand/drawn/pond/dora counts account for every rendered tile
  token; a leaked opponent draw would not trip a test that names it). A one-line negative
  assertion wasn't obviously expressible without structural coupling; flagged rather than
  forced.
- **Gap (accepted)**: `regionTokens` assumes labeled tile regions are flat lists (first
  matching close tag ends the region) — commented at the helper; a future nested pond
  layout would need the helper upgraded, and would fail loudly rather than silently.

## Open concerns for a human

1. **No visual check happened.** No browser was available this session; the boot-table
   layout with four empty ponds (min-height 1.6em, max-width 9.5rem) and the mid-hand
   pond wrapping were never eyeballed. One `just dev` glance is the cheapest remaining
   verification; any fix would be CSS-only.
2. **Turn-marker-at-deal semantics.** With an empty log, East is already marked active
   (phase is 'playing', turn 0). That is correct per the fold, but it means the boot
   walking-skeleton now shows a turn cue before any interaction exists — harmless, and
   T-003-02-02 immediately makes it meaningful.
3. **Pond capacity styling** is provisional: a full ryuukyoku pond holds 17-18 tiles and
   will wrap into several rows inside `max-width: 9.5rem`. Legible, but the proper
   6-per-row riichi pond grid is deferred to the tile-art pass (noted in design.md D3).
4. **Two spec tests passed before implementation** (wall counter — already rendered;
   no-aria-current-after-end — vacuous until the attribute existed). Both are live
   guards now; called out for reviewer honesty, details in progress.md.

No TODOs left in code; no known limitations beyond the above; nothing here blocks
T-003-02-02, which consumes exactly the surface this ticket rendered.
