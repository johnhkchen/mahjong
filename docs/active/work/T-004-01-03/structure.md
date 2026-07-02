# T-004-01-03 — legalactions-claim-offers-agreement — Structure

File-level blueprint. Shapes and boundaries only; step ordering in plan.md.

## Files touched

| File | Change |
|---|---|
| `src/core/legal.ts` | Rewritten enumeration: four state classes, claim/kan offers. ~+150 lines. |
| `src/core/legal.test.ts` | Agreement suite over the extended vocabulary. ~+400 lines, some rewrites. |
| `src/core/dynamics.test.ts` | Generator filter + keyOf mirror + stale comments. ~10 lines. |
| `src/app/drive.ts` | `forcedAction` last-discard fix + comment updates. ~10 lines. |
| `src/app/drive.test.ts` | Only if an assertion pins the last-element identity; expected ~0–5 lines. |

Untouched, by design: `record.ts` (the folding half is frozen — this ticket
adds no fold behavior), `tiles.ts`/`wall.ts`/`dora.ts`/`deal.ts`, `index.ts`
(barrel `export *` already re-exports legal.ts), `App.svelte`/`Table.svelte`
(shape-robust through drive.ts), `record.test.ts`.

## src/core/legal.ts — internal organization

Module doc: the offered/folding two-statement contract paragraph survives;
the "today's vocabulary (draw/discard)" closed-form doc is replaced by the D2
order specification, stated as the frozen public contract ("bots sample by
index" — the order IS the API).

Imports (D4 boundary): `kindOf`, `rankOf`, `suitOf`, `TileId`, `TileKind` from
`./tiles`; `SEAT_COUNT`, `Seat` from `./deal`; types `HandAction`, `TableState`
from `./record`. Nothing else — no record.ts values, no new exports from
record.ts.

Internal helpers (module-local, not exported):

- `copiesInHand(hand, kind): TileId[]` — the held copies of one kind, hand
  order. Shared by pon/daiminkan/chi/ankan/shouminkan enumeration.
- `kanAllowed(state): boolean` — `state.doraIndicators.length - 1 < 4 &&
  state.live.length > 0` (the identity + haitei backstop, D4). One comment
  citing the record.ts guard it mirrors.
- `claimOffers(state): HandAction[]` — the window enumeration, in D2 order:
  - pon: seats `(window.seat + k) % 4`, k = 1..3; copies pairs i<j →
    `{type:'pon', seat, tile, uses:[c[i], c[j]]}`.
  - daiminkan (only when `kanAllowed`): same seat scan; exactly-3 copies →
    one offer, uses in hand order.
  - chi: seat `(window.seat + 1) % 4` only; `rankOf(kind)` null → none;
    for `low` of rank−2, rank−1, rank (clamped to [1, 7]): the two needed
    ranks ascending; copy loops lower-kind-outer / higher-kind-inner →
    `{type:'chi', seat, tile, uses:[lowTile, highTile]}` (D3).
- `ankanOffers(state): HandAction[]` — kinds in first-occurrence order over
  hand-then-drawn; a kind offers iff hand copies + (drawn matches ? 1 : 0)
  === 4; uses = hand copies in hand order, drawn appended last (D3). Empty
  when `!kanAllowed`.
- `shouminkanOffers(state): HandAction[]` — turn seat's melds in meld order;
  for each pon, the fourth copy from hand (hand order) else drawn; offer
  `{type:'shouminkan', seat, tile}`. Empty when `!kanAllowed`.

`legalActions(state)` — the four state classes, in this branch order:

1. `phase !== 'playing'` → `[]`.
2. `state.mustDiscard` → hand discards in hand order (NO draw — the bug fix).
3. `state.drawn === null` → `[draw]`, then `...claimOffers(state)` when
   `state.claimable !== null`.
4. post-draw → 13 hand discards + drawn discard (verbatim today), then
   `...ankanOffers(state)`, then `...shouminkanOffers(state)`.

Freshness invariant unchanged: every call builds new literals; `uses` tuples
are fresh arrays.

## src/core/legal.test.ts — suite organization

Kept helpers: `seedArb`, `FULL_TURNS`, `dealtLive`, `tsumogiriRecord`,
`maximalRecord`, `prefixArb` (generator unchanged — it already reaches
claim-window states).

New/changed helpers:

- `keyOf(action)` widens: `uses`-bearing actions serialize sorted-uses —
  `type:seat[:tile]:sortedUses` — so membership is order-insensitive (D5).
- Mirrored frozen anchors (per-file mirroring convention; derivation comments
  + "never regenerate"): seed-1 chi/pon prefixes, seed-3 race prefix, seed-67
  `kanPrefix67`/`shouminkanPrefix67`, seeds 161/280 ankan prefixes, seed-101033
  four-kan chain, seed-280 kan-maximal record — restated from record.test.ts.
  NEW anchor from a scratchpad scan: a multi-variant chi window (≥2 run shapes,
  a duplicated copy) with its full expected offer array as a literal.
- `claimCandidatesAt(state)` — the documented exhaustive candidate space at an
  anchor: for each seat and each claim type, tile = window tile, uses = every
  hand-position combination (pairs for chi/pon, triples for daiminkan); plus
  ankan 4-subsets of hand∪drawn and shouminkan over all 136 tile ids at
  post-draw anchors. Space constructor only — no legality judgment inside.

Suites (existing five headers survive; content grows):

1. **the set is the closed form** — rewritten: mustDiscard states offer exactly
   the hand discards (property over claim anchors + fold-extended prefixes);
   pre-draw offered[0] is the draw and every remaining offer is a claim naming
   `state.claimable.tile`; post-draw offered[0..13] are the 14 discards
   verbatim and every remaining offer is an ankan/shouminkan by the turn seat.
2. **ended hand offers nothing** — unchanged, plus the kan-shortened seed-280
   ryuukyoku.
3. **offered actions fold** — property text unchanged (now bites on claims);
   plus the same property run at every frozen claim/kan anchor state.
4. **outside actions throw** — sampled-negative property keeps its bads and
   gains claim-shaped negatives (wrong-seat chi, decoy tile, stale window,
   unheld uses); the exhaustive partition re-anchors: draws+discards space
   (548) at the old three anchors PLUS `claimCandidatesAt` spaces at the
   claim-window / kan anchors — offered ⇒ folds, outside ⇒ throws RangeError.
   Suppression anchors assert specific keys absent AND throwing: fifth kan,
   haitei ankan/shouminkan, claims with the window stale or closed.
5. **purity and freshness** — properties unchanged (prefixArb now hits claim
   states); add anchor-state runs so kan-bearing offers are covered; fresh-
   `uses`-array identity check added.
6. **NEW: deterministic order** — frozen-literal full-array assertions at the
   multi-claim anchors (the D2/D3 order made concrete): seed-67 window =
   [draw, pon×3, daiminkan, …chi?], race anchor = [draw, pon, chi], the
   multi-variant chi anchor's exact array.

## src/core/dynamics.test.ts — surgical edits

- `playRecord`: `const legal = legalActions(...).filter((a) => a.type ===
  'draw' || a.type === 'discard')` + comment: claims/kans stay out of random
  trajectories until T-004-01-04 grows the generator. Same filter in the
  `gameArb` dangle probe. Everything downstream (choice consumption, bounds,
  termination exact-counts) is then untouched.
- `keyOf` mirrors legal.test.ts's widened form (comment already says
  "mirrored"); mutant constructors' stale comment updated.

## src/app/drive.ts — surgical edit

`forcedAction`: the non-player post-draw arm returns the last offered DISCARD
(`findLast`-style reverse scan; ES2023 findLast availability decided at
implement time — a reverse for-loop if the lib target lacks it). Doc comments
drop "homogeneous offering" and restate: draws force; a non-player discard
obligation forces tsumogiri = the last offered discard; claim/kan offers are
never auto-taken (bots pass on calls until a real bot ticket).

## Interface stability ledger

- `legalActions` signature unchanged; offered[0] and the post-draw 14-discard
  prefix byte-stable (D2) — existing samples by index survive.
- `HandAction`/`TableState`/`Meld`: untouched.
- Barrel exports: unchanged set.
- drive.ts exports: signatures unchanged; `forcedAction` behavior identical at
  every kan-free state.

## Ordering constraint

legal.ts and legal.test.ts must land together (the suite is the lock); the
dynamics/drive edits are prerequisites for a green tree the moment legal.ts
grows, so they ride the same commit or the immediately following one — plan.md
sequences this.
