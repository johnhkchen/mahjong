# T-007-03-03 — sort-to-tap-mapping-guard — Design

## The question

The AC demands a test proving a **rendered-component** fact: the button at
visually-sorted position k reports exactly `sorted[k]`'s TileId to `ontap`, and
keeps doing so across the reorder path. Research shows the only untested link
is Table.svelte's keyed each + click closure — invisible to SSR (no handlers in
SSR output) and to pure TS (no DOM). The design question is therefore: **how to
render and click**, and what exactly to assert.

## Options considered

### A — jsdom client-mount test (CHOSEN)

Add `jsdom` as a devDependency; one new test file with the
`@vitest-environment jsdom` docblock (global config stays `node`; every other
suite untouched). The test `mount`s Table (Svelte 5 client API) with a
`$state`-proxied props object, queries the hand buttons in document order,
`click()`s them, and asserts the exact TileIds `ontap` receives — then mutates
`props.table` to the refolded post-tedashi state, `flushSync()`s, and asserts
the mapping again across the keyed reorder, including DOM-node identity for
surviving tiles.

- **For**: the only option that tests the actual risk (closure wiring +
  keyed reconciliation) rather than a replica of it. Exact ids, not kinds —
  the seed-1 hand's duplicate kinds (and its stable-sorted `50:4p` before
  `49:4p`) make kind-level assertions provably weaker. Exercises the very
  update path the sibling tickets' insertion animations mount on.
- **Against**: first DOM-test dependency in the repo. Weighed below.
- Verified feasible: vite-plugin-svelte matches rune modules by `.svelte.`
  infix (`DEFAULT_SVELTE_MODULE_INFIX` in the installed plugin), so
  `table.tap.svelte.test.ts` gets rune support; Svelte 5's delegated events
  receive jsdom's bubbling `.click()`; vitest supports per-file environments.

### B — happy-dom instead of jsdom

Same shape, lighter/faster dependency.
- **Rejected**: jsdom is Svelte's own vitest guidance and the ecosystem
  default; happy-dom's fidelity gaps (event/focus quirks) are exactly the
  kind of noise a *guard* test must not sit on. Speed is irrelevant at one
  file. Either works; pick the boring one.

### C — no new dep: SSR order assertion + pure-TS sort replica

Assert SSR document order of `discard {kind}` labels equals the sorted kinds;
separately prove `tapDiscard(offered, PLAYER, sorted[k])` returns the exact
offered element (pure TS, drive-test style).
- **Rejected as the whole answer**: it cannot see `onclick={() => ontap?.(id)}`
  — the one untested link. Kind labels cannot distinguish the two 4p copies,
  so a component that swapped duplicate copies' buttons would pass. It proves
  "the view sorts" and "the seam selects", never "the button you tap IS the
  tile you get". The AC's "exact TileId" and "animated reorder path preserves
  the mapping" are both out of its reach (SSR renders once; there is no
  reorder). — Its *order* half survives as a cheap complement inside A's file
  (kind-order asserted against the raw hand via core accessors), because it
  documents the sort contract in the same place.

### D — headless browser (playwright/puppeteer)

Real pixels, real CSS, could also watch the transitions run.
- **Rejected**: T-007-03-02's review already declined this dependency class
  for the motion tickets; the visual-position≡DOM-order equivalence holds by
  the current CSS (flex row, no order/transform repositioning on `.hand`), and
  the marginal assurance (pixel positions) does not buy a new browser runtime
  in CI for a single guard. Research records the equivalence as the honest
  testable claim.

## Why the new devDependency is justified (the one policy call)

The epic's constraint is **no runtime dependency** — measured at
`dist/index.html`, which a vitest devDep can never touch. The precedent
T-007-03-02 set was against a *headless browser* for probing animation feel;
jsdom is a different class: the standard vitest DOM used by Svelte's own
testing docs, exercised only under `just test`. The AC as written —
"tapping ... discards that position's exact TileId ... the animated reorder
path preserves the mapping" — is not honestly provable without a client mount;
choosing C would ship a test that *looks* like the guard and isn't. Pinned
exact-version like every other devDep.

## What the test asserts (the chosen shape)

File: `src/app/table.tap.svelte.test.ts` (matches vitest's `src/**/*.test.ts`
include AND the plugin's `.svelte.` module infix). Fixtures fold from **seed 1**
— the boot/anchor seed every suite shares — via the same records drive.test.ts
uses; no product code changes at all, Table.svelte included (the guard must
watch the component as it is, not a testability fork of it).

State A: `afterEastDraw` — 13-tile hand (draw order ≠ sorted order, asserted
as fixture sanity, plus duplicate kinds present), drawn `100:8s`, offering =
14 discards.

1. **Sorted render order** — the 13 `.hand` buttons in document order carry
   aria-labels `discard {kindOf(sorted[k])}` where `sorted` is the stable
   kind-index sort of `table.hands[0]` computed in-test from core's public
   `kindIndexOf`/`kindOf` (the sort contract, stated once next to the DOM it
   governs; option C's salvageable half).
2. **Tap identity, every position** — clicking button k yields exactly
   `sorted[k]` via `ontap`, for all 13 positions, and
   `tapDiscard(offered, PLAYER, received)` returns the offered element with
   `action.tile === sorted[k]` (`toBe` an element of `offered` — the seam's
   identity discipline extended to the rendered surface). The duplicate-kind
   positions (3m/3p/4p pairs, including the id-order-inverted 4p pair) are
   where this has teeth.
3. **Drawn surface** — clicking the drawn button yields exactly `100`, the
   sort never captures it.
4. **The reorder path** — append the REAL tapDiscard element for `sorted[0]`
   (tedashi: every li shifts, drawn merges at sorted position 11 — probed),
   refold, `props.table = next`, `flushSync()`. Assert: 13 buttons again;
   document order equals the NEW sorted hand; clicking every position yields
   the new exact ids (taps are now the owner's no-op — the mapping is still
   the component's fact); the discarded tile's button is gone; the merged
   tile has a **new** node; and every surviving tile's button is the **same
   DOM node** as before (keyed-by-id reconciliation — nodes move, never get
   repurposed; the property the sibling tickets' mount-boundary animations
   also lean on, and the assertion that fails loudly if the each is ever
   re-keyed by index or unkeyed).
5. **A second reorder flavor** — the seed-15 pon claim (drive.test.ts's
   anchor): hand 13→11, two ids leave at once, `mustDiscard`. Same mapping
   assertions; proves the guard is not shaped around one mutation kind.

`drive.test.ts` stays green untouched — the AC's last clause is the existing
suite run, not new work.

## Rejected micro-alternatives

- **Exporting the sort from Table.svelte** (module-script export) to avoid the
  in-test replica: rejected — it mutates product code for testability and lets
  the test follow a refactor silently; the replica makes any comparator change
  fail visibly, which is what a guard is for.
- **Mounting App instead of Table**: App's `$effect` drive loop starts real
  `setTimeout`s and auto-plays bots — nondeterministic test churn for zero
  additional coverage of THIS seam (App.tap→tapDiscard is drive.test.ts's,
  and wiring `ontap={tap}` is one prop). Table is the stateless unit whose
  contract is its props; mount it directly, drive records by hand.
- **Asserting CSS (`no transition on .hand li`)**: pins the siblings'
  implementation, breaks on legitimate restyling, and tests nothing about
  taps. The DOM-mapping assertions are the durable form of the same guard.
