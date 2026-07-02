# T-001-02-02 — Plan: implementation steps

Executes structure.md. Seven steps; each independently verifiable. One code commit at the
end (the steps are too interdependent to commit piecemeal — tests import the barrel, the
barrel imports both modules), then the artifacts commit, matching the repo's two-commit
precedent.

## Step 1 — Add fast-check (exact-pinned devDependency)

- `flox activate -- npm view fast-check version` to learn the current release.
- `flox activate -- npm install -D -E fast-check` (writes `package.json` +
  `package-lock.json`; `-E` matches the repo's exact-pin convention).
- **Verify:** `package.json` devDeps show `"fast-check": "<exact>"` with no range
  sigil; `node_modules/fast-check` exists.

## Step 2 — `src/core/rng.ts`

Write the randomness kit per structure.md: `Rng` type, `createRng` (mulberry32 with
`>>> 0` seed normalization), `nextInt` (rejection sampling, RangeError guard on
non-integer / < 1 / > 2^32 bounds), `shuffleInPlace` (Durstenfeld). Header comment states
the algorithm-freeze contract. Import-free file.

- **Verify (smoke, pre-test):** `flox activate -- npx tsc -p tsconfig.json --noEmit`-level
  errors will surface in step 6's `just check`; here, a quick
  `node -e` REPL run of the mulberry32 recurrence to eyeball outputs vary by seed.

## Step 3 — Golden-vector capture and independent cross-check

The one step with a bespoke procedure, because it freezes the algorithm forever:

1. Run the *repo's* `createRng` for seeds 0, 1, 0xDEADBEEF; record first 5 u32 outputs.
2. Independently re-implement mulberry32 in a throwaway scratchpad script (from the
   published reference algorithm, not by importing the repo file) and confirm the ten
   outputs match exactly.
3. Only then paste the vectors into `rng.test.ts` as the golden test.

- **Verify:** the two implementations agree on all 15 values; disagreement = stop, find
  the transcription bug before anything is frozen.

## Step 4 — `src/core/rng.test.ts` + barrel update

Add `export * from './rng'` to `src/core/index.ts` (wall line arrives in step 5). Write
the six test groups from structure.md: golden vectors (step 3's values), same-seed stream
determinism, `>>> 0` normalization, `nextInt` range property over arbitrary bounds,
`nextInt` guard examples, `shuffleInPlace` permutation/identity/determinism properties.
`seedArb = fc.integer({ min: 0, max: 0xffffffff })` at file top.

- **Verify:** `flox activate -- npx vitest run src/core/rng.test.ts` green.

## Step 5 — `src/core/wall.ts`, `src/core/wall.test.ts`, barrel completion

`buildWall(seed)` as the two-line composition; `export * from './wall'` in the barrel.
Tests: census property (136 ids, all distinct, 4 per kind × 34 kinds — the AC-a wording),
determinism property (deep-equal + distinct objects — AC-b), sensitivity property
(distinct seed pairs → different walls — AC-c), normalization property, golden wall
prefix for one fixed seed (captured from the now-frozen rng, first 12 ids, cross-checked
by replaying the shuffle in the step-3 scratchpad script).

- **Verify:** `flox activate -- npx vitest run src/core/wall.test.ts` green.

## Step 6 — Full gate

- `just test` — entire suite (tiles + rng + wall), the AC's literal command.
- `just check` — svelte-check + tsc strict.
- `just build` — the single-file bundle still closes; sanity-check `dist/index.html`
  exists. (fast-check is dev-only; the bundle must not grow by its size — eyeball the
  build output size against the previous build.)
- Purity grep (the core invariant, per T-001-02-01 precedent):
  `grep -rn -E "from ['\"](svelte|.*app/)|document\.|window\." src/core/` → no matches;
  also confirm `Math.random` appears nowhere in `src/core/`:
  `grep -rn "Math.random" src/` → no matches.
- **Verify:** all four gates clean; record transcript summaries in progress.md.

## Step 7 — Commits + progress/review artifacts

1. Stage *only*: `src/core/rng.ts`, `src/core/rng.test.ts`, `src/core/wall.ts`,
   `src/core/wall.test.ts`, `src/core/index.ts`, `package.json`, `package-lock.json`.
   (Working tree carries unrelated lisa frontmatter edits, `.lisa-layout.kdl`,
   `board.svg` — do not touch.)
   Commit: `T-001-02-02: seeded rng (mulberry32) + wall build + first property tests`.
2. Write `progress.md` (steps completed, gate transcripts, deviations) and `review.md`
   (changes, coverage, concerns), then commit the six artifact files:
   `T-001-02-02: add RDSPI artifacts (research/design/structure/plan/progress/review)`.

## Testing strategy summary

- **Property tests (fast-check, new idiom):** the AC trio (census / determinism /
  sensitivity) on `buildWall`; range/permutation/determinism/normalization on the rng kit.
  Default numRuns (100), default random run-seed — failures reproduce via fast-check's
  printed `{ seed, path }`.
- **Example-based golden tests:** frozen mulberry32 vectors + frozen wall prefix — the
  algorithm-as-contract lock. These are the only tests whose failure means "you broke
  every stored seed", and their names say so.
- **Guard tests:** `nextInt` precondition RangeErrors.
- **Integration:** `just check` + `just build` (types; bundle closes; no dev-dep leakage).
- **Invariant gate:** purity grep incl. `Math.random` absence.

## Acceptance criteria → step mapping

| AC clause | Discharged by |
| --- | --- |
| wall has exactly 136 tiles, 4 of each of 34 kinds (property) | step 5 census property, gated in step 6 via `just test` |
| same seed → identical wall order (property) | step 5 determinism property |
| different seeds differ (property) | step 5 sensitivity property |
| all of the above pass under `just test` | step 6 |

## Rollback / deviation policy

Everything is additive (two new modules, two test files, one barrel line, one devDep);
`git revert` of the single code commit restores the tree exactly. Foreseeable deviations:
fast-check's current major changes an API name (adapt at step 4, note in progress.md);
vitest 4 interaction surprises (fast-check is framework-agnostic, so treat any failure as
a config smell and investigate before working around). Config-file changes remain out of
bounds for this ticket.
