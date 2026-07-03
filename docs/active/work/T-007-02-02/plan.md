# T-007-02-02 — thumb-zone-hand-and-touch-targets — Plan

## Steps

### Step 1 — Tile scale seam

Edit `src/app/Tile.svelte` `<style>`: `.tile { font-size: 0.8rem }` →
`font-size: var(--tile-scale, 0.8rem)`.

**Verify:** `just test` (SSR suites byte-compare nothing size-related; must stay
24 files / 564 green) and `just check`. This step alone changes zero rendered
pixels — the default equals today's value.

### Step 2 — Table tap zone

Edit `src/app/Table.svelte` `<style>` only (confirm with `git diff` that no
template line changed):

- `.table` += `flex: 1 1 auto`
- `.hand`: `gap: 0`; `--tile-scale: 1.5rem`
- `.drawn` += `--tile-scale: 1.5rem`
- `.tap` += `display: inline-flex; align-items: center; justify-content: center;
  min-width: 2.75rem; min-height: 2.75rem; touch-action: manipulation`

**Verify:** `just test`, `just check`; `git diff src/app/Table.svelte` shows a
style-block-only hunk.

### Step 3 — Prompt targets

Edit `src/app/ClaimPrompt.svelte` `<style>` only:

- `.call, .pass` += `min-height: 2.75rem; touch-action: manipulation`;
  padding → `0.4rem 0.8rem`
- `.call` += `--tile-scale: 1rem`

**Verify:** as Step 2.

### Step 4 — Pinned column + console slot

Edit `src/app/App.svelte`:

- Template: wrap the existing `{#if …}<ClaimPrompt …/>{/if}` in
  `<div class="console">…</div>` — the `{#if}` condition, props, and handlers
  move verbatim.
- Style: `main { justify-content: flex-start; gap: 0.5rem; padding: 1rem 0.5rem
  max(0.5rem, env(safe-area-inset-bottom)); }` (top keeps 1rem); add `.console
  { display: flex; align-items: flex-start; justify-content: center; width:
  100%; max-width: 26rem; min-height: 3.5rem; }`

Edit `index.html`: append `, viewport-fit=cover` to the viewport meta content.

**Verify:** `just test`, `just check`, `just build` (single-file gate incl.
300kB ceiling).

### Step 5 — Empirical geometry verification (scratchpad harness)

Rebuild T-007-02-01's harness in the session scratchpad (progress.md records the
working pattern — iframe `dist/index.html` at exactly 360×780; hanging
subresource + `--timeout` to keep headless Chrome alive; auto-player clicking
the drawn tile / pass buttons against the live 250ms bot drive). Measure and
record:

1. **Boot:** `documentElement.scrollWidth === 360`; the hand `<ul>` rect's
   bottom edge in the bottom third of the viewport (y ≥ 520); every
   `button.tap` rect ≥ 44×44.
2. **Player mid-turn (drawn tile up):** 14 tap buttons all ≥ 44×44, all inside
   the viewport, no horizontal scroll; hand wraps 7+6.
   A 14-tile state is any player turn; the auto-player pauses before
   discarding to measure.
3. **Claim window (seed 15, 8 tsumogiri turns — the frozen SSR anchor):** the
   prompt renders inside the console at the viewport bottom; every
   `.call`/`.pass` rect ≥ 44px tall and fully on-screen; the hand did not move
   when the prompt appeared (compare hand rect before/after window opens).
4. **Deep mid-hand** (auto-play far in, as T-007-02-01 did): `scrollWidth ===
   360`; no vertical overflow beyond expected; screenshot to scratchpad.
5. **Tap→discard end-to-end:** harness clicks a hand tile button and asserts
   the pond count increments — the AC's "tap→discard stays green" observed in
   the real DOM, not only in drive.test.ts.

Numbers land in progress.md; screenshots stay in the scratchpad.

### Step 6 — Commit

Single commit, exactly these paths: `src/app/Tile.svelte`,
`src/app/Table.svelte`, `src/app/ClaimPrompt.svelte`, `src/app/App.svelte`,
`index.html`. Message: `T-007-02-02: thumb-zone hand — 44px tap targets, pinned
bottom console`. Do **not** stage sibling threads' work (`git status` first;
docs/tickets and `src/core/shanten*` churn belongs to other threads).

Artifacts (research→review) commit separately after review.md, per repo
convention (`T-007-02-02: RDSPI artifacts — research through review`).

## Testing strategy

- **Unit/SSR (committed):** the existing 564 tests are the regression net; the
  AC explicitly requires them green *unmodified*. No new vitest tests: every new
  behavior is geometry, which vitest cannot observe (no layout engine) — same
  reasoned gap as T-007-02-01.
- **Types/lint:** `just check` after every step.
- **Build integrity:** `just build` runs the single-file verifier (self-
  containment + 300kB ceiling).
- **Geometry (empirical, session-scoped):** Step 5's five measurements map 1:1
  onto the AC clauses: thumb-zone placement, ≥44px targets, 14-tile wrap without
  horizontal scroll, drive/SSR behaviors observed live.

## Risks & fallbacks

- **7-per-row misses by a few px** on some font metrics → flex-wrap degrades to
  6+6+1 rows, still no scroll, AC still met; if the drawn row then feels tall,
  reduce `.hand` button pitch is NOT the fix (44px is the floor) — shave `main`
  side padding to 0.25rem instead.
- **Deep-pond states + taller hand overflow 780 vertically** → acceptable
  (vertical scroll is not an AC violation; horizontal is), but if boot/common
  states overflow, reclaim via `.table` row-gap and pond `min-height`.
- **`flex: 1` on `.table` surprises the b28.dev embed** (same file in attract
  mode) → it's `1 1 auto` inside a flex parent only; standalone embeds without a
  flex column are unaffected.
- **Console slot too short for stacked chi variants** → it grows (min-height,
  not height); the momentary table compression is the designed-in rare case.
