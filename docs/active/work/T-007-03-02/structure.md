# T-007-03-02 — Structure: meld exposure & hand-end reveal motion

## File-level changes

| File | Change |
|---|---|
| `src/app/Table.svelte` | **Modified** — `<style>` block only: one media-query block appended containing two `@keyframes` and five `animation:`/keyframe attachments. Template and `<script>` untouched. |
| `docs/active/work/T-007-03-02/*` | **Created** — RDSPI artifacts. |

No files created or deleted in `src/`. No changes to `App.svelte`,
`Tile.svelte`, `ClaimPrompt.svelte`, tests, or config. No new dependencies.

## The shape of the CSS

Appended at the end of `Table.svelte`'s `<style>` (after `.label`, keeping the
existing order of rules untouched so the diff is purely additive):

```css
/* Motion: claims and hand-ends arrive, they don't pop. Every rule here is
   additive on top of settled static styles, so under reduced motion the
   block simply never applies and elements appear in their end states. */
@media (prefers-reduced-motion: no-preference) {
  /* A new meld li mounts exactly when the fold first contains the meld
     (the unkeyed each appends; existing lis update in place). */
  .meld {
    animation: meld-settle 200ms ease-out;
  }

  /* The claimed tile turns sideways into the parlor mark — animating INTO
     the static rotate(90deg) above, so the end state needs no repeating. */
  .claimed-tile {
    animation: claim-turn 200ms ease-out;
  }
  @keyframes claim-turn {
    from {
      transform: rotate(0deg);
    }
  }

  /* The pond tile is visibly taken: the {#if claimedAway} branch swap
     recreates the li, so the mark's dim-and-tilt animates at the claim. */
  .pond .claimed {
    animation: claim-taken 200ms ease-out;
  }
  @keyframes claim-taken {
    from {
      opacity: 1;
      transform: rotate(0deg);
    }
  }

  /* Hand-end reveal: the ryuukyoku line (a DIRECT child of .center — the
     win sentence's own .ended sits inside .win-summary and must not double-
     animate) and the win summary rise quietly into place. */
  .center > .ended,
  .win-summary {
    animation: reveal-rise 220ms ease-out;
  }
  @keyframes reveal-rise {
    from {
      opacity: 0;
      transform: translateY(0.35rem);
    }
  }

  @keyframes meld-settle {
    from {
      opacity: 0;
      transform: scale(0.85);
    }
  }
}
```

(Exact ordering/comment wording finalized at implement; this is the blueprint.)

## Design notes carried into the code

### From-only keyframes

Every `@keyframes` declares only `from`; the implicit `to` is the element's own
computed style. This is the mechanism that makes reduced-motion and the static
end states a single source of truth: `rotate(90deg)` lives only in the existing
`.claimed-tile` rule, `opacity: 0.45; rotate(8deg)` only in `.pond .claimed`.
No end-state value is duplicated into a keyframe.

### Selector inventory (svelte-check contract)

All five animated selectors match template elements that already exist —
`li.meld` (Table.svelte:69), `span.claimed-tile` (:73), pond `li.claimed`
(:57), `p.ended` in `.center` (:112), `div.win-summary` (:122) — so
`css-unused-selector` stays quiet. No new class names are introduced, which is
what keeps SSR output byte-identical.

### `transform` collision audit

`animation` on an element whose static rule sets `transform` overrides that
transform for the animation's duration — fine where the keyframe animates the
same property into the same end state (`claim-turn`, `claim-taken`), and safe
elsewhere because no other animated element has a static transform:

- `.meld` — no static transform. ✓
- `.claimed-tile` — static `rotate(90deg)`; keyframe ends there by omission. ✓
- `.pond .claimed` — static `rotate(8deg)` + `opacity .45`; same. ✓
- `.center > .ended`, `.win-summary` — no static transform/opacity. ✓

### Mount-boundary contract (for future maintainers)

The animations key off *insertion*. Two template facts uphold that and are now
load-bearing; both get a comment at their style rule, not the template:

1. The melds `{#each}` is unkeyed and append-only per hand — index-diffing
   updates existing lis in place, so only genuinely new melds animate. If it is
   ever keyed by something that churns, every fold would replay the settle.
2. The pond's claimed mark is an `{#if}`/`{:else}` branch swap (recreates the
   li). If that ever becomes a `class:` toggle on one li, `claim-taken` stops
   firing (a class toggle doesn't restart an animation already applied) — the
   claimed mark would just pop again. Not a correctness break, a legibility
   regression; svelte-check will not catch it.

## Module boundaries

- **core untouched** — motion is pure presentation; the fold knows nothing.
- **Table.svelte remains stateless** — no props added, no state, no effects.
  The component's contract ("TableState in, markup out") is unchanged; motion
  is a styling of *when DOM appears*, which the fold already determines.
- **No shared motion module yet.** T-007-03-01 will add draw/discard motion,
  likely also in Table.svelte styles. Two tickets' keyframes coexisting in one
  `<style>` is fine at this scale; extracting a shared motion vocabulary is a
  refactor for whichever ticket lands second *if* real duplication appears.
  This ticket deliberately does not pre-build abstraction for a sibling that
  hasn't been designed.

## Ordering of changes

Single atomic change — one file, one style block. No migration ordering, no
staged rollout. Implementation order inside the commit:

1. Append the media-query block to `Table.svelte`'s `<style>`.
2. `just test` (SSR suites green), `just check` (svelte-check + tsc clean).
3. `just build`; grep `dist/index.html` for `meld-settle`, `reveal-rise`,
   `prefers-reduced-motion` to confirm the single file ships them.
4. Commit `src/app/Table.svelte` only (the tree carries other threads' edits —
   stage explicitly, never `git add -A`).
5. Commit `docs/active/work/T-007-03-02/` as the artifacts commit.

## Interfaces

No public interface changes. The action-log contract, `TableState`, component
props, aria vocabulary, and test fixtures are all untouched.
