# T-007-01-02 — pin-sou-numbered-faces — Plan

## Steps

### Step 1 — pip vocabulary + layout tables (Tile.svelte module script)

Add to the existing `<script lang="ts" module>`:

- `PIN`, `SOU`, `RED` ink constant objects (dominant + darker ring/edge shades).
- `Coin` / `Stick` types.
- `PIN_LAYOUTS: Record<Rank, readonly Coin[]>` — nine literal arrays per the
  structure.md coordinate sketch (1p grand red coin … 9p 3×3 with red center).
- `SOU_LAYOUTS: Record<Rank, readonly Stick[]>` — `1: []` (bird branch owns 1s),
  2s–9s per sketch; 8s entries carry `tilt` for the gable rotation.
- Import `Rank` type from `../core` in the module script.

Verify: file compiles in isolation via `just check` at end of step 3 (Svelte
files can't be type-checked piecemeal; steps 1–3 are one edit session, one
commit — split here only for review legibility).

### Step 2 — template branches (Tile.svelte)

Replace the interim numbered region with four branches: m interim (byte-moved,
unchanged content), p `{#each}` coins (circle + ivory square hole each), 1s bird
(hand-placed shapes: perch rect, body ellipse, head circle, red beak path, ivory
eye circle, two tail rects), s `{#each}` sticks (rounded rect + ivory joint
line, shared `transform` when tilted). Instance script gains
`const rank = $derived(kind === null ? null : rankOf(kind))`; import `rankOf`.
Guard the each-branches on `rank !== null`.

Constraints checked while writing:
- No `<text>` in p/s branches; no digit-adjacent-suit-letter anywhere.
- No ids, no defs, no `<title>`, no gradients.
- All shapes within x 8–52, y 6–72 after rotation (8s checked by hand: a 24-long
  stick rotated 20° about its center stays within ±~12 of center).
- Coin holes and joints painted after (over) their pip shape — SVG paint order.

### Step 3 — tests (tile.ssr.test.ts)

Add the `pip faces` describe from structure.md: coin count == N on Np; rect
count == 2 + N on Ns (N ≥ 2); `<ellipse` on 1s only across all 34 kinds; no
`<text` in any p/s chip; `<text` still present on 5m (the -03 handoff pin);
34 pairwise-distinct chip bodies. Reuse `chipOf`; add a local `countOf` helper.

### Step 4 — verify

- `just test` — full vitest sweep: the new describe, the untouched chassis
  contract (token multiset over all 34 kinds now exercises the pip faces), and
  app.ssr.test.ts with zero edits.
- `just check` — svelte-check + tsc, 0 errors 0 warnings.
- `just build` — single-file build green; record byte size against the 77,525 B
  baseline (expect ~+3–6 KB of template markup, nowhere near -04's ceiling).

Failure handling: coin/stick counts off by chassis assumptions → recount
`<rect` in an honor chip first (must be 2) before touching layouts; token sweep
failure → some shape attribute leaked a token-shaped string (impossible for
shapes — would indicate a `<text>` remnant; delete it).

### Step 5 — commit

One commit, message `T-007-01-02: pin/sou pip faces — coins, bamboo, the 1s
bird on the settled chassis`. Stage explicitly:

```
git add src/app/Tile.svelte src/app/tile.ssr.test.ts docs/active/work/T-007-01-02
```

Never `git add -A` — the tree carries sibling threads' edits (shanten files,
other tickets' docs). Audit `git diff --cached --stat` before committing.

### Step 6 — artifacts commit

`progress.md` is updated during implement; `review.md` written after. Commit
artifacts with the RDSPI convention (`T-007-01-02: RDSPI artifacts — research
through review`) as the prior tickets did.

## Testing strategy summary

| Layer | What proves it |
| --- | --- |
| Token contract survives | existing 34-kind multiset sweep + full-set test, unchanged |
| Faces are the right faces | new coin/stick multiplicity + bird exclusivity |
| Interim numerals gone (p/s) / kept (m) | `<text` absence/presence assertions |
| All 18 faces distinct (AC "distinct") | 34-way pairwise-distinct assertion |
| Types / template validity | `just check` |
| Ships as one file | `just build` |
| Looks right | human `just dev` eyeball — flagged in review.md, not automated (content-only doctrine) |

## Rollback / deviation rules

The component change is internally atomic — if the bird stalls aesthetically,
the designed fallback (single large stalk) slots into the same branch without
touching tests except the ellipse marker (fallback keeps an ellipse leaf or the
test pivots to the perch). Any deviation gets a dated note in progress.md before
proceeding.
