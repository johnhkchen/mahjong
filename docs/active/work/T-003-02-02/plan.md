# T-003-02-02 — tap-to-discard-and-tsumogiri-loop — Plan

Ordered, independently verifiable steps; two atomic commits. Structure.md is the
blueprint; this sequences it and pins the verification for each step.

## Step 1 — `src/app/drive.ts`: the seam

Write the module exactly as specified in structure.md: `PLAYER`, `tapDiscard`,
`forcedAction`, header comment stating the boundary (offered list in → element of it or
null out; no legality computed; tsumogiri chooser = bot placeholder, swappable arm).

**Verify:** `just check` — types only; the module compiles against the barrel's
`HandAction`/`Seat`/`TileId` with no core changes.

## Step 2 — `src/app/drive.test.ts`: the AC's app test

Helpers (per-file, repo convention):

- `dealt = foldRecord({ seed: 1, actions: [] })` — the frozen anchor.
- `afterEastDraw = foldRecord({ seed: 1, actions: [{ type: 'draw', seat: 0 }] })` —
  a post-draw player state; its offering has 14 discards.
- `botTurnState(…)` — fold of East's tsumogiri turn + South's draw, giving a non-player
  discard offering.

Tests, in three describes:

**`tapDiscard`** (the "via legalActions, not local legality" clause):
1. On `afterEastDraw`'s offering: tapping each of the 14 discardable tiles returns the
   *same object* as the offered element (`toBe`, not `toEqual`) — the built action IS
   `legalActions` output.
2. Doctored list: `offered` with the first hand tile's discard removed → tapping that
   tile returns `null`, though the fold says East holds it. Legality demonstrably comes
   from the list alone.
3. Draw offering (dealt state) → tapping any of East's 13 tiles returns `null`.
4. Bot offering → tapping (as `PLAYER`) any offered tile returns `null` (seat guard).
5. Empty offering (ryuukyoku fold, reuse an all-tsumogiri 140-action record) → `null`.

**`forcedAction`**:
6. Dealt state (East pre-draw) → returns the singleton draw itself (`toBe`) — draws are
   forced even for the player.
7. Bot pre-draw state → returns that seat's draw.
8. Bot post-draw offering → returns the LAST offered element, and its tile equals the
   fold's `state.drawn` — tsumogiri cross-checked against the independent statement.
9. `afterEastDraw` (player post-draw) → `null`: the player's discard is never forced.
10. Ryuukyoku fold → `null`: the loop's halt condition.

**full hand driven through the seam** (integration walk, all synchronous):
11. From `{seed: 1, actions: []}`, loop: fold → `legalActions` → `forcedAction`; if
    non-null append it; else if the offering is non-empty, append
    `tapDiscard(offered, PLAYER, offered[0].tile)` (East always taps his first offered
    tile — a tedashi-shaped choice, exercising hand discards, not just tsumogiri);
    else stop. Assert during the walk: every appended action is an element of that
    iteration's offering (identity); for every bot discard, the tile equals the fold's
    `drawn` (pond purity). Assert at the end: `phase === 'ryuukyoku'`,
    `actions.length === 140`, `live.length === 0`, `legalActions(final)` is `[]`, and
    the three bot ponds have 17/18 tiles matching the wall order they drew (lengths
    17+18+18+17 = 70 discards total across the four ponds).

**Verify:** `just test` — new file green, all pre-existing suites untouched and green.

**Commit 1:** `T-003-02-02: drive seam — tap and forced actions selected from
legalActions output` (drive.ts + drive.test.ts).

## Step 3 — `src/app/Table.svelte`: the tappable surface

Per structure.md: widen props with optional `ontap`; wrap East's 13 hand tiles and the
drawn tile in `<button type="button" aria-label="discard {kindOf(id)}"
onclick={() => ontap?.(id)}>`; add the chrome-neutralizing button style. Update the
header comment (input wiring out is not a derived fact).

**Verify:** `just check`; `just test` — the existing SSR suites must still pass
unchanged (token regex sees no new `>[1-9][mpsz]<` matches; wind counts unaffected).

## Step 4 — `src/app/App.svelte`: the record grows

Per structure.md: `actions` `$state`, `table`/`offered` deriveds, `tap` handler through
`tapDiscard`, paced `$effect` through `forcedAction` with timer cleanup, `<Table {table}
ontap={tap} />`, comment rewrite.

**Verify:** `just check`; `just test` (App SSR suite still sees the dealt fold — no
effects on the server).

## Step 5 — `src/app/app.ssr.test.ts` additions

- Dealt-App suite: the your-hand region contains exactly 13 `aria-label="discard `
  occurrences (region-scoped, not whole-body, to stay robust to the drawn-tile button).
- Mid-hand Table suite: the drawn-tile region contains a discard button label.

**Verify:** `just test` full run green.

## Step 6 — manual end-to-end (`just dev`) + build gate

The AC's first clause is a dev-server behavior; walk it once:

- Boot: dealt table, East auto-draws after one pacing tick.
- Tap a non-offered surface moment (during bot turns) → nothing happens.
- Tap a hand tile on East's turn → it lands in East's pond; S/W/N tsumogiri one by one,
  visibly, ponds and wall counter updating per action; East auto-draws again.
- Let it run (tapping each round) toward the tail OR temporarily raise the fold's
  starting actions? — no: verify pacing/tap behavior for several rounds manually, and
  trust the integration walk (step 2, test 11) for the deal-to-ryuukyoku claim; the
  ryuukyoku *rendering* is already covered by T-003-02-01's SSR suite off the same fold.

Then `just build` — single-file gate stays green.

**Commit 2:** `T-003-02-02: tap-to-discard and paced tsumogiri loop — the record grows
in App, taps and bot turns selected from legalActions`.

## Testing strategy summary

- **Unit (drive.test.ts 1–10):** the seam's whole contract, including the AC's
  "via legalActions rather than computing legality locally" (tests 1–2 are the teeth:
  identity with offered elements + doctored-list rejection).
- **Integration (test 11):** the AC's "full seeded hand plays from deal to ryuukyoku…
  non-East seats auto-tsumogiri… ryuukyoku exactly when the wall empties", minus the
  literal tapping/pacing, which SSR cannot host.
- **SSR (step 5):** the tap surface exists and is labeled for assistive tech.
- **Manual (step 6):** pacing, visual updates per action, real tap wiring.

## Risks and contingencies

- **Svelte effect-loop guard:** the chain is one append per timer tick (async), never a
  synchronous effect cycle — no depth risk. If `actions.push` inside a timeout were
  flagged by lint/check, fall back to reassignment (`actions = [...actions, action]`);
  semantics identical, still one fold per action.
- **SSR wind-count/token constraints:** buttons and `discard Xm` labels add neither
  wind words nor `>token<` matches; if `svelte-check` demands more a11y attributes on
  buttons, satisfy locally without new global styles.
- **Deep-proxy fold cost:** re-folding 140 proxied actions per append is O(n²) over
  trivial n; architecture.md explicitly blesses re-derive-by-folding. No memo layer.
