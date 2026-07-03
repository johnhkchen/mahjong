# T-007-03-02 — Plan: meld exposure & hand-end reveal motion

## Steps

The change is one additive CSS block, so the plan is one implementation step
plus verification gates, committed atomically.

### Step 1 — Baseline the gates

Run `just test` and `just check` **before** touching anything, to know whether
the shared working tree (other lisa threads have `src/core/shanten.*` modified)
is green going in. If a pre-existing failure exists, record it in progress.md
and judge this ticket only against suites it owns (`src/app/*.ssr.test.ts`,
svelte-check over `src/app/`).

- **Verify**: baseline recorded in progress.md.

### Step 2 — Append the motion block to `Table.svelte`

Per structure.md: one `@media (prefers-reduced-motion: no-preference)` block at
the end of `<style>` containing:

- `.meld` → `meld-settle 200ms ease-out` (from: `opacity 0`, `scale(0.85)`)
- `.claimed-tile` → `claim-turn 200ms ease-out` (from: `rotate(0deg)`)
- `.pond .claimed` → `claim-taken 200ms ease-out` (from: `opacity 1`, `rotate(0deg)`)
- `.center > .ended, .win-summary` → `reveal-rise 220ms ease-out`
  (from: `opacity 0`, `translateY(0.35rem)`)

All keyframes are from-only (implicit `to` = the element's settled computed
style). Comments state the two mount-boundary contracts (unkeyed append-only
melds each; claimed mark as branch swap) — the *why*, at the rule that depends
on it. Template and `<script>` untouched.

- **Verify**: `git diff src/app/Table.svelte` shows changes only inside
  `<style>`.

### Step 3 — Run the gates

1. `just test` — all vitest suites; specifically `meld display (SSR)`,
   `hand-end view (SSR)`, `wall-exhausted table view (SSR)` must pass.
2. `just check` — svelte-check + tsc; **zero** new warnings (svelte-check's
   `css-unused-selector` is the misspelled-selector trap).

- **Verify**: both commands exit 0 (modulo any pre-existing failure recorded in
  step 1, which must be *identical* before and after).

### Step 4 — Prove the built artifact ships the motion

`just build`, then grep `dist/index.html` for `meld-settle`, `claim-turn`,
`claim-taken`, `reveal-rise`, and `prefers-reduced-motion`. This closes the
loop the SSR tests cannot (component CSS never reaches `render()` output): the
one shipped file actually inlines the keyframes and the reduced-motion guard,
and the size gate still passes.

- **Verify**: all five strings present in `dist/index.html`; build (incl. size
  gate) exits 0.

### Step 5 — Commit the implementation

Stage **only** `src/app/Table.svelte` (the tree carries other threads' edits).
Message following the repo convention:

```
T-007-03-02: meld exposure + hand-end reveal motion — CSS-only mount animations
```

- **Verify**: `git show --stat HEAD` lists exactly one source file.

### Step 6 — Review artifact + artifacts commit

Write `review.md` (changes, coverage, open concerns — including the manual
visual pass status and the mount-boundary contracts for T-007-03-03's author).
Commit `docs/active/work/T-007-03-02/` as
`T-007-03-02: RDSPI artifacts — research through review`.

- **Verify**: `git show --stat HEAD` lists only files under
  `docs/active/work/T-007-03-02/`.

## Testing strategy

**No new automated tests.** Justification, since a plan that adds none must say
why:

- The acceptance criterion's testable clauses are "existing meld and ryuukyoku
  SSR assertions stay green" and "svelte-check passes" — both are existing
  gates, and the change keeps SSR markup byte-identical, making the first
  structural.
- The animated behavior itself (a keyframe firing on mount, honoring a media
  query) is browser-rendering behavior. Asserting it would mean a headless
  browser with `matchMedia` emulation — a new dependency class the epic's
  "cheap CSS-only motion" intent argues against, and no precedent exists in the
  repo (the test suite is vitest + svelte SSR only).
- The gap that leaves — a wrong `from` value, an ugly duration — is aesthetic,
  caught by the manual pass, not assertable meaningfully anyway.
- The step-4 dist grep is the automated-ish backstop that the shipped file
  contains the motion CSS at all.

**Existing coverage relied on**: `app.ssr.test.ts` meld display suite (seed-3
chi fixture: meld tokens, claimed-from label, pond completeness, turn handoff),
hand-end suite (tsumo + bot ron), wall-exhausted suite (ryuukyoku). These pin
everything the ticket must not disturb.

**Manual verification** (the honest check for motion feel), via `just dev`:

1. Fresh boot → wait for a bot claim or force one: the seed-3 script from the
   SSR fixture is reproducible — but in the live app the simplest path is
   playing seed 1 until any claim window and taking it. Watch: meld settles in,
   claimed tile turns sideways, pond tile dims-and-tilts in sync.
2. Play/let a hand end both ways if feasible (ryuukyoku is guaranteed by
   folding out the wall; agari depends on play) — watch the center reveal rise.
3. macOS System Settings → Accessibility → Display → Reduce motion ON → repeat
   step 1: elements must appear instantly in end states (sideways tile, dimmed
   pond mark, visible summary), no motion.

If the environment can't drive a browser, record exactly that in review.md as
the open concern rather than claiming the pass.

## Risks & mitigations

- **Pre-existing red in the shared tree** (in-flight `shanten.*` edits) →
  step-1 baseline separates inherited failures from caused ones.
- **svelte-check flags an animated selector** → would mean the template/selector
  inventory in structure.md was wrong; fix the selector, never add markup.
- **Concurrent thread edits Table.svelte** (T-007-03-01 is a sibling) → commits
  are file-locked by lisa; if a conflicting change lands between steps, re-run
  steps 3–4 after rebase. The block is purely additive, so conflicts are
  append-position only.
