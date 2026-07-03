# T-007-03-03 — sort-to-tap-mapping-guard — Progress

## Completed (all steps; one code commit: `b1632d2`)

- **Step 1 — jsdom installed**: `jsdom@29.1.1`, exact-pinned like every other
  devDep. Baseline `npm run test` re-run after the install: 568/568, unchanged.
- **Step 2 — environment smoke**: a minimal mount/click/prop-mutation spike
  passed, de-risking the three runtime assumptions (rune transform under the
  `.svelte.test.ts` name, client compile in the test run, delegated clicks
  from jsdom). One real deviation surfaced — see below.
- **Step 3 — full suite written**: `src/app/table.tap.svelte.test.ts`, 9 tests
  in 4 describes, exactly the structure.md battery: sorted render order (kind
  labels), tap→exact-TileId at all 13 positions (ids, not kinds — the
  duplicate-kind pairs and the frozen `50:4p`-before-`49:4p` inversion),
  tapDiscard identity from the rendered surface, the drawn button's separate
  surface, and the two reorder flavors (seed-1 tedashi merge, seed-15 pon
  shrink) with per-tile DOM node identity across each move.
- **Step 4 — verification battery**: `vitest run` 577/577 (25 files; the 568
  existing — drive.test.ts included, the AC's clause d — plus 9 new);
  svelte-check 178 files 0 errors 0 warnings; `npm run build` green with
  `dist/index.html` at **83,176 bytes — byte-identical to the pre-ticket
  figure** (T-007-03-01's review records the same number), proving the devDep
  never touches the shipped file.
- **Extra verification (not in plan): mutation-tested the guard.** Two
  hand-applied mutations to Table.svelte, each run against the new suite and
  then reverted: unkeyed `{#each hand as id}` → 2 failures; index-keyed
  `{#each hand as id, k (k)}` → 2 failures (both die on the node-identity
  assertions, as designed). Post-revert: all green. The guard bites.
- **Step 5 — committed** by explicit path only (`package.json`,
  `package-lock.json`, `vite.config.ts`, the test file); the concurrent
  threads' working-tree changes (shanten.*, ticket frontmatter) untouched.

## Deviation from structure.md (documented before proceeding, per workflow)

**`vite.config.ts` is modified** — structure.md declared it untouched, relying
on the `@vitest-environment jsdom` docblock. The smoke spike disproved that:
vitest's module runner resolves packages with node conditions regardless of
the docblock, so `mount` imported Svelte's *server* build and threw
(`svelte/src/index-server.js` in the stack). The docblock changes the DOM
globals, not module resolution — the browser build needs `resolve.conditions:
['browser']`, which is per-vite-server, not per-file.

Fix: the config's `test` block now defines two **projects** (vitest 4's
in-config split):

- `node` — environment node, `src/**/*.test.ts` minus `*.svelte.test.ts`:
  every pre-existing suite, byte-for-byte the old behavior (server-compiled
  Svelte for the SSR renders).
- `dom` — environment jsdom, `resolve.conditions: ['browser']`, exactly
  `src/**/*.svelte.test.ts`: the new suite (and any future client suite —
  the filename convention now selects the project AND the rune transform).

First attempt kept the root-level `include` beside `projects`; `extends: true`
merged it into both projects and the dom project swept up the SSR suites
(2 files failed under the browser build). Second attempt moved `include`
wholly into the projects — 25 files, all green. The docblock was dropped from
the test file (the project owns the environment; two sources of truth would
drift).

Rationale for accepting the deviation rather than redesigning: the projects
split is the vitest-4-native form of exactly what design.md chose (per-file
jsdom, everything else untouched), it lives in 20 lines of config, and the
alternative — global browser conditions gated on VITEST — would have run the
SSR suites against the client build, which is the one thing design.md's
option analysis forbade.

## Remains

Nothing on the code. Review.md next (the artifacts commit follows it).
