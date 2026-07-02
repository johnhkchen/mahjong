# T-003-02-02 — tap-to-discard-and-tsumogiri-loop — Research

Descriptive map of what exists, where, and how it connects. No solutions proposed here.

## The ticket in one line

Make the hand playable end-to-end: the app appends actions to its authoritative record —
East discards by tapping a tile, the three other seats tsumogiri as the deliberate bot
placeholder — with all legality consumed from `legalActions`, so a seeded hand runs from
deal to exhaustive draw purely as a fold.

## Dependency state

- **T-003-01-02 (legal-actions-surface): `phase: done`.** `legalActions` is exported from
  the core barrel (commits `796f7d2`, `9d38ae1`), locked to the step function by the
  agreement suite in `legal.test.ts` (548-candidate partition, soundness over prefixes).
- **T-003-02-01 (render-ponds-turn-and-phase): `phase: done`.** Table.svelte renders all
  four ponds in discard order, the active-turn marker, East's drawn tile, the wall
  countdown, and the ryuukyoku end state (commits `38b8dac`, `6551110`). Everything this
  ticket makes *change over time* is already *presented*.
- **T-003-01-03 (random-legal-sequence generator)** is a core-side sibling, not a
  dependency; its charter (long random tedashi walks through `legalActions`-driven play)
  overlaps only in spirit with the app loop here.

## The engine surface this ticket consumes (src/core/)

App code imports only from the barrel `src/core/index.ts`.

### foldRecord (record.ts:197) — the authority

`foldRecord({seed, actions}) → TableState`. Empty log = freshly dealt table. Pure; the
record is never mutated; all output arrays fresh per fold. Illegal actions throw
`RangeError` naming the log index — the app must never append an action the fold rejects.

### legalActions (legal.ts:34) — the offered set

`legalActions(state: TableState): HandAction[]`, closed-form at every reachable state:

- ended hand (`phase !== 'playing'`) → `[]`;
- `drawn === null` → exactly one action, the turn seat's `{type:'draw', seat}`;
- `drawn !== null` → exactly 14 discards by the turn seat: **the 13 hand tiles in hand
  order, then the drawn tile last**. The order is a documented, test-pinned contract
  ("bots and generators may sample by index" — T-003-01-02 review calls this the point).

Consequences the app can lean on: every offered set is homogeneous (all draws or all
discards, all by `state.turn`); a draw is never a choice (singleton); the drawn tile —
the tsumogiri discard — is always the *last* element of a discard offering; `[]` is the
end-of-hand signal.

### HandAction / HandRecord (record.ts:30-49) — what the app appends

`{type:'draw', seat}` (no tile — the wall is the authority) and
`{type:'discard', seat, tile: TileId}` (tsumogiri derived at fold time, not encoded).
`HandRecord = {seed, actions}`; `Seat = 0|1|2|3` (0 = East, the dealer and the player).

### Turn cycle facts relevant to a driving loop

- Post-deal live wall is 70 tiles; a full all-tsumogiri hand is exactly 70 draw/discard
  pairs (140 actions), ending in ryuukyoku on the discard that follows the wall-emptying
  draw (record.ts: phase flips on the discard, so an ended phase ⇔ empty live wall).
