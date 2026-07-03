# T-007-03-01 — draw-and-discard-to-pond-motion — Structure

## File-level changes

| File | Change | Nature |
|---|---|---|
| `src/app/Table.svelte` | **modified** — `<style>` block only | add one `@media (prefers-reduced-motion: no-preference)` block containing the `.pond li` and `.drawn` transition + `@starting-style` rules |
| `docs/active/work/T-007-03-01/*` | **created** | RDSPI artifacts (this set) |

No files are created or deleted in `src/`. Explicitly untouched:

- `src/app/Table.svelte` **markup and script** — the diff is confined between
  `<style>` and `</style>`; no element, attribute, class name, or prop changes.
- `src/app/App.svelte`, `src/app/Tile.svelte`, `src/app/ClaimPrompt.svelte`,
  `src/app/drive.ts`, `src/app/main.ts` — no edits.
- `src/core/**` — byte-for-byte untouched (epic invariant).
- `package.json` / lockfile — no dependency changes.
- All test files — the AC requires existing tests green, none demand new ones;
  motion is not observable in the jsdom/SSR harness (no layout/animation
  engine), and the tap-mapping guard is sibling T-007-03-03's deliverable.

## Where the new CSS sits inside `Table.svelte`

Appended at the end of the existing `<style>` block (after `.label`, currently
line ~342), as one self-contained gated section:

```css
/* ── motion: draw + discard entrances (T-007-03-01) ─────────────────
   Insertion transitions via @starting-style — client-only by nature, so
   SSR output is untouched. Reduced-motion users and pre-@starting-style
   browsers share the no-op path: tiles appear instantly, as before. */
@media (prefers-reduced-motion: no-preference) {
  .pond li {
    transition: opacity 180ms ease-out, transform 180ms ease-out;
    @starting-style {
      opacity: 0;
      transform: translateY(-0.4rem);
    }
  }
  .drawn {
    transition: opacity 180ms ease-out, transform 180ms ease-out;
    @starting-style {
      opacity: 0;
      transform: translateY(0.35rem);
    }
  }
}
```

Rationale for placement and shape:

- **One media block, not per-rule gates** — the gate is the design's single
  policy point; a future motion ticket (T-007-03-02) extends the same block or
  adds a sibling, keeping "is motion enabled" answerable in one place.
- **End-of-block placement** — the existing style block is organized by table
  region (grid → seats → ponds → melds → hand → console → center); motion is a
  cross-cutting layer, so it sits after the regions rather than splicing into
  `.pond`/`.drawn`'s base rules. Base rules keep describing the settled state;
  the motion section describes only how elements *arrive* at it.
- **No custom properties** — two rules sharing two literals (`180ms ease-out`)
  don't yet earn an abstraction; T-007-03-02 can hoist a `--settle` token onto
  `.table` if a third consumer appears.

## Component/boundary map (unchanged, for orientation)

```
App.svelte            — drive loop, BOT_DELAY_MS=250 pacing   (no change)
 └─ Table.svelte      — stateless view of the fold            (style-only change)
     ├─ ul.pond > li  — keyed (id); discard = one appended li  ← entrance motion
     ├─ span.drawn    — {#if turn===0 && drawn}                ← entrance motion
     ├─ ul.hand > li  — keyed (id)                             (deliberately no motion)
     └─ Tile.svelte   — chip art leaf                          (no change)
```

The public contract is unmoved: `Table` still takes one folded `TableState`
prop; motion is a presentation property of two existing selectors. No new
interface, module, or export anywhere.

## Ordering of changes

Single atomic step — one CSS section in one file. There is no meaningful
sub-ordering; the commit is:

1. Add the gated motion section to `Table.svelte` styles, run the full gate
   suite (`just test`, `just check`, `just build`), verify motion empirically,
   commit.

## Risks pinned at the structure level

- **Svelte scoping of the nested at-rule** — retired by the Research spike:
  5.56.4 emits `.pond.svelte-hash li:where(.svelte-hash)` with the nested
  `@starting-style` intact, zero warnings.
- **svelte-check / vite CSS pipeline** — svelte-check uses the same compiler
  (spike-clean); Vite's esbuild CSS minifier handles `@starting-style` (it is
  plain nestable CSS). Confirmed empirically in the Implement phase by `just
  check` + `just build` + grepping the emitted dist for the at-rule.
- **Unintended transition targets** — `transition` on `.pond li` also covers
  the `.claimed` class flip (documented in Design as harmless prepayment of
  T-007-03-02) and nothing else: no other style in the component touches
  `.pond li` or `.drawn`'s `opacity`/`transform`.
