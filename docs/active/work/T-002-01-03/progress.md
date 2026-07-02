# T-002-01-03 — Progress: deal four starting hands

Tracking against plan.md. All steps completed in one pass; no deviations of substance.

## Completed

- [x] **Step 1 — `src/core/deal.ts`**: `Seat`, `SEAT_COUNT`, `STARTING_HAND_SIZE`,
      `DEAL_SIZE`, `Deal`, `dealHands` with the CONTRACT FREEZE doc block (4-4-4-1
      index map), the `RangeError` guard on `live.length !== LIVE_WALL_SIZE`, and
      purity-gate-safe comments. Imports: `./tiles` (type), `./wall` (constant) only.
- [x] **Step 2 — barrel**: `export * from './deal'` appended to `src/core/index.ts`.
      `just check` green immediately after (0 errors, 0 warnings) — no `export *`
      collisions.
- [x] **Step 3 — properties + guard** in `src/core/deal.test.ts`: conservation (AC a),
      frozen 4-4-4-1 seat-order map (AC b), determinism with fresh arrays (AC c),
      input-purity, and the length guard (0/52/121/123/136 → RangeError). `just test`
      green: 7 files, 43 tests at that point.
- [x] **Step 4 — golden capture**: throwaway scratchpad script (`capture-deal-golden.ts`,
      not committed) derived seed 1's deal two independent ways — literal per-seat index
      lists `[0,1,2,3,16,…,48] …` applied to `partitionWall(buildWall(1)).live`, versus
      `dealHands` itself. Output: **AGREE** on all four hands and the remainder, plus
      both sanity anchors: East's first four = frozen wall prefix `[64, 53, 95, 45]`
      (wall.test.ts golden) and `deal.live[0] === buildWall(1)[52]`. Pinned values:
      - E: `[64, 53, 95, 45, 86, 118, 50, 8, 36, 46, 49, 11, 82]`
      - S: `[98, 42, 120, 91, 2, 106, 28, 26, 81, 83, 7, 79, 38]`
      - W: `[104, 0, 97, 110, 40, 73, 48, 44, 29, 10, 129, 22, 74]`
      - N: `[132, 54, 37, 12, 89, 134, 113, 58, 61, 84, 32, 131, 4]`
      - remaining live prefix: `[100, 60, 14, 66]`
      Golden-binds check performed: perturbed `64 → 65` in the pinned East hand, suite
      failed (1 failed / 43 passed), restored, suite green again.
- [x] **Step 5 — full verification**: `just test` → 7 files, **44 tests, all passing**
      (tiles, rng, wall, dora, purity, deal, app SSR). `just check` → svelte-check +
      tsc strict, 0 errors. `git status` shows exactly the intended code files
      (deal.ts, deal.test.ts, index.ts) plus this ticket's artifacts.
- [x] **Step 6 — code commit**: `T-002-01-03: deal four 13-tile starting hands
      (dealHands) from the live wall` — src/core/deal.ts, src/core/deal.test.ts,
      src/core/index.ts only. Ticket frontmatter untouched (lisa owns phase/status);
      the artifacts commit follows once review.md exists.

## Deviations from plan

- The golden-capture script needed an absolute import path for the core barrel (a
  relative path from the scratchpad did not resolve under tsx); cosmetic only, the
  derivation logic ran exactly as planned.
- None otherwise — module shape, test names, and golden procedure match structure.md.

## Remaining

- Review phase (review.md), then the artifacts commit.
