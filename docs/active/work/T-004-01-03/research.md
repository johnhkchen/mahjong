# T-004-01-03 — legalactions-claim-offers-agreement — Research

Descriptive map of what exists, where, and how it constrains this ticket. No
solutions here; decisions live in design.md.

## The ticket in one line

Grow the OFFERED half of the public contract: after a discard, `legalActions`
enumerates each eligible seat's claims (pon/kan ordered before chi, chi variants
distinct, chi only by the seat whose left neighbor is the discarder), plus
ankan/shouminkan on the active turn — with the agreement
suite (legal.test.ts) keeping offer and fold locked together: every offered
claim folds, every non-offered claim candidate throws, deterministic order.

## Scope boundaries drawn by sibling tickets

- **T-004-01-01 (done)** delivered chi/pon fold semantics: `claimable` window,
  `mustDiscard`, per-seat `melds`, `applyClaim` with a frozen guard order
  (window → seat → tile → uses distinct → uses held → shape).
- **T-004-01-02 (done)** delivered the three kan forms: `applyDaiminkan` /
  `applyAnkan` / `applyShouminkan`, `kansMade` (derived from melds),
  `guardRinshanAvailable` (fifth kan / empty live wall), `applyKanTail`
  (kan-dora flip, rinshan draw into `drawn`, live tail into dead). Its review
  hands this ticket two facts: (a) `kansMade === doraIndicators.length - 1` by
  construction — the cheap identity if enumeration wants the count; (b) "the
  agreement suite still doesn't know calls exist" is THIS ticket's gap.
- **T-004-01-04** owns property-based generation over claims/kans in
  dynamics.test.ts ("no property-based generation over kans (T-004-01-04)" —
  -02 review). This ticket must keep dynamics.test.ts green but does NOT grow
  its generator into claims.
- No ticket has yet given the app UI for claims; App.svelte builds actions only
  from tapDiscard/forcedAction, so claims stay unreachable from the app even
  after this ticket offers them.

## legal.ts today (47 lines)

One function, `legalActions(state: TableState): HandAction[]`. Documented
closed form of the OLD draw/discard vocabulary:

- ended phase → `[]`;
- `drawn === null` → `[{type:'draw', seat: state.turn}]` — a single draw;
- `drawn !== null` → the 14 discards: 13 hand tiles in hand order, drawn last.

