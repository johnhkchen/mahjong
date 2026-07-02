# T-003-02-01 — render-ponds-turn-and-phase — Plan

Ordered, independently verifiable steps. Two production-facing commits plus the artifact
housekeeping Lisa expects. Every step's verification is a command, not a judgment call.

## Step 0 — Baseline gate (no commit)

Run `just test` and `just check` on the current tree before touching anything, so any
pre-existing red is known and not attributed to this ticket.

- Verify: both green (or note pre-existing failures in progress.md and proceed only if
  they are unrelated to `src/app/`).

## Step 1 — Fixtures, helpers, and failing SSR tests

**File:** `src/app/app.ssr.test.ts` only.

1. Widen imports: `type HandAction`, `type TileId` from `../core`; `Table` from
   `./Table.svelte`.
2. Add `tsumogiriTurns(live, n)` — the k-th turn is seat `k % 4` drawing and discarding
   `live[k]` (structure.md fixture block).
3. Add `regionTokens(body, label)` — slice the `aria-label="{label}"` element to its
   closing `</ul>`/`</span>` and reuse `tileTokensOf`; fail loudly if the label is absent.
   (Implementation detail: match lazily to the first close tag of the labeled element's
   tag name; ponds and hand are flat lists so the first close is the right one — comment
   this assumption.)
4. Build `midHand` and `exhausted` folds exactly as specified in structure.md (8 turns
   with `actions[1]` swapped to tedashi of `dealt.hands[0][0]`, pending 9th draw; 70
   turns).
5. Add the two describe blocks with the seven assertions from structure.md — pond order
   per seat (ordered arrays vs `midHand.ponds[i].map(kindOf)`), single `aria-current` in
   East's slice, wall-counter strings, drawn-tile region + hand still 13, ryuukyoku
   banner, `0 tiles left`, no `aria-current` after the end.

- Verify: `just test` — the five existing tests still pass; the new tests FAIL on missing
  pond/drawn/banner markup (and `aria-current`), not on fixture-building throws. A
  RangeError from `foldRecord` here means the script builder is wrong — fix before moving
  on; the engine is not in question (T-003-01-01 is done and green).
- Commit 1: `T-003-02-01: SSR spec for ponds, turn marker, drawn tile, and ryuukyoku`
  — committing red view-tests is acceptable mid-story here because commit 2 follows
  immediately in the same pass; if the project's CI gate on main objects, squash 1+2 at
  push time (note the choice in progress.md).

## Step 2 — Grow Table.svelte to the spec

**File:** `src/app/Table.svelte` only.

1. Script: add `pond` labels to `SEATS`; take the index in the `{#each}`.
2. Template, per structure.md's target shape: unconditional pond `<ul>` per seat;
   `aria-current`/`class:active` gated on `phase === 'playing' && i === table.turn`;
   player's drawn-tile chip outside the hand `<ul>`, gated on `turn === 0 && drawn !==
   null`; ryuukyoku `role="status"` banner in the center panel.
3. Styles: `.pond` (flex row, wrap, min-height, no bullets), `.seat.active` (ink-bright
   wind label + subtle cue), `.drawn` (separation margin), `.ended` (banner type).
4. Update Table's header comment: the fact list it presents now includes ponds, turn,
   drawn, phase — still all field reads.

- Verify: `just test` fully green (old five + new blocks); `just check` green
  (svelte-check + tsc — the `Seat` vs loop-index comparison and the
  `aria-current={… ? 'true' : undefined}` expression are the two places types could
  pinch; the loop index needs no cast since it's only used for reads and comparison).
- Commit 2: `T-003-02-01: render ponds, turn marker, drawn tile, and ryuukyoku off the fold`

## Step 3 — Eyeball pass (no commit unless fixes)

`just dev` and load the app once: the boot table (empty log) must look unbroken — four
empty ponds shouldn't distort the felt grid, East is turn-marked with no drawn tile
(drawn is null at deal → no chip; East marked active since phase is playing). This is a
layout smoke check the SSR tests structurally cannot see. Any CSS-only fix folds into a
small follow-up commit (`T-003-02-01: pond layout fix`), still view-only. If the dev
server can't run in this session, note it in progress.md as an open concern for review.md
rather than blocking — the AC is carried entirely by the SSR test.

## Step 4 — Artifacts and handoff

Write `progress.md` (running during steps 0-3, finalized here) and `review.md`
(changes, coverage, concerns). Commit 3:
`T-003-02-01: work artifacts (research through review)` — includes all six artifacts.

## Testing strategy summary

- **Unit/SSR (the AC's own gate):** app.ssr.test.ts is the only test surface this ticket
  needs — the view is stateless, so SSR string assertions fully specify it. No DOM
  emulation, no interaction tests (nothing is interactive yet).
- **What is deliberately NOT tested:** classes and structure (file charter), CSS/layout
  (step 3 eyeball), opponents' drawn-tile concealment as an assertion (it's the absence
  of markup; the pond/hand token counts already pin total visible tiles implicitly — the
  mid-hand body contains exactly 13 hand + 1 drawn + 8 pond + 1 dora tokens, and the
  ordered per-region assertions cover all of them).
- **Engine:** untouched, so its suites are regression canaries only.

## Risks and their planned outs

1. **`regionTokens` regex fragility** (SSR output nesting) — mitigated by the flat-list
   assumption comment + loud failure on no-match; if Svelte's SSR inserts comments
   (`<!---->`) inside lists, the token regex (`>([1-9][mpsz])<`) is unaffected since it
   keys on Tile's span content, and the slice regex uses dotall.
2. **Wind-word-count test collision** — pond labels are lowercase by design (D3); if the
   existing test still trips (e.g. 'east' vs 'East' assumptions change), the fix is the
   label constant in SEATS, one place.
3. **Existing tile-multiset App test picking up new regions** — App's record has empty
   ponds and null drawn, so token totals are unchanged; if it trips, something rendered
   unconditionally that shouldn't (that's a real bug to fix, not a test to adjust).
4. **`svelte/server` render of Table directly** — same API already used for App; Table
   has no context/store requirements, only a prop. Low risk.
5. **Tedashi fixture correctness** — `dealt.hands[0][0]` is by construction not the drawn
   tile (`dealt.live[1]` was never dealt), so the fold takes the tedashi branch; if the
   fold throws, the builder (not the engine) is at fault.

## Done means

- [ ] `just test` green including: mid-hand render shows all four ponds in discard order,
      the active seat marked, wall counter = live.length; exhausted render shows the
      ryuukyoku end state. (The AC, verbatim, as executed test names.)
- [ ] `just check` green.
- [ ] Commits landed in order; artifacts complete; ticket frontmatter untouched (Lisa's).
