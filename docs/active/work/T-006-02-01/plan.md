# T-006-02-01 — standard-form-shanten — Plan

Ordered, independently verifiable steps executing structure.md. Each step ends
with a checkable state; commits are noted where the tree is meaningfully green.

## Step 1 — the module: `src/core/shanten.ts`

Write the module per structure §2: header charter comment, type-only imports,
private `countsOf` (third-copy comment), `MAX_MELDS`, the `bestValue`
backtracker (six extraction branches + advance, lowest-nonzero-kind anchor,
mutate-recurse-restore, upper-bound prune, no surviving module state), and the
`standardShanten` face (guards → counts → `8 − 2·melds − best`).

Guard messages, pinned now so tests can quote them verbatim:

- `standardShanten with ${n} melds — a hand holds at most 4`
- `standardShanten requires ${t13} or ${t14} concealed tiles with ${m} melds, got ${n}`

**Verify**: `flox activate -- npx tsc --noEmit` clean (or `just check`); no test
yet — compilation and self-review of the exhaustiveness invariant.

## Step 2 — barrel export

Add `export * from './shanten'` to `src/core/index.ts` after `./waits`.

**Verify**: `just check` clean (barrel re-export surfaces any name collision —
`standardShanten`, `MAX_MELDS` stays private so no clash with agari/waits
privates).

## Step 3 — smoke fixtures (the AC anchors)

`src/core/shanten.test.ts` with helpers (`h`, arity-stub melds) and the first
two describe blocks:

- complete: `123m456p789s111z22z` (14) → −1; 4 stub melds + `h('55z')` → −1.
- tenpai 0: ryanmen `23m456p789s111z55z`; tanki `123m456p789s111z2z`; shanpon
  `22m33p456s789s111z`; 4 melds + `h('3p')` → 0; 14-tile
  `123m456p789s111z2z5s` (contains tenpai 13) → 0.

**Verify**: `just test` — these pin the formula's sign conventions before the
harder shapes. Expected values argued in comments (each is a waits.test.ts
fixture whose wait/agari status is already independently pinned there — the
cross-module echo is deliberate and stated).

**Commit 1**: `T-006-02-01: standardShanten — block-count core + AC anchors`
(module + barrel + smoke tests; tree green).

## Step 4 — ladders, discount, tension fixtures

Remaining describe blocks per structure §3:

- ladders: 1-shanten `23m456p789s111z5z2s`-style (ryanmen tenpai with the pair
  broken — derive exactly in comment); a 2-shanten; scattered-13
  `147m147p147s1234z` → 8 (the AC's "13-tiles-apart" worst case; comment argues
  no two tiles cohere: gaps of 3 within suits, distinct honors).
- meld discount: `23m456p789s55z` (10 tiles) + 1 stub meld → 0, and deeper
  remainders at 2 and 3 melds with computed expectations; shows required sets
  shrinking with meld count (the AC's discount clause).
- head/partial tension: e.g. `1122m 345p 345s 77z` variants where the search
  must choose pair-as-head vs pair-as-partial vs pair-feeding-triplet; each
  expectation derived by explicit block decomposition in the comment.

**Verify**: `just test`. Any mismatch here is a real algorithm bug (fixtures are
rule-derived): debug the backtracker, not the fixture, unless the comment's
derivation itself is shown wrong — record which in progress.md.

## Step 5 — contract block

RangeErrors verbatim (3 concealed / 0 melds; 13 concealed / 1 meld — the
wrong-arity-with-melds case; 5 melds); purity (spread-copy inputs, deep-equal
after; two calls strictly equal results); both-arity acceptance (13 and 14 side
of the same hand both score without throwing, 14-side ≤ 13-side for a superset
hand — a single sanity inequality, not a property sweep).

**Verify**: `just test && just check` — full green.

**Commit 2**: `T-006-02-01: standardShanten fixtures — ladders, meld discount,
contract` (or fold into Commit 1 if Step 3–5 complete in one sitting; two
commits preferred to keep the anchor-pinning reviewable).

## Step 6 — cross-suite sanity + review prep

- Run the WHOLE core suite (`just test`, no filter): confirms purity.test.ts
  accepts the new module and nothing else regressed.
- Grep the final module for accidental scope creep: no chiitoi/kokushi tokens,
  no `shanten(` bare export (both belong to -02), no meld-content reads.

## Testing strategy summary

| Layer            | What                                            | Where        |
| ---------------- | ----------------------------------------------- | ------------ |
| unit fixtures    | AC anchors, ladders, discount, tension, bounds  | Steps 3–4    |
| contract         | RangeErrors verbatim, purity, dual arity        | Step 5       |
| type/purity      | tsc + svelte-check + purity sweep               | Steps 1,2,6  |
| property sweeps  | **out of scope** — T-006-02-03's brute-force    | (deferred)   |

Acceptance-criteria trace: "src/core exports a standard-form shanten function
returning an integer" → Steps 1–2; "unit tests pin known hands (complete =
−1/0-away, tenpai, 1-shanten, 13-tiles-apart)" → Steps 3–4; "called-meld counts
reducing required sets" → Step 4's discount block.

## Risks and their planned handling

- **Algorithm exactness** (the only real risk): the head-flag/cap formulation is
  argued in design §2.A/§4.5; Step 4's tension fixtures are chosen to hit the
  known-counterexample classes (greedy pair placement, block overcounting). If a
  fixture disagrees and its comment-derivation survives scrutiny, fix the search
  (likely a missing branch or a wrong guard), rerun all fixtures, note in
  progress.md. T-006-02-03's oracle is the final backstop by design.
- **Prune correctness**: a wrong bound silently truncates the max. The bound
  used (`2·blocksLeft + headFree`) is trivially an upper bound on remaining
  value; keep it that simple, resist anything cleverer.
- **Performance**: not measured unless tests feel slow; the envelope argument
  (design §2.A) says it won't. If vitest runtime jumps, check the prune ordering
  (extractions before advance).
- **Concurrent lisa threads on main**: commits touch only the three files in
  structure §1 plus this work dir; never the ticket frontmatter.

## Done means

`just test` and `just check` green; `standardShanten` exported from the barrel;
fixtures cover every AC clause; progress.md records step completion and any
deviation; review.md written (Review phase).
