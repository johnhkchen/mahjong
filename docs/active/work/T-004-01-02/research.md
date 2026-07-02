# T-004-01-02 — kan-three-forms-rinshan-kandora — Research

Descriptive map of what exists, where, and how it constrains this ticket. No
solutions here; decisions live in design.md.

## The ticket in one line

Add the three kan forms (daiminkan / ankan / shouminkan) to the fold: each kan
draws a rinshan replacement from the dead wall's frozen rinshan positions
(dead[0..3]), flips the next kan-dora indicator rightward from dead[4], and
shortens the live wall so exhaustive draw fires one discard earlier per kan —
with conservation over the widened partition and illegal kans throwing.

## Scope boundaries drawn by sibling tickets

- **T-004-01-01 (done, commits 553a05b/c9cde7e/44df5b9)** delivered chi/pon fold
  semantics: `claimable` window, `mustDiscard`, per-seat `melds`, `applyClaim`.
  Its review.md explicitly hands this ticket two seams: (a) `Meld.claimed`/`from`
  are non-nullable and ankan has neither — "that ticket will widen the shape";
  (b) the conservation formula widens here to
  `hands + melds + ponds + drawn + live + dead == 136`.
- **T-004-01-03** owns `legal.ts` claim/kan offers and the agreement suite. This
  ticket does NOT touch `legal.ts` — same division T-004-01-01 used. legal.ts's
  comment still says "today's vocabulary (draw/discard)"; even chi/pon offers
  don't exist yet.
- **T-004-01-04** owns property-based generation over claims/kans
  (dynamics.test.ts), including "dead-wall exhaustion" mutation cases. This
  ticket's tests stay example-based + targeted properties in record.test.ts,
  per the T-004-01-01 precedent.

## The fold today (src/core/record.ts, 379 lines)

### HandAction — frozen, extend-only vocabulary

`draw` (no tile — wall order is the single authority), `discard` (physical
TileId), `chi`/`pon` (`{seat, tile, uses: [TileId, TileId]}`). Frozen
conventions this ticket must respect: every action carries the acting `seat`
as deliberate redundancy (wrong seat = corruption, throws); anything the wall
order already determines is NOT recorded (draw records no tile); anything only
the player chooses (which physical copies leave the hand) IS recorded (`uses`).

### TableState — a derived view, explicitly growable

