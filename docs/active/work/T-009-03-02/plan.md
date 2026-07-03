# Plan — T-009-03-02: furiten badge and yakuless notice

## Step 1 — core queries + unit tests (commit: "core")

- Add `furitenSeal(state, seat): TileId | null` and `yakulessTenpai(state,
  seat): boolean` to `src/core/legal.ts`, positioned after `ronOffers` (design.md
  Decisions 1-4). Header addendum naming both exports.
- New `src/core/legal.furiten.test.ts`, reusing fixtures already frozen
  elsewhere in the codebase (no new seed-mining needed for the core suite):
  - `furitenSeal`: `FURITEN_SEED=23798`/21 turns (basic, self-pond, expect
    `6p`); `RON_SEED=3951`/2 turns then 4 turns (temporary — seals cross-pond
    on seat 0's... no, seat 3's window, then clears); `RIICHI_FURITEN_SEED=100`
    (permanent, never clears); a no-furiten baseline.
  - `yakulessTenpai`: `YAKULESS_SEED=12754` at 0 actions (true); `RON_SEED` at
    0 actions (false — pinfu has yaku); the seed-100 riichi-locked state
    (false — riichi is a yaku); a synthetic open-hand override built from the
    `YAKULESS_SEED` fixture's own 4z triplet folded into a pon (false — the
    isMenzen gate, independent of the underlying yakuless shape).
- Verification: `npx vitest run src/core/legal.furiten.test.ts` green,
  `npx svelte-check`/`tsc` clean, full suite shows no NEW failures versus
  the pre-existing baseline (checked once, up front, against a clean stash of
  a fresh checkout — see progress.md for the exact 4 pre-existing failures
  and why they are unrelated).

## Step 2 — Table.svelte wiring (commit: "table")

- Widen `Table`'s props with optional `furitenTile?: TileId | null` and
  `yakulessTenpai?: boolean`.
- Render both inside the existing `{#if seat.you}` block, after the drawn-tile
  section, per design.md Decisions 5-6 (kind-agnostic copy, `<Tile>` reuse).
- New scoped CSS matching the `.hint` register.
- No test changes yet — Table's existing SSR/tap suites must stay green with
  the new props simply absent/undefined (optional props, `{#if}`-gated).

## Step 3 — App.svelte wiring (commit: "app")

- Import `furitenSeal`/`yakulessTenpai` from `'../core'`.
- Two new `$derived` values (`furitenTile`, `yakuless`) computed from `table`
  directly, passed through to `<Table>`.
- No console-slot changes (Decision 5) — verify the existing riichi-prompt/
  claim-prompt/hint SSR and tap suites are unaffected.

## Step 4 — SSR coverage at the view layer (commit: "ssr tests")

- New `describe` block in `app.ssr.test.ts`, rendering `Table` directly
  against real folded states (never hand-typed markup), per the file's own
  documented pattern for mid-hand/wall-exhausted states:
  - furiten present (`RON_SEED`, sealed) → region + tile token + "tsumo still
    wins".
  - furiten absent (`RON_SEED`, cleared) → region absent.
  - yakuless notice present — a freshly mined seed where seat 0 itself is
    closed/tenpai/yakuless at zero actions (mining needed: no existing fixture
    targets seat 0 specifically for this fact; the existing `YAKULESS_SEED`
    is seat 2). Mine via a short scratch scan (`yakulessTenpai(foldRecord({
    seed, actions: [] }), 0)` over an ascending seed range), pin whichever
    seed hits first, never regenerate — the codebase's own convention.
  - neither region — the existing `BOOT_SEED` fresh-deal fixture already used
    elsewhere in the file (0 actions ⇒ not tenpai, no pond history).

## Testing strategy summary

| Layer | What | How |
|---|---|---|
| Core unit | `furitenSeal`, `yakulessTenpai` correctness (all 3 furiten kinds, all yakuless gates) | `legal.furiten.test.ts`, frozen seeds |
| Type safety | New exports, new props | `svelte-check` + `tsc -p tsconfig.node.json` |
| View SSR | Badge/notice render exactly when the core fact is true, absent otherwise | `app.ssr.test.ts`, real folds through real Svelte compiler |
| Regression | Nothing else moves | Full `vitest run`, diffed against the pre-existing failing set |

No property-based test is added for either query: both are thin compositions
of already property-tested primitives (`waits`, `yakuOf`/`winYaku`, the fold's
own `tempFuriten`/`riichiFuriten`), and the ticket's AC asks for pinned
fixture coverage ("SSR tests"), not a new invariant.

## Verification checklist (executed during Implement, recorded in progress.md)

- [ ] `npx vitest run src/core/legal.furiten.test.ts` — green
- [ ] `npx vitest run src/app/app.ssr.test.ts` — green
- [ ] `npx svelte-check --tsconfig ./tsconfig.json` — 0 errors
- [ ] `npx tsc -p tsconfig.node.json --noEmit` — clean
- [ ] Full `npx vitest run` — no failures beyond the 4 pre-existing ones
- [ ] Manual SSR markup print (scratch, deleted after) — badge/notice HTML
      well-formed, matches Decision 6's copy exactly
