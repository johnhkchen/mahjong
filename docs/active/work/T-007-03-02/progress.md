# T-007-03-02 — Progress

## Completed

- [x] **Step 1 — Baseline**: `just test` 568/568 green (24 files), `just check`
  0 errors 0 warnings. The shared tree's in-flight edits (other threads'
  `src/core/shanten.*`, ticket frontmatter) do not break the gates — clean
  baseline, nothing to discount later.
- [x] **Step 2 — Motion block**: appended one
  `@media (prefers-reduced-motion: no-preference)` block to the end of
  `src/app/Table.svelte`'s `<style>` — two claim animations (`meld-settle` on
  `li.meld`, `claim-turn` rotating `.claimed-tile` 0→90deg), the pond mark's
  `claim-taken` (opacity/tilt into the settled 0.45/8deg), and `reveal-rise`
  on `.center > .ended` + `.win-summary` (220ms fade-rise). All keyframes
  from-only; end states remain declared once, in the existing static rules.
  Diff: +58 lines, style block only; template and script untouched.
- [x] **Step 3 — Gates**: `just test` 568/568 green (meld display, hand-end,
  wall-exhausted SSR suites included), `just check` 0/0. No new
  `css-unused-selector` warnings — every animated selector matches.
- [x] **Step 4 — Built-artifact proof**: `just build` green, single-file gate
  OK (82,774 bytes; was ~82.1kB — well within gate). `dist/index.html` grep:
  each keyframe name appears exactly **twice** (the Svelte-hashed
  `@keyframes svelte-5dy8av-*` definition + its matching `animation:`
  reference — the wiring survives Svelte's keyframe scoping), and the whole
  block sits inside `prefers-reduced-motion:no-preference` in the minified
  output. Extracted the compiled block and eyeballed it: selectors scoped
  correctly, `.center > .ended` child combinator preserved.
- [x] **Step 5 — Implementation commit**: `src/app/Table.svelte` staged alone.

## Deviations from plan

1. **"Byte-identical SSR" refined.** Research/design claimed a style-only edit
   leaves SSR output byte-identical. Not exactly: editing the style block
   changes Svelte's scoping hash, which appears in every `class="… svelte-xxxx"`
   attribute of the SSR markup. The *structure, content, and aria vocabulary*
   are unchanged — which is what the tests assert and what the acceptance
   criterion means — and all suites pass unmodified. The guarantee is "markup
   facts identical", not "bytes identical". No action needed; recorded so the
   review doesn't overstate.
2. **Manual visual pass not performed.** No browser automation exists in this
   environment (no playwright/puppeteer in the toolchain) and adding one is out
   of scope by the ticket's own no-new-dependency intent. The compiled-CSS
   inspection in step 4 is the closest machine check. The `just dev`
   walk-through from plan.md step "Manual verification" (claim window + both
   hand-ends + macOS Reduce Motion toggle) remains open for a human — flagged
   in review.md.

## Remaining

- [x] Step 6 — review.md + artifacts commit (in flight; this file and review.md
  land in that commit).
