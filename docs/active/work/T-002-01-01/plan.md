# T-002-01-01 — Plan: dora indicator → dora kind mapping

Ordered, independently verifiable steps executing structure.md. The whole ticket is one
small module + tests + a barrel line; steps are sized so every intermediate state keeps
`just test` green, folding into a single atomic commit at the end.

## Step 1 — create `src/core/dora.ts`

Write the module exactly as shaped in structure.md §2:

- Header comment: rules-knowledge framing, the three cycles with wraparound spelled
  out, kind-level scope note (ids decoded upstream; ura uses the same mapping).
- `import { suitOf, type TileKind } from './tiles'`
- `export function doraKindOf(indicator: TileKind): TileKind` — numbered
  `(n % 9) + 1` same suit; winds `(n % 4) + 1`z; dragons `((n - 4) % 3) + 5`z;
  `as TileKind` casts on the template-string returns.

**Verify:** `just test` still green (nothing imports the file yet); no type errors in
the file (`just check` may be deferred to step 4 but a quick tsc pass here is free).

## Step 2 — wire the barrel

Append `export * from './dora'` to `src/core/index.ts`.

**Verify:** `just test` green — this also runs the purity gate over the new module
(only `./tiles` imported → passes) and re-runs every existing suite against the grown
barrel (no name collisions).

## Step 3 — create `src/core/dora.test.ts`

Write the six `it` blocks from structure.md §4, importing from `'./index'`:

1. totality over `TILE_KINDS` (AC),
2. the five pinned wraparounds 9m→1m, 9p→1p, 9s→1s, 4z→1z, 7z→5z (AC),
3. the full 34-entry hand-written literal table with `satisfies Record<TileKind, TileKind>`
   — transcribed from the *rule statement*, not from running the code (this is the
   independent-spelling defense; comment says never regenerate),
4. bijectivity (image has 34 distinct kinds),
5. cycle-group closure (suit preserved; winds→winds via kindIndexOf 27–30; dragons→
   dragons via 31–33) + no fixpoints,
6. successor rule for ranks 1–8 across m/p/s.

**Discipline for step 3.3:** write the table top-to-bottom from the rule ("dora = next
in cycle") before running the tests once — if the table and the arithmetic disagree, stop
and re-derive from the rule text rather than "fixing" whichever is easier.

**Verify:** `just test` — new suite passes alongside all existing suites.

## Step 4 — full gate

- `just test` — expect 6 test files (tiles, rng, wall, purity, app SSR, dora), all green.
- `just check` — svelte-check + tsc clean (catches any cast/type sloppiness in the new
  module and the `satisfies` table).

## Step 5 — commit

Single commit; everything is one logical change:

```
T-002-01-01: dora indicator→kind mapping (doraKindOf) in core

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
```

Scope of the commit: `src/core/dora.ts`, `src/core/dora.test.ts`, `src/core/index.ts`,
plus this ticket's `docs/active/work/T-002-01-01/` artifacts (per repo practice of
committing RDSPI artifacts with the ticket, cf. `fe17d36`). **Not** included: the
ticket's frontmatter (Lisa owns phase/status), unrelated dirty files
(`docs/active/tickets/T-002-01-0{1,2}.md` were already modified in the working tree
before this session — leave them out of the staged set).

## Testing strategy summary

- **Unit/property tests:** all in `dora.test.ts`, exhaustive over the closed 34-kind
  domain (no sampling needed; fc adds nothing here — tiles.test.ts precedent).
- **Integration:** none warranted — no consumer exists yet (T-002-01-02/-04 will be the
  integration points and carry their own ACs).
- **Regression:** the full existing suite via `just test`, notably purity.test.ts
  (import gate over the new files) and the barrel-based imports in every other test.
- **Types as tests:** `satisfies Record<TileKind, TileKind>` makes the literal table's
  totality (all 34 keys present, all values valid kinds) a compile-time fact.

## Verification criteria (met = ticket AC met)

1. `just test` exits green with `dora.test.ts` included.
2. The totality assertion enumerates all 34 `TILE_KINDS`.
3. The five AC wraparound cases are individually pinned.
4. `doraKindOf` is importable from `src/core/index.ts` (tests import it exactly there).
5. `just check` clean.

## Risks / contingencies

- **Type narrowing friction** on template-string returns: expected; resolved with the
  established `as TileKind` idiom. If tsc still complains, fall back to typing the
  helper expressions explicitly — do not weaken the public signature.
- **Purity-gate comment quirk:** the gate's regex scans comments for import-like text —
  keep header comments free of `from '<pkg>'`-shaped strings.
- **Table/arithmetic mismatch:** treat as a rule-derivation bug, not a test bug; re-derive
  both from the rule statement (design.md §6).
