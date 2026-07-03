# T-007-02-02 — thumb-zone-hand-and-touch-targets — Structure

## Files touched (4 modified, 0 created, 0 deleted)

All changes are presentation-layer; `src/core/`, `drive.ts`, and every test file
are untouched. The one markup change in the whole ticket is the `div.console`
wrapper in App.svelte.

### 1. `src/app/Tile.svelte` — the scale seam (1 line)

In the `<style>` block only:

```css
.tile {
  /* was: font-size: 0.8rem */
  font-size: var(--tile-scale, 0.8rem);
}
```

- Public interface change: the chip now honors an inherited `--tile-scale`
  custom property; default preserves the settled 0.8rem basis everywhere no
  ancestor sets it (ponds, melds, dora, win summary, prompt header).
- No script/template change; the SVG chassis, `.kind` token, and all faces stay
  byte-identical.

### 2. `src/app/Table.svelte` — tap-zone sizing + card stretch (style block only)

Zero template edits (the T-007-02-01 precedent — SSR tests stay green by
construction). In `<style>`:

- `.table`: add `flex: 1 1 auto` (stretches inside App's column; inert if the
  parent isn't flex). Everything else in the T-007-02-01 band grid stays.
- `.hand`: `gap: 0.15rem` → `gap: 0` (the 44px button pitch provides the
  spacing); add `--tile-scale: 1.5rem` (chip 36×50.4px).
- `.drawn`: add `--tile-scale: 1.5rem`; keep it a separate centered row below
  the hand (its `<span>` sibling position is an SSR contract).
- `.tap`: add `min-width: 2.75rem; min-height: 2.75rem;` plus
  `display: inline-flex; align-items: center; justify-content: center;` so the
  chip centers in the 44px target; add `touch-action: manipulation` (kills the
  300ms double-tap-zoom delay on the primary surface).
- Ordering note: `.tap` styles both the hand and drawn buttons — one rule, both
  surfaces.

### 3. `src/app/App.svelte` — the pinned column + console slot

Template (the ticket's only markup change):

```svelte
<main>
  <header>mahjong</header>
  <Table {table} ontap={tap} />
  <div class="console">
    {#if (prompt.length > 0 || win !== null) && !dismissed}
      <ClaimPrompt … />   <!-- props unchanged -->
    {/if}
  </div>
</main>
```

The `{#if}` moves inside the always-rendered `div.console`; ClaimPrompt's props,
the drive wiring (`tap`, `claim`, `pass`, `takeWin`), the `$effect` loop, and all
script code are untouched.

Style:

- `main`: `justify-content: center` → `flex-start`; side padding 1rem → 0.5rem
  (the 7-per-row width budget); `padding-bottom:
  max(0.5rem, env(safe-area-inset-bottom))`; `gap: 1rem` → `0.5rem` (vertical
  economy); keep `align-items: center`, `min-height: 100dvh`, `box-sizing`.
- new `.console`: `min-height: 3.5rem; display: flex; align-items: flex-start;
  justify-content: center; width: 100%; max-width: 26rem;` (width cap mirrors
  the felt so a wide prompt wraps like the table does).

### 4. `src/app/ClaimPrompt.svelte` — button targets (style block only)

- `.call`, `.pass`: add `min-height: 2.75rem`; padding `0.3rem 0.6rem` →
  `0.4rem 0.8rem`; add `touch-action: manipulation`.
- `.call`: add `--tile-scale: 1rem` (choice tiles legible, row stays one line).
- `.pass`: unchanged ghost look otherwise — the target grows, the chrome doesn't.
- No template change: button order (win → calls → pass), labels, and the
  `</aside>` region shape are SSR contracts.

### 5. `index.html` — viewport meta

`content="width=device-width, initial-scale=1.0"` →
`content="width=device-width, initial-scale=1.0, viewport-fit=cover"`.
(Not a reference attribute — the single-file gate's rules are unaffected.)

## Module boundaries (unchanged, restated)

- **core → app**: `TableState` in, taps out — no change; no new derived facts.
- **Table**: stateless presentational; still never computes legality; buttons
  render whenever their tiles do.
- **ClaimPrompt**: computation-free input wiring; visibility stays the OWNER's
  fact in App.svelte (the `{#if}` merely moved inside a styling wrapper).
- **Tile**: presentational leaf; gains one *CSS* degree of freedom
  (`--tile-scale`), no new props.

## Interface contracts preserved (the SSR/drive green-list)

- `aria-label="your hand"` `<ul>` flat, one `discard …` button per tile (13 boot,
  11 post-chi), first `</ul>` closes the region.
- `aria-label="drawn tile"` `<span>` closed by `</span>`, its own `discard …`
  button — 13+1 = the AC's 14 tap-tiles.
- `aria-label="call or pass"` aside; win-first button order; `pass` label;
  absence at boot (`.console` renders empty).
- `drive.test.ts` — pure TS over the seam; no component logic touched.

## Change ordering

1. `Tile.svelte` var seam (safe no-op alone — default preserves today's size).
2. `Table.svelte` + `ClaimPrompt.svelte` sizing (each independently shippable).
3. `App.svelte` + `index.html` pinning (depends on `.table { flex: 1 }` from 2
   conceptually, but degrades gracefully — order 2↔3 is not load-bearing).
4. Gates + harness verification, then commit (single commit is fine: one concern,
   ~40 changed lines across four files; T-007-02-01 shipped the same way).
