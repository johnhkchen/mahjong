# T-004-02-02 — call-pass-prompt-and-meld-display — Progress

Tracking against plan.md. All steps complete; two code commits landed.

## Step log

- **Step 0 — Baseline**: DONE. `just test` 199 green, `just check` 0 errors on
  the starting tree. (Baseline was 199, not -02-01's 192: the working tree
  carries a concurrent thread's `src/core/dynamics.test.ts` additions —
  T-004-01-04's, per the untracked work dir. Handled by staging files
  explicitly; that file and the lisa-owned ticket-frontmatter modifications
  were never staged.)
- **Step 1 — Daiminkan anchor scan**: DONE, HIT. Scratchpad scan (seeds 1–300,
  tsumogiri prefixes ≤ 28 turns) found two East daiminkan windows; froze
  **seed 212, 6 turns**: South discards 103 (8s), East holds all three
  remaining 8s copies [100, 102, 101] (hand order) → THREE identical-kind pon
  pairs + the daiminkan in one window, head = West's draw. Better than the
  plan hoped: one anchor covers both the -02-01 positive-kan gap and the
  maximal dedupe case.
- **Step 2 — promptChoices + tests (commit 1, `80b2ed4`)**: DONE. drive.ts
  +26 lines (`kindOf` import + `promptChoices` after `claimChoices`);
  drive.test.ts +86: dedupe at raceWindow3 (2 duplicate-copy chis → 1, toBe
  the first), seed-212 (4 choices → [pon, daiminkan], survivors toBe into
  claimChoices), seed-15 pass-through (toEqual + per-element toBe),
  emptiness-equivalence property over nine anchors (also pinning prompt
  non-empty ⇔ passClaim non-null), plus tapClaim's positive daiminkan
  selection and identical-kind pon pairs individually selectable. 204 green.
- **Step 3 — ClaimPrompt.svelte**: DONE as structured (~115 lines with
  styles). Props `{claimed, choices, onclaim, onpass}`; buttons echo the
  element's own `(type, uses)`; daiminkan face-labeled "kan"; aria labels pin
  call name + claimed kind + uses kinds; pass button. Computation-free (the
  only reads are `kindOf` for display labels).
- **Step 4 — Table.svelte melds + pond marks**: DONE as structured.
  `claimedAway` derived Set (`'claimed' in meld` narrows ankan out); gated
  per-seat `.melds` list (own tiles, then the claimed tile rotated 90° with
  `aria-label="claimed {kind} from {wind}"`); pond `<li>` swaps to
  `class="claimed"` + `aria-label="claimed {kind}"` when claimed away
  (dimmed, slight rotation — still counted, visibly taken).
- **Step 5 — App.svelte rewire**: DONE. The `?? passClaim` arm and its
  interim comment are gone (the -02-01 review-#1 bomb defused in the same
  commit the prompt lands); effect drives `forcedAction` alone; `prompt`
  derived from `promptChoices`; `claim()`/`pass()` handlers in `tap()`'s
  null-guard shape; conditional `<ClaimPrompt>` after `<Table>` with the
  `claimable !== null` type-guard conjunct.
- **Step 6 — SSR tests**: DONE. Two new describes (+10 tests): the seed-15
  prompt rendered directly (landmark, document-order tile tokens
  [3p,3p,3p,2p,4p,4p,5p], three aria-pinned call buttons, pass button), the
  seed-212 render showing the kan button (and no kan at the mixed window),
  the prompt-free dealt App boot; the seed-3 post-chi Table render (east
  melds [1p,3p,2p], `claimed 2p from north`, north pond ordered-complete with
  the `claimed 2p` mark, exactly one melds region, 11 hand buttons,
  turn-marker on East). One in-flight fix: a not-contains assertion typo
  (`"south pond melds"` → the real label `"south melds"`).
- **Step 7 — Runtime + build**: DONE. `just build` green — dist/index.html
  55.70 kB (51.6 → 55.7 kB across the ticket), self-contained verified. Dev
  smoke: vite served the app and compiled App.svelte/main.ts without error
  (curl against a temporary port). Full in-browser click-through of the
  prompt was NOT performed in this headless session — see review.md; the
  pause/resume trajectory is pinned deterministically by the existing seed-1
  walk (two East windows, actions #96/#104) and the seed-3 claim walk.
- **Step 8 — Artifacts**: this file + review.md, committed together.

## Deviations from plan

1. **Step 1 exceeded expectations** (scan found the kan window immediately) —
   the "documented gap" fallback was not needed; the seed-212 anchor also
   became an SSR fixture (kan button rendering), which the plan had not
   promised.
2. **The pond mark uses an `{#if}` li swap** rather than `class:` +
   conditional aria on one element — byte-identical for unmarked ponds,
   simpler to read; no behavioral difference.
3. **Test count**: 199 → 214 (+15: 5 drive, 10 SSR); plan predicted "a few
   per block" without pinning a number.

Nothing else deviated; structure.md's blueprint matches the landed code.

## Verification summary

- `just test`: 214 passed (11 files) at every gate.
- `just check`: 0 errors, 0 warnings (157 files) at every gate.
- `just build`: single self-contained file, verify-single-file OK.
- Commits: `80b2ed4` (seam helper), `2f4f21c` (prompt + melds + marks).