Fields today: `hands` (draw order, never sorted), `live`, `dead` (14 tiles,
frozen layout), `doraIndicator: TileId` (= dead[4] at fold start), `dora:
TileKind` (mapped via doraKindOf), `ponds` (complete discard history — claimed
tiles STAY in the pond, D4 of T-004-01-01), `turn`, `melds` (per-seat
`Meld[]`), `claimable` (`{seat, tile} | null` — set by every playing discard,
cleared by draw or claim), `mustDiscard` (true exactly from a chi/pon until the
caller's discard), `drawn` (`TileId | null`, held apart from the 13-tile hand),
`phase: 'playing' | 'ryuukyoku'`. Docs state two invariants this ticket
stresses: "every tile id lives in exactly one of hands / melds' own / ponds /
drawn / live / dead at all times" and "an ended phase exactly when live is
empty" — ryuukyoku flips on the discard that follows the wall-emptying draw.

### Meld (record.ts:78)

`{type: 'chi' | 'pon', claimed: TileId, from: Seat, own: readonly [TileId,
TileId]}`. Only `own` joins the conservation partition; `(from, claimed)` is
the pond mark. The doc comment already reserves the widening: "the kan ticket
may widen this shape (ankan has no claimed tile) without invalidating any
stored hand" — Meld is derived view, not record contract.

### The step (applyAction / applyClaim)

Turn cycle discriminants: `drawn === null && !mustDiscard` → draw (from
live[0], closes the claim window); `drawn !== null` → discard (tsumogiri or
tedashi: hand tile leaves, drawn APPENDED to hand end); `mustDiscard` → claim
discard from hand only. After any discard: if live is empty → phase =
'ryuukyoku'; else turn advances (mod 4) and `claimable` opens. `applyClaim`
guard order is frozen and index-named: window → seat → tile → uses distinct →
uses held → shape. All rejections are `RangeError` naming `action ${index}`.
`isRun` is a module-local helper (review.md flags it for T-004-01-03
extraction, not this ticket — kans need only kind-equality checks).

### foldRecord (record.ts:360)

`partitionWall(buildWall(seed))` → `dealHands` → initial state literal →
`actions.forEach(applyAction)`. Pure; fresh arrays per fold; record never
mutated.

## The dead wall (src/core/wall.ts) — this ticket's main upstream contract

`DEAD_WALL_SIZE = 14`, `LIVE_WALL_SIZE = 122`, `INITIAL_DORA_INDICATOR_INDEX =
4`. `partitionWall` docs freeze the layout this ticket consumes:

- dead[0..3] — the four rinshan draws, **in draw order** (the physical
  alternating-stack order is already linearized here);
- dead[4, 6, 8, 10, 12] — dora indicators: initial flip at 4, **kan flips
  walking rightward** (first kan → dead[6], …, fourth kan → dead[12]);
- dead[5, 7, 9, 11, 13] — ura-dora indicators, each paired directly after its
  dora indicator (ura is a later ticket; the layout just reserves them).

The comment says explicitly: "Only the initial indicator is exposed here;
kan/rinshan/ura tickets consume the rest of the documented map." The dead wall
comment also fixes the arithmetic identity "4 rinshan draws + 5 dora + 5 ura".
Note `dead` in TableState is a fresh mutable array per fold (like `live`, which
the draw step consumes via `shift()`).

`doraKindOf` (dora.ts) maps any indicator kind to its dora kind — kind-level,
already suitable for kan-dora indicators unchanged.

## Riichi domain facts the AC encodes

- **Daiminkan** (open kan): claim another seat's fresh discard with three held
  copies of the same kind. Claim-window semantics like pon (any non-discarder);
  turn jumps to the caller. The caller then draws the rinshan tile and
  discards.
- **Ankan** (closed kan): on your own turn, holding a drawn tile, expose four
  copies of one kind from hand+drawn. No claimed tile, no `from`. Then rinshan
  draw and discard.
- **Shouminkan** (added kan): on your own turn, holding a drawn tile, add the
  fourth copy (from hand or drawn) to your OWN existing pon of that kind.
  Then rinshan draw and discard. (Chankan — robbing this kan — is an agari
  ticket's concern; no ron exists yet.)
- **Rinshan replacement**: every kan form draws one tile from the rinshan
  positions. In physical riichi the dead wall is then replenished from the
  live wall's tail so it stays 14 — which is exactly why exhaustive draw
  arrives one discard earlier per kan (the AC's phrasing).
- **Kan-dora**: each kan flips one more indicator, rightward from the initial
  one. (Timing variants exist in the wild — ankan flips immediately,
  daiminkan/shouminkan after the discard in some rulesets; the ticket's
  Context says simply "every kan … flips the next kan-dora indicator", a
  simplification design.md must own.)
- **Illegal kans** named by the AC: tile not held, wrong form (kinds don't
  match / no owned pon to add to / wrong window state), empty wall. A fifth
  kan is structurally impossible (four rinshan tiles) and T-004-01-04 lists
  dead-wall exhaustion among its mutation cases.

## Test surfaces that constrain the change

- **record.test.ts (576 lines)**: two full-TableState literals (the empty-log
  property at :70 and the frozen seed-1 golden at :155) — any new TableState
  field must be added to the first; the golden asserts `dead`, `doraIndicator:
  24`, `dora: '8m'` against frozen literals. House rule stated repeatedly:
  expectations are wall-derived or hand-derived frozen literals with
  derivation comments, "never regenerate", never read back from the fold under
  test. Frozen seed-1 facts available: dead = [80, 41, 88, 6, 24, 128, 112,
  124, 30, 99, 43, 101, 108, 75]; hands/live prefix as in the golden. The
  illegal-claim matrix (`expectClaimThrows`) asserts the `action ${index}`
  fragment — the pattern kan guards will extend.
- **dynamics.test.ts (261 lines)**: generates from `legalActions` only, so it
  cannot reach kans until T-004-01-03/04; its `allZones` flatten omits melds
  (safe: generated records never form melds today). Must stay green untouched.
- **legal.test.ts (230 lines)**: agreement suite over draw/discard only;
  untouched by T-004-01-01, untouched here.
- **purity.test.ts / app.ssr / drive tests**: core purity and app compile.
  `Table.svelte:72` renders `table.doraIndicator` (singular) — the one app
  consumer of a dora field; TableState growth must stay additive or this
  breaks `just check`.

## Constraints carried into Design

1. Extend-only vocabulary: three new action members may be added; existing
   members cannot change shape. Wall-order-derivable data (the rinshan tile,
   the flipped indicator) must NOT be recorded in actions.
2. Meld widening is a sanctioned seam, but `melds.flat().flatMap(m => m.own)`
   in record.test.ts and the D4 partition rule ("melds contribute own only")
   must keep working for chi/pon.
3. The "ended exactly when live is empty" invariant and the ryuukyoku flip
   condition (`live.length === 0` after a discard) interact directly with
   "one discard earlier per kan" — the mechanism that shortens the live wall
   must preserve or consciously rework this.
4. Conservation: dead currently contributes all 14 tiles; a rinshan tile
   moving to `drawn` must leave `dead` (no double count), and the AC's formula
   counts `dead` as a whole.
5. `doraIndicator`/`dora` are singular TileId/TileKind fields with an app
   consumer; kan-dora needs a plural view. Reshaping existing fields was
   explicitly rejected in T-004-01-01 D4(c) ("reshaping spends compatibility
   for nothing") — growth must be additive.
6. Guard style: RangeError naming the action index, one guard per failure
   mode, frozen guard order, module voice ("the claimable discard is tile N").
7. Commands: `just test` (vitest over src/core), `just check`, `just build`;
   commits small and green (T-004-01-01 shipped three).
