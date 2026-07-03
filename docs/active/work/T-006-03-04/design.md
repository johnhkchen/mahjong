# T-006-03-04 — determinism-termination-harness — Design

## The decision in one paragraph

A new core test file, `src/core/selfplay.test.ts`, holding a LEAN all-four-botted
driver (`selfPlay(seed)`) — the reference arbitration re-stated without the -02
sweep's per-step oracles — and three suites over it: a fixed corpus where every
seed is played TWICE and asserted byte-identical (serialized whole-record
comparison) and ended within ACTION_BOUND, with non-vacuity pinned across the
corpus (both end phases reached, calls folded, both win forms folded); a small set
of MINED ANCHORS freezing exact end facts for named seeds (log length, end phase,
winner/yaku) so arbitration drift is loud; and an fc-sampled layer extending both
properties across the full seed domain. `policy.test.ts` is left untouched.

## Question 1 — where does the harness live?

**Chosen: core (`src/core/selfplay.test.ts`).**

The AC says "drives all four seats via the policy" — the policy pair plus
legalActions plus foldRecord IS the subject; P5's determinism is an engine-level
property. The purity gate settles the rest mechanically: a core test cannot import
`src/app/drive.ts`, and nothing in drive.ts is needed to bot four seats — the
arbitration rule is frozen by legal.ts's offered order, and drive.ts merely
restates it around a human player.

Rejected — **app-level harness through drive.ts** (bot the PLAYER seat around
forcedAction's waits): forcedAction deliberately returns null at every player
decision, so the harness would have to re-state the player's policy consult and
feed it through settleWindow — re-deriving the same arbitration with extra moving
parts, in the wrong layer. The shipped driver's conformance to the reference
arbitration is already T-006-03-03's pinned ground (its walks run deal → end with
bots live, and its review states the wiring matches the sweep exactly). A future
attract-mode ticket, which must bot the player IN the app, is the natural home for
an app-level self-play walk; noted as a follow-up, not built here.

Rejected — **runtime `selfplay.ts` module exported from the barrel** (pre-building
attract mode's driver): the ticket says test-only, twice; dynamics.test.ts's
doctrine says the runtime consumer of self-play "is a later epic with their own
shape"; and a second runtime driver beside drive.ts would create a "which driver
is authoritative" question no current consumer needs answered.

## Question 2 — reuse playPolicy or re-state the driver?

**Chosen: an independent lean re-statement (~45 lines) inside the new file.**

- Extraction into a shared helper is structurally awkward: test files may import
  only same-directory siblings plus tooling, so sharing means a non-test core
  module holding test-only code — blurring the "core is big in tests, never ships
  them" boundary for ~45 lines of loop.
- playPolicy's body is dominated by -02's per-step oracles (re-scoring every
  offered discard, re-deriving the claim cut and anchor); the harness deliberately
  does NOT want them — they are the policy suite's subject and they cost ~10× the
  driver itself. Leaning playPolicy in place would weaken -02's pins.
- Independent statements locked by tests is the codebase's core doctrine
  (legal.ts vs record.ts). The lock here: the driver appends only membership-
  checked offered elements (so any drift still folds legally), and the mined
  anchors freeze its end-to-end behavior — a drift in the re-stated arbitration
  changes a frozen literal loudly.

The lean driver keeps exactly TWO per-step guards, both cheap and both about the
harness's own soundness rather than policy correctness: the chosen action must be
an element of the offered set (`legal.includes(chosen)` — reference identity, the
policies' contract), and the action count must stay under ACTION_BOUND (the
termination tripwire, thrown not expected, per sweep doctrine).

## Question 3 — what is compared "byte-identically"?

**Chosen: `JSON.stringify` of the WHOLE HandRecord (seed + actions), compared as
strings.** Two independent `selfPlay(seed)` runs can never share references
(legalActions returns fresh literals), so identity is the wrong instrument;
structural `toEqual` is what the rehearsal already does; the AC's "byte-identical
action log end to end" asks for the serialized artifact. Key order is
deterministic — every action literal is built by legalActions with fixed key
order, and the record shape is `{seed, actions}` built here — so stringify is a
faithful byte encoding. On mismatch the failure names the seed via the sweep's
plain-throw convention (a raw string diff of ~150 actions is unreadable; the
throw carries the first diverging index, computed on failure only).

Rejected — comparing only `actions` arrays with `toEqual`: that is the -02
rehearsal verbatim; the harness should be strictly stronger, and serialization is
also what localStorage persistence and bug-report logs will actually round-trip.

## Question 4 — corpus shape, scale, and non-vacuity

**Chosen: a fixed literal corpus of 40 seeds (0..39), every seed double-played;
plus an fc layer of 10 sampled seeds over the full [0, 2^32) domain.**

Arithmetic: the oracle-laden playPolicy costs ~90ms/seed; the lean driver drops
the ~14-shanten-calls-per-discard oracle, so ~30–50ms/run is the estimate. 40
seeds × 2 runs + 10 fc × 2 runs = 100 runs ≈ 3–5s, comfortably inside the 60s
contention-proof timeout convention. If implement-time measurement differs badly,
the corpus shrinks/grows to hold the ~5s isolated runtime — the corpus size is a
runtime budget, documented as such (the -02 precedent).

Non-vacuity (pinned facts, never statistics — the dynamics.test.ts doctrine):
across the corpus the harness asserts (a) BOTH end phases occur — at least one
agari and at least one ryuukyoku — so termination is never proven on trivial
games alone; (b) at least one claim folds (the call branch and its arbitration
actually ran); (c) both win forms occur — at least one tsumo and at least one ron
— so the atamahane path and the tsumo path are both inside the replayed corpus.
If mining shows 0..39 misses one of these, the corpus WIDENS until it holds them
(the documented rule: widen the corpus, never weaken the check). (c) is the one
most at risk — the -02 review notes rons may be rare; implement mines first and
widens deliberately.

Mined anchors: 3 corpus seeds with diverse ends (one ron-agari, one tsumo-agari,
one ryuukyoku) get exact frozen facts — action count, end phase, and for wins the
winner/by/tile-kind — double-keyed against the fold's own derivation (the win
facts are read from the folded end state, so the literal pins arbitration
stability while the fold guarantees internal consistency). These are the drift
alarm for the re-stated driver AND for any future policy/legal change: a strength
ticket that changes bot behavior re-mines them consciously.

