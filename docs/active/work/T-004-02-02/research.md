# T-004-02-02 — call-pass-prompt-and-meld-display — Research

Descriptive map of what exists. The ticket surfaces the claim interruption in
the running app: a call/pass prompt (chi variants choosable), exposed melds per
seat, the claimed tile marked in the discarder's pond, the paced loop pausing on
the prompt and resuming from the caller. Everything below is what the ticket
builds ON — no solutions proposed here.

## 1. The seam this ticket consumes (src/app/drive.ts, 154 lines)

T-004-02-01 built the complete input seam; this ticket is its first real UI
consumer. Exported surface, all "return an ELEMENT of legalActions output or
null":

- `PLAYER: Seat = 0` — East, the human.
- `claimChoices(offered, player): HandAction[]` (drive.ts:50) — the player's
  chi/pon/daiminkan offers, elements of `offered` in frozen order (pons →
  daiminkans → chis, shapes low-rank ascending). Explicitly documented as "the
  claim prompt's render list (T-004-02-02) — the loop waits exactly when the
  prompt shows."
- `ClaimChoice` (drive.ts:37) — `{ type: 'chi'|'pon'|'daiminkan', uses:
  readonly TileId[] }`, "a claim button's payload". Distinct chi variants
  differ precisely in `uses`.
