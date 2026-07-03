# T-007-02-01 — portrait-table-frame — Review

## What changed

**One file, one commit, style block only.**

- `src/app/Table.svelte` (commit `97502b3`, +23/−9, all inside `<style>`):
  - `.table`: the square 3×3 grid (`aspect-ratio: 1`, corner cells, `width:
    min(100%, 70dvh)`, `1fr 2fr 1fr` tracks) became three portrait bands — West
    spanning the top, North | center | South in the middle, East (the player's whole
    zone) spanning the bottom. Columns `1fr 7.5rem 1fr`, rows `auto 1fr auto`,
    `width: 100%`, `max-width: 26rem` (the phone-frame cap on desktop),
    `min-height: min(60dvh, 30rem)` (boot-state felt presence; the `1fr` middle row
    absorbs the slack), `box-sizing: border-box`, small padding and row-gap. The
    wind→area mapping still lives in exactly one place.
  - `.seat` / `.center`: `min-width: 0` — the structural guarantee that no grid track
    can be blown wider than its share (the AC's "overflow-x contained", by
    construction rather than by clipping).
  - `.pond`: `max-width` 9.5rem → 100% (bands and tracks now size ponds).
  - `.center`: percentage margin (tuned for the square) → fixed padding,
    `align-self: center`.

**Created:** the six RDSPI artifacts in this directory. **Deleted:** nothing.
**Untouched:** all markup/templates, `App.svelte`, `ClaimPrompt.svelte`,
`Tile.svelte` (concurrently owned by T-007-01-02), all tests, all of `src/core/`.

## Acceptance criteria — verified

- **360×780, no horizontal scroll**: measured, not eyeballed — a headless-Chrome
  harness iframing the built `dist/index.html` at exactly 360×780 reports
  `documentElement.scrollWidth = 360` at boot **and** at a deep mid-hand (42 discards:
  ponds 11/11/10/10, one South meld, wall at 29, reached by auto-playing the human
  seat tsumogiri against the live bot drive). `scrollHeight = 780` too — the frame
  doesn't even scroll vertically at that state.
- **All four ponds + melds + dora + wall count on-screen at once**: every region's
  `getBoundingClientRect` measured fully inside the 360×780 viewport simultaneously;
  screenshot evidence captured (session scratchpad, `midhand-real.png`).
- **SSR aria landmarks/tests unchanged**: zero template edits, zero test edits;
  `just test` green (24 files / 564 tests).
- **svelte-check green**: 0 errors, 0 warnings (plus tsc clean) via `just check`.

## Test coverage assessment

- The existing SSR suite is the regression net and it passes unmodified — for a
  markup-invariant CSS change that is the strongest automated signal the repo has
  (vitest has no layout engine; there is deliberately no new dependency).
- **Gap (accepted, flagged):** no *committed* automated check measures viewport
  geometry; the empirical verification lives in a session scratchpad harness plus
  this record. If layout regressions recur, a checked-in headless-viewport smoke
  script would be the fix — that is a new-tooling decision above this ticket.
- **Gap (bounded by arithmetic):** the mid-hand measurement samples one real deep
  state; the true worst case (all four ponds 21 discards, four melds each) is covered
  by fixed-pixel arithmetic (tile scale is rem-fixed at 19.2×26.88px: worst bands
  total ≈ 550px of 780) rather than by measurement.

## Open concerns for a human reviewer

1. **Desktop identity change (deliberate):** the square parlor felt is gone
   everywhere; desktop now gets the same portrait card centered at 26rem. Rationale in
   design.md (the square was already degrading into overlap mid-hand; the product is
   pocket-first; the b28.dev embed shows the same file). If a wide-viewport layout is
   ever wanted, it should be a new ticket with its own media-query design.
2. **Tuning constants** (`7.5rem` center column, `26rem` frame cap, `min(60dvh,
   30rem)` presence height) are judgment calls verified at 360×780; other phones will
   flex fine structurally (`min-width: 0` + wrapping), but aesthetics at, say, 320px
   width were not specifically tuned (312-wide content still fits: bands shrink, side
   pond columns drop to ~76px ⇒ 3 tiles/row).
3. **Hand/prompt ergonomics are out of scope by design** — the hand renders full-width
   in the bottom band at the old tile scale and the claim prompt stays in flow below
   the table; T-007-02-02 (thumb zone, ≥44px targets) owns both and now has a stable
   full-width bottom band to build in.
4. **Headless-Chrome quirk worth remembering** (recorded in progress.md): direct
   `--window-size=360` screenshots are clamped wider on macOS and `--virtual-time-
   budget` cannot drive this app (it waits on human input). The iframe-at-360 +
   real-time auto-player harness is the pattern that works; T-007-02-02's verification
   will want it.

## TODOs / known limitations

- None in shipped code. No TODO comments introduced; no behavior changed — this was a
  pure presentation reflow with the action-log contract, drive seam, and component
  interfaces untouched.
