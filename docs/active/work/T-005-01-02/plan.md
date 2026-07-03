# T-005-01-02 — tenpai-waits — Plan

Ordered, independently verifiable steps; each commits atomically. Verification runs
through the pinned toolchain: `just test` (vitest over src/), `just check`
(svelte-check + tsc). Baseline before step 1: both green at HEAD (`6f96208`).

## Step 1 — the module: waits.ts + barrel line

**Do**: create `src/core/waits.ts` per structure §waits.ts — role comment with the
exhaustion convention, private `visibleCounts` (concealed + meld `own` + `claimed`
via kindOf), `TENPAI_TILE_COUNT`/`MAX_MELDS` constants, `waits()` (guards → counts →
34-kind loop with the ≥ 4 skip → isAgari probe per kind), `isTenpai()` emptiness
read. Add `export * from './waits'` to `src/core/index.ts` after the agari line.

**Verify**:
- `just check` — 0 errors (types compose from existing exports only).
- `just test` — full suite green, in particular purity.test.ts now scanning
  waits.ts (imports `./tiles`, `./agari`, type-only `./record` — all legal) and the
  barrel-drift checks if any exist.
- Smoke by hand (scratch, not committed): waits of `23m456p789s11z55z`… n/a — smoke
  moves to step 2's fixtures; step 1's verification is compile + gates only.

**Commit**: `T-005-01-02: waits.ts — visible-count filter + 34-kind completion loop`

## Step 2 — fixture suites (contract locked first)

**Do**: create `src/core/waits.test.ts` with the header comment, the `h()` copy, and
the four fixture describes from structure §3–6 — wait shapes (tanki, ryanmen,
kanchan, penchan, shanpon, junsei chuuren 9-wait, cross-suit ascending-order pin),
special forms (chiitoitsu single wait, kokushi 13-sided and single-wait), exhaustion
convention (concealed 1111m producer, ankan-blocked ryanmen, all-waits-exhausted
noten via pon + tanki), contract (garbage-noten, both RangeError messages, > 4
melds, purity incl. repeat-call equality, isTenpai). Fixture melds are hand-built
REAL melds (correct kinds/ids) — no FAKE_MELDS import; every expected list derived
in a comment from the rules, never from module output.

Hand-derivation obligations while writing (recorded here so review can spot-check):

- `1111m234m567m999p` (13): 1m completes structurally (11111 → 111+11) but visible
  = 4 ⇒ excluded; 4m completes (44 pair, 111+123+567+999) with 1 visible ⇒ waits
  exactly [4m]. Confirm no other kind completes by scanning pair candidates.
- ankan 1m + `23m456p789s11z` (10): structural ryanmen [1m, 4m]; 1m visible = 4 via
  the meld ⇒ [4m].
- pon 5z + pon/chi ×3 + `[5z]` (1): tanki 5z, visible = 4 ⇒ [] and isTenpai false.
- junsei chuuren `1112345678999m`: waits = all nine m ranks (classic result; derive
  at least 1m, 5m, 9m explicitly in the comment, assert the full nine-list).
- kokushi 13 distinct kinds: waits = the 13 kokushi kinds exactly (no other kind
  can complete a 13-orphan hand missing nothing).

**Verify**: `just test` — new fixtures green alongside the full suite; any red here
is a convention or derivation error to resolve BEFORE generators exist (deviation
gets documented in progress.md if the module, not the fixture, is wrong).

**Commit**: `T-005-01-02: wait-shape, special-form, and exhaustion fixtures`

## Step 3 — meld-aware builders + property suites

**Do**: append to waits.test.ts per structure §2/§7:

- `mkMeld` — one Meld of a chosen form (pon / chi / ankan at minimum; ids via
  `tileId(kind, copy)` with copies threaded from the caller's budget).
- `buildTenpaiParts(meldCount, formChoices, setChoices, pairChoice)` — shared
  34-slot budget; meld sets drawn and materialized first (ankan consumes 4),
  then 4 − meldCount concealed sets + pair, -01 buildWinner's mod-index style (no
  rejection loops). Returns `{ concealed14, melds }`.
- Arbitraries: `tenpaiPartsArb` (meldCount 0–4), `winnerMinusOneArb` (drop index).
- Properties:
  1. builder self-test: budget ≤ 4/kind everywhere (counting concealed + meld
     tiles), `concealed14.length === 14 − 3·meldCount`, `isAgari(concealed14,
     melds)` — anti-vacuity for everything downstream (~200 runs).
  2. winner-minus-one: (a) if the removed kind's visible count in the 13-hand +
     melds is < 4, `removed ∈ waits` — construction-guaranteed, oracle-free;
     (b) full biconditional over all 34 kinds: `k ∈ waits ⇔ visible(k) < 4 ∧
     isAgari([...hand13, k], melds)` with test-local visible counting written
     inline (not imported from the module — waits.ts's helper is private anyway);
     (c) result strictly ascending in kindIndexOf (~300 runs).
  3. random 13-tile multiset draws (meld arity 0): same biconditional; plus
     `isTenpai ⇔ waits.length > 0` (~300 runs).

**Verify**: `just test` full suite green; suite wall-time still ~1s-scale (the
property layer adds ≈ 800 × 34 decompose probes ≈ well under the -01-measured
budget); `just check` 0 errors.

**Commit**: `T-005-01-02: property suite — meld-aware winners, minus-one waits, biconditional`

## Step 4 — final gates + handoff

**Do**: full `just test` + `just check` run; write progress.md final state and
review.md (changes, coverage assessment, gaps, open concerns — incl. the convention
choice as a flagged human-review item and the concurrent -03 barrel note).

**No commit of src beyond step 3**; docs/active/work artifacts ride along per repo
convention (work artifacts are committed — -01's are in history).

## Testing strategy summary (what the AC maps to)

| AC clause | Where verified |
|---|---|
| every kind in waits completes agari | property 2b/3 biconditional (⇒ direction) |
| every kind outside waits does not | same biconditional (⇐ direction) + fixtures |
| noten hands return empty waits | property 3 negatives + garbage fixture |
| exhausted kinds per documented convention | D2 doc in waits.ts + three exhaustion fixtures + visible<4 term in the biconditional |
| random hands | fc generators at meld arity 0–4 (winners) and 0 (multiset draws) |

## Risks / contingencies

- **Fixture derivation error** (my hand-math wrong): the property biconditional
  will contradict the fixture; trust the rules re-derivation, fix the fixture, note
  in progress.md.
- **Builder can't reach some meld forms cheaply** (shouminkan/daiminkan ids need
  from/claimed bookkeeping): pon/chi/ankan cover both content classes that matter
  (3-copy and 4-copy consumption); the remaining kan forms differ only in
  claimed/own split, which visibleCounts sums identically — acceptable narrowing,
  document in review.md.
- **Suite runtime blowout**: drop property 2/3 to 200 runs before touching module
  code; the -01 measurements make this unlikely.
- **Concurrent -03 lands a barrel line first**: pure additive conflict on
  index.ts; re-place our line after theirs and recommit (file lock serializes).
