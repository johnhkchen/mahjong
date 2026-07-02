# T-004-02-01 — drive-claim-window-selection — Plan

Five steps, two code commits plus the artifacts commit. Steps 2–3 land as
one commit (the suite is the seam's spec — neither is green alone if seed 1
opens East windows mid-walk); step 4 is its own commit.

## Step 1 — Scratchpad scans: freeze the missing anchor, pre-verify the walk

No repo changes. A scratchpad script (vitest-free, `npx tsx` or a one-off
vitest file under the scratchpad dir) that folds tsumogiri prefixes and
reads legalActions:

- **1a. East multi-chi-variant anchor.** For seeds 1..~500 and prefix
  lengths 1..~16 turns: find windows where `legalActions` holds ≥ 2 chi
  offers with seat 0. Record seed, turn count, discarder, window tile, the
  full variant list. Pick the smallest/cleanest; freeze its derivation
  comment. (Chi ⇒ discarder is North, seat 3 — expect prefix lengths ≡ 0
  mod 4.)
- **1b. Anchor re-verification.** Assert the re-stated seed-3 facts (East
  chi [47,37] + South pon [43,41] on North's 42; head draw seat 0) and
  seed-5 facts (East pon [93,95] on West's 94; head draw seat 3) straight
  off fresh folds — guards against transcription drift from legal.test.ts.
- **1c. Walk rehearsal.** Replay drive.test.ts's exact walk policy at seed 1
  with the NEW rules (pass at every East claim window): count East pass
  events, confirm 140 actions / ryuukyoku / [18,18,17,17] unchanged. The
  count becomes the walk's pinned literal (if zero, the pass arm still
  lands but pins zero — and the claim-walk describe carries the real
  exercise).

**Verify:** script output pasted into anchor comments; nothing committed.

## Step 2 — drive.ts: the seam extension

Per structure.md's internal organization: `ClaimAction`/`isClaim`,
`ClaimChoice`, `claimChoices`, `usesEqual`, `tapClaim`, `passClaim`,
`forcedAction`'s wait guard first, header + doc comments rewritten where
they promised "every seat passes until a claim UI ticket".

**Verify:** `just check` clean; `just test` — legal/record/dynamics suites
untouched and green; drive.test.ts may fail only in the known place (the
walk's unforced-offering throw, per scan 1c).

## Step 3 — drive.test.ts: the AC suite (commit 1 with step 2)

In structure.md's order: anchor block (racePrefix3, ponWindowPrefix5,
scanned chiVariants anchor — derivation comments, never regenerate), then
describes: claimChoices, tapClaim, passClaim, forcedAction's two new nulls,
the walk's pass policy + pinned pass count, the claim-driven-through-the-
seam walk (chi → mustDiscard → tapDiscard → bots resume).

House teeth checklist, all mandatory:
- every returned action asserted with `toBe` into the live offered array;
- one doctored-list rejection per new selector (tapClaim: East's chi
  filtered out; passClaim needs none — its null cases are structural);
- wrong-seat rejection uses a REAL other-seat offer (South's race pon);
- ordered-uses matching pinned by a reversed-uses null;
- complementarity property across all anchored states (exactly one driver
  non-null, both null ⇔ player-discard or ended).

**Verify:** `just test` fully green (expect ~190+ tests); this is the AC.
**Commit 1:** `T-004-02-01: drive seam claim window — forcedAction waits on
player claims; claimChoices/tapClaim/passClaim selectors + suite`.

## Step 4 — App.svelte: interim auto-pass (commit 2)

The one-line effect change (`?? passClaim(offered, PLAYER)`), import, and
the interim comment naming T-004-02-02 as the replacer.

**Verify:** `just check`; `just test` (SSR test indifferent — confirms);
`just build` (the single-file artifact still assembles). Runtime behavior
is byte-identical to HEAD by design (East auto-passes as before — scan 1c
already proved the seed-1 trajectory unchanged); the walk test is the
headless equivalent of watching the dev loop, so no manual dev-server pass
is required for this ticket — -02-02's AC owns the visible flow.
**Commit 2:** `T-004-02-01: App effect drives passClaim as interim
auto-pass until the claim prompt (T-004-02-02)`.

## Step 5 — review.md + artifacts commit

progress.md finalized, review.md written (changes, coverage, gaps, the
-02-02 handoff list: prompt renders claimChoices, dedupe-by-kind concern
from -01-03 review, the `?? passClaim` line to replace). Commit all six
artifacts.

## Testing strategy summary

- **Unit:** every selector against every anchored state class — window with
  player offers (two head-owner geometries + multi-variant), bot-only
  window, plain pre-draw, post-draw, mustDiscard (via claim walk), ended.
- **Integration:** two walks — the full seed-1 hand under pass-everything
  (trajectory invariance: the new seam changes nothing when the player
  declines), and the seed-3 claim walk (the seam can drive a call and its
  claim discard end to end through fold-accepted appends).
- **Contract teeth:** toBe identity, doctored lists, ordered-uses pinning,
  complementarity — legality provably from the offered list alone.
- **Out of scope, owned elsewhere:** claims in random-legal generation
  (T-004-01-04); visible prompt/meld/pond UI and dev-server verification
  (T-004-02-02); player ankan/shouminkan selection (future ticket — the
  loop already nulls at the player's post-draw states).

## Risks / contingencies

- **Scan 1a finds no East multi-chi window in range:** widen seed range /
  prefix depth; a variant pair is guaranteed findable (any North discard
  where East holds e.g. duplicate copies of one neighbor kind). Worst case,
  distinguishability is still pinned at raceWindow3 by null-for-lookalike
  uses, but the positive two-variant selection is the AC's spirit — keep
  scanning until found.
- **Seed-1 walk DOES open East windows (likely):** the pass count literal
  documents it; if it does NOT, the claim-walk describe alone carries
  call coverage — acceptable, noted in review.md.
- **Complementarity property flushes a latent hole** (e.g. a state where
  both drivers null while play continues): that is the property earning its
  keep — fix the seam, not the property.
