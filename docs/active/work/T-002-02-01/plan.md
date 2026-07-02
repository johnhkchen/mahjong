# T-002-02-01 — Plan: render dealt hand on table

Ordered steps with per-step verification. The code lands as **one atomic commit**
(structure §7: the four files are only green together), but the steps below are
executed and locally verified in sequence so failures localize.

## Step 0 — Baseline

Run `just test` and `just check` at HEAD to confirm the starting suite is green
(expected: 8 files / 51 tests, 0 check errors). Any pre-existing failure stops the
ticket before it muddies attribution.

## Step 1 — `src/app/Tile.svelte` (new leaf component)

Create the presentational tile chip per structure §2: `id: TileId` prop, `kindOf`
decode, `suitOf`-keyed text color class, chip styling, header comment marking it as
the future tile-art reskin point.

*Verify*: `just check` — svelte-check picks the new component up; it must compile
clean even before anything imports it (an unused component is not an error).

## Step 2 — `src/app/Table.svelte` (prop swap + hand + center)

Per structure §3, in one edit:

1. Prop: `wall: readonly TileId[]` → `table: TableState`; update imports
   (`Tile`, `kindIndexOf`, `kindOf`, `type TableState`).
2. `hand` derived: stable copy-sort of `table.hands[0]` by `kindIndexOf(kindOf(id))`.
3. East seat: `<ul class="hand" aria-label="your hand">` of keyed `<Tile {id} />`.
4. Center: remove `.count`/`.label` placeholder spans; add indicator Tile inside an
   `aria-label="dora indicator"` element with visible label, plus
   `{table.live.length} tiles left`.
5. CSS: hand-row layout (flex, no list bullets, tile sizing), center spacing; seat
   grid untouched.
6. Update the header comment (still stateless; sorting-is-presentation note).

*Verify*: `just check` reports the expected mismatch **in App only** (Table now wants
`table`, App still passes `wall`) and no errors inside Table itself — confirming
step 3 is the only remaining wiring.

## Step 3 — `src/app/App.svelte` (derivation swap)

Per structure §4: import `foldRecord` (drop `buildWall`), derive
`const table = $derived(foldRecord({ seed, actions: [] }))`, pass `<Table {table} />`,
refresh the derivation comment (record = seed + empty log; the view is a fold).
`seed = $state(1)` and its comment stay.

*Verify*: `just check` fully clean. `just dev` + eyeball (design §9's visual risk):
13 sorted chips at the bottom seat, indicator + "70 tiles left" in the center, no
overflow at phone-ish and desktop widths. (Visual only — not a gate the suite runs.)

## Step 4 — `src/app/app.ssr.test.ts` (rewrite)

Per structure §5:

- Keep header idiom, `BOOT_SEED = 1` + comment, `render(App)`, winds-once test,
  table-landmark test.
- Replace the wall-count test with the three new tests (design §8): tile-token
  multiset (13 hand kinds + indicator kind, exactly), aria region names
  (`your hand`, `dora indicator`), placeholder-replaced (live-remaining count
  present, `tiles in the wall` absent).
- All expectations derived by calling `foldRecord`/`kindOf` from `'../core'` inside
  the test; no literal tile values typed into assertions.

*Verify*: `just test` — full suite green (expected 8 files, 53 tests: 51 − 1 removed
+ 3 added). Then **perturb-restore** the load-bearing assertion: temporarily hide one
hand tile in Table (render 12) and confirm the multiset test fails; restore; confirm
green. (This proves the token-extraction regex actually binds to the markup — the one
piece of test machinery that could silently match nothing.)

## Step 5 — Full gate + code commit

`just test && just check && just build` — build must pass the single-file verifier
(`scripts/verify-single-file.mjs`), satisfying AC (c).

Commit (one, atomic):
`T-002-02-01: render dealt hand + dora indicator on the table via the core fold`
containing exactly: `src/app/Tile.svelte`, `src/app/Table.svelte`,
`src/app/App.svelte`, `src/app/app.ssr.test.ts`.

## Step 6 — Progress artifact

Write `progress.md` (running log kept during steps 1-5; finalized here): steps
completed, deviations from this plan (if any) with rationale, suite numbers, commit
hash. Then proceed to Review.

## Testing strategy summary

| Layer | What | Gate |
| --- | --- | --- |
| SSR content test | 13 dealt tiles + indicator as a token multiset; aria region names; placeholder replaced; winds; landmark — all fold-derived | `just test` (AC a) |
| Types/boundary | prop contracts, `TileState` consumption, barrel-only imports | `just check` (AC c) |
| Purity gate (existing) | core still imports nothing new (untouched, keeps passing) | `just test` |
| Build | single self-contained `dist/index.html` | `just build` (AC c) |
| Visual | chip layout, overflow, colors | manual `just dev` (non-gating) |

No new unit tests for Tile/Table in isolation: the SSR test through App exercises the
full component chain (App → Table → Tile) with real fold data, which is exactly AC
(a)'s framing; component-isolation tests would re-assert the same markup with less
integration value. No core tests change: core is untouched (any core diff in the
final `git status` is a red flag).

## Risk register (from design §9, with checkpoints)

- **Token regex binds nothing / matches extras** → perturb-restore in step 4; the
  exact-multiset (not superset) comparison catches extras.
- **Readonly-tuple sort mutation** → copy-sort (`[...]`) in step 2; svelte-check in
  step 2 verifies.
- **Chip overflow in the east cell** → step 3 eyeball; CSS-only fix if needed
  (non-gating, cannot slip the schedule).
- **`toSorted` availability** → node ≥ 20 in the flox pin has it; fallback is
  `[...].sort()` — trivial substitution if check complains.

## Definition of done (maps to ticket AC)

- (a) app.ssr.test.ts asserts the 13 dealt tiles + dora indicator, placeholder
  replaced — steps 4-5 green.
- (b) All table data via `foldRecord`; only presentation logic (sort, decode,
  `.length`) in `src/app/` — enforced by design/structure, checked in review.
- (c) `just check` + `just build` (single-file gate) pass — step 5.
