# T-003-02-02 — tap-to-discard-and-tsumogiri-loop — Progress

## Completed

- **Step 1 — `src/app/drive.ts`** ✅ — `PLAYER`, `tapDiscard`, `forcedAction`, exactly
  the structure.md signatures; header comment pins the boundary (offered list in →
  element of it or null out; tsumogiri arm = the swappable bot placeholder).
  Verified: `just check` clean.
- **Step 2 — `src/app/drive.test.ts`** ✅ — 11 tests: 5 `tapDiscard` (identity with the
  offered element, doctored-list rejection, draw-offering / other-seat / ended-hand
  rejections), 5 `forcedAction` (player + bot draws forced, bot tsumogiri = last
  offering = fold's drawn, player discard never forced, empty-offering halt), 1
  integration walk (deal → ryuukyoku in exactly 140 actions, every append an identity
  element of a fresh `legalActions` fold, East always tedashi-tapping his first offered
  tile, bot discards all tsumogiri, final offering empty, pond lengths 18/18/17/17).
  Verified: `just test` 100/100.
  **Commit 1: `95e31cd`.**
- **Step 3 — `Table.svelte`** ✅ — optional `ontap` prop; East's 13 hand tiles and the
  drawn tile wrapped in `<button type="button" aria-label="discard {kind}">`; `.tap`
  style neutralizes button chrome; header comment notes input wiring is not a derived
  fact. No legality knowledge in the view.
- **Step 4 — `App.svelte`** ✅ — `actions` `$state`, `table`/`offered` deriveds, `tap`
  through `tapDiscard`, `$effect` + 250 ms `setTimeout` fixed-point loop with timer
  cleanup, `<Table {table} ontap={tap} />`; stale "necessarily empty" comment replaced.
- **Step 5 — `app.ssr.test.ts` additions** ✅ — dealt App renders 13 region-scoped
  discard-button labels; mid-hand drawn tile carries its discard label. All existing
  SSR assertions untouched and green.
  Verified: `just test` 102/102, `just check` 0 errors / 0 warnings.
- **Step 6 — gates + smoke** ✅/⚠ — `just build` single-file gate OK (dist/index.html
  44.2 kB self-contained); `just dev` boots, serves the page and transforms `drive.ts`
  cleanly. **Deviation:** the plan's in-browser tap walk could not be performed — no
  browser-automation tool exists in this environment. The behavioral claims it would
  have covered are held by the integration walk (test 11) over the very functions App
  wires; the untested residue is the one-line Svelte bindings (onclick → `tap`, effect
  timer), flagged for a human in review.md.
  **Commit 2: `f83e210`.**

## Deviations from plan

- Plan's pond-length parenthetical said "17+18+18+17"; the correct split (East acts
  first, 70 turns) is E 18, S 18, W 17, N 17 — the test asserts `[18, 18, 17, 17]`.
- Manual dev-server tap walk downgraded to serve/transform smoke check (above) — no
  browser automation available; nothing else deviated.

## Remaining

Nothing — all plan steps executed; review.md is the next artifact.
