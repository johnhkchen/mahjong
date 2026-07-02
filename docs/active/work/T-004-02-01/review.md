# T-004-02-01 — drive-claim-window-selection — Review

Self-assessment and handoff. Read with design.md (six decisions) beside it.

## What changed

**`src/app/drive.ts`** (64 → 156 lines) — the ticket's production surface:

- `forcedAction` gains ONE new guard, placed before every other
  classification: any chi/pon/daiminkan offer belonging to `player` → null,
  the loop waits. The placement is load-bearing (design D1): at the seed-3
  geometry the head is the player's OWN draw (North discarded, the turn
  advanced to East), so any head-first formulation would auto-pass the
  player's chi. Bot-only windows keep the old behavior — the head draw
  forces and the window goes stale, now documented as the placeholder-bot
  auto-pass policy. The tsumogiri reverse-scan and all other arms are
  byte-identical.
- New `claimChoices(offered, player)` — the player's claim offers, elements
  of the offered array in frozen order (D4). One predicate shared by
  forcedAction's wait, passClaim's guard, and (next ticket) the prompt's
  render list, so the loop waits exactly when the prompt shows.
- New `tapClaim(offered, player, choice)` with exported `ClaimChoice`
  payload `{type, uses}` (D3): selection by call form + exact ordered copies
  — distinct chi variants differ precisely in `uses`. Returns the offered
  ELEMENT or null; ordered matching (canonical legalActions output echoed
  back), so reordered tuples are lookalikes, rejected.
- New `passClaim(offered, player)` (D2): the head draw iff the player holds
  a claim offer — there is no pass action in the vocabulary; declining IS
  the default continuation whose fold closes the window. Complementary to
  forcedAction by construction: exactly one driver applies at every state.

**`src/app/drive.test.ts`** (155 → 351 lines, 15 → 28 tests) — the AC file:

- Three frozen claim-window anchors (scratchpad-scanned, derivations in
  comments): seed-3 race window (East's TWO duplicate-copy chi variants +
  South's pon, head = East's own draw), seed-5 pon window (East's pon behind
  North's draw obligation), seed-15 mixed window (East pon + two
  shape-distinct chis — the frozen pon-before-chi order pinned).
- House teeth throughout: every selection `toBe` into the live offered
  array; doctored-list rejection (East's chi filtered out is rejected while
  its sibling variant still selects); another seat's REAL offer under the
  player's seat → null; reversed-uses lookalike → null; a complementarity
  property over all eight anchored states (never both drivers non-null;
  pass non-null ⇔ player claim offers exist; both null only at player-
  discard or ended states).
- The full-hand walk now runs the explicit pass policy and pins `passes = 2`
  (seed 1 opens exactly two East chi windows, actions #96/#104) with the
  trajectory unchanged — 140 actions, ryuukyoku, ponds [18,18,17,17]:
  declining everything reproduces unclaimed play exactly.
- A second walk drives a REAL call through the seam: seed-3 chi via tapClaim
  → fold accepts (meld literal asserted: claimed 42 from seat 3, own
  [37,47]) → mustDiscard state where forced AND pass are both null →
  tapDiscard drives the claim discard → forcedAction resumes the bots.

**`src/app/App.svelte`** (+5/−2): the effect driver becomes
`forcedAction(...) ?? passClaim(...)` — the interim auto-pass (D5) keeping
main playable between this ticket and the prompt; comment names T-004-02-02
as the replacer. Runtime trajectories are byte-identical to HEAD~2.

**Untouched, by design:** all of `src/core/` (the offered/fold contract was
closed for this ticket), Table.svelte, app.ssr.test.ts.

Commits: `08ed674` (seam + suite), `ecd6fa1` (App wiring), plus this
artifacts commit.

## Acceptance criteria — verified line by line

drive.test.ts is green (192 total, ~1s) and covers each clause:

- **forcedAction resolves bot-only claim windows by passing** — the seed-1
  beforeSouthDraw test (South's real chi offer, head draw forced) plus the
  full walk, whose 140-action trajectory equals unclaimed play.
- **returns null when the human East holds a claim offer** — both head-owner
  geometries: raceWindow3 (the player's own draw at the head) and ponWindow5
  (a bot's draw at the head).
- **human selection helpers return an element of the offered set** — every
  tapClaim/passClaim/tapDiscard assertion is `toBe` into the live array;
  the claim walk appends only fold-accepted elements.
- **distinct chi variants distinguishable** — the two duplicate-copy
  variants at raceWindow3 and the two shape-distinct chis at mixedWindow15
  each selected by their `uses`; reversed/lookalike/unoffered combinations
  and another seat's offers all null.
- **null for anything not offered** — doctored list, wrong seat, wrong call
  form, windowless states (dealt / post-draw / ended), plus passClaim's
  five null anchors.

`just check` and `just build` (self-contained single file, 51.6 kB) clean.

## Test coverage assessment

Strong on the seam itself: all four state classes × both drivers × both tap
selectors, two integration walks, and the complementarity property that
would flush any future state where the loop and the prompt disagree. Gaps,
deliberate and owned downstream:

- **No daiminkan-for-the-player anchor** — tapClaim's daiminkan arm is
  exercised only as a null (wrong-form lookalike). The selector is
  form-agnostic (one find over `claimChoices`), and the enumeration side is
  partition-tested in legal.test.ts; a positive player-daiminkan walk would
  need a scanned anchor where East holds three copies. Cheap to add in
  -02-02 if the prompt renders kan buttons.
- **Player ankan/shouminkan selection has no helper** — out of scope (D4):
  those are own-turn choices, the loop already nulls at the player's
  post-draw states, and bot kan offers still lose to tsumogiri. A future
  ticket adds a tap for them.
- **Claims in random-legal generation** — T-004-01-04's charter, unchanged.

## Open concerns for a human reviewer

1. **The `?? passClaim` line in App.svelte is a timed bomb of the benign
   kind:** if T-004-02-02 adds the prompt but forgets to remove the arm, the
   app will auto-decline before any prompt can render (forcedAction null →
   passClaim non-null → append after 250 ms). The -02-02 diff site is that
   exact line; its AC ("a call/pass prompt appears") fails loudly if the arm
   survives. Flagged in the code comment.
2. **claimChoices hands over the complete, non-minimal offered set** — three
   identical-looking pon pairs for a triplet holder (carried from -01-03
   review #1). The prompt must dedupe by kind-shape for presentation, NOT
   ask the seam or the enumeration to shrink.
3. **Ordered `uses` matching in tapClaim** is deliberately strict (D3):
   a UI that reconstructs payloads instead of echoing rendered data will get
   nulls. That is the contract working as intended, but worth knowing before
   -02-02 wires buttons.
4. **`ClaimChoice.uses` is `readonly TileId[]`, not a fixed-length tuple** —
   looser than the action union's tuples so one payload type spans
   pon/chi/daiminkan. Lookalike lengths are rejected at runtime by
   `usesEqual`; a stricter per-form tuple union was judged not worth the
   ceremony for a 3-consumer interface.
5. **The complementarity property enumerates eight anchored states**, not
   random ones — a generative version over random prefixes would be
   stronger; it belongs naturally in -01-04's property suite if the seam is
   ever pulled into core's orbit.

No TODOs left in code; no known bugs; nothing skipped silently.
