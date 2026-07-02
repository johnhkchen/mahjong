# T-003-02-02 — Review: tap-to-discard-and-tsumogiri-loop

Self-assessment and handoff. The hand is now playable end-to-end: App owns the growing
record (`seed` + append-only `actions`), East discards by tapping, draws and the three
bot seats' tsumogiri land automatically one paced tick at a time, and the whole thing
halts at ryuukyoku because `legalActions` returns the empty offering — the app never
computes legality, counts the wall, or mirrors state outside the record.

## What changed

Two commits (`95e31cd`, `f83e210`); two files created, three modified; nothing deleted;
`src/core/**` untouched — both contract halves (`foldRecord`, `legalActions`) consumed
exactly as frozen.

### `src/app/drive.ts` (created, ~55 lines)

The seam between input and the record. `PLAYER` (East, seat 0), plus two pure
functions that take `legalActions` output and return an **element of it** or `null`:

- `tapDiscard(offered, player, tile)` — the discard of `tile` by `player` from the
  offered list, or null (not the player's discard turn / tile not offered).
- `forcedAction(offered, player)` — what happens without input: any draw (the player's
  included — a draw is never a choice), or bot tsumogiri as the **last** offered
  discard (legalActions' frozen hand-order-then-drawn-last contract; index sampling is
  its blessed use), or null on the player's discard choice / the empty ended offering.

The tsumogiri arm is documented as the deliberate bot placeholder — a real core bot
(stateless peripheral, state → action) later replaces exactly that arm.

### `src/app/App.svelte` (modified)

`let actions = $state<HandAction[]>([])` beside the existing seed;
`table = $derived(foldRecord({ seed, actions }))`, `offered =
$derived(legalActions(table))`. The tap handler appends `tapDiscard`'s result when
non-null. A `$effect` runs the table as a reactive fixed point: one `setTimeout`
(250 ms — pacing is presentation) appends `forcedAction`'s pick; the append re-folds,
re-derives, re-runs the effect until the player's choice or ryuukyoku; cleanup clears
the pending timer. `$effect` never runs in SSR, so server renders stay the dealt fold.

### `src/app/Table.svelte` (modified)

Still stateless: one new optional prop `ontap?: (tile: TileId) => void`. East's 13
hand tiles and the drawn tile render inside `<button type="button"
aria-label="discard {kind}">` (chrome-neutralized so the tile chip stays the visual
unit). No legality enters the view — buttons render whenever their tiles do; an
illegal tap is the caller's no-op.

### `src/app/drive.test.ts` (created, ~160 lines) + `app.ssr.test.ts` (2 tests added)

## Test coverage, AC by AC

The AC is one compound clause; piece by piece:

- **"taps only succeed on legally discardable tiles" / "the tap handler builds actions
  via legalActions rather than computing legality locally"** — the teeth are identity
  and the doctored list: tapping any of the 14 offered tiles returns the offered
  element itself (`toBe`, never a constructed lookalike), and a genuinely-held tile
  *removed* from the offered list is rejected — so legality demonstrably comes from
  the list (which App wires as `legalActions(table)`) and nowhere else. Draw-offering,
  other-seat, and ended-hand taps all return null.
- **"non-East seats auto-tsumogiri"** — `forcedAction` unit tests (bot pick = last
  offered = the fold's `drawn`, cross-checked against the step's independent
  statement) plus the integration walk asserting every bot discard equals the fold's
  drawn tile across the whole hand.
- **"a full seeded hand plays from deal to ryuukyoku"** — the integration walk drives
  `{seed: 1}` through only `forcedAction` + `tapDiscard` (East always tedashi-taps his
  first offered tile): exactly 140 actions, every one an identity element of a fresh
  `legalActions` fold, final phase ryuukyoku, live wall 0, pond lengths 18/18/17/17.
- **"the ryuukyoku state appears exactly when the wall empties"** — held jointly by
  core's frozen fold (phase flips on the wall-emptying discard, T-003-01-01) and
  T-003-02-01's wall-exhausted SSR suite; the loop's halt on the empty offering is
  tested here (`forcedAction([]) → null`, final `legalActions` empty).
- **"ponds and wall counter update after every action"** — rendering per state is
  T-003-02-01's suite; per-action landing is the paced effect (untested — below).
- **Tap surface** — new SSR tests: 13 region-scoped `discard` button labels in the
  dealt hand; the mid-hand drawn tile carries its own discard label.

**Gates:** `just test` 102/102 (89 pre-existing + 11 drive + 2 SSR), `just check`
0 errors / 0 warnings, `just build` single-file gate OK (44.2 kB self-contained),
`just dev` boots and serves cleanly.

## Coverage gaps (accepted, with owners)

- **The Svelte bindings themselves are untested** — `onclick={() => ontap?.(id)}`, the
  `$effect`/`setTimeout` pacing, and timer cleanup. The test environment is SSR-only
  (no DOM, no events, no effects — a deliberate repo choice; the design rejected
  adding jsdom for one binding line). Everything with decision content is in the
  tested seam; the bindings are one-liners. **A human should run `just dev` once and
  tap through a few rounds** — the one plan step this environment could not execute
  (no browser automation available; smoke check confirmed serve + transform only).
- **Pacing is unobserved by any test** — 250 ms is a taste constant in App.svelte;
  changing it can't break correctness (the integration walk is synchronous).
- **East's integration-walk policy is first-offered-tile** — deterministic tedashi;
  random tap sequencing over the app seam is adjacent to T-003-01-03's
  random-legal-walk charter, not duplicated here.

## Open concerns for a human reviewer

- **`forcedAction` leans on two legalActions contracts** — offering homogeneity
  (classify by `offered[0]`) and drawn-tile-last (tsumogiri by index). Both are
  documented, frozen, and pinned by the T-003-01-02 agreement suite, and the review
  there explicitly blessed index sampling; but when calls/riichi widen the vocabulary,
  offerings stop being homogeneous and this function must grow arms in the same
  ticket. Its doc comment says so.
- **Buttons are always tappable** (no disabled state during bot turns / draws) — an
  illegal tap is a silent no-op by design ("only succeed" = only append). Fine for the
  walking skeleton; a polish/teaching ticket may want affordances (disabled state,
  "not your turn" feedback).
- **Tsumogiri placeholder lives app-side** — deliberately (design.md decision 1): the
  real bot belongs to core's AI epic; the placeholder is shaped as its call site so
  the swap is a one-line rewire. Watch that no future app code grows smarter than
  "pick from offered".
- Nothing critical: no TODOs in code, plan deviations were cosmetic (pond-length
  arithmetic in the plan text; manual browser walk downgraded to smoke check —
  both recorded in progress.md).
