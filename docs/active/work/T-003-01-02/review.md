# T-003-01-02 — Review: legal-actions-surface

Self-assessment and handoff. The engine's public contract now has both halves:
`foldRecord` (log in → state out, T-003-01-01) and `legalActions` (state in →
offered actions out, this ticket), locked together by an agreement suite. Bots,
hints, the app's input wiring, and T-003-01-03's random-legal-sequence generator
can now consume legality from core instead of inventing it.

## What changed

Two commits (`6144c32`, `9d38ae1`); two files created, one line added to the
barrel; nothing deleted; `record.ts` — the freshly-frozen step — never touched.

### `src/core/legal.ts` (created, ~50 lines)

One export: `legalActions(state: TableState): HandAction[]`. A closed-form
enumeration read off `phase` / `turn` / `drawn` / `hands[turn]`:

- ended hand (`phase !== 'playing'`) → `[]`;
- `drawn === null` → the turn seat's single `{type:'draw'}`;
- `drawn !== null` → 14 discards: the 13 hand tiles in hand order (stable — hands
  are draw-ordered, never sorted), then the drawn tile last.

Deliberately an *independent* statement of the turn cycle, not derived from
`applyAction` (design.md rejected oracle-filtering and validator-sharing precisely
because either would make the AC's agreement test compare the step with itself).
Contract comments freeze: pure read, fresh array + fresh action literals per call,
deterministic order, trusted-state precedent (no validation of hand-built states),
and the extend-only widening note for calls/riichi/agari.

### `src/core/index.ts` (modified)

One line, `export * from './legal'`, satisfying the AC's barrel-export clause.

### `src/core/legal.test.ts` (created, ~270 lines)

The agreement suite, 8 tests. Helpers mirror `record.test.ts` per-file convention
(`dealtLive` / `tsumogiriRecord` / `maximalRecord`, plus `prefixArb` — seed ×
0–70 turns × optional dangling draw, reaching pre-draw, post-draw, and ended
states); every expectation derives from the frozen upstream contracts, never from
the code under test. Importing `legalActions` from `./index` doubles as the
barrel-export check.

## Test coverage, AC by AC

- **"exported from the core barrel"** — the suite imports it from `./index`;
  `just check` and the purity gate keep the barrel honest.
- **"every action legalActions returns is accepted by the step function, across
  many seeds and log prefixes"** — soundness property over `prefixArb`: each
  offered action, appended to its prefix, folds without throwing. Completeness is
  covered from the other side by the closed-form properties: pre-draw states offer
  exactly the singleton draw; post-draw states offer exactly 14 discards whose
  tiles are `hands[turn] ∪ {drawn}` in the specified order.
- **"sampled actions outside the returned set throw"** — two layers: a property
  sampling one-rule-outside negatives per prefix (wrong-seat draw/discard,
  out-of-sequence draw/discard, tiles from another hand / dead wall / live wall /
  own pond — each asserted both absent from the set and thrown as `RangeError`),
  plus an exhaustive partition at frozen seed 1: all 548 encodable candidates
  (4 draws + 4×136 discards) split exactly into offered ⇒ folds / outside ⇒
  throws, at pre-draw (1 offered), post-draw (14), and ended (0) anchors.
- **"an ended (ryuukyoku) state returns no legal actions"** — dedicated property
  over arbitrary seeds, re-confirmed by the partition's ended anchor.

House invariants re-proven for the new surface: purity (state deep-equals a
`structuredClone` snapshot after the call) and freshness (repeated calls are
`toEqual` but not `toBe`, down to per-index action objects).

**Gates**: `just test` 75/75 green (67 pre-existing + 8 new), `just check`
0 errors / 0 warnings, `just build` single-file gate OK (dist/index.html 40.5 kB,
self-contained — unchanged by a core-only addition).

## Coverage gaps (accepted, with owners)

- **Random tedashi walks** — all property prefixes are tsumogiri-shaped (the house
  pattern: predictable from the deal alone). Post-draw states still exercise all
  14 discard offerings, but no test *folds* long random tedashi sequences through
  `legalActions`-driven play; that generator is explicitly T-003-01-03's charter
  and now has the surface it needs.
- **Two statements of one rule** — the turn cycle now lives in both `applyAction`
  and `legalActions`, by design. The lock is the agreement suite plus
  T-003-01-03's random walks; any future rule change (calls, riichi) must touch
  both files and will fail these tests if it touches only one.
- **The 548-candidate space is today's vocabulary** — when `HandAction` widens,
  the partition test's candidate enumeration must widen with it or it silently
  under-claims exhaustiveness. Flagged in the test's comment ("every draw/discard
  the encoding can express").

## Open concerns for a human reviewer

- **Order as contract**: the doc comment promises hand-order-then-drawn-last and a
  test pins it. This makes the *order* (not just the set) observable API — bots
  and the T-003-01-03 generator may sample by index, which is the point, but it
  means reordering the enumeration later is a breaking change. If that feels too
  strong, weakening the promise to "deterministic" is a one-comment, one-test
  change — do it before T-003-01-03 builds on it.
- **No record-shaped wrapper**: architecture.md's "log in → legal actions out" is
  satisfied by composition (`legalActions(foldRecord(record))`); design.md's
  rationale is the O(n²) re-fold cost for the consumers that actually exist. If a
  future consumer wants the record-shaped form, add a wrapper then.
- Nothing critical: no TODOs left in code, no deviations from plan (progress.md
  notes the one unused contingency — the sampled-negatives `it` never needed
  splitting).
