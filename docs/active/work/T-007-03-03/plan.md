# T-007-03-03 — sort-to-tap-mapping-guard — Plan

## Steps

### Step 1 — install the DOM environment

`flox activate -- npm install --save-exact --save-dev jsdom`

Verify: `package.json` gains an exact-pinned `jsdom`; `node_modules/jsdom`
exists; `just test` still passes 568/568 (the install alone must change no
behavior — global vitest env is still `node`).

Risk checkpoint: if the flox sandbox blocks npm's network, stop and surface —
no fallback dependency-vendoring games.

### Step 2 — smoke the environment before writing the real suite

Scratch spike (not committed, or written then folded into the real file):
docblock `@vitest-environment jsdom`, `mount(Table, { target, props })` with
the seed-1 dealt fold, one `querySelectorAll` count and one `.click()` → ontap
capture. This de-risks the three environment assumptions in one shot:

- runes transform in the `.svelte.test.ts` filename (plugin infix — verified
  in source, unverified at runtime),
- client-compiled Svelte modules load under vitest's jsdom transform mode
  alongside the node-env SSR suites in the same run,
- delegated `onclick` fires from jsdom's `.click()`.

If any fails: fallback ladder (design) — move the `$state` props creation into
a `src/app/` helper named with a plain `.svelte.ts` suffix; or last resort
remount-per-state (loses node-identity assertions; would be documented as a
deviation and the AC's reorder clause re-scoped — not expected).

### Step 3 — write the full suite

`src/app/table.tap.svelte.test.ts` per structure.md's layout: helpers
(`sortedDisplay`, `mountTable`, `tsumogiriTurns`), seed-1 fixtures, the five
describe blocks (render order / tap identity / drawn / tedashi reorder /
claim-shrink reorder). Assertion inventory pinned in structure.md; the
duplicate-kind positions and the `50:4p`-before-`49:4p` stable-sort fact are
the teeth — assert them explicitly as fixture sanity so a future wall change
that accidentally deals a sorted hand fails loudly rather than passing vacuously.

Cleanup discipline: every mount is unmounted (afterEach or try/finally) so
delegated listeners and DOM don't leak across tests.

### Step 4 — full verification battery

- `just test` — all suites; the AC's clause (d) is drive.test.ts green in the
  same run as the new guard.
- `just check` — svelte-check accepts the rune-bearing test file; tsc node
  config unaffected.
- `just build` — single-file gate unchanged (proves the devDep is invisible to
  dist; the epic's no-runtime-dependency constraint measured where it binds).

### Step 5 — commit

One code commit, staged by explicit path only (concurrent lisa threads own
other working-tree changes):

```
git add package.json package-lock.json src/app/table.tap.svelte.test.ts
git commit -m "T-007-03-03: sort-to-tap mapping guard — jsdom client suite ..."
```

Then the artifacts commit (`docs/active/work/T-007-03-03/`).

## Testing strategy (what tests what)

- **New unit/DOM suite** (this ticket): the component-level mapping — sorted
  render order, click→exact-TileId at every position, tapDiscard identity from
  the rendered surface, keyed-reorder node identity across tedashi and claim
  mutations. Two mutation flavors so the guard isn't shaped to one.
- **Existing drive.test.ts** (unchanged): the seam's own identity/doctored-list
  discipline — the AC explicitly requires it stays green.
- **Existing SSR suites** (unchanged): everything the new suite must not
  disturb; they also cover the hand's 13-count and labels server-side.
- **Not tested, recorded honestly**: pixel-level visual position (research's
  DOM-order≡visual-order equivalence, CSS-dependent), and CSS motion itself
  (paint-only; cannot remap a click; the siblings' reviews own that ground).

## Verification criteria (the AC, mapped)

| AC clause | Evidence |
|---|---|
| hand whose draw order differs from sorted order | seed-1 fixture sanity assertion (probed: differs, duplicate kinds) |
| tapping the visually-sorted position discards that exact TileId | click-every-position ⇒ ontap ids ⇒ tapDiscard `toBe` offered element |
| animated reorder/transition path preserves the mapping | post-mutation flushSync battery: order + clicks + same-node identity, tedashi AND claim |
| drive.test.ts tap→discard stays green | full `just test` run, untouched file |

## Step sizing

Steps 1–2 are one commit-less setup motion; step 3 is the single meaningful
change; 4 verifies; 5 commits. One atomic code commit total — the ticket is a
guard, not a feature.
