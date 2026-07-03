# Design — T-009-03-01 tenpai-riichi-prompt

## Decision 1 — which tile the prompt asks about

Options considered:

**A. Reuse `discardPolicy`'s own tile choice.** `discardPolicy(seatView(state, PLAYER),
offered)` already resolves, deterministically and by a documented tie-break, to exactly
one tile whenever any riichi offer exists for that seat (research.md's floor argument:
shanten 0 is the best any discard reaches, so if a riichi offer exists the tie-break
winner reaches it too). Its result is either the `riichi` action itself, or — in the one
documented exception (a dead wait) — the plain `discard` for that identical tile. Either
way, the *other* action for the same tile is trivially found in `offered` (research.md:
the plain discard always exists ahead of the riichi offers in offered order).

**B. First-offered riichi action.** `offered.find(a => a.type === 'riichi' && a.seat ===
player)`, mirroring `winChoice`'s shape exactly. Simple, but "first in hand order" is an
arbitrary tile with no relation to what the bots do or to any teachable rationale — two
players reaching an identical hand shape could see different candidate tiles depending
on draw order, and the tile picked might not even be the shanten-optimal one (bots and
the shanten hint would disagree with what the prompt highlights).

**C. List every candidate tile as its own button.** Most "correct" (mirrors real-table
freedom to riichi on any tenpai-preserving tile) but reintroduces full tile-selection UI
this ticket's AC does not ask for (the AC's tests are phrased as a single accept/decline,
not a per-tile list), and duplicates `ClaimPrompt`'s per-choice button machinery for a
case that — per policy.ts's own comment — degenerates to one tile in the common case.

**Chosen: A.** It costs zero new core logic (pure reuse of an already-exported, already
seat-generic function), it keeps the prompt's tile in lockstep with what the bots
themselves would do (pedagogically coherent — "the same move the AI would make"), and it
resolves the dead-wait edge case for free (the prompt still shows, asking about the same
tile discardPolicy considered, whether or not it recommends declaring). Rejected: B (
arbitrary, potentially inconsistent with the shanten hint's own reasoning), C (scope
creep past this ticket's single yes/no framing; a future strength ticket can widen this
the same way T-009-02-01 widened bot policy without reshaping its arms).

## Decision 2 — where the selection logic lives

`discardPolicy` is a core export; calling it is "reading core," identical in kind to
`Table.svelte`'s call to `scoreBreakdownOf` or the existing drive.ts calls to
`discardPolicy`/`callPolicy` for bots. The **selection** (turning a `discardPolicy`
result plus `offered` into a `{ declare, decline }` pair of concrete `HandAction`
elements) is exactly drive.ts's job — the same shape as `winChoice`/`tapClaim`. A new
drive.ts export:

```ts
export interface RiichiPrompt {
  readonly tile: TileId
  readonly declare: HandAction // the 'riichi' element of `offered`
  readonly decline: HandAction // the matching 'discard' element of `offered`
}