Documented properties this ticket must preserve: pure read (never mutates),
fresh array of fresh literals per call, same state → same set ("bots and
generators may sample by index"), and "extend-only, like the action vocabulary
it mirrors: call/riichi/agari tickets grow this enumeration".

**Two latent gaps the new fold vocabulary opened here:**

1. `mustDiscard` states (post-chi/pon, drawn === null): legalActions falls into
   the `drawn === null` arm and offers a DRAW — which the fold rejects
   ("draw out of sequence — owes a discard"). The offered set at these states
   is currently WRONG, not merely incomplete. Unreachable pre--01, reachable
   now.
2. Claim-window states (pre-draw, `claimable !== null`): the fold accepts
   chi/pon/daiminkan there, but legalActions offers only the draw — incomplete.
   Likewise post-draw states where the fold accepts ankan/shouminkan.

## The fold's claim/kan acceptance rules (record.ts, the other half of the lock)

What the step ACCEPTS — the enumeration must mirror exactly this, independently:

- **chi** (`applyClaim`): window open; seat === (window.seat + 1) % 4 only;
  tile === window.tile; uses distinct, both in the caller's hand; kinds form a
  run with the claimed kind (`isRun`: one numbered suit, three consecutive
  ranks). Honors can never be chi'd.
- **pon**: window open; any seat except the discarder; tile === window.tile;
  uses distinct, held; both uses' kinds === claimed kind.
- **daiminkan**: window semantics of pon; then rinshan availability
  (`kansMade < 4` AND `live.length > 0`); three distinct held uses, all of the
  claimed kind. (Window open implies live nonempty, documented; the live guard
  is a backstop.)
- **ankan**: turn seat; NOT mustDiscard; drawn !== null; rinshan availability;
  four distinct uses each held OR the drawn tile; all one kind.
- **shouminkan**: turn seat; NOT mustDiscard; drawn !== null; rinshan
  availability; tile held or drawn; the seat owns a pon of that kind (at most
  one can exist). The action records only the added `tile`.
- After a claim: turn jumps to the caller, window closes, `mustDiscard = true`
  (chi/pon) or the rinshan draw fills `drawn` (kans). A draw closes the window
  (staleness); an ended hand never holds a window.

Physical-copy arithmetic that bounds the offer space: 4 copies per kind, one in
the pond ⇒ at most ONE seat can ever pon a given discard (needs 2 of the
remaining 3), at most one can daiminkan (needs all 3), and a shouminkan target
pon leaves exactly one loose fourth copy. Chi is single-seat by rule. Multiple
offers per seat still arise: a pon-capable seat holding 3 copies has C(3,2)=3
uses pairs; a chi seat may have up to 3 run shapes and duplicate copies per
shape; two disjoint ankan kinds can coexist in 14 concealed tiles.

## The agreement suite today (legal.test.ts, 233 lines)

Structure this ticket extends:

- Per-file mirrored helpers (house convention): `seedArb`, `FULL_TURNS` (70),
  `dealtLive`, `tsumogiriRecord`, `maximalRecord`, `prefixArb` (random
  tsumogiri prefix, optional dangling draw). Note: every tsumogiri prefix with
  ≥1 turn and no dangle ends on a discard — i.e. prefixArb ALREADY generates
  claim-window states; the "pre-draw: exactly the single draw" property will
  become false the moment claims are offered.
- Suites: "the set is the closed form" (pre-draw = 1 draw; post-draw = 14
  discards, order pinned), "ended hand offers nothing", "offered actions fold"
  (every offered action appended → no throw), "outside actions throw" (sampled
  negatives + an exhaustive 548-candidate partition at seed-1 anchors:
  offered ⇒ folds, outside ⇒ throws RangeError), "purity and freshness".
- `keyOf` membership serializer: branches on `'tile' in action` — claim actions
  with `uses` would collide (a pon and a discard of the same tile already
  differ by type; but two pons differing only in uses would collide). The 548
  candidate space is draws + discards only.

## Consumers of legalActions that feel the growth

- **dynamics.test.ts** (turn-loop properties): `playRecord` drives every move
  from legalActions; a pre-draw set larger than 1 consumes a fc choice and
  could pick a claim. Its termination test asserts EXACTLY 140 actions and 70
  pond tiles; its mutant constructors narrow on draw/discard only ("the
  generator only emits draws and discards (legalActions offers no more yet)" —
  a comment that goes stale with this ticket); `assertMutantThrows` requires
  mutants be outside legality. Claims entering random play is T-004-01-04's
  charter, not this ticket's.
- **src/app/drive.ts**: `forcedAction` classifies by `offered[0]` and returns
  `offered[offered.length - 1]` as the bot tsumogiri — "the LAST offered
  discard, by legalActions' frozen hand-order-then-drawn-last contract". If kan
  offers append after the discards, the last ELEMENT is no longer the drawn
  tile's discard; a bot post-draw state holding four of a kind (reachable in
  real play) would return an ankan. Its doc comment also leans on "an offering
  is homogeneous — all draws or all discards", which stops being true.
  `tapDiscard` filters by type/seat/tile and is shape-robust.
- **App.svelte**: `offered = $derived(legalActions(table))`, actions appended
  only via tapDiscard/forcedAction — shape-robust except through forcedAction
  above. drive.test.ts pins `forcedAction(offered) === offered[0]` for draws
  and a full playthrough to ryuukyoku.

## Frozen test anchors available for reuse (record.test.ts)

House convention: frozen literals from scratchpad scans, derivation comments,
"never regenerate"; helpers mirrored per-file, anchors reusable by re-stating.

- Seed 1: East tsumogiris 100 (8s) → South chi 98+106; East tedashi 82 (3s) →
  South pon 81/83. Full deal literals for both hands are in the goldens.
- Seed 3 (RACE): North discards 42 (2p) → chi-able by East (47+37) AND pon-able
  by South (43/41) — the pon-over-chi race anchor.
- Seed 67: `kanPrefix67` ends with a discard of 91 claimable by seat 3 holding
  90/88/89 — a daiminkan-and-pon window; `shouminkanPrefix67` reaches a
  post-draw state where seat 3 owns the pon and holds 89 → shouminkan.
- Seeds 161/280: `ankanPrefix161`/`ankanPrefix280` reach post-draw states with
  four concealed copies (280's uses include the drawn tile 0..3 of 1m).
- Seed 101033: `fourKanChain()` — four kans made, fifth-kan negatives.
- Seed 280 `kanMaximalRecord280()` — kan-shortened hand to ryuukyoku; -02's
  illegal-kan matrix includes "ankan on the haitei draw" (empty live wall).

## Constraints and assumptions carried forward

- Two independent statements, one lock: legal.ts must NOT import guard logic
  from record.ts internals (applyClaim, isRun, kansMade are module-local and
  must stay so); the agreement suite is the only coupling.
- Enumeration purity/freshness/determinism properties already have teeth
  (structuredClone snapshot, fresh-literal identity checks) and extend as-is.
- `RINSHAN_TILE_COUNT` (4) is record.ts-local; `doraIndicators.length - 1`
  equals kans made, per -02.
- `just test` (156 tests), `just check`, `just build` all green at HEAD.