- East acts first; turns advance E→S→W→N; between East's discard and East's next input
  there are exactly 7 forced steps (S/W/N draw+discard pairs, then East's own draw).
- Tedashi is legal and folds correctly (hand tile leaves, drawn tile appended to hand) —
  tapping any of the 13 hand tiles, not only the draw, is within the engine's vocabulary.

## The app surface (src/app/)

### App.svelte — composition root, where the record lives

`let seed = $state(1)` (the walking-skeleton golden seed) and
`const table = $derived(foldRecord({ seed, actions: [] }))`. The comment says the log is
"necessarily empty until action tickets widen HandAction" — widened since T-003-01-01;
this ticket is the one that makes `actions` real state. App owns the authoritative
record; nothing else in the app holds game state.

### Table.svelte — stateless presentational, one prop

`let { table }: { table: TableState } = $props()`. Header comment pins the rule: never
derives game facts; the only computation is the display copy-sort of East's hand
(`kindIndexOf`/`kindOf`, presentation-owned per core's doc). Renders per seat: wind
label, pond (`aria-label="{wind} pond"`, discard order straight off the fold), and for
East: the sorted hand (`aria-label="your hand"`) and, when `turn === 0 && drawn !== null`,
the drawn tile apart from the hand (`aria-label="drawn tile"`). Center panel: dora
indicator, `{live.length} tiles left`, and `ryuukyoku — exhaustive draw` when ended.
Turn marker: `aria-current="true"` on the active seat, only while `phase === 'playing'`.
**No interactivity anywhere: no buttons, no event props, no callbacks.** Hand tiles are
plain `<li><Tile/></li>`.

### Tile.svelte — presentational leaf

`TileId` in → one `<span class="tile suit-{s}">{kind}</span>` chip. No handlers.

### main.ts — mounts App; nothing else.

## The test surface

### app.ssr.test.ts — SSR only, no DOM, no events

Renders through `svelte/server`'s `render()` (vitest `environment: 'node'`). Pinned
convention: assert content and aria landmarks only, never classes or structure. Helpers:
`tileTokensOf` (regex `>([1-9][mpsz])<`), `regionTokens(body, label, closeTag)` (slices
from an aria-label to the next close tag), `tsumogiriTurns(live, n)` (hand-authors an
all-tsumogiri script off the empty fold — this ticket's loop is the *runtime* twin of
this test helper). Existing suites: dealt App render, mid-hand Table render (ponds in
order, one `aria-current`, drawn tile, wall countdown), wall-exhausted Table render.
Constraints that bind additions: the App suite asserts *all* body tile tokens equal
hand+indicator (App's fold has empty actions — still true in SSR where effects don't
run); each wind word appears exactly once, case-sensitively.

**SSR cannot simulate taps and `$effect` does not run on the server** — any behavior
test of the tap/tsumogiri loop must exercise plain TypeScript, not rendered components.

### Test environment has no DOM emulation

No jsdom/happy-dom in devDependencies; vitest env is `node`. There is no facility for
`click()`-driven component tests, and no ticket has introduced one.

### legal.test.ts / record.test.ts conventions

Per-file helpers, expectations derived from frozen upstream contracts (never from the
code under test), fast-check properties for spaces, frozen seed 1 for anchors.

## Architecture constraints that bind this ticket

- The record is authoritative; **table state is always derived by folding** after every
  action (architecture.md §6: "the app re-derives table state by folding; the table DOM
  is small so re-render is cheap"). No incremental state mirror in the app.
- The action log is the public contract: the app builds `HandAction` literals and
  appends; it never reaches into fold internals.
- Legality is consumed from `legalActions` — the AC makes this a tested requirement:
  the tap handler must demonstrably build actions via `legalActions`, not recompute
  hand-membership or turn checks locally.
- The AI is a stateless peripheral (`table state → action`). Tsumogiri-for-three-seats
  is this ticket's deliberate placeholder for that peripheral — the same call shape a
  real bot will fill later.
- `core/` never imports app; app-side modules importing the barrel is the sanctioned
  direction (purity.test.ts guards core's side).

## Assumptions surfaced

- "Tapping" in a Svelte 5 view means click/tap on a `<button>` (or equivalent) — Table
  currently has none, so tappability is new surface; Table must stay stateless, which
  means input arrives as a callback prop while the record stays in App.
- East's *draw* is not a tap: the AC's tap vocabulary is discards only, and a draw is
  never a choice (singleton offering) — so someone must auto-append draws for East too,
  not only bot actions, or the hand stalls after every East discard.
- The AC's "ponds and wall counter update after every action" is observable in `just
  dev`; whether bot actions land instantly-batched or visibly paced is a design choice —
  nothing in the ticket or knowledge docs pins pacing, but vision.md's P1 ("watch a real
  hand unfold") and the teaching-first stance favor legible sequencing.
- `docs/active/work/T-003-02-02/` did not exist before this research; the six-artifact
  layout follows the sibling tickets' work dirs.
