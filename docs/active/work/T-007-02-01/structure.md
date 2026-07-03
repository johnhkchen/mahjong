# T-007-02-01 — portrait-table-frame — Structure

## File-level changes

| File | Change |
| --- | --- |
| `src/app/Table.svelte` | **Modified — style block only.** Template (lines 1–134) byte-identical. |
| `docs/active/work/T-007-02-01/*` | RDSPI artifacts (this directory). |

**Created:** nothing in `src/`. A throwaway screenshot/overflow harness lives in the
session scratchpad, never in the repo.
**Deleted:** nothing.
**Explicitly untouched:** `src/app/Tile.svelte` (owned by concurrent T-007-01-02),
`src/app/App.svelte`, `src/app/ClaimPrompt.svelte`, all tests, all of `src/core/`,
`index.html`, build config.

## The one modified region: `Table.svelte` `<style>` (lines 136–312)

Selector-by-selector blueprint. Every selector that exists today still exists (no
unused-selector warnings possible); only declarations change.

### `.table` — the frame remap (the heart of the ticket)

```css
.table {
  /* custom properties (--felt etc.): unchanged */
  display: grid;                          /* unchanged */
  grid-template-areas:
    'west west west'
    'north center south'
    'east east east';                     /* was: '. west .' / 'north center south' / '. east .' */
  grid-template-columns: 1fr 7.5rem 1fr;  /* was: 1fr 2fr 1fr */
  grid-template-rows: auto 1fr auto;      /* was: 1fr 2fr 1fr */
  row-gap: 0.4rem;                        /* new: band separation */
  width: 100%;                            /* was: min(100%, 70dvh) */
  max-width: 26rem;                       /* new: the phone-frame cap on desktop */
  min-height: min(60dvh, 30rem);          /* new: boot-state presence; replaces aspect-ratio */
  box-sizing: border-box;                 /* new: 0.5rem border counts inside width */
  padding: 0.4rem 0.2rem;                 /* new: felt breathing room inside the border */
  /* aspect-ratio: 1 — REMOVED */
  /* background, border, border-radius, color: unchanged */
}
```

### `.seat` and `.center` — track-blowout guard

- `.seat`: add `min-width: 0`. Flex column internals unchanged.
- `.center`: add `min-width: 0`; replace `margin: 12%` with `margin: 0` +
  `padding: 0.5rem 0.25rem` (percentage margin was tuned for the square's wide middle
  column; in a 7.5rem track it must not eat tile space). `align-self: center` so the
  center card hugs its content height mid-band instead of stretching the full `1fr`
  row. Border/radius/flex internals unchanged.

### `.pond` — band-width wrapping

- `max-width: 9.5rem` → `max-width: 100%`. The wrapping flex behavior, gap,
  `min-height: 1.6em` reservation: unchanged. North/South ponds are now constrained
  by their ~96px grid tracks; East/West ponds by the full band.

### Everything else in the style block — unchanged

`.east/.south/.west/.north` (area assignments — the wind→area mapping still lives
here, once), `.seat.you`, `.seat.active`, `.you-mark`, `.hand`, `.pond .claimed`,
`.melds`, `.meld`, `.claimed-tile`, `.drawn`, `.tap`, `.ended`, `.win-summary`,
`.yaku`, `.dora`, `.label`. The hand/drawn/tap surface is deliberately left at current
scale and position — T-007-02-02 owns the thumb zone.

## Module boundaries and interfaces

No interface changes anywhere. `Table.svelte`'s public contract is unchanged
(`{ table, ontap }` in, same markup out); `core` is not imported differently; the
action-log contract is untouched. This is a pure presentation-layer re-tuning inside
one component's private style sheet — the architecture's "thin Svelte view" boundary
is what makes the ticket this small.

## Ordering of changes

Single atomic edit — there is exactly one coherent state (the new grid); intermediate
states (e.g. new areas with old columns) render nonsense. One commit for the code,
following the repo's `T-007-02-01: <summary>` message convention, staged with explicit
paths only (`src/app/Table.svelte`) because sibling Lisa threads have uncommitted work
in `src/app/Tile.svelte` and `src/core/` that must not be swept up.

## Verification structure (no repo files)

1. `just test` — the SSR suite must pass untouched (regression proof that markup and
   aria are unchanged).
2. `just check` — svelte-check + tsc, warning-clean.
3. `just build` — the single-file artifact, then headless Chrome (probed at implement
   time) renders `dist/index.html` at `--window-size=360,780`:
   - boot screenshot (`--virtual-time-budget` small) — dealt table, frame presence;
   - mid-hand screenshot (larger virtual-time budget lets the 250ms bot drive fill
     ponds) — four ponds + melds + dora + wall count all on screen, no horizontal
     clipping at the 360px edge.
   - a scratchpad harness page iframing `dist/index.html` at 360×780 and reporting
     the inner `document.documentElement.scrollWidth` (must be ≤ 360), dumped via
     `--dump-dom --allow-file-access-from-files` — the AC's overflow-x check as a
     number, if Chrome is available; otherwise the design's fixed-px arithmetic +
     screenshots are the evidence.
