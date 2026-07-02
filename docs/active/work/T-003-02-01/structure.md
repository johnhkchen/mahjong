# T-003-02-01 — render-ponds-turn-and-phase — Structure

The blueprint: which files change, what shape the code takes, and in what order. Two files
are modified; nothing is created or deleted outside `docs/active/work/`.

## File inventory

| File | Change | Why |
|---|---|---|
| `src/app/Table.svelte` | modified | ponds, turn marker, drawn tile, ryuukyoku banner + their styles |
| `src/app/app.ssr.test.ts` | modified | fixture builders, region helper, two new describe blocks |
| `src/core/**` | untouched | engine already provides every field (T-003-01-01) |
| `src/app/App.svelte` | untouched | D1: test renders Table directly; App's record handling is T-003-02-02's |
| `src/app/Tile.svelte` | untouched | reused as-is for pond and drawn tiles |

## src/app/Table.svelte — internal organization

The component keeps its exact public interface — one prop, `table: TableState` — and its
"never derives game facts" header contract. Changes by section:

### Script block

- `SEATS` gains a per-seat pond label, keeping the wind-casing rule in one place:
  `{ wind: 'East', pond: 'east pond', area: 'east', you: true }`, etc. (Derivable from
  `wind.toLowerCase()`, but a literal field keeps the aria vocabulary greppable and makes
  the lowercase-on-purpose decision visible where it's used.)
- The `{#each SEATS as seat (seat.area)}` loop binds the index: `as seat, i` — `i` is the
  `Seat` for `table.ponds[i]` and the `i === table.turn` comparison. SEATS order is already
  Seat order (E, S, W, N); a comment pins that alignment.
- No new `$derived` values. The hand sort stays the only computation. Ponds render straight
  off `table.ponds[i]`; everything else is field reads in the template.

### Template (target shape)

```svelte
<section class="table" aria-label="mahjong table">
  {#each SEATS as seat, i (seat.area)}
    <div class="seat {seat.area}" class:you={seat.you}
         class:active={table.phase === 'playing' && i === table.turn}
         aria-current={table.phase === 'playing' && i === table.turn ? 'true' : undefined}>
      {seat.wind}{#if seat.you}<span class="you-mark">you</span>{/if}
      <ul class="pond" aria-label={seat.pond}>
        {#each table.ponds[i] as id (id)}<li><Tile {id} /></li>{/each}
      </ul>
      {#if seat.you}
        <ul class="hand" aria-label="your hand"> …existing… </ul>
        {#if table.turn === 0 && table.drawn !== null}
          <span class="drawn" aria-label="drawn tile"><Tile id={table.drawn} /></span>
        {/if}
      {/if}
    </div>
  {/each}
  <div class="center">
    …existing dora + wall counter…
    {#if table.phase === 'ryuukyoku'}
      <p class="ended" role="status">ryuukyoku — exhaustive draw</p>
    {/if}
  </div>
</section>
```

Notes pinned by design:

- `aria-current` must be **absent** (undefined), not `"false"`, on inactive seats — the
  test asserts exactly one occurrence, and Svelte omits `undefined` attributes.
- Pond `<ul>` renders unconditionally (empty list for empty pond) — no special case, and
  the aria label is present from the deal onward.
- Drawn-tile chip sits OUTSIDE the `hand` ul: `regionTokens(body, 'your hand')` must not
  pick it up, and core holds `drawn` apart from the 13-tile hand — structure mirrors state.
- Order inside `.seat`: wind label → pond → (player only) hand → drawn. Ponds face the
  table center for all seats; the flex column plus grid areas already handle placement.

### Style block (additions only)

- `.pond` — flex row, wrap, small gap, `min-height` of one tile row so empty ponds don't
  collapse the seat cell; `list-style: none`.
- `.pond :global(.tile)` sizing is NOT touched — Tile owns its face; if pond tiles need to
  shrink later that's the tile-art ticket's problem. (Font-size on `.pond` is acceptable
  since Tile uses em-relative padding but a fixed `font-size: 0.8rem` — leave as-is.)
- `.seat.active` — visible turn cue: brighten the wind label (`color: var(--ink)`) and a
  subtle underline/ring. Kept minimal; no animation.
- `.drawn` — small left margin visually separating the draw from the sorted hand.
- `.ended` — the banner: uppercase-tracked like `.label` but in `--ink`, margin 0.

## src/app/app.ssr.test.ts — internal organization

Existing content is preserved verbatim (header comment gets one sentence about the
mid-hand fixtures). Additions, in file order:

### Helpers (module level, beside `tileTokensOf`)

```ts
/** Tsumogiri script: n full turns; turn k = seat k%4 draws live[k] and discards it. */
function tsumogiriTurns(live: readonly TileId[], n: number): HandAction[]

/** The inner tile tokens of the element labeled `label`, in document order. */
function regionTokens(body: string, label: string): string[]
```

- `tsumogiriTurns` builds `[{draw, seat}, {discard, seat, tile: live[k]}]` pairs from the
  EMPTY fold's live wall — the engine's own frozen conventions, read through the public
  surface (design D2). Both fixtures below share it.
- `regionTokens` slices `aria-label="{label}"` up to the enclosing element's closing tag
  (`</ul>` — regex on the SSR string, e.g. `aria-label="east pond"[^>]*>(.*?)</ul>`,
  dotall) and reuses `tileTokensOf` on the slice. It asserts the label exists (throw or
  `expect` fail on no match) so a renamed label can't silently pass an empty-equals-empty
  comparison. Works because ponds/hand are flat `<ul>`s with no nested `</ul>` — a comment
  notes that structural assumption.
- Imports widen: `foldRecord, kindOf` + `type HandAction, type TileId` from `../core`;
  `Table` from `./Table.svelte`.

### Fixture block: `midHandRecord` / `exhaustedRecord` (design D2)

```ts
const dealt = foldRecord({ seed: BOOT_SEED, actions: [] })
// 8 tsumogiri turns, then East's first discard swapped to tedashi of dealt.hands[0][0],
// then a 9th draw by East, left pending.
const midHandActions = tsumogiriTurns(dealt.live, 8)
midHandActions[1] = { type: 'discard', seat: 0, tile: dealt.hands[0][0] }
midHandActions.push({ type: 'draw', seat: 0 })
const midHand = foldRecord({ seed: BOOT_SEED, actions: midHandActions })

const exhausted = foldRecord({ seed: BOOT_SEED, actions: tsumogiriTurns(dealt.live, 70) })
```

Expected facts (all asserted against the fold, not hardcoded): each pond has 2 tiles;
East's pond is `[dealt.hands[0][0], dealt.live[4]]` — an order only the log explains;
`midHand.turn === 0`, `midHand.drawn === dealt.live[8]`, `midHand.live.length === 61`;
`exhausted.phase === 'ryuukyoku'`, `exhausted.live.length === 0`. The test asserts markup
against `midHand.ponds[i].map(kindOf)` etc. — the fold stays the single source of truth;
the literal numbers above appear only as sanity guards, if at all.

### New describe blocks

1. `describe('mid-hand table view (SSR)')` — `render(Table, { props: { table: midHand } })`
   - four ponds render their tiles in discard order (ordered deep-equal per pond region)
   - the active seat is marked: exactly one `aria-current="true"`, located in the East
     seat's slice of the body
   - wall counter matches: body contains `` `${midHand.live.length} tiles left` ``
   - the drawn tile renders apart from the hand: `regionTokens(body, 'drawn tile')` is
     `[kindOf(midHand.drawn)]`, and 'your hand' still yields exactly 13 tokens
2. `describe('exhausted table view (SSR)')` — render with `exhausted`
   - body contains `'ryuukyoku'` (the banner) and `'0 tiles left'`
   - no `aria-current` anywhere (the hand is over; nobody is "to act")

## Ordering of changes

1. **Test file first** (fixtures + helpers + new describes) — they fail against the current
   Table for the right reasons (missing regions), proving they bite.
2. **Table.svelte** — template + styles until green.
3. One `just check` + `just test` gate; the two steps land as separate concerns in the
   commit sequence (see plan.md) but may share a commit if the diff reads better whole.

## Boundaries respected

- Data flows one way: core fold → prop → markup. No new state, no events (T-003-02-02).
- The view reads `phase`, `turn`, `drawn`, `ponds`, `live.length` — five field reads, zero
  recomputations. The only conditionals are presentation gates on those reads.
- Tests keep the file's charter: content and aria only — `class:active` is a visual
  courtesy the tests never mention.
