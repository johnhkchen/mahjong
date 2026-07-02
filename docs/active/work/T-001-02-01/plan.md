# T-001-02-01 tile-types-and-identities — Plan

## Shape of the work

One small, interdependent code change (4 files) that must land as a single commit, preceded
by verification at every step. The steps below are execution-ordered; steps 1–3 produce the
working tree, steps 4–6 verify it three different ways, step 7 commits, step 8 closes out.
Total new code is ~100 lines of source + ~120 lines of tests.

## Steps

### 1. Create `src/core/tiles.ts`

Per structure.md's interface spec, in file order: types → constants (`TILE_KINDS` generated
by loops, frozen; internal `KIND_INDEX` reverse map) → id encoding (`kindIndexOf`, `tileId`,
`kindOf`, `copyOf`, `allTileIds`) → predicates (`suitOf`, `rankOf`, `isHonor`, `isTerminal`,
`isSimple`). Zero import statements. Doc comments on the encoding contract (id = kindIndex ×
4 + copy; no runtime range validation — the future log parser owns boundary validation) and
on canonical order (mpsz; honors E,S,W,N,haku,hatsu,chun).

*Verify:* file compiles in isolation (`npx tsc --noEmit` equivalent comes with step 5; at
this point, editor/tsc cleanliness is enough to proceed).

### 2. Rewrite `src/core/index.ts`; delete `src/core/index.test.ts`

Barrel: purity-invariant header comment + `export * from './tiles'`. Delete the scaffold
smoke test (`git rm src/core/index.test.ts` — plain delete; git tracks it either way at
commit time).

### 3. Create `src/core/tiles.test.ts`

The seven test groups from structure.md, importing from `'./index'`:

1. AC counts (34 distinct kinds, 136 distinct ids)
2. Exact canonical 34-element sequence (mpsz order pinned literally)
3. Exhaustive encoding round-trips both directions + exactly-4-copies-per-kind
4. `kindIndexOf` bridge and per-kind id ranges `[4i, 4i+3]`
5. Classification: exact terminal/honor member lists, 7+6+21 partition, pairwise disjoint
6. `suitOf`/`rankOf` representatives + exhaustive null-iff-honor sweep
7. Immutability: `TILE_KINDS` frozen; `allTileIds()` fresh per call

Where a loop can cover all 34 kinds or all 136 ids, loop — the domain is small enough that
exhaustive beats sampled everywhere.

### 4. `just test`

Expect: all tests green, and the run shows only `tiles.test.ts` (the smoke test is gone).
This discharges AC clause 1 (the enumeration test exists and passes). If a test fails,
fix source or test as appropriate — the canonical-sequence test failing means the generator
loop order is wrong (fix source); a round-trip failure means the encoding arithmetic is
wrong (fix source).

### 5. `just check`

Expect: svelte-check and `tsc -p tsconfig.node.json` both clean. Known risk from T-001-01-02:
none expected here — no new config, no `.svelte` changes; template-literal-type unions are
plain TS 5.x. Discharges AC clause 2.

### 6. Purity grep (AC clause 3)

```
grep -rnE "import|from" src/core/          # eyeball: only ./tiles, ./index, vitest
grep -rniE "svelte|document|window|navigator|localStorage" src/core/   # expect zero hits
```

Record both commands and their output in progress.md — the AC says "verifiable by grep";
the record makes it verified, not just verifiable. Also run `just build` once as a cheap
regression sanity (the barrel rewrite touches what `src/app` will eventually import; build
proves the singlefile pipeline still closes).

### 7. Commit the code

Single commit, message: `T-001-02-01: tile domain — 34 mpsz kinds, 136 tile ids, encoding +
classification, exhaustive tests`. Stage **only** the four files from structure.md — the
working tree has pre-existing unrelated noise (modified ticket frontmatter files, untracked
`.lisa-layout.kdl`, `board.svg`) that belongs to lisa/the owner and must not be swept in.

### 8. Write `progress.md`, then Review phase → `review.md`, commit artifacts

progress.md: steps completed, verification transcript (test/check/grep/build output
summaries), deviations if any. Then review.md per the workflow (changes, coverage, gaps,
concerns). Final commit: `T-001-02-01: add RDSPI artifacts` (the 6 docs files), matching
the two-commit precedent of both prior tickets.

## Testing strategy summary

- **Unit tests:** exhaustive example-based enumeration over the total domain (all 34 kinds ×
  all 4 copies × both encoding directions). No property-test library — with 136 total values,
  exhaustive iteration strictly dominates random generation; fast-check arrives with
  T-001-02-02 per its AC.
- **Integration:** `just check` (types across the repo incl. svelte-check) and `just build`
  (the bundle still closes end-to-end).
- **Invariant gate:** the purity grep, recorded in progress.md.

## Acceptance criteria → step mapping

| AC clause | Discharged by |
| --- | --- |
| vitest test enumerates exactly 34 kinds, 136 distinct ids | steps 3–4 (test groups 1–3) |
| `just check` clean | step 5 |
| no DOM/Svelte imports in src/core/, grep-verifiable | steps 1–2 (construction) + 6 (verification) |

## Rollback / deviation policy

Everything is additive except the placeholder deletion; `git revert` of the one code commit
restores the scaffold exactly. If step 5 surfaces a svelte-check surprise (the T-001-01-02
review flags the toolchain as young), the fallback ladder is: adjust test/typing idiom →
document in progress.md; config changes are out of bounds for this ticket.
