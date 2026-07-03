# T-008-01-01 — fu-calculation — Plan

Ordered, independently-verifiable steps. Each is small enough to commit atomically.

## Step 1 — scaffold `src/core/fu.ts`: constants, structural helpers, set-fu table

Write the module header comment, constants (§2 of structure.md), and the
non-ambiguous helpers: `isMenzen`, `isTsumoSource`, `isValuableKind`,
`valuableFuOf`, `meldSetOf`, `completesRyanmen`, `runContainsAtEdge`, `setFuOf`,
`isTripletOpenForFu`. No public export yet. No test file yet — these are private
building blocks, verified transitively by Step 3's tests.

**Verify:** `just check` (tsc) passes — no runtime behavior to test in isolation.

## Step 2 — `waitAndPairFuOf`, `standardFuOf`, and the public `fuOf` dispatcher

Implement the candidate-enumeration/max-fu logic (design.md §2, structure.md's
`waitAndPairFuOf`), the assembly function `standardFuOf`, the two pinfu/kuipinfu
overrides (design.md §4), the chiitoitsu/kokushi dispatch, and rounding. Export
`fuOf(ctx: WinContext): number` as the sole public symbol.

**Verify:** `just check` passes; module compiles and imports cleanly (a throwaway
`tsc --noEmit` single-file check via `just check` is enough — no test yet).

## Step 3 — `src/core/fu.test.ts`: the AC-pinned fixtures

Build the test file per structure.md §3, groups 1–6 (the literal AC bullets) first:

1. **Pinfu tsumo 20 / ron 30.** e.g. closed hand `234m 567p 789s 22z... ` — actually
   pair must be NON-yakuhai: use a simple pair (`22m`) plus three runs plus the
   winning run on ryanmen. Concealed, zero melds. Assert `fuOf` = 20 on tsumo
   context, 30 on ron context (same decomposition, `source` swapped between
   `'wall'` and `'discard'`).
2. **Chiitoitsu fixed 25.** Seven distinct pairs, any winning kind among them.
   Assert 25 for both tsumo and ron `source`.
3. **Open pinfu-shaped ron 30 (kuipinfu).** One `chi` meld + three concealed runs +
   non-yakuhai pair, ryanmen-completed, `source: 'discard'`. Assert 30. Add the
   sibling tsumo case (source `'wall'`) asserting 30 via ordinary rounding
   (22→30), to document design.md §4's "tsumo needs no special case" claim as a
   real assertion, not just a comment.
4. **Closed ron +10 menzen.** A non-pinfu closed hand (e.g. one kanchan-wait run
   plus a valuable pair) — compare the SAME decomposition's fu on `'discard'`
   (ron) vs `'wall'` (tsumo): ron total = tsumo total + 10 - 2 (menzen bonus in,
   tsumo bonus out), asserted as concrete numbers, not a diffed relation.
5. **Kan vs triplet fu.** Four fixtures, same kind (e.g. `1z` haku, terminal/honor
   rate) as: concealed ankou (closed triplet in decomposition.sets, tsumo-sourced
   so no ron-adjustment), ron-completed triplet-in-decomposition (open rate via the
   adjustment), `ankan` meld (closed kan), `daiminkan`/`shouminkan` meld (open kan)
   — assert the four values 8/4/32/16 relationship (terminal/honor rates) land
   correctly relative to each other and against the base-plus-known-remainder
   arithmetic.
6. **Round-up-to-10.** Construct a hand whose raw sum is NOT a multiple of 10
   (e.g. 20 base + 4 open-simple-triplet + 2 wait + 2 pair-not-valuable... pick
   concrete tiles so the arithmetic is checkable by hand in the comment) landing
   on 22 or 42, assert rounds up to 30/50 respectively.

Then group 7 (ambiguity) and group 8 (kokushi throws), per structure.md.

**Verify:** `just test` green for `fu.test.ts` specifically first
(`npx vitest run src/core/fu.test.ts` during iteration), then the full suite.

## Step 4 — barrel export

Add `export * from './fu'` to `src/core/index.ts` in the existing alphabetical/
dependency-ish position (after `yakuman`, matching the file's current tail — fu
depends on yaku/agari/record/tiles, same tier as yakuman).

**Verify:** `just check` (svelte-check + tsc across the whole project, confirming
no import cycle and the barrel re-export type-checks) and `just test` (full suite,
confirming nothing else broke) both green.

## Step 5 — full-suite verification pass

Run `just test` and `just check` one more time from a clean state (no partial
edits), confirming:
- No `src/core/` file gained a DOM/Svelte import (grep `from 'svelte'` /
  `from '../app` finds nothing new).
- `fu.ts` exports exactly `fuOf` (no accidental additional public surface beyond
  what design.md §7 specifies) — spot check via `index.ts`'s re-export and a quick
  grep for `export` in `fu.ts`.

**Verify:** both commands exit 0. This step produces no code change unless a
regression surfaces, in which case fix and re-verify before moving to Review.

## Testing strategy summary

- **Unit-only** — no integration/property tests here; T-008-01-04
  (scoring-property-grid) is explicitly the property-test ticket for the whole han×
  fu surface and depends on this ticket plus T-008-01-03. This ticket's suite is
  fixture-based, matching `yaku.test.ts`'s house style and the AC's literal
  "fixtures pinning the classic traps" wording.
- Every fixture's expected number is hand-derived in a comment from the table in
  research.md §3 before the assertion — never reverse-engineered from a first
  failing run (the `yaku.test.ts` precedent, restated in structure.md §3).
- `just check` is run after Steps 1, 2, and 4 (cheap, catches type drift early);
  `just test` is the Step 3/5 gate.

## Commit boundaries

One commit per step is the target: (1) scaffold, (2) dispatcher, (3) tests green,
(4) barrel export, folding step 5 into step 4's commit if nothing surfaces (no
separate empty commit for a clean verification pass).