## Question 5 — what does the driver assert about ends?

The loop ends exactly when `phase === 'agari'` or the offered set is empty
(ryuukyoku with no houtei ron); a ryuukyoku state WITH houtei rons continues one
step — callPolicy takes the ron unconditionally and the fold lands agari (the
only ended→ended transition). The per-seed assertions are then: end phase is a
member of {'agari', 'ryuukyoku'} (the AC's "reaches an ended phase"), and
`actions.length ≤ ACTION_BOUND` stated as an explicit expect (the AC's "within
the bounded turn count" made visible, beyond the driver's own tripwire throw).

Rejected — asserting the two runs' folded END STATES deep-equal: identical
records imply identical folds by the fold-determinism suite (record.test.ts);
re-asserting it here is redundant coverage of another module's pin.

## What is deliberately NOT in scope

- No changes to `policy.ts`, `legal.ts`, `record.ts`, `drive.ts` — the harness is
  a pure consumer; if it finds a bug, the fix is its own commit against the
  owning module's suite.
- No runtime self-play export, no attract-mode wiring, no difficulty hooks.
- policy.test.ts's rehearsal tests stay: they are -02's AC pins (oracle-focused),
  narrow by design; the harness supersedes their breadth, not their depth. The
  one-line rehearsal comments referencing T-006-03-04 stay true (it WAS the
  rehearsal).
- No cross-process determinism claim: two in-process runs plus the frozen-
  convention suites are the honest statement; the header documents this.

## Risks

- **Corpus runtime growth**: shanten over every bot discard decision is the cost
  center; 40 seeds is ~5s today but a future policy strengthening (ukeire) could
  multiply it. Mitigation: the corpus-size comment states the budget and the
  knob.
- **Anchor brittleness by intent**: any behavior-changing policy/legal ticket
  breaks the mined anchors. That is their job; the header says "re-mine
  deliberately, never loosen."
- **fc layer flake surface**: a pathological sampled seed that runs long is
  bounded by ACTION_BOUND and the 60s timeout; numRuns 10 keeps the layer light.
