# T-007-03-01 — draw-and-discard-to-pond-motion — Progress

## Step 1 — Baseline gates ✅

- `just test`: 24 files / 568 tests, all green (including the unrelated
  in-flight `src/core/shanten*` edits present in the shared tree).
- `just check`: 177 files, 0 errors, 0 warnings.

## Step 2 — Motion CSS added to `Table.svelte` ✅ (with a mid-flight merge)

While this ticket was in Design, sibling thread **T-007-03-02** landed its own
motion section (claim/hand-end `@keyframes`, same reduced-motion gate) at the
end of `Table.svelte`'s style block and committed it. Adaptation, not
deviation: this ticket's section was appended **after** the sibling's block as
its own `@media (prefers-reduced-motion: no-preference)` section, exactly the
"sibling block" option structure.md anticipated. One interaction note added to
the code comment: on the recreated claimed pond li, the sibling's `claim-taken`
animation preempts this transition for the shared properties (running
animations own animated properties) — which is the intended visual.

Diff discipline held: after the sibling's commit, `git diff src/app/Table.svelte`
is exactly this ticket's 31 inserted style lines; no markup, script, or other
file touched.

## Step 3 — Static gates ✅

- `just check`: 0 errors, 0 warnings (nested `@starting-style` compiles clean,
  as the Research spike predicted).
- `just test`: 568/568 green — SSR and drive assertions untouched.
- `just build`: `dist/index.html` 83,176 bytes, single-file gate OK (limit
  300,000). Grep of dist confirms both `@starting-style` rules survived
  minification, correctly svelte-scoped, inside the (esbuild-merged)
  `prefers-reduced-motion:no-preference` media query.

## Step 4 — Empirical motion verification ✅

Headless-Chrome probe (pattern per T-007-02-01/-02, extended): harness page
iframes the built `dist/index.html` at 360×780 over a local HTTP server, with
an auto-player (tsumogiri the drawn tile, pass any prompt) and a
MutationObserver sampling computed style on every inserted pond `li` / `.drawn`
span at +50ms and +400ms. Real-time run (virtual-time budget provably cannot
advance the transition clock — first attempt showed transitions applied but
frozen at their starting style).

- **Motion pass** (default media): 28 pond insertions + 7 drawn insertions,
  every one `transition: 0.18s, 0.18s`; **35/35 mid-flight at +50ms**
  (opacity ≈0.35–0.42, consistent with 180ms ease-out from 0); all persisting
  elements settled at opacity 1 by +400ms (one 0.45 reading is a claimed
  tile's settled opacity — correct).
- **Reduced-motion pass** (`--force-prefers-reduced-motion`): media query
  correctly unmatched; computed `transition: 0s` on every insertion; opacity
  already 1 at +50ms — instant appearance, byte-identical behavior to before
  this ticket.
- Auto-player drove a full multi-round sequence: all four ponds fed (bot and
  player discards sampled alike), draws arriving each player turn, one claim
  prompt passed.

## Step 5 — Commit ✅

- Code commit: `src/app/Table.svelte` only (the sibling's earlier commit left
  the working diff exactly this ticket's hunk).
- Artifacts commit: `docs/active/work/T-007-03-01/` (research → review), per
  the repo's established two-commit pattern.

## Deviations from plan

1. **Sibling collision handled** (above): plan Step 5's "commit only this
   ticket's files" was executed by *waiting out* the sibling's commit rather
   than partial staging — the cleaner path once their commit landed.
2. **Probe transport**: plan Step 4 offered dump-DOM as the capture mechanism;
   Chrome's current headless removed `--timeout`, so the harness POSTs its
   report to a scratchpad HTTP server instead. Same probe, different exfil.
3. Nothing else deviated; no scope was added or dropped.

## Remaining

Nothing — review.md is the final artifact.
