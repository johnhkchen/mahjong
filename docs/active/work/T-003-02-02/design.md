# T-003-02-02 — tap-to-discard-and-tsumogiri-loop — Design

Options weighed against the research; one chosen with rationale.

## The problem, precisely

Four pieces of behavior have to appear, and the record has to stay the only authority:

1. **East taps a tile → a discard action appends** — only when that discard is offered.
2. **Draws auto-append** — a draw is never a choice (singleton offering), for East too;
   without this the hand stalls after every East discard.
3. **South/West/North auto-tsumogiri** — the deliberate bot placeholder.
4. **The loop halts itself** — `legalActions` returns `[]` at ryuukyoku; no wall-count
   checks anywhere in the app.

And the AC's testing clause: an app test must prove the tap handler builds actions *via
`legalActions`*, in a test environment that is SSR-only (no DOM, no events, no effects).

## Decision 1 — where the driving logic lives

**Options**

- **(a) Inline in App.svelte.** Handlers and the advance loop written directly in the
  component script. Rejected: the test environment cannot execute component event
  handlers or effects (research: no jsdom, `$effect` skipped in SSR), so the AC's
  required test would be unwritable without new test infrastructure this ticket has no
  mandate to add.
- **(b) A pure app-side module, `src/app/drive.ts`.** Plain functions the component
  wires to events and effects; the functions are the tested surface, the component
  bindings stay one-liners. Matches the repo's shape: core is pure-and-tested, the view
  is thin; this puts the *only* new decision logic in a pure, node-testable seam.
- **(c) In core, as the first bot (`src/core/bot.ts`).** Tsumogiri-as-a-bot is core's
  eventual home (architecture: the AI is a stateless peripheral, `table state → action`).
  Rejected *for now*: the bot interface (difficulty, defense, hint reuse) deserves the
  AI epic's own design pass; core exports carry contract-freeze weight here; and the
  ticket words this as "the deliberate bot placeholder" inside the app loop with an
  *app* test. What we keep from (c): the placeholder is shaped exactly like a bot call
  site — offered actions in, one chosen action out — so swapping in core's real bot
  later is a one-line rewire, honoring "never woven into app code" in substance.

**Chosen: (b)** — `src/app/drive.ts`, two small pure functions.

## Decision 2 — how the tap handler consumes legality

**Options**

- **(a) Compute legality locally** (`turn === 0 && drawn !== null && tile in hand ∪
  {drawn}`). Explicitly forbidden by the AC; it would be a second statement of the turn
  cycle in the app, exactly what `legalActions` exists to prevent.
- **(b) Call `legalActions(state)` inside the handler.** Correct, but the "consumes
  legalActions" claim is then only testable by mocking the core barrel (`vi.mock`) —
  a precedent-free, heavier test style in this repo, and it couples the test to an
  import path rather than to behavior.
- **(c) Parameterize on the offered list**: `tapDiscard(offered, player, tile)` returns
  the matching **element of `offered` itself**, or `null`. App wires
  `tapDiscard(legalActions(table), PLAYER, tile)`. The test proves list-obedience
  behaviorally, no mocks: hand a doctored offered list that *omits* a genuinely-held
  tile → tap returns `null` (so legality cannot be coming from hand membership); assert
  the returned action `toBe`-identical to an element of the list (the action literally
  *is* `legalActions` output, not a locally-built lookalike).

**Chosen: (c).** Same choice for the forced-advance function, one signature family:
everything downstream of `legalActions` speaks "offered list in, action out".

## Decision 3 — identifying the forced action

`forcedAction(offered, player): HandAction | null`:

