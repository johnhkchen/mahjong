# T-001-02-02 — Review

Self-assessment and handoff for the seeded-RNG / wall-build / first-property-test ticket.
All acceptance criteria met; `just test`, `just check`, and `just build` all clean.

## What changed

One code commit (`b6366fd`, +282 lines, 7 files), everything additive:

| File | Change |
| --- | --- |
| `src/core/rng.ts` | **New.** Domain-agnostic seeded randomness kit: `createRng` (mulberry32 over a uint32 seed, `>>> 0` normalization), `nextInt` (exact-uniform via rejection sampling — integer-only, no modulo/float bias — with a loud RangeError guard), `shuffleInPlace` (Durstenfeld Fisher–Yates). Import-free. Header comment declares the **contract freeze**: the output stream is part of the replay format. |
| `src/core/wall.ts` | **New.** `buildWall(seed): TileId[]` — the wall *is* the seeded permutation of all 136 tile ids; fresh mutable array per call. Deliberately no deal/dead-wall/dora structure (later tickets). |
| `src/core/rng.test.ts` | **New.** 7 tests: frozen mulberry32 golden vectors (3 seeds × 5 outputs), stream determinism, seed normalization, u32-output, `nextInt` range, `nextInt` guards, shuffle permutation/identity/determinism properties. |
| `src/core/wall.test.ts` | **New.** 5 tests — the AC lives here: census property (∀ seed: 136 tiles, all distinct, exactly 4 per each of the 34 kinds), same-seed determinism property, different-seed sensitivity property, normalization property, frozen wall prefix for seed 1. |
| `src/core/index.ts` | Barrel gains `export * from './rng'` / `'./wall'`. |
| `package.json` / `package-lock.json` | `fast-check` **4.8.0** added as an exact-pinned devDependency (brings one transitive dep, `pure-rand`). Dev-only; verified absent from the shipped bundle. |

No files deleted; no config changes (vitest already globs the new tests; the justfile
`_deps` recipe auto-installs the new lockfile).

## What this ticket establishes for the repo

1. **The seeded-determinism invariant now has a mechanism**: seed → wall is a pure, frozen
   function; "a hand is its record (seed + actions)" is now implementable.
2. **The property-test idiom** all later scoring/shanten tickets copy: `fc.assert(fc.property(...))`
   inside ordinary vitest `it` blocks; `seedArb = fc.integer({min: 0, max: 0xffffffff})`
   at file top; default numRuns/run-seed (failures reproduce via fast-check's printed
   `{seed, path}`); one named property per invariant.
3. **The algorithm-freeze pattern**: golden-vector tests whose *names* state that failure
   means every stored seed is invalidated. The vectors were cross-checked against an
   independent transcription of the published mulberry32 reference before freezing
   (procedure + values recorded in progress.md).

## Test coverage assessment

- **Covered well:** every public function has both property coverage and (where
  applicable) example/golden coverage. The AC trio is verbatim in wall.test.ts. Edge
  bounds probed: `nextInt` at bound 1, 2^32, and all rejection cases via arbitrary bounds;
  seeds across the full uint32 domain plus arbitrary doubles (incl. NaN/±Infinity via the
  normalization property); empty/singleton arrays reachable by the shuffle arbitrary.
- **Gaps, acknowledged:**
  - *No statistical uniformity test* (e.g. chi-squared over wall positions). The shuffle
    is exactly-uniform *by construction* (rejection sampling + Fisher–Yates) given a good
    u32 source, and mulberry32's quality is taken from its published test-battery record
    rather than re-derived in CI — a statistical test would be slow, flaky, or both.
  - *Rejection path untested directly*: no seed/bound pair in the golden set is known to
    exercise a rejected draw (probability < 3.2e-8 per draw at bound ≤ 136). The property
    tests cover large bounds where rejection is likelier, but there is no deterministic
    fixture pinning the "draw again" branch. A hand-crafted `Rng` stub returning a
    just-above-limit value first would cover it in a future tidy-up.
  - `nextInt`/`shuffleInPlace` are tested via the real generator, not against an
    independent shuffle reference beyond the seed-1 golden prefix (which *was*
    independently cross-checked, so the composition is anchored once).

## Open concerns / notes for a human reviewer

1. **The freeze is now real.** From this commit forward, touching the constants in
   `rng.ts` (or the shuffle's draw order) breaks golden tests *by design*. If a future
   ticket ever legitimately needs a different generator, that is a versioned-log-format
   decision, not a refactor.
2. **Seed domain is uint32 by fiat** (design.md D1). The future action-log ticket inherits
   "seed header = one integer in [0, 2^32)". If anyone wants human-memorable string seeds
   later, hash-to-uint32 at the boundary; core stays numeric.
3. **`>>> 0` silently coerces** fractional/negative/NaN seeds rather than throwing —
   deliberate asymmetry with `nextInt`'s loud guard (seeds cross the program boundary and
   get validated by the future log parser; bounds are internal programmer errors). Flagged
   in case the reviewer prefers loud both ways.
4. **Sensitivity property is probabilistic-in-principle** (distinct seeds *could* collide
   on a permutation) but deterministic-in-practice (≪ 2^-100 per tested pair); comment in
   the test explains. It cannot realistically flake.
5. Untracked `board.svg` and `.lisa-layout.kdl` plus lisa's ticket-frontmatter edits were
   present in the working tree before this ticket started and were deliberately left
   unstaged/uncommitted.

## Verification transcript (summary)

- `just test`: 3 files, **20/20 passed** (~0.5 s).
- `just check`: svelte-check 141 files, 0 errors/warnings; tsc clean.
- `just build`: `dist/index.html` 23.44 kB (gzip 9.57 kB) — bundle unchanged in character;
  fast-check not inlined.
- Purity greps: no svelte/app/DOM imports in `src/core/`; no `Math.random` in `src/`.

## TODOs deliberately left behind

None blocking. The rejection-branch fixture (coverage gap above) is a nice-to-have for
any future rng-adjacent ticket; not filed as a ticket since it hardens a branch that is
already correct by construction and property-probed.
