# T-004-02-02 — call-pass-prompt-and-meld-display — Design

Decisions grounded in research.md. Core is closed; everything below is app
surface. Six decisions.

## D1 — The prompt is its own component, composed by App; Table stays fold-only

**Chosen:** a new `ClaimPrompt.svelte` with props `{ claimed: TileId, choices:
HandAction[], onclaim: (choice) => void, onpass: () => void }`. App renders it
conditionally (its visibility derived from the seam, D5) beside the Table;
Table.svelte is not involved in the prompt at all.

Rationale: Table's contract is ONE prop — the folded TableState — and the
prompt is not a fold fact; it renders from `offered` (legality), which only
App, the record's owner, holds. Putting the prompt in Table would either leak
`offered` into the stateless view or have Table re-derive legality — both
violate its header contract ("it never derives game facts"). A separate
component also gives SSR tests a direct render target with hand-authored
choices, exactly how mid-hand Table states are tested today (research §6) —
App can't reach a claim window in SSR (effects never run).

**Rejected — prompt markup inline in App.svelte:** loses the direct SSR
render seam; App is currently 74 lines of wiring and should stay wiring.

**Rejected — Table grows optional `choices`/`onclaim` props:** two contracts
in one component; the fold view stops being "whole contract is its one prop."

## D2 — Buttons echo `(type, uses)` back through tapClaim; App pushes the result

**Chosen:** ClaimPrompt's onclaim hands back the choice it rendered; App does
`tapClaim(offered, PLAYER, { type: choice.type, uses: choice.uses })` and
pushes the non-null result. Pass is `passClaim(offered, PLAYER)`, pushed when
non-null. Both handlers mirror the existing `tap()` null-guard shape.

