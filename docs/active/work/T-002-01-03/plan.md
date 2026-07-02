# T-002-01-03 — Plan: deal four starting hands

Ordered, independently verifiable steps executing structure.md. Commit convention
follows the repo precedent: one code commit for the ticket
(`T-002-01-03: <summary>`), artifacts committed separately at the end
(the T-002-01-02 pattern, commits 89a90e5 + 14b59e0).

## Step 1 — `src/core/deal.ts`

Create the module exactly as structure.md §2:

- Header comment (first live-wall consumer; frozen 4-4-4-1 convention; no RNG).
- `Seat`, `SEAT_COUNT`, `STARTING_HAND_SIZE`, `DEAL_SIZE`, `Deal`, `dealHands`.
- Guard `RangeError` on `live.length !== LIVE_WALL_SIZE`.
- CONTRACT FREEZE doc block on `dealHands` with the full index map.
- Careful with the purity gate: it scans comments for quoted specifiers, so doc
  comments must not contain quoted strings that look like bare imports.

**Verify:** module typechecks in isolation (step 3 runs the full gate).

## Step 2 — barrel export

Append `export * from './deal'` to `src/core/index.ts` (after `./dora`).

**Verify:** `just check` green (svelte-check + tsc strict, catches collision or type
errors immediately).

## Step 3 — property + guard tests

Create `src/core/deal.test.ts` with tests 1–5 from structure.md §3 (conservation,
seat-order/4-4-4-1 map, determinism + fresh arrays, input purity, length guard) — all
but the golden. Imports via `./index`; `seedArb` idiom.

**Verify:** `just test` green — including `purity.test.ts` picking up both new files,
and all pre-existing suites untouched.

## Step 4 — golden capture and golden test

Per structure.md §5:

1. Write a throwaway script in the scratchpad (NOT in the repo) that derives seed 1's
   deal two ways: (a) an explicit, independently written index list applied to
   `partitionWall(buildWall(1)).live`, and (b) `dealHands` itself. Print both.
2. Assert the two derivations agree; sanity-anchor East's first four tiles against the
   frozen wall prefix `[64, 53, 95, 45]` and `deal.live[0]` against `buildWall(1)[52]`.
3. Pin the agreed hands (4 × 13 literals) and `deal.live.slice(0, 4)` in the golden
   test, named per structure.md ("a mismatch means the deal convention changed…"),
   with the capture-provenance comment ("captured once… never regenerate").

**Verify:** `just test` green; deliberately perturb one pinned literal, confirm the
test fails, restore (proves the golden actually binds).

## Step 5 — full verification

- `just test` — all suites green (tiles, rng, wall, dora, purity, deal, app SSR).
- `just check` — svelte-check + tsc strict clean.
- Confirm `git status` shows only the three intended files (deal.ts, deal.test.ts,
  index.ts) plus artifacts.

## Step 6 — commit

- Code commit: `T-002-01-03: deal four 13-tile starting hands (dealHands) from the live wall`
  containing `src/core/deal.ts`, `src/core/deal.test.ts`, `src/core/index.ts`.
- Artifacts commit after review.md exists:
  `T-002-01-03: add RDSPI artifacts (research/design/structure/plan/progress/review)`.
- Do not touch ticket frontmatter (lisa owns phase/status).

## Testing strategy summary

| Concern | Test | Type |
| --- | --- | --- |
| AC (a) conservation of 136 distinct ids across hands + live + dead | deal.test.ts #1 | property (∀ seed) |
| AC (b) E/S/W/N order via the frozen 4-4-4-1 map | deal.test.ts #2 | property (∀ seed) |
| AC (c) same seed → identical deal | deal.test.ts #3 | property (∀ seed) |
| Derivation purity (input untouched) | deal.test.ts #4 | property (∀ seed) |
| Loud guard on corrupt wall length | deal.test.ts #5 | example-based |
| Convention freeze (replay contract) | deal.test.ts #6 golden | golden, pinned once |
| Core import purity | purity.test.ts (existing, auto-globs) | static gate |
| Type soundness | `just check` | static gate |

No integration tests needed: the deal has no side effects and no app surface until
T-002-02-01; the property chain build → partition → deal *is* the integration.

## Risks / watch items

- **Golden capture integrity**: the independent derivation must not be produced by
  calling `dealHands` twice. The script writes the index lists out literally.
- **`export *` collisions** are silent — step 2's `just check` plus test imports of
  every new name from `./index` (step 3) both guard this.
- **Purity-gate comment rule**: avoid quoted bare-package-looking strings in comments.
- **fast-check runtime**: six new properties at default 100 runs each over a 136-tile
  chain is well within the existing suite's budget (wall.test.ts already does this).