- `offered` empty → `null` (hand ended; the loop's halt condition).
- Head is a draw → that draw (draws are forced for every seat — singleton by contract).
- Discards by a seat ≠ player → **the last element**: `legalActions`' frozen, test-pinned
  order puts the drawn tile last, and its review explicitly blesses sampling by index —
  the tsumogiri placeholder is the canonical use of that contract. (Alternative — pass
  `state.drawn` in and `find` it — rejected as a second input for information the order
  contract already encodes.)
- Discards by the player → `null` (a real choice; wait for the tap).

Homogeneity of the offered set (all same type/seat) is `legalActions`' documented shape,
so inspecting the head classifies the whole set.

## Decision 4 — how forced actions land over time

**Options**

- **(a) Synchronous while-loop** after mount and after each tap. Correct and simple,
  but all 7 forced steps between East's discards paint as one batched frame — the AC's
  "ponds and wall counter update after every action" becomes technically-true but
  invisible, and P1's "watch a real hand unfold" (plus the teaching-first stance) wants
  legible sequencing.
- **(b) `$effect` + one `setTimeout` tick per forced action.** The effect reads
  `forcedAction(offered, PLAYER)`; if non-null it schedules a single append and returns
  a cleanup that clears the timer. Each append re-folds → re-derives `offered` → re-runs
  the effect: the loop is the reactive fixed point, no explicit iteration, and it halts
  when `forcedAction` returns `null` (player's choice or `[]` at ryuukyoku). Each action
  paints its own frame — ponds and wall counter visibly update per action. SSR-safe for
  free: effects don't run on the server, so the existing dealt-table SSR suite still
  sees the empty-log fold.

**Chosen: (b)** with a small constant delay (~250 ms). Pacing is presentation, so it
lives in App.svelte, untested (the tested loop invariant — forced actions are always
taken from `legalActions` output and reach ryuukyoku — is drive.test.ts' integration
walk, which iterates the same functions synchronously).

## Decision 5 — Table interactivity

Table stays stateless: it gains one optional callback prop, `ontap?: (tile: TileId) =>
void`, and renders East's 13 hand tiles and East's drawn tile as `<button>`s
(`aria-label="discard {kind}"`) that call it. No legality knowledge enters Table —
buttons are always rendered; an illegal tap reaches App, `tapDiscard` returns `null`,
nothing appends ("taps only *succeed* on legally discardable tiles" — a no-op is a
non-success). Alternative — pass `offered` down to disable illegal buttons — rejected:
it duplicates legality state into the view for a UX nicety no AC asks for; a later
polish ticket can add affordances.

The record stays in App: `let actions = $state<HandAction[]>([])` beside the existing
`seed`, `table = $derived(foldRecord({ seed, actions }))`, `offered =
$derived(legalActions(table))`. Appending mutates the `$state` array; the fold re-derives
— the architecture's "re-derive by folding after every action", literally.

## Test strategy (detailed in plan.md)

- **`src/app/drive.test.ts`** — the AC's app test. Units: `tapDiscard` returns the
  offered element itself (`toBe`), rejects a held-but-unoffered tile (doctored list),
  rejects during draw offerings / other seats' turns / ended hands; `forcedAction`
  forces draws for every seat, picks the tsumogiri (last) discard for bots, defers the
  player's discard, halts on `[]`. Integration: a full seed-1 hand driven by exactly
  these two functions — every append an element of a fresh `legalActions` fold — runs
  deal → ryuukyoku in 140 actions, bots' ponds all-tsumogiri, `legalActions` empty at
  the end.
- **`src/app/app.ssr.test.ts`** — additions only: East's hand tiles and drawn tile
  render as labeled discard buttons (tappable surface exists); existing suites must
  stay green (research: token regex and wind-count constraints are unaffected by
  buttons and `discard {kind}` labels).

## Rejected wholesale

- **jsdom/happy-dom + fireEvent component tests** — new test infrastructure for one
  binding line; the pure-seam design makes it unnecessary.
- **Persisting the record to localStorage** — a later ticket; nothing here blocks it
  (the record is already the single serializable authority).
- **Any wall-count or phase logic in the app** — ryuukyoku is consumed as `offered
  .length === 0` for the loop and `table.phase` for the view, both reads off core.
