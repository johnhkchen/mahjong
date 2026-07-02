# T-003-02-01 — render-ponds-turn-and-phase — Design

Five decisions, each grounded in research.md. The through-line: the view stays a stateless
fold-reader; the test stays content-and-aria only.

## D1 — What the SSR test renders: Table directly, with a folded prop

**Options**

- **A. `render(Table, { props: { table: foldRecord(record) } })`** — test the stateless
  component the ticket grows, directly.
- B. Give App an optional `record` prop (defaulting to the boot seed) and render App.
- C. Mutate App's internal `$state` from the test.

**Decision: A.** The unit under test is Table — the AC's subject ("the stateless Table
view"). Table's single-prop contract (`table: TableState`) is exactly the engine's public
contract surface, so feeding it hand-authored folds is the honest test. B changes App's API
for the sake of a test one ticket before T-003-02-02 redesigns App's record handling anyway
(it will append actions to `$state`); pre-widening App now is speculative and would be
churned. C is impossible under SSR and against runes' design. The existing App-rendering
describe block stays untouched — it keeps covering the App→Table wiring for the boot record.

**Consequence:** App.svelte is not modified by this ticket at all.

## D2 — Authoring the mid-hand record: computed tsumogiri script + one tedashi

**Options**

- A. Hardcode a literal `actions` array of seat/tile numbers for seed 1.
- **B. Compute the script from the empty fold**: draws consume `emptyFold.live` head-first,
  so turn k's drawn tile is `live[k]`; build tsumogiri pairs programmatically, plus one
  tedashi discard of a known dealt hand tile.
- C. Wait for `legalActions` (T-003-01-02) and generate legal sequences.

**Decision: B.** A is brittle (any frozen-convention regression surfaces as inscrutable
magic numbers) and unreadable. C inverts the dependency DAG — T-003-01-02 is not a
dependency and is still in research. B reads the engine's own frozen conventions through the
public fold (no reimplementation of wall/deal math) and stays legible: the fixture builder
is ~10 lines. It is "hand-authored" in the AC's sense — constructed deliberately in the
test, not recorded from play.

**Fixture shapes** (both on the boot seed, matching the existing test's `BOOT_SEED = 1`):

- **Mid-hand record**: 8 complete turns (each seat discards twice) then East draws a 9th
  tile and stops mid-turn. Turn 1 (East's first) is **tedashi** — discard
  `emptyFold.hands[0][0]`, a dealt tile — the other 7 are tsumogiri. This yields: every pond
  non-empty with 2 tiles, East's pond in an order no sort would produce a priori
  (dealt-tile-first, then a drawn tile), `turn = 0` (East) active, `drawn ≠ null` for the
  player, `live.length = 61`. One record exercises every AC clause except ryuukyoku.
- **Exhausted record**: 70 all-tsumogiri turns (140 actions) → `phase = 'ryuukyoku'`,
  `live.length = 0`. Cheap to fold (foldRecord is O(actions)).

## D3 — Pond markup: per-seat `<ul>` with lowercase aria labels

Each seat gets a pond list rendered from `table.ponds[i]` in array order (the fold
guarantees discard order; the view must not sort — mirroring the "order IS the pond's
meaning" contract):

```svelte
<ul class="pond" aria-label="east pond"> … <li><Tile {id} /></li> … </ul>
```

- Labels are `"{wind.toLowerCase()} pond"` — matching the existing lowercase aria style
  ("your hand", "dora indicator") AND dodging the wind-word-count constraint from
  research.md: `body.split('East')` counts are case-sensitive, so `"east pond"` leaves the
  existing exactly-once assertion green. This is load-bearing; a capitalized label breaks
  an existing test.
- The `SEATS` const already sits in Seat order; the `{#each}` gains the index to read
  `table.ponds[i]`. An empty pond renders an empty list — no conditional, no special case.

**Rejected:** rotated/columnar pond layouts per seat edge (pure styling ambition, not in
the AC; the 6-per-row riichi pond grid can come with the tile-art pass).

## D4 — Turn marker and drawn tile: aria-current on the seat; drawn shown for East only

- **Active seat**: the seat wrapper for `i === table.turn` gets `aria-current="true"` (plus
  a visual class) — but **only while `table.phase === 'playing'`**. After ryuukyoku the fold
  deliberately leaves `turn` at the last discarder; presenting that as "to act" would be a
  false fact. Gating display on the `phase` field is presentation logic over read fields,
  not derivation of a game fact. `aria-current` is the semantically correct ARIA token for
  "current item in a set" and is assertable as content.
- **Drawn tile**: rendered only for the player (East, `seat.you`) when `table.turn === 0 &&
  table.drawn !== null`, as a visually separated chip beside the sorted hand with
  `aria-label="drawn tile"`. Opponents' drawn tiles are concealed information (research.md
  assumption made explicit here): a riichi player never sees them, and the teaching table
  must not either. The AC does not require rendering opponents' draws; we deliberately
  don't.
- The drawn tile is NOT merged into the sorted hand display — core holds it apart
  (`drawn` is "held apart from the 13-tile hand") and the riichi convention is exactly
  that: the draw sits to the right of the hand. Presentation mirrors the fold's shape.

**Rejected:** marking the turn with a text word ("to act") as the primary signal — words
repeated per-seat invite collisions with word-count tests and localize badly; an attribute
is cleaner. A small visual cue still comes with the class.

## D5 — Ryuukyoku end state: a center banner read straight off `phase`

When `table.phase === 'ryuukyoku'`, the center panel shows a banner:

```svelte
{#if table.phase === 'ryuukyoku'}<p class="ended" role="status">ryuukyoku — exhaustive draw</p>{/if}
```

- Read from the `phase` field, never inferred from `live.length === 0` (the invariant in
  CLAUDE.md: the view never derives what the fold already states). The literal union is
  widenable; when agari endings land, this `{#if}` grows branches.
- `role="status"` is the right landmark for an end-of-hand announcement and gives the test
  a semantic hook; the visible text teaches the term with its plain meaning attached
  (vision.md P4 — legible vocabulary).
- The wall counter stays rendered at 0 — "0 tiles left" plus the banner is exactly the
  causal story of an exhaustive draw.

**Rejected:** replacing the whole center panel or an overlay — needless structure churn for
a state T-003-02-02's play loop needs visible *alongside* the final table.

## Test design (follows from D1-D5)

New region-scoped helper: extract a labeled element's inner tile tokens in document order
(`regionTokens(body, 'east pond')`), because whole-body `tileTokensOf` cannot assert
per-pond ordering. Assertions per AC:

1. Mid-hand render: each of the four pond regions contains exactly the expected kinds **in
   discard order** (deep-equal on ordered arrays, not multisets — East's tedashi makes
   order observable); `aria-current="true"` appears exactly once and inside East's seat
   region; body contains `61 tiles left`; drawn-tile region shows `kindOf(live[8])`.
2. Exhausted render: body contains the ryuukyoku banner text and `0 tiles left`; no
   `aria-current` anywhere.
3. Existing five App tests stay green untouched (D3's lowercase labels; empty ponds render
   no tile tokens).

## What this ticket does NOT do

No interactivity (T-003-02-02), no `legalActions` (T-003-01-02), no opponent hand backs or
tile art, no App.svelte changes, no core changes of any kind.
