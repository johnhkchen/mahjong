# T-003-01-03 — Research: turn-loop-property-suite

Descriptive map of what exists that this ticket builds on, where the relevant
machinery lives, and the constraints anything added must respect. No solutions here.

## The ticket in one line

Drive a random-legal-sequence generator off `legalActions` and prove the engine's
dynamics with fast-check: tile conservation at every log prefix, fold determinism,
guaranteed termination in ryuukyoku, and loud failure on randomly mutated (illegal)
sequences — dynamics the existing tsumogiri-shaped suites cannot reach.

## Where the relevant code lives

```
src/core/
  index.ts        # barrel: export * from tiles/rng/wall/dora/deal/record/legal
  record.ts       # HandAction, HandRecord, TableState, applyAction (private), foldRecord
  legal.ts        # legalActions(state): HandAction[] — the offered set, closed-form
  deal.ts         # Seat, SEAT_COUNT (4), STARTING_HAND_SIZE (13), DEAL_SIZE (52)
  wall.ts         # buildWall, partitionWall, LIVE_WALL_SIZE (122), DEAD_WALL_SIZE (14)
  tiles.ts        # TileId 0..135, TILE_COUNT (136), kind helpers
  record.test.ts  # fold entrypoint, step semantics, 9-case illegal-action throw matrix
  legal.test.ts   # agreement suite: offered ⇔ folds, 548-candidate partition
  purity.test.ts  # gate: runtime modules import only './sibling'; tests + vitest/fast-check/node:
```

Both halves of the public contract this ticket exercises already exist and are locked
to each other by `legal.test.ts` (T-003-01-02): `foldRecord` is the single authority
on what *folds*, `legalActions` the authority on what is *offered*, and the agreement
suite proves offered ⇒ folds and (sampled + one exhaustive 548-candidate anchor)
outside ⇒ throws.

## The dynamics as the engine defines them

`foldRecord({seed, actions})` builds the dealt table (wall → partition → deal → dora,
all frozen conventions) and applies each action through the module-private
`applyAction`. The turn cycle:

- `drawn === null` → the turn seat must draw; the tile comes from `live[0]` (the
  action records no tile — the wall is the authority).
- `drawn !== null` → the turn seat must discard: the drawn tile (tsumogiri) or a hand
  tile (tedashi — hand tile leaves, drawn tile is APPENDED to the hand, so hands stay
  draw-ordered and random play *permutes* hands over time, unlike tsumogiri).
- After a discard: if `live` is empty, `phase = 'ryuukyoku'`; else turn advances
  E→S→W→N. Ended phase ⇔ empty live wall.
- Anything else throws `RangeError` naming the action index.

Consequences that matter for this ticket:

- **Legal games have a fixed length.** Every legal action is a draw or a discard;
  draws consume exactly one live tile; the game ends on the discard following the
  70th draw (LIVE_WALL_SIZE − DEAL_SIZE = 70 post-deal live tiles). So every legal
  full game is exactly 140 actions — termination is structural, and a generator
  looping "while legal actions exist" has a provable hard bound.
- **The legal set is closed-form at every reachable state**: 0 actions (ended),
  1 (pre-draw), or 14 distinct discards (post-draw, 13 hand tiles in hand order +
  drawn last). A generator can sample by index; `legalActions` is deterministic and
  its order is documented as stable.
- **Conservation is a five-zone invariant.** `TableState`'s doc comment freezes it:
  "Every tile id lives in exactly one of hands / ponds / drawn / live / dead at all
  times." The AC phrases it "hands + ponds + live + dead" — at post-draw prefixes the
  drawn tile is held apart from the hand, so the checkable identity at *every* prefix
  necessarily includes `drawn` (the existing conservation test in `record.test.ts`
  already includes it). A design decision must make this interpretation explicit.
- **There is no public single-step API.** `applyAction` is module-private; the only
  way to advance state is to fold a longer record. Prefix-indexed checks therefore
  refold — O(n²) total applies for a 140-action game, ~10k array operations, cheap.

## What the existing suites already cover (and don't)

`record.test.ts` proves conservation, determinism, ryuukyoku, and a 9-case illegal
matrix — but every reachable state it folds comes from **tsumogiri-only** records:
hands never change, ponds are wall prefixes, expectations are derived directly from
the wall. `legal.test.ts` extends coverage to dangling-draw prefixes, still
tsumogiri-shaped. Nobody yet folds a record containing *tedashi*, so:

- hands that have been permuted/replaced by play are unreached,
- the tedashi branch of `applyAction` (splice + append) is exercised only by one
  seed-1 example test,
- the interaction of tedashi with conservation/determinism/termination is unproven.

That is exactly the gap the ticket names: "the exhibit a one-shot cannot reach."

## Test conventions the suite must sit among

- fast-check 4.8.0 + vitest 4.1.9; `just test` = `vitest run` (currently 81 tests,
  ~0.5s test time — budget matters, this suite folds full games repeatedly).
- House arbitraries: `seedArb = fc.integer({min: 0, max: 0xffffffff})`; helpers
  (`dealtLive`, `tsumogiriRecord`, `maximalRecord`) are mirrored per-file rather than
  shared through a helper module ("the record.test.ts helper, mirrored per-file per
  house convention" — legal.test.ts:41).
- Expectations derive from frozen upstream contracts, never from the code under test.
  A random-legal generator necessarily *drives* through `legalActions` + `foldRecord`;
  the properties it checks must be invariants (conservation, determinism, termination,
  throw-on-mutation), not value predictions — those stay in the existing suites.
- Illegal-action tests assert `RangeError`; negatives are built "one rule outside
  legality" and checked absent from the offered set first (legal.test.ts pattern).
- `purity.test.ts`: a new test file may import only `./sibling`, `vitest`,
  `fast-check`, `node:`. Its specifier regex also fires on quoted specifiers inside
  comments — comments must not contain `from '...'`-shaped text naming bare packages.
- Existing suites import from `./index` (legal.test.ts does this deliberately as the
  barrel-export check).

## Constraints and assumptions surfaced

- **Determinism of the generator itself.** fast-check supplies the randomness
  (choice integers); the engine's own rng is seeded. Nothing in the generator may use
  `Math.random` — replayability of a failing case is fast-check's shrinking story.
- **A mutation is only a counterexample if it is actually illegal.** Randomly
  changing a discard's tile can land on another held tile (still legal). The
  agreement suite's precedent: check the mutant against the offered set at its action
  point, and only assert `throw` for mutants outside it.
- **Runtime core is untouched.** The AC asks for tests only; `legalActions` and
  `foldRecord` already export everything needed. No new runtime module, no barrel
  change — unless design finds the generator worth sharing, but bots (the future
  runtime consumer of random play) are a later epic.
- **Budget**: property counts × full-game folds must keep `just test` in the
  low seconds; fast-check's default 100 runs per property is the reference point.

## What is *not* in scope (owned elsewhere)

- Bots/AI random play as a runtime module — future epic (stateless peripheral).
- Rendering, SSR — T-003-02-01 (sibling, touches src/app only).
- Calls/riichi/agari vocabulary — future epics; today's dynamics are draw/discard.
