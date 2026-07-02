# T-001-02-02 — Progress

All seven plan steps executed in order, no deviations from plan.md. Code committed as
`b6366fd` (`T-001-02-02: seeded rng (mulberry32) + wall build + first property tests`).

## Step log

### Step 1 — fast-check devDependency ✅

- `npm view fast-check version` → **4.8.0** (current release at implement time).
- Installed with `npm install -D -E fast-check` inside the flox toolchain; `package.json`
  now pins `"fast-check": "4.8.0"` (exact, matching the repo convention) and
  `package-lock.json` updated (2 packages added: fast-check + its single dependency
  `pure-rand`). 0 vulnerabilities reported.

### Step 2 — `src/core/rng.ts` ✅

Written per structure.md: `Rng` type (`() => number`, u32), `createRng` (mulberry32 over
one uint32 state word, `seed >>> 0` normalization), `nextInt` (rejection sampling with a
RangeError guard on non-integer / < 1 / > 2^32 bounds), `shuffleInPlace` (Durstenfeld,
mutates and returns). Header comment states the contract-freeze warning. Import-free.

### Step 3 — Golden-vector capture + independent cross-check ✅

Followed the bespoke procedure exactly:

1. An **independent transcription** of the published mulberry32 reference (plus a
   from-the-design-spec re-implementation of nextInt + shuffle) was written in the session
   scratchpad (`mulberry32-reference.mjs`), *not* importing the repo file.
2. The repo implementation was run separately via node type-stripping
   (`repo-rng-capture.mjs` importing `src/core/rng.ts`).
3. `diff` of the two outputs: **VECTORS MATCH** — all 15 u32 values (seeds 0, 1,
   0xDEADBEEF × 5 outputs) and the seed-1 wall prefix agree exactly.

Frozen values (recorded here as the artifact-of-record; the tests carry the same values):

```
seed 0:          1144304738, 1416247, 958946056, 627933444, 2007157716
seed 1:          2693262067, 11749833, 2265367787, 4213581821, 4159151403
seed 0xDEADBEEF: 4043151706, 1147597007, 3315858022, 1538288752, 2042435954
wall(1)[0..12):  64, 53, 95, 45, 98, 42, 120, 91, 104, 0, 97, 110
```

### Step 4 — `src/core/rng.test.ts` + barrel ✅

Barrel gained `export * from './rng'` (and `'./wall'` in the same edit — steps 4/5
interleaved harmlessly since wall.ts was written alongside). Seven tests: golden vectors,
same-seed stream determinism, `>>> 0` normalization, u32 output property, `nextInt` range
property (bounds up to 2^32), `nextInt` guard examples (0, negative, fractional, 2^32+1,
NaN), `shuffleInPlace` permutation/in-place-identity/determinism property.

- `npx vitest run src/core/rng.test.ts`: **7 passed**.

### Step 5 — `src/core/wall.ts` + `src/core/wall.test.ts` ✅

`buildWall(seed)` as the two-line composition. Five tests: census property (AC-a: 136
ids, all distinct, in range, exactly 4 per kind across all 34 kinds), determinism property
(AC-b: deep-equal + distinct array objects), sensitivity property (AC-c: distinct uint32
seed pairs → different walls), normalization property, golden wall prefix for seed 1.

- `npx vitest run src/core/wall.test.ts`: **5 passed**.

### Step 6 — Full gate ✅

| Gate | Result |
| --- | --- |
| `just test` | 3 test files, **20 passed** (tiles 8, rng 7, wall 5), ~0.5 s |
| `just check` | svelte-check: 141 files, **0 errors 0 warnings**; tsc node config clean |
| `just build` | single-file bundle closes: `dist/index.html` **23.44 kB** (gzip 9.57 kB) — fast-check absent from the bundle as required (dev-only) |
| Purity grep | `grep -rn -E "from ['\"](svelte\|.*app/)\|document\.\|window\." src/core/` → no matches |
| `Math.random` grep | no matches anywhere in `src/` |

### Step 7 — Commit ✅

Staged exactly the seven planned files (`src/core/rng.ts`, `src/core/rng.test.ts`,
`src/core/wall.ts`, `src/core/wall.test.ts`, `src/core/index.ts`, `package.json`,
`package-lock.json`); unrelated working-tree changes (lisa ticket-frontmatter edits,
`.lisa-layout.kdl`, `board.svg`) left untouched. Commit `b6366fd`, 7 files,
+282 lines. Artifacts commit follows per the two-commit precedent.

## Deviations

None of substance. One micro-deviation noted for honesty: plan step 4 scheduled only the
rng barrel line with the wall line arriving in step 5; both barrel lines and `wall.ts`
were written in one edit alongside `rng.test.ts` because the files were already fully
specified by structure.md. Verification order (rng tests before wall tests) was preserved.

## Acceptance criteria status

- [x] `just test` passes a property test asserting any built wall has exactly 136 tiles
  with exactly 4 of each of the 34 kinds (wall.test.ts census property)
- [x] …the same seed always produces an identical wall order (determinism property)
- [x] …while different seeds differ (sensitivity property)
