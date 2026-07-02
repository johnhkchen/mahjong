# T-002-01-04 — Plan: hand-record fold entrypoint

Ordered, independently verifiable steps executing structure.md. Commit convention
follows the repo precedent: one code commit for the ticket (`T-002-01-04: <summary>`),
artifacts committed separately at the end (the T-002-01-03 pattern, commits
256efb3 + 15571be). Ticket frontmatter is never touched (lisa owns phase/status);
note the working tree already carries lisa's own edits to `docs/active/tickets/*.md` —
stage files explicitly, never `git add -A`.

## Step 1 — `src/core/record.ts`

Create the module exactly as structure.md §2:

- Header comment (the keystone made code; contract layer every later epic reads).
- `HandAction = never` with the widening-is-the-extension-point doc.
- `HandRecord { seed, actions }` with the rng-seed-domain and log-parser-boundary docs.
- `TableState` with the derived-view-not-frozen-contract doc and per-field docs
  (seat-indexed hands in draw order, post-deal live, dead layout pointer,
  indicator + mapped dora).
- `foldRecord` — guard `RangeError` on `record.actions.length > 0`, then
  build → partition → deal → assemble with `dora: doraKindOf(kindOf(doraIndicator))`.
- Purity-gate rule: no quoted bare-package-looking strings anywhere, comments included.

**Verify:** module typechecks in isolation (step 2 runs the full gate).

## Step 2 — barrel export

Append `export * from './record'` to `src/core/index.ts` (after `./deal`).

**Verify:** `just check` green (svelte-check + tsc strict) — catches `export *`
collisions or type errors immediately, and makes AC (d) true.

## Step 3 — property + guard tests

Create `src/core/record.test.ts` with tests 1–6 from structure.md §3 (empty-log fold =
explicit composition; same seed → identical deal; same record → same folded state with
fresh arrays; record not mutated; 136-tile conservation; non-empty-log guard via one
commented cast). Imports via `./index`; `seedArb` + `recordOf` helpers.

**Verify:** `just test` green — including `purity.test.ts` picking up both new files,
and all pre-existing suites untouched (was 7 files / 44 tests at 15571be).

## Step 4 — golden cross-check and golden test

Per structure.md §5 — lighter than prior tickets since all array literals are already
frozen elsewhere:

1. Hand-derive the one new fact: indicator id 24 → kind index 6 → `7m` → dora `8m`
   (tiles.ts canonical order + dora.ts numbered cycle).
2. Throwaway scratchpad script (NOT in the repo) prints
   `foldRecord({ seed: 1, actions: [] })` — dora kind, indicator, dead wall, hand and
   live prefixes — and asserts agreement with the hand-derived `8m` and the pinned
   deal/wall literals.
3. Pin the golden test (test 7), named per structure.md ("the record contract moved —
   every stored hand replays wrong"), with the provenance comment (literals reused
   from frozen deal/wall goldens; dora derived by hand and cross-checked; never
   regenerate).

**Verify:** `just test` green; deliberately perturb one pinned value (`'8m'` → `'9m'`),
confirm the suite fails, restore, confirm green (proves the golden binds).

## Step 5 — full verification

- `just test` — all suites green (tiles, rng, wall, dora, purity, deal, record,
  app SSR).
- `just check` — svelte-check + tsc strict clean.
- Acceptance-criteria walk: (a) test 1 + golden cover the empty-log fold's full field
  list; (b) test 2 named verbatim; (c) test 3 named verbatim; (d) barrel line + all
  test imports resolving through `./index`.
- `git status` shows only the three intended code files plus this ticket's artifacts
  (and lisa's pre-existing ticket-frontmatter edits, untouched).

## Step 6 — commit

- Code commit: `T-002-01-04: hand record type + fold entrypoint (foldRecord) as core's
  public contract` containing exactly `src/core/record.ts`, `src/core/record.test.ts`,
  `src/core/index.ts`.
- Artifacts commit after review.md exists:
  `T-002-01-04: add RDSPI artifacts (research/design/structure/plan/progress/review)`.

## Testing strategy summary

| Concern | Test | Type |
| --- | --- | --- |
| AC (a) empty-log fold = dealt table incl. mapped dora | record.test.ts #1 | property (∀ seed) |
| AC (b) same seed → identical deal | record.test.ts #2 | property (∀ seed) |
| AC (c) same record → same folded state, repeated folds | record.test.ts #3 | property (∀ seed) |
| Record purity (input untouched) | record.test.ts #4 | property (∀ seed) |
| Conservation end-to-end through the public entrypoint | record.test.ts #5 | property (∀ seed) |
| Loud guard on uninterpretable (non-empty) logs | record.test.ts #6 | example-based |
| Contract freeze (fold assembles the frozen parts) | record.test.ts #7 golden | golden, pinned once |
| AC (d) public exports | barrel line + test imports via `./index` + `just check` | static gate |
| Core import purity | purity.test.ts (existing, auto-globs) | static gate |

No integration tests needed: the fold has no side effects and no app surface until
T-002-02-01; test 1's explicit-composition comparison *is* the integration of all four
underlying modules.

## Risks / watch items

- **`export *` collisions** are silent — step 2's `just check` plus test imports of
  every new name from `./index` both guard this.
- **The guard cast in test 6** must be a single, commented `as unknown as` — it
  deliberately defeats `never` to simulate a corrupt record; keep it contained so the
  test file stays an honest consumer elsewhere.
- **Purity-gate comment rule**: record.ts's docs mention logs/parsers — keep any
  example specifiers unquoted.
- **Golden independence**: the dora kind must be derived by hand *before* running the
  script, so the script confirms rather than produces the pinned value.
- **fast-check runtime**: five new properties at default 100 runs over the full
  build → partition → deal chain ≈ deal.test.ts's existing budget; well within bounds.
