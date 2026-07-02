# T-004-02-02 — call-pass-prompt-and-meld-display — Review

Self-assessment and handoff. Read with design.md (six decisions) beside it.
Core untouched throughout — the ticket is app-only, as researched.

## What changed

**`src/app/drive.ts`** (155 → 181 lines) — one new export:

- `promptChoices(offered, player)` (D3): claimChoices deduped for
  presentation — first offer of each (call form, `uses`-kinds) group, frozen
  order preserved, elements of `offered` itself. Collapses duplicate-copy
  variants (seed 3's two 1p+3p chis → one button; seed 212's three 8s pon
  pairs → one) while shape-distinct variants and distinct forms always
  survive. Empty ⇔ claimChoices empty, so prompt visibility and the loop's
  wait stay one predicate family. Kinds are read only to GROUP offers
  (`kindOf` is the module's first game-vocabulary import); selection remains
  tapClaim's.

**`src/app/ClaimPrompt.svelte`** (new, 118 lines) — the prompt (D1, D2):
computation-free input wiring. Header shows the claimed tile; one button per
choice showing the call name (daiminkan face-labeled "kan" — parlor
vocabulary; the payload keeps the record's discriminant) plus Tile chips of
the `uses` leaving the hand; each button echoes its element's own
`(type, uses)` through `onclaim` (the ordered-echo contract tapClaim selects
by — -02-01 review concern #3 honored); a pass button fires `onpass`.
Visibility is the owner's fact — the component renders whenever mounted.

**`src/app/Table.svelte`** (208 → 275 lines) — fold facts only (D4):

- `claimedAway`: a derived Set of every claiming meld's `claimed` id
  (`'claimed' in meld` narrows ankan out; physical ids are unique, one Set
  covers all ponds).
- Per-seat gated melds list (`aria-label="{wind} melds"`): each meld's `own`
  tiles, then the claimed tile rotated sideways with
  `aria-label="claimed {kind} from {wind}"`; ankan renders own-only. For East
  the list sits directly above the hand row — "beside East's hand".
- Pond tiles claimed away stay in place (the fold's complete-discard-history
  posture made visible) wearing `aria-label="claimed {kind}"` + dim/rotate
  styling.

**`src/app/App.svelte`** (74 → 103 lines) — the rewire (D5): the interim
`?? passClaim` auto-pass arm is DELETED in the same commit the prompt lands
(-02-01 review concern #1 — no window where both or neither exist); the
effect drives `forcedAction` alone; `prompt = $derived(promptChoices(...))`;
`claim()`/`pass()` handlers push tapClaim/passClaim results under the
existing null-guard shape; `<ClaimPrompt>` renders after the table when
`prompt` is non-empty (`claimable !== null` conjunct is a type guard only).

**`src/app/drive.test.ts`** (391 → 475 lines, 28 → 33 tests): frozen seed-212
anchor (scratchpad-scanned, derivation in comments: South discards 103/8s,
East holds [100,102,101] → three pon pairs + daiminkan, head = West's draw);
promptChoices block (dedupe with toBe-identity survivors, pass-through at the
mixed window, emptiness-equivalence property over nine anchors also pinning
prompt-shows ⇔ pass-exists); tapClaim's positive daiminkan selection —
closing the gap -02-01's review named — and identical-kind pon pairs still
individually selectable by exact copies.

**`src/app/app.ssr.test.ts`** (154 → 259 lines, 13 → 23 tests): the seed-15
prompt rendered directly with fold-derived props (landmark, document-order
tile tokens, three aria-pinned buttons, pass); the seed-212 kan button (and
its absence at the mixed window); the prompt-free dealt App boot; the seed-3
post-chi Table render — east melds [1p,3p,2p], `claimed 2p from north`, the
north pond ordered-complete with the claimed mark, exactly one melds region,
11 hand buttons, turn marker on East ("resuming from the caller").

Commits: `80b2ed4` (seam helper + suite), `2f4f21c` (prompt/melds/marks +
SSR), plus this artifacts commit.

## Acceptance criteria — walked clause by clause

"In `just dev` on a seed where East can claim, a call/pass prompt appears" —
the boot seed 1 opens two East chi windows (actions #96/#104, pinned by the
full-hand walk); the prompt's visibility predicate (promptChoices non-empty)
is exactly forcedAction's wait, property-tested. "Choosing a call (including
picking between chi variants)" — seed-15 anchor: two shape-distinct chi
buttons, aria-named by shape; duplicate-copy variants collapse (D3).
"Exposes the meld beside East's hand" — SSR meld test. "Marks the claimed
tile in the discarder's pond" — SSR pond-mark test; the tile stays counted.
"Hands East the discard" — the post-chi fold offers only East's 11 hand
discards; forcedAction and passClaim both null there (drive claim walk);
the existing hand-tap surface drives it. "Passing resumes the paced bot
loop" — passClaim returns the head draw; its fold closes the window and
forcedAction resumes (claim walk + complementarity property). "`just check`
and the SSR test green" — 0 errors/warnings; 214 tests green; `just build`
55.70 kB self-contained OK.

## Test coverage assessment

Strong: every new behavior has both a unit statement (drive.test.ts, frozen
anchors, toBe identity teeth) and a rendered statement (SSR, content + aria
only). The -02-01 daiminkan gap is closed positively. Gaps, owned:

- **No in-browser click-through happened in this session** (headless). The
  dev server was smoke-tested (serves + compiles); the pause/resume
  trajectory is deterministic and pinned, but a human should run `just dev`
  once and tap through a claim — seed 1 reaches East's first window ~25 s in.
- **No client-side mount test** — the $effect pause (no timer while the
  prompt is up) is proven by forcedAction's null, not by observing the
  browser loop; the project has no jsdom/mount harness and this ticket
  didn't add one.
- **Ankan meld rendering** is exercised by no fixture (bots can't kan; the
  player's own-turn kan UI is future work). The rendering arm is the same
  loop with the claimed-tile span gated off; a future kan ticket should add
  the SSR fixture.
- **Multi-meld seats / bot melds** render through the same per-seat loop but
  have no fixture; hand-authoring one is easy when a ticket needs it.

## Open concerns for a human reviewer

1. **Dedupe keeps the FIRST copy-combination** (D3). Until red fives, the
   discarded choices are meaningless; when red fives land, their kinds must
   differ (e.g. `0p` vs `5p`) or promptChoices would silently hide a real
   choice. legalActions' per-copy enumeration was future-proofed the same
   way — flagging so the red-five ticket checks BOTH sites.
2. **The prompt has no timeout** — the game waits indefinitely on the
   player's call/pass. Correct for a teaching game; noted because a "bot
   thinking" pacing polish was explicitly rejected (D5) and someone may miss
   it.
3. **`claimable !== null` in App's render gate** is a type guard; if it ever
   fires with `prompt` non-empty the UI silently hides the prompt and the
   loop soft-locks. Unreachable by construction (claims are enumerated only
   off an open window) — a dev-mode assertion was considered and skipped as
   ceremony.
4. **Meld placement for bot seats is untested visually** (no runtime path
   makes one); the flex column may need spacing tuning when real bots call.
5. **ClaimPrompt trusts its `choices` prop** to be claim actions (non-claims
   render nothing via the type-narrowing guard). Fine for its one caller;
   a second caller should keep passing promptChoices output.

No TODOs left in code; no known bugs; nothing skipped silently.
