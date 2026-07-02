# T-004-02-02 — call-pass-prompt-and-meld-display — Plan

Ordered steps over structure.md's blueprint. Two code commits (seam helper,
then view + wiring), each gated on `just test` + `just check`; `just build`
before the final commit. Artifacts commit last. Core untouched throughout.

## Step 0 — Baseline

Run `just test` and `just check` on the clean tree; confirm 192 tests green
before touching anything. (The working tree has unrelated ticket-frontmatter
modifications owned by lisa — leave them out of every commit; stage files
explicitly, never `git add -A`.)

Verify: baseline green recorded in progress.md.

## Step 1 — Scratchpad scan for an East daiminkan anchor (time-boxed)

A throwaway script in the scratchpad (never committed): for seeds 1..~200 and
tsumogiri prefixes up to ~24 turns, fold and check `legalActions` for a
`daiminkan` offer with `seat === 0`. Also note (bonus, same scan) any East
window mixing kan with other forms. Take the first hit; record seed, turn
count, uses, and the head-draw owner as the derivation comment.

- Hit → freeze the anchor in drive.test.ts (step 2 includes the positive
  tapClaim kan test and the promptChoices kan labeling case).
- No hit inside the box (~2 min of scanning) → the -02-01 daiminkan gap stays
  documented in review.md; nothing blocks (the arm is form-agnostic).

Verify: anchor derivation comment written from the scan output, or the gap
noted.

## Step 2 — drive.ts promptChoices + drive.test.ts (commit 1)

1. Add `kindOf` to drive.ts's core import; append `promptChoices` after
   `claimChoices` with the doc contract from structure.md (presentation
   dedupe; first-of-group; empty ⇔ claimChoices empty).
2. New `describe('promptChoices')` in drive.test.ts:
   - raceWindow3: length 1; `toBe` the first offered chi variant ([37,47]);
     the duplicate-copy sibling ([37,44]) filtered.
   - mixedWindow15: pass-through — `toBe`-identity to claimChoices' pinned
     three (pon [44,47], chi [41,51], chi [51,55]), order preserved.
   - Empty at beforeSouthDraw (bot-only window), dealt, afterEastDraw,
     exhausted.
   - Emptiness equivalence: over the eight -02-01 anchor states,
     `promptChoices(...).length === 0` ⇔ `claimChoices(...).length === 0`
     (the prompt-visibility/loop-wait coupling made a test).
   - If step 1 landed: the daiminkan anchor block — frozen prefix, tapClaim
     selects the kan offer by `(type, uses)` with toBe identity, promptChoices
     includes it.

Verify: `just test` (all suites), `just check`. Commit:
`T-004-02-02: promptChoices — presentation dedupe over the claim set`.

## Step 3 — ClaimPrompt.svelte

New component per structure.md: props `{claimed, choices, onclaim, onpass}`;
header "call on" + Tile; a labeled button per choice (call name — daiminkan
shown as "kan" — plus Tile chips of `uses`; aria pins name + kinds); the pass
button; `onclaim` echoes the element's `(type, uses)`. Scoped styles: compact
bar, felt-adjacent palette, chrome-less tile chips inside buttons matching
Table's `.tap` convention.

Verify: `just check` (component types compile); rendering asserted in step 6.

## Step 4 — Table.svelte melds + pond marks

1. `claimedAway` derived Set over `table.melds` (`'claimed' in m` narrowing).
2. Per-seat gated `.melds` list after the pond: own tiles, then the claimed
   tile rotated with `aria-label="claimed {kind} from {wind}"` (ankan: own
   only). Lowercase wind words via the existing SEATS areas.
3. Pond `<li>`: `class:claimed` + `aria-label="claimed {kind}"` when the id is
   in `claimedAway`; dim/rotate styling.
4. Styles: `.melds`, `.meld`, `.claimed-tile`, `li.claimed`.

Verify: `just check`; existing SSR suite still green (no current fixture holds
melds, so output for existing tests must be byte-compatible — the melds list
is gated on non-empty).

## Step 5 — App.svelte rewire

1. Delete the `?? passClaim` arm + its interim comment; effect drives
   `forcedAction` alone; adjust the effect comment (the prompt owns the claim
   window now).
2. `prompt` derived from `promptChoices`; `claim(choice)` / `pass()` handlers
   through tapClaim/passClaim with the existing null-guard shape.
3. Conditional `<ClaimPrompt>` render (promptChoices non-empty; `claimable`
   non-null as the type guard), placed after Table (visually nearest East).

Verify: `just check`.

## Step 6 — SSR tests (app.ssr.test.ts)

1. `describe('claim prompt (SSR)')`: ClaimPrompt rendered directly with the
   seed-15 fold's promptChoices (derived in the test from
   `legalActions(mixedWindow15)` — recomputed, never typed in): the
   `call or pass` group landmark; header claimed tile (3p); three buttons
   whose aria labels pin call names + uses kinds (pon 3p with 3p 3p; chi with
   2p 4p; chi with 4p 5p); the `pass` button. Negative: the dealt `render
   (App)` body contains no `call or pass`.
2. `describe('meld display (SSR)')`: Table rendered with the seed-3 post-chi
   fold (racePrefix3 + chi {tile 42, uses [37,47]} + East's claim discard of
   `hands[0][0]`): east-melds region tokens equal own+claimed kinds; the
   `claimed 2p from north` aria present; north pond ordered-equal to the
   fold's ponds[3] with the `claimed 2p` mark; your-hand count 11.

Verify: `just test` (full), `just check`.

## Step 7 — Runtime verification + build (gate for commit 2)

- `just build` — the single-file target still compiles (bundle size noted).
- `just dev` smoke: boot seed 1, let the paced loop run to East's first claim
  window (~action #96, ≈25 s at 250 ms/tick); confirm the prompt appears and
  the loop is paused; pass → loop resumes. Then a faster claim check: confirm
  in-browser only if feasible headlessly; otherwise rely on the seed-3 walk +
  SSR coverage and record exactly what was and wasn't hand-verified in
  review.md. (The AC's `just dev` clause is a human-visible check; the
  deterministic walks pin the same trajectory in CI.)

Commit 2: `T-004-02-02: call/pass prompt, meld display, pond claim marks`.

## Step 8 — progress.md then review.md

progress.md kept current per step (deviations + rationale inline as they
happen). review.md last: changes summary, AC walk-through clause by clause,
coverage assessment (including the daiminkan-anchor outcome), open concerns.
Commit: `T-004-02-02: add RDSPI artifacts`.

## Testing strategy summary

| Layer | What proves it | Where |
|---|---|---|
| Dedupe correctness | frozen anchors 3/15 + emptiness property | drive.test.ts |
| Prompt renders choices | direct SSR render, aria-pinned buttons | app.ssr.test.ts |
| Meld + pond mark | seed-3 post-chi fold through Table | app.ssr.test.ts |
| Pause/resume loop | complementarity property (-02-01) + seed-3 claim walk | drive.test.ts (existing) |
| No-regression | full suite + byte-compatible gated markup | just test / check / build |

## Risks

- **Existing SSR assertions breaking on Table markup changes** — additions are
  gated (`melds.length > 0`, `claimedAway` empty on existing fixtures); the
  pond li gains attributes only when marked. Watched at step 4's gate.
- **Svelte a11y warnings** (svelte-check treats some as errors via `just
  check`) on the new aside/buttons — labels are explicit; fix at step 3/5
  gates if flagged.
- **Scan finds no daiminkan anchor** — non-blocking, documented gap.