This is -02-01's D3 contract working as designed: the button carries the
canonical `uses` it was rendered from (ordered echo — review concern #3), and
value-matching through tapClaim keeps the doctored-list teeth rather than
trusting a reference across Svelte's `$state` proxying. Pushing the choice
element directly (it IS an element of offered) was rejected: it bypasses the
seam's one selection contract and silently breaks if a future prompt renders
from anything but live `offered`.

## D3 — Dedupe by (type, kind-shape) in a new drive.ts helper: promptChoices

The seam hands over the COMPLETE offered set (research §8): seed 3's window
holds two chi variants that differ only in which physical 3p copy they use —
visually identical buttons that would confuse the learner the prompt exists to
teach. Dedupe is presentation's job (-02-01 review concern #2, verbatim).

**Chosen:** export `promptChoices(offered, player): HandAction[]` from
drive.ts — `claimChoices` filtered to the FIRST offer of each `(type,
uses-kinds)` group, frozen order preserved. Seed 3 → one chi button; seed 15
→ pon + two shape-distinct chis, all three kept. Keeping the first is
canonical: legalActions enumerates copies in hand order, so the first variant
is the one the fold would have been offered anyway, and the choice among
identical-kind copies is meaningless until red fives (when kinds themselves
will differ, and the groups split by construction).

It lives in drive.ts, not the component: it takes legalActions output and
returns elements of it (the module's one shape), it needs `kindOf` (core
vocabulary, already the app's import), and drive.test.ts is where the anchors
live. ClaimPrompt stays computation-free.

Visibility stays coupled: `promptChoices` is empty exactly when `claimChoices`
is empty (a dedupe never empties a non-empty list), so the prompt shows
exactly when forcedAction waits — the -02-01 complementarity property keeps
holding with either predicate.

**Rejected — dedupe inside ClaimPrompt:** puts a game-fact computation in a
view component; untestable next to the frozen anchors.

**Rejected — no dedupe (render all variants):** two indistinguishable "chi
1p+3p" buttons at the AC's own anchor geometry; the ticket's chi-variant
choice means SHAPE choice, not physical-copy choice.

## D4 — Melds and pond marks render in Table, straight off the fold

Both are pure fold facts (`table.melds`, and `(from, claimed)` pairs), so
they belong in the stateless view, available for every seat — bots never call
under the placeholder policy, but the view renders whatever fold arrives
(hand-authored records in tests do hold bot melds).

**Chosen — melds:** per seat, a `<ul class="melds" aria-label="{wind}
melds">` after the pond (for East, this sits beside the hand area per the
AC), one `<li>` per meld in claim order. A claiming meld renders its `own`
tiles then the `claimed` tile visually set off (rotated chip — the physical
parlor convention — via a `.claimed` wrapper) with
`aria-label="claimed {kind} from {wind}"` naming the fact for tests and
assistive tech. An ankan renders its four `own` tiles, no claimed mark.
Rendered only when the seat has melds, like the drawn-tile gate.

**Chosen — pond marks:** a `$derived` Set of every claiming meld's `claimed`
TileId (physical ids are globally unique, one Set covers all four ponds); a
pond `<li>` whose id is in the set gets the claimed styling (dimmed + rotated)
and `aria-label="claimed {kind}"`. The tile STAYS in the pond — core's
"counted in ponds[from]" rule made visible: the learner sees the discard
history intact with the claimed tile marked, which is the furiten/defense
teaching posture the architecture chose.

**Rejected — remove claimed tiles from the rendered pond:** contradicts the
fold's documented pond semantics and erases the teaching fact; also makes
pond order lie.

**Rejected — deriving the mark set in App and passing it in:** it's a pure
function of the one prop Table already has.

## D5 — App wiring: the `?? passClaim` arm is deleted; prompt visibility is the seam's wait

**Chosen:** the effect driver reverts to `forcedAction(offered, PLAYER)` alone
— the interim auto-pass arm (-02-01 review concern #1) is deleted in the same
commit that renders the prompt, so there is no window where both exist (the
250 ms auto-decline racing the prompt) or neither (soft-lock). Visibility:
`const prompt = $derived(promptChoices(offered, PLAYER))`, rendered when
non-empty; the claimed tile for the prompt header is `table.claimable!.tile`
(non-null whenever choices exist — a claim offer implies an open window).
The pacing contract holds by construction: forcedAction is null while the
prompt shows (same predicate family), so the loop pauses; a pass push makes
the head draw fold, the window closes, forcedAction resumes the bots; a claim
push jumps the turn to East with mustDiscard, where forcedAction and
passClaim are both null and the existing hand-tap surface takes over ("hands
East the discard") — then East's discard resumes the loop from the caller.

**Rejected — keep auto-pass behind a timeout as a "thinking bot" nicety:**
re-introduces the race concern #1 warns about; a decision timer is a later
polish ticket if ever.

## D6 — Test strategy

- **drive.test.ts** — `promptChoices` block on the frozen anchors: raceWindow3
  dedupes two duplicate-copy chis to the first ([37,47], toBe identity into
  offered); mixedWindow15 passes through untouched (pon + both shape-distinct
  chis, order pinned); empty at bot-only and windowless states; a doctored
  list stays deduped-consistent. Attempt a cheap scratchpad scan for an East
  daiminkan window (three held copies of a bot discard) to close -02-01's
  open daiminkan-anchor gap — if a small-seed scan finds one, freeze it and
  cover tapClaim's positive kan arm + promptChoices labeling; if not, the gap
  stays documented (the arm is form-agnostic either way).
- **app.ssr.test.ts** — three additions in the house style (content + aria
  only): (1) ClaimPrompt rendered directly with seed-15 promptChoices — the
  three buttons with call names and their `uses` tiles, the pass button, the
  claimed tile in the header; (2) Table rendered with the seed-3 post-chi fold
  (`racePrefix3` + chi + claim discard, reusing drive.test.ts's pinned meld
  literal) — east melds region shows own [37,47] + claimed 42 marked "from
  north", north pond still contains 2p now marked claimed, East's hand at 11
  buttons; (3) the dealt App render stays prompt-free (negative: no claim
  buttons at boot).
- **Runtime AC** (`just dev`): verified by hand — seed 1 opens East chi
  windows at actions #96/#104 (research §8), so the prompt appears on the
  default boot. `just check` + full `just test` + `just build` gate every
  commit; findings recorded in review.md.
