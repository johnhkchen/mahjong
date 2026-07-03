# T-007-03-03 — sort-to-tap-mapping-guard — Review

## What changed

One code commit (`b1632d2`), four files, **zero product-code changes** —
Table.svelte, App.svelte, drive.ts, and all of `src/core/` are untouched:

- **`src/app/table.tap.svelte.test.ts`** — created. The repo's first (and
  only) client-mount suite: 9 tests pinning E-007's named correctness risk.
  Mounts the stateless Table over a `$state` props proxy (the app's own
  update path — one prop in, refolded state assigned), clicks real buttons
  through Svelte's delegated events in jsdom, and asserts on the exact
  TileIds `ontap` reports.
- **`vite.config.ts`** — modified: the `test` block became two vitest
  projects. `node` (environment node) runs every pre-existing suite exactly
  as before; `dom` (environment jsdom, `resolve.conditions: ['browser']`)
  runs exactly `src/**/*.svelte.test.ts`. This is a **deviation from
  structure.md** (which planned a per-file docblock and no config change):
  the docblock swaps DOM globals but not module resolution, so `mount`
  resolved Svelte's server build and threw. Details and the rejected
  alternative in progress.md.
- **`package.json` / `package-lock.json`** — `jsdom@29.1.1` added as an
  exact-pinned devDependency. The policy call is argued in design.md: the
  epic's constraint is no *runtime* dependency, measured at `dist/index.html`
  — which came out **byte-identical** (83,176 bytes, same figure as
  T-007-03-01's review). The precedent T-007-03-02 set was against a headless
  *browser* for animation probing; jsdom is the standard vitest DOM and runs
  only under `just test`.

## Acceptance criteria ↔ evidence

- **"a hand whose draw order differs from sorted order"** — seed 1 (the boot/
  anchor seed), asserted as fixture sanity, not assumed: raw ≠ sorted,
  duplicate kinds present (3m/3p/4p pairs), and the frozen stable-sort fact
  that 4p copy id 50 renders *before* id 49 — the position where kind labels
  and exact ids tell different stories.
- **"tapping the visually-sorted position discards that position's exact
  TileId"** — every one of the 13 buttons clicked in document order; the
  `ontap` sequence equals the frozen sorted-id array (`toEqual` over ids);
  each reported id then builds, via `tapDiscard`, the offered element for
  exactly that tile (`toBe` — the seam's identity discipline walked onto the
  rendered surface). The drawn button is covered separately (its own surface,
  never captured by the sort).
- **"the animated reorder/transition path preserves the mapping"** — two
  reorder flavors, both driven by appending REAL offered elements and
  refolding: the tedashi merge (sorted[0] leaves, the drawn 8s merges at
  sorted position 11, every li shifts) and the seed-15 pon shrink (13→11,
  sorted positions 7 and 8 leave mid-list). After each `flushSync`: document
  order equals the new sorted hand, every click reports the new exact id, and
  every surviving tile's button is the *same DOM node* moved — never
  repurposed. Node identity is the load-bearing assertion: the sibling motion
  tickets' insertion animations mount on exactly this keyed behavior.
  (Scope note, per research: no `.hand` motion exists — the siblings
  deliberately animate pond/drawn/meld only, and CSS is paint-only, unable to
  re-bind a click. The reorder mechanism that *could* remap taps is keyed-each
  reconciliation, which is what jsdom exercises. Pixel-level visual order is
  the one thing not asserted — document order stands in for it, sound for the
  current flex-row hand with no order/transform repositioning.)
- **"drive.test.ts tap→discard stays green"** — untouched, green in the same
  run: 577/577 across 25 files. Also `svelte-check` 178 files 0/0 and
  `just build` green.

## Test coverage assessment

- **The guard is mutation-verified**, not just green: unkeying the hand each
  (`{#each hand as id}`) and index-keying it (`(k)`) each fail the two
  node-identity tests; both mutations reverted, suite re-verified green. A
  comparator change in the display sort would fail the order tests (the sort
  is deliberately replicated in-test rather than exported — design.md's call).
- **Gaps, stated honestly**: (a) pixel positions — DOM order ≡ visual order
  holds by the current CSS; a future `order`/RTL/absolute-positioning restyle
  of `.hand` would need a browser-level check (rejected dependency class);
  (b) CSS motion itself is untested here, owned by the siblings' empirical
  probes; (c) the dom project covers only this file by design — SSR suites
  intentionally never run under the browser build.

## Open concerns for a human

1. **The devDependency + config deviation is the one judgment call to
   ratify**: jsdom (dev-only, dist byte-identical) and the two-project vitest
   split. Both are argued in design.md/progress.md; if the owner prefers a
   zero-dep posture, the fallback is design option C (SSR order + seam
   identity, no closure coverage) — a strictly weaker guard that would leave
   the AC's "exact TileId" clause unproven at the component boundary.
2. **Concurrency note**: the working tree carries live sibling edits
   (`src/core/shanten.*`, `src/core/shanten.property.test.ts`, ticket
   frontmatter churn). This ticket staged by explicit path only; the 568
   pre-existing tests passing includes those uncommitted shanten changes, so
   a sibling revert could shift the total count — this ticket's 9 are
   independent of them.
3. Vitest reports the project name in output (`|dom|`); `just test` output
   shape changed trivially (project prefixes). No consumer parses it.

## Commits

- `b1632d2` — code: the suite, the vitest projects split, the jsdom pin.
- Artifacts commit (this directory) follows, per house pattern.