- `tapClaim(offered, player, choice)` (drive.ts:67) — selection by call form +
  exact ORDERED `uses`; the UI must echo back the canonical `uses` it rendered
  from (reconstructed/reordered payloads are rejected as lookalikes — -02-01
  review concern #3).
- `passClaim(offered, player)` (drive.ts:92) — the head draw iff the player
  holds a claim offer; declining IS the default continuation whose fold closes
  the window. Complementary to forcedAction by construction: exactly one
  driver applies at every state, so "a pass button can only exist while there
  is something to decline."
- `forcedAction(offered, player)` (drive.ts:140) — null exactly at: the
  player's discard choice, the player's claim window, and the ended hand.
- `tapDiscard(offered, player, tile)` (drive.ts:105) — already wired to hand
  taps; drives the post-claim discard too (proven in drive.test.ts's claim
  walk).

## 2. The one line this ticket must replace (src/app/App.svelte)

App.svelte:37: `const action = forcedAction(offered, PLAYER) ??
passClaim(offered, PLAYER)` — the `?? passClaim` arm is the interim auto-pass,
comment-marked "until T-004-02-02's call/pass prompt replaces this line."
-02-01 review concern #1: if the prompt is added but the arm survives, the app
auto-declines after 250 ms before the player can respond; the AC ("a call/pass
prompt appears") fails loudly if so.

App structure: `seed = $state(1)`, `actions = $state<HandAction[]>([])`,
`table = $derived(foldRecord(...))`, `offered = $derived(legalActions(table))`.
The `$effect` pushes one forced action per 250 ms tick (`BOT_DELAY_MS`);
cleanup clears the pending timer; `$effect` never runs in SSR. `tap(tile)`
pushes `tapDiscard`'s element. App owns the record and the offered set; Table
sees only the fold.

## 3. The view being extended (src/app/Table.svelte, Tile.svelte)

Table.svelte is deliberately stateless: one `table: TableState` prop plus an
`ontap` callback OUT. Header comment: "It never derives game facts — every
fact below is a field read off the fold; the only conditionals are
presentation gates on those reads." Its one computation is the display sort of
the player's hand. Current rendering per seat: wind label, pond (`table.ponds
[i]` in discard order, `aria-label="{wind} pond"` lowercase), and for East a
sorted 13-tile hand of discard buttons plus the drawn tile apart. Center:
dora indicator, wall count, ryuukyoku status. NOT rendered anywhere today:
`table.melds`, `table.claimable`, any claimed-away mark in ponds, any prompt.

Grid: `grid-template-areas` names seats by wind (east bottom, south right,
west top, north left); `.center` occupies the middle cell. CSS custom props
`--felt/--felt-edge/--ink/--ink-dim`; tap targets are chrome-less buttons
around Tile chips.

Tile.svelte: presentational leaf, `{ id: TileId }` in, mpsz-kind text chip out
(future tile-art ticket replaces its internals only).

## 4. What core already provides (closed for this ticket)

`TableState` (record.ts:140) carries every fact the ticket displays:

- `melds: readonly [Meld[], Meld[], Meld[], Meld[]]` — per-seat, claim order.
- `Meld` (record.ts:103) — for chi/pon: `{ type, claimed, from, own:
  [TileId, TileId] }`; daiminkan/shouminkan own three; ankan owns four with no
  claimed/from. Doc: the claimed tile is "displayed in the meld, counted in
  ponds[from]; `(from, claimed)` is the mark identifying it there."
- `ponds` keep the COMPLETE discard history — a claimed-away tile stays in the
  discarder's pond (furiten/defense reads depend on it). So "marked in the
  pond" is a view derivation: physical TileIds are unique, and every claiming
  meld names its `(from, claimed)` pair.
- `claimable: { seat, tile } | null` — the open window; `mustDiscard: boolean`
  — true from a claim until the caller's discard (no drawn tile then).

Fold behavior on a claim (applyClaim, record.ts:233): `uses` leave the hand,
the meld appends, the turn JUMPS to the caller, the window closes, the caller
owes a hand-only discard. `legalActions` at mustDiscard offers exactly the
caller's hand discards (legal.ts:172) — so the existing hand-tap surface
already drives the post-claim discard.

## 5. Frozen test anchors available for reuse (drive.test.ts)

Three scratchpad-scanned claim windows, derivations in comments, "never
regenerate":

- **Seed 3, 4 tsumogiri turns** (`racePrefix3`): North discards 42 (2p); East
  holds TWO duplicate-copy chi variants, uses [37,47] and [37,44] (same 1p+3p
  shape, different 3p copies); South holds a pon. Head = East's OWN draw.
- **Seed 5, 7 turns**: West discards 94 (6s); East pons with [93,95]; head =
  North's draw.
- **Seed 15, 8 turns**: North discards 45 (3p); East holds a pon [44,47] AND
  two shape-distinct chis [41,51] (2p3p4p) and [51,55] (3p4p5p) — the
  multi-type prompt in one window, frozen order pon-before-chis.

The claim walk (drive.test.ts:362) pins the post-chi fold: `melds[0] = [{
type: 'chi', claimed: 42, from: 3, own: [37, 47] }]` and the mustDiscard →
tapDiscard → resume sequence. The full-hand walk pins seed 1's two East chi
windows (passes = 2, trajectory byte-identical to unclaimed play).

## 6. SSR test conventions (app.ssr.test.ts, 154 lines)

Vitest + `render` from 'svelte/server'. Three describe blocks: App rendered
whole at the boot seed (dealt state — effects never run in SSR, so no
mid-hand state is reachable through App); Table rendered DIRECTLY with
hand-authored folded records for mid-hand and wall-exhausted states — "the
stateless view's whole contract is its one prop." Assertions are content and
aria landmarks only, never classes/structure: `tileTokensOf` regexes
`>([1-9][mpsz])<`, `regionTokens` slices from an `aria-label` to a close tag
(fails loudly on a missing label). The AC names this suite: it must stay green
and is the natural home for prompt/meld/pond-mark rendering tests.

## 7. Commands, toolchain, conventions

`just dev` (Vite dev server), `just test` (vitest over src/, 192 tests ~1s),
`just check` (svelte-check + tsc), `just build` (singlefile). Svelte 5 runes
($state/$derived/$props/$effect). Commits per ticket step, `T-004-02-02:`
prefix convention visible in git log. Aria labels are the test hooks; pond
labels lowercase by deliberate vocabulary choice.

## 8. Constraints and assumptions surfaced

- **Core is closed**: melds, ponds, claimable already carry every displayable
  fact; the ticket is app-only (drive.ts possibly, App/Table/new components,
  SSR tests). -02-01 explicitly left Table.svelte and app.ssr.test.ts
  untouched "by design" for this ticket.
- **Dedupe is presentation's job** (-02-01 review concern #2): claimChoices
  hands over the complete offered set — a triplet holder sees three
  identical-looking pon pairs (copies are interchangeable until red fives).
  The prompt must dedupe by kind-shape for display, NOT ask the seam or
  enumeration to shrink. The seed-3 anchor's two chi variants are EXACTLY
  this: same kinds (1p+3p), different copies — visually identical buttons.
- **Ordered `uses` echo** (concern #3): buttons must carry the offered
  element's own `uses` (or the element itself) back through tapClaim.
- **Daiminkan**: tapClaim's daiminkan arm has no positive anchor; -02-01
  review says "cheap to add in -02-02 if the prompt renders kan buttons." The
  prompt's render list (claimChoices) can contain daiminkan offers, so the
  prompt must at least render them.
- **Player-seat facts in the view**: Table already hardcodes seat 0 as the
  player ("Seat 0 (East) is the player. Table.svelte presents the same fact"
  — drive.ts cross-references it). Melds are per-seat data; bots never call
  under the placeholder policy, but the fold can hold bot melds (hand-authored
  records), and the view is stateless over whatever fold arrives.
- **Prompt visibility must equal loop wait**: claimChoices is the shared
  predicate; if the prompt renders from anything else, the loop and the UI
  can drift (the -02-01 complementarity property exists to flush this).
- **AC's runtime clause**: "in `just dev` on a seed where East can claim" —
  boot seed is 1, and seed 1 DOES open two East chi windows mid-hand
  (actions #96/#104), so the prompt is reachable on the default boot without
  seed plumbing.
- **No design system for overlays exists yet** — the table has no modal/
  banner precedent; the center cell and the seat cells are the existing
  surfaces. Whatever the prompt looks like, SSR tests assert content/aria
  only, so the visual choice is free.

## 9. Files in scope

| File | Role today | Touch expected |
|---|---|---|
| src/app/App.svelte | record owner, effect loop, tap wiring | replace `?? passClaim` arm; prompt wiring |
| src/app/Table.svelte | stateless fold view | melds per seat, pond claim marks; possibly prompt slot |
| src/app/Tile.svelte | tile chip leaf | reuse as-is |
| src/app/drive.ts | input seam | consume; possibly a small presentation helper |
| src/app/drive.test.ts | seam suite + anchors | reuse anchors; daiminkan anchor if kan buttons render |
| src/app/app.ssr.test.ts | SSR content tests | new claim-window/meld/mark coverage (AC names it) |
| src/core/* | engine | READ-ONLY (contract closed) |
