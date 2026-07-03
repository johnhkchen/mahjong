# T-007-03-02 — Review: meld exposure & hand-end reveal motion

## What changed

One source file, one commit (`c5f073d`):

- **`src/app/Table.svelte`** — modified, +58 lines, entirely inside `<style>`.
  A single `@media (prefers-reduced-motion: no-preference)` block appended
  after the existing rules, containing four animations on five existing
  selectors:

  | Selector | Keyframes | Duration | Reads as |
  |---|---|---|---|
  | `.meld` | `meld-settle` (opacity 0, scale .85 →) | 200ms | the meld lands on the felt |
  | `.claimed-tile` | `claim-turn` (rotate 0deg →) | 200ms | the claimed tile turns sideways into the parlor mark |
  | `.pond .claimed` | `claim-taken` (opacity 1, rotate 0 →) | 200ms | the pond tile is visibly taken |
  | `.center > .ended`, `.win-summary` | `reveal-rise` (opacity 0, translateY .35rem →) | 220ms | ryuukyoku line / win summary rise into place |

No template, script, prop, or aria change anywhere. No new dependencies. Core
untouched. `Table.svelte` remains a stateless fold-in/markup-out component.

**Mechanism** (the design's one idea): each of these elements mounts exactly
when the fold first contains its fact — a new meld li (unkeyed append-only
each), the pond claimed-branch swap (recreates the li), the terminal phase
blocks. A CSS animation fires on insertion, so mount timing *is* event timing,
with zero script. All keyframes are from-only: the implicit `to` is the
element's settled static style (`rotate(90deg)`, `opacity .45`/`rotate(8deg)`),
so end states stay declared in exactly one place and reduced-motion needs no
override — under `reduce` the block never applies and elements appear directly
in their end states, which is precisely the pre-ticket behavior.

## Acceptance criteria check

- *"Meld exposure and the hand-end (ryuukyoku/agari) reveal animate ~150–250ms
  via CSS only"* — ✅ 200ms/220ms, plain `@keyframes` in the component style,
  no library, no script. Both durations also fit inside one `BOT_DELAY_MS =
  250` tick, so bot pacing never overlaps a running reveal.
- *"honoring prefers-reduced-motion"* — ✅ the entire block is inside
  `@media (prefers-reduced-motion: no-preference)`; verified present in the
  minified `dist/index.html`.
- *"existing meld and ryuukyoku SSR assertions stay green"* — ✅ `just test`
  568/568 (24 files), including `meld display (SSR)`, `hand-end view (SSR)`,
  `wall-exhausted table view (SSR)`, unmodified.
- *"svelte-check passes"* — ✅ 0 errors, 0 warnings (177 files) — in particular
  no `css-unused-selector`, so every animated selector matches the template.

## Test coverage

**Relied on (unchanged)**: the SSR suites pin everything the ticket must not
disturb — meld token order and claimed-from labeling, pond completeness with
the claimed mark, hand-end sentences/tile/yaku, ryuukyoku line, aria
vocabulary. They passed before and after with an identical count.

**Added: none.** The animated behavior (keyframes firing on mount, media-query
gating) is browser-rendering behavior; asserting it would need a headless
browser + `matchMedia` emulation — a new dependency class with no repo
precedent, against the epic's cheap-CSS intent. The gap this leaves is
aesthetic (a wrong duration or `from` value), not functional.

**Backstop performed instead**: built the single file and verified the
compiled CSS directly — each keyframe name appears exactly twice in
`dist/index.html` (Svelte-hashed `@keyframes svelte-5dy8av-*` definition + its
matching `animation:` reference, proving the wiring survives Svelte's keyframe
scoping), all rules inside the reduced-motion media query, the
`.center > .ended` child combinator preserved by minification. Single-file
size gate green (82,774 bytes).

## Open concerns

1. **Manual visual pass is outstanding — the one thing needing a human.** No
   browser automation exists in this environment, so motion *feel* is
   unverified. Script (from plan.md): `just dev`; play to any claim window and
   take it — watch the meld settle, the claimed tile turn sideways, the source
   pond tile dim-and-tilt in sync; end a hand (folding out the wall guarantees
   ryuukyoku) — watch the center reveal rise; then macOS Reduce Motion ON and
   repeat — everything must appear instantly in end states. Durations are the
   likeliest tuning knob; each appears once, in `Table.svelte`.
2. **"Byte-identical SSR" was an overclaim in research/design** — refined in
   progress.md: a style edit changes the Svelte scoping hash embedded in SSR
   `class` attributes. Markup *facts* (structure, content, aria) are identical,
   which is what the tests assert and the criterion means. No action needed.
3. **Two mount-boundary contracts are now load-bearing**, commented at their
   style rules: (a) the melds `{#each}` must stay unkeyed/append-only, or
   every fold replays the settle; (b) the pond claimed mark must stay an
   `{#if}`/`{:else}` branch swap — a `class:` toggle on a kept li would stop
   `claim-taken` firing (legibility regression, not a correctness break;
   svelte-check would not catch it).
4. **Restored-record replay** (known limitation, accepted in design): the
   animations key off insertion, so a future persistence feature loading a
   mid-hand record will replay its reveals once on load. Cosmetic; the
   persistence ticket can gate it then if it grates.
5. **For T-007-03-03's author** (sort-to-tap guard, depends on this ticket):
   this ticket adds *no* motion to any tap surface — nothing on `.hand`,
   `.tap`, or `.drawn`, and no Svelte transition/animate directives anywhere —
   so it introduces no reorder/remap path. The guard's "animated
   reorder/transition" clause will concern T-007-03-01's work, not this.
6. **Sibling coexistence**: T-007-03-01 (draw/discard motion) had not started
   when this landed; it will likely add its own keyframes to the same style
   block. If real duplication appears then, extracting a shared motion
   vocabulary is that ticket's call — deliberately not pre-built here.

## Commits

- `c5f073d` — `T-007-03-02: claim + hand-end motion — meld settles, claimed
  tile turns sideways, reveals rise` (src/app/Table.svelte, +58)
- artifacts commit (this directory) follows.