export function riichiPrompt(
  state: TableState,
  offered: readonly HandAction[],
  player: Seat,
): RiichiPrompt | null
```

Implementation: run `discardPolicy(seatView(state, player), offered)` only when a
riichi offer exists for `player` at all (cheap guard — a plain `.some` scan — before
paying for the shanten/waits work inside `discardPolicy`); branch on the result's
`type` (`riichi` → that's `declare`, look up `decline` by matching tile; `discard` →
that's `decline`, look up `declare` by matching tile, or `null` overall if none matches,
which cannot happen given the guard but keeps the function total rather than asserting).
Both lookups are `offered.find(...)`, the established idiom. Nothing here reads `waits`,
`shanten`, or scores a tie-break directly — that stays inside `discardPolicy`.

The shanten hint is a separate, simpler read — no offer selection involved, just a
direct value. It does not belong in drive.ts's "select from `offered`" family (there is
no `HandAction` to select — it's a hand-shape fact, not a legal action), so it is
computed where App.svelte already computes `seatScores` and similar per-hand derived
values, via a small drive.ts helper (kept alongside the other seam functions for the
same "app never re-derives core facts inline" discipline, but distinct in kind — it
takes a `SeatView`, not `offered`):

```ts
export function tenpaiHint(view: SeatView): number | null
```

Returns `null` when: the seat isn't mid-decision (no `drawn` held, i.e. not this seat's
own discard point), the seat is already riichi-locked (`view.riichi[seat]`, nothing to
hint), or the resulting shanten is `0` (tenpai — the riichi prompt owns that moment, not
the hint). Otherwise returns `shanten(hand-as-kinds, view.melds[seat])` over `[...hand,
drawn]` (the 14-tile arity, matching what `riichiOffers`/`discardPolicy` themselves
evaluate against). Reads only `shanten` — literally "reads the core shanten module," the
AC's own words.

## Decision 3 — decline's fold target

The AC states plainly: "declining folds the plain discard." Given research.md's finding
that the matching plain discard is *always already present* in `offered` for any tile
with a riichi offer, there is no reason to special-case decline as a bare dismiss (the
houtei `dismissed`-flag pattern exists because ryuukyoku's ron decline genuinely has *no*
action to fold — a different situation). Decline folds `riichiPrompt(...).decline`
directly: one tap, one fold, matching every other button in this app (win, claim, pass-
with-a-fold-target-when-one-exists). This also means the riichi prompt needs **no
presentation-only state** in App.svelte (no new `$state` boolean) — both buttons are
pure taps through the seam, exactly like `claim`/`takeWin` already are.

## Decision 4 — console placement and priority

New component `RiichiPrompt.svelte`, sibling to `ClaimPrompt.svelte`, rendered in
App.svelte's existing `.console` slot. Priority, matching the fact that a claim/win
window and a riichi decision point are already mutually exclusive states in
`legalActions`' own union (riichi offers only exist at the turn seat's own unlocked
post-draw point; claim windows and win offers arise elsewhere), so the existing
`{#if (prompt.length > 0 || win !== null)}` branch and a new riichi branch never
actually compete for the same fold — but the code still nests them defensively in that
order (claim/win first, riichi second, hint last) so a future rule change can't
silently show two prompts at once:

```svelte
{#if prompt.length > 0 || win !== null}
  <ClaimPrompt ... />
{:else if riichi !== null}
  <RiichiPrompt tile={riichi.tile} ondeclare={...} ondecline={...} />
{:else if hint !== null}
  <p class="hint">{hint} away from tenpai</p>
{/if}
```

`RiichiPrompt` renders the header line ("you're tenpai — declare riichi?"), the tile in
question (via the existing `Tile` component — consistent with `ClaimPrompt`'s claimed-
tile header), the three one-line stakes (hand locks / 1000-point stick / riichi yaku +
uradora chance — the ticket's own wording, kept verbatim as the copy), and two buttons:
"declare riichi" and a decline labeled to match the parlor vocabulary already used
elsewhere (`ClaimPrompt`'s `callName` maps `daiminkan` → "kan"; here the decline button
reads "not yet", the plainest continue-playing phrasing — no new jargon, matches the
user's brand-voice guidance to keep in-app copy in kitchen-table English wherever the
copy isn't itself mahjong vocabulary).

The hint is a bare paragraph, not a new component — "subtle" per the ticket, one line,
no buttons, matching `HandEnd.svelte`'s precedent of small `<p class="...">` lines for
single derived facts rather than a dedicated file per string.

## Rejected: extending ClaimPrompt instead of a new component

`ClaimPrompt` renders `promptChoices`/`winChoice` output — a completely different family
of offers (`chi`/`pon`/`daiminkan`/`tsumo`/`ron`), a different header (claimed tile) and
a different button set (per-choice `uses`-labeled buttons, an optional bare pass). Riichi
needs a fixed two-button layout with distinct copy (stakes lines) that has nothing in
common with a claim button's shape. Bolting riichi in as extra optional props would
force every `ClaimPrompt` consumer/test to reason about a fourth unrelated mode; a
sibling file keeps each prompt's SSR tests independent, matching the existing
`ClaimPrompt`/`HandEnd`/`Table` file-per-concern split.
