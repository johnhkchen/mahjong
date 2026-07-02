# T-001-02-02 — Research: seeded RNG, wall build, first property test

Descriptive survey of what exists today and the constraints that bound this ticket. No
solutions proposed here (that is design.md).

## 1. The ticket in one line

Add a seeded deterministic PRNG and a wall-build function (seed → shuffled 136-tile wall),
proven by the project's **first property test** — establishing the seeded-determinism
invariant and the property-testing idiom every later scoring/shanten ticket follows.

Acceptance criterion: `just test` passes a property test asserting (a) any built wall has
exactly 136 tiles with exactly 4 of each of the 34 kinds, (b) the same seed always produces
an identical wall order, (c) different seeds differ.

Dependency `T-001-02-01` (tile domain) is complete and committed (61a30f2).

## 2. What exists in `src/core/` today

Exactly three files; `src/core/` is the pure engine with a hard zero-DOM/zero-framework rule.

| File | Contents relevant to this ticket |
| --- | --- |
| `src/core/tiles.ts` | The complete tile domain. `TileId` = integer 0–135 encoded as `kindIndex * 4 + copy`. `TILE_COUNT = 136`, `KIND_COUNT = 34`, `COPIES_PER_KIND = 4`. Crucially, **`allTileIds(): TileId[]` returns "the full tile set [0..135] as a fresh mutable array — callers may shuffle it in place"** — the doc comment was written in T-001-02-01 anticipating exactly this ticket's wall build. `kindOf(id)` decodes a tile id back to its kind, which is what a per-kind census of a wall needs. |
| `src/core/index.ts` | The barrel: "core's public face; app code imports only from here." Currently `export * from './tiles'`. New core modules are expected to be re-exported here. |
| `src/core/tiles.test.ts` | The existing testing idiom: vitest `describe/it/expect`, imports from `./index` (the barrel, not the module — tests double as public-API checks). Style: exhaustive enumeration over total domains, each invariant spelled twice independently (e.g. the canonical kind order is both computed and written out literally). |

There is no randomness, no shuffle, and no wall anywhere in the repo yet
(`grep -ri 'random|seed|shuffle|wall' src/` matches nothing).

## 3. Toolchain and dependency reality

- `package.json`: **zero runtime dependencies**; devDeps are exact-pinned (no `^`/`~`):
  svelte 5.56.4, vite 8.1.3, vitest 4.1.9, typescript 5.9.3, svelte-check 4.7.1,
  vite-plugin-singlefile 2.3.3, @sveltejs/vite-plugin-svelte 7.1.2, @tsconfig/svelte 5.0.8.
- **No property-testing library is installed.** This is deliberate and documented:
  T-001-02-01's research.md notes "fast-check (or similar) arrives with T-001-02-02, which
  owns 'the first property test'", and its plan.md repeats "fast-check arrives with
  T-001-02-02 per its AC". The prior ticket's exhaustive tests explicitly deferred
  randomized-generation tooling to here.
- Vitest config lives inline in `vite.config.ts` (`test: { environment: 'node', include:
  ['src/**/*.test.ts'] }`). Any new `src/core/*.test.ts` file is picked up automatically.
- `justfile`: `just test` → `flox activate -- npm run test` → `vitest run`. A `[private]
  _deps` recipe runs `npm ci` iff `node_modules/.package-lock.json` is older than
  `package-lock.json`, so adding a devDependency (which rewrites the lockfile) is
  automatically installed on the next `just` invocation for any clone.
- `just check` = `svelte-check --tsconfig ./tsconfig.json && tsc -p tsconfig.node.json
  --noEmit`. tsconfig is strict; ES2022 target; bundler resolution.

## 4. Architectural constraints that bind this ticket

From `docs/knowledge/architecture.md` and CLAUDE.md invariants:

1. **Seeded, deterministic randomness is a repo invariant**: "Randomness is seeded; full
   hands must be deterministically simulatable (AI-vs-AI determinism doubles as attract
   mode)." This ticket creates the mechanism that invariant rests on.
2. **A hand is its record**: "a seed (the wall order) plus an ordered list of actions".
   The action-log notation (a later ticket) will carry a seed header from which the wall
   order is re-derived; the seed → wall function must therefore be a *pure, stable*
   function — same seed must reproduce the same wall not just within a session but across
   replays, `localStorage` round-trips, and bug reports ("a bug report is a hand log").
   This makes the PRNG algorithm itself part of the long-term contract: changing it later
   silently invalidates every stored seed.
3. **Charter P-axis**: charter.md names "seeded-RNG full-hand simulation" and "the wall is
   exactly 136 tiles" as explicit parts of "the property-test crown" — the quality axis
   the whole tortoise-vs-hare series exhibits.
4. **Zero platform imports in core**: no `crypto.getRandomValues`, no `Math.random`
   dependence for the seeded path (`Math.random` is unseedable anyway). Whatever PRNG is
   used must be implemented in plain TypeScript inside `src/core/`.
5. **Single-file ship target**: the engine ships inside one `index.html`; dev-only deps
   (a property-test library) never ship — architecture.md: "Big in *tests*, not runtime —
   and tests never ship." So a test-only dependency is unconstrained by bundle size, but a
   *runtime* PRNG must be tiny hand-written code.

## 5. Riichi-domain facts a wall build must respect (now vs later)

- A riichi wall is all 136 tiles, shuffled; deal order, dead wall (14 tiles), and dora
  indicators are *positions within* the shuffled sequence, not separate structures. What
  this ticket owes the future is only: a deterministic, uniformly-shuffled sequence of all
  136 `TileId`s. Dealing, dead wall, and dora indexing are later tickets' concerns
  (S-001-02 continues into deal/draw).
- Tiles are physically distinguishable in our model (136 distinct ids, `copyOf` 0–3), so a
  wall is a *permutation of ids*, not a multiset of kinds — which is exactly what makes
  "same seed → identical wall" a strict array equality and gives replay its footing.

## 6. Prior art in the repo's own workflow

- Commit pattern from both prior tickets: one code commit
  (`T-001-02-01: tile domain — …`) followed by one artifacts commit
  (`T-001-02-01: add RDSPI artifacts (…)`). Working tree currently has unrelated
  modifications (ticket frontmatter files touched by lisa, untracked `.lisa-layout.kdl`,
  `board.svg`) that must be left alone; commits should stage only this ticket's files.
- Test style precedent (tiles.test.ts): import from `./index`, top-level `describe` per
  domain, invariants stated as a partition/census where possible, a freshness/immutability
  check at the end. The first property test sets the *additional* precedent all later
  property tickets will copy: how fast-check (or whichever library design.md picks)
  integrates with vitest, where numRuns/seed policy lives, and how failures reproduce.

## 7. Constraints & assumptions surfaced

- **Seed type is undecided upstream.** Nothing in docs/knowledge fixes whether a seed is a
  32-bit integer, a string, or something else; the action-log ticket will serialize it.
  Whatever design.md picks becomes the de-facto log-header type.
- **PRNG quality bar**: game-fairness, not cryptography. But period/state size interacts
  with "different seeds differ" and with how many distinct walls players can ever see;
  design.md must weigh 32-bit vs larger state.
- **Modulo/rounding bias** in integer derivation from a raw PRNG is a real (if small)
  uniformity concern for a Fisher–Yates shuffle; the design should take an explicit
  position rather than inherit one accidentally.
- **"Different seeds differ" is probabilistic** as a universal claim; the test must be
  phrased so it is deterministic-in-practice (fixed generator, fixed run seed or
  collision-free construction) and never flakes CI.
- **fast-check version**: current major must be checked against the npm registry at
  implement time and exact-pinned like every other devDep; vitest 4 compatibility to be
  confirmed by running the suite (no `@fast-check/vitest` decision made yet — that's
  design's call).
- Adding a devDep changes `package.json` + `package-lock.json`; the flox `_deps` gate in
  the justfile handles reinstall automatically (verified by reading the recipe).

## 8. Files this ticket will plausibly touch (inventory, not commitment)

- New: `src/core/` module(s) for rng + wall, with test file(s); `docs/active/work/T-001-02-02/*`.
- Modified: `src/core/index.ts` (barrel), `package.json` + `package-lock.json` (test dep).
- Untouched: everything in `src/app/`, vite/tsconfig/justfile (no config change needed —
  vitest already globs the new tests; the `_deps` recipe already handles the new dep).
