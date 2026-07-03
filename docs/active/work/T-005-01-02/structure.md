# T-005-01-02 — tenpai-waits — Structure

The blueprint: files, module boundaries, internal organization, change ordering.
No code — shapes and responsibilities.

## Files

| File | Change | Content |
|---|---|---|
| `src/core/waits.ts` | NEW (~90 lines) | the waits derivation + isTenpai |
| `src/core/waits.test.ts` | NEW (~350 lines) | fixtures + meld-aware property suite |
| `src/core/index.ts` | +1 line | `export * from './waits'` (after `./agari`) |

Nothing else moves. agari.ts, record.ts, legal.ts stay closed; purity.test.ts's glob
gate covers waits.ts automatically (imports: `./tiles`, `./agari`, type-only
`./record` — all same-directory, gate-legal).

## src/core/waits.ts — internal organization

Top-to-bottom, matching core's established module anatomy (role comment → private
helpers → constants → public face):

1. **Module role comment** — waits as the datum ron offers, furiten gating, and
   tenpai teaching read; consumer of agari.ts (never re-derives decomposition);
   the exhaustion convention stated up front: a kind all four of whose copies are
   visible to the hand itself (concealed + own melds, claimed included) is never a
   wait — one list serves all three readers; other seats' visible tiles deliberately
   out of scope (live-tile counting is a table-visibility concern, not shape).

2. **`visibleCounts(concealed, melds): number[]`** — private. Fresh 34-slot count
   array over the concealed kinds PLUS every tile of every meld: `own` always,
   `claimed` when the form has one (chi/pon/daiminkan/shouminkan), mapped through
   `kindOf`. This is waits' own counts helper — agari.ts keeps its `countsOf`
   private (concealed-only, different signature); no sharing, per convention.
   Doc note: this is the one place in core so far that reads meld CONTENT — the
   contrast with agari's arity-only posture is called out.

3. **`TENPAI_TILE_COUNT = 13`** — private constant; the waiting hand is one tile
   short of AGARI_TILE_COUNT. `MAX_MELDS = 4` restated locally (agari.ts's is
   private; a one-line constant is below the export bar).

4. **`waits(concealed: readonly TileKind[], melds: readonly Meld[]): TileKind[]`** —
   the module's face. Contract doc covers: input is the between-turns hand (13 −
   3·melds kinds, NO drawn/claimed tile); melds > 4 or wrong concealed arity throws
   RangeError naming both numbers in waits' own 13-based message; result is every
   physically completable kind in ascending TILE_KINDS order (frozen contract, the
   decomposeAgari precedent); empty result IS the noten signal — including the
   all-waits-self-exhausted hand; pure read (inputs unmutated, fresh array, same
   input ⇒ same output). Body: guards → visibleCounts once → loop k over 0..33,
   `continue` when `counts[k] >= COPIES_PER_KIND`, else `isAgari([...concealed,
   TILE_KINDS[k]], melds)` → push `TILE_KINDS[k]`.

5. **`isTenpai(concealed, melds): boolean`** — the emptiness read of waits, one
   line, mirroring isAgari's relationship to decomposeAgari.

Public surface: exactly `waits` and `isTenpai`. No types are introduced — the
signature is composed entirely of existing exports (TileKind, Meld).

## src/core/waits.test.ts — internal organization

Header comment: fixtures carry independence (hand-derived expected lists; the
property oracle is the -01-verified decomposer, and the implementation runs the same
loop — stated openly). Imports from `./index` (barrel, like agari.test.ts) plus
vitest/fast-check.

1. **`h(spec)`** — mpsz shorthand, copied from agari.test.ts (second copy; the
   extraction bar is three, per -01's review).

2. **Meld-aware builders** (test-local):
   - `mkMeld(kind | runStart, form, copyBase)` — materialize one real Meld of a
     given form with ids via `tileId(kind, copy)`; chi takes a run start (claimed =
     lowest kind's next copy, own = the other two), pon/kan take one kind and 3/4
     copies. Seats/from values arbitrary but type-honest.
   - `buildTenpaiParts(meldCount, choices…)` — the -01 `buildWinner` pattern
     upgraded: one shared 34-slot budget array capped at COPIES_PER_KIND; draw
     `meldCount` meld sets (form chosen per choice index: pon / chi / ankan —
     ankan consumes 4 copies) materialized as Meld objects, then 4 − meldCount
     concealed sets and the pair as kinds. Returns `{ concealed14, melds }` — a
     14-tile winner with content-honest melds. Self-test property asserts budget
     respect and isAgari(concealed14, melds).
   - `winnerMinusOne` arbitrary — drop index into concealed14 ⇒
     `{ hand13, melds, removed }`.

3. **Wait-shape fixtures** (`describe('wait shapes')`) — each expected list derived
   in a comment: tanki (…tiles…22z waits [2z]… actually the single), ryanmen
   (23m ⇒ [1m, 4m]), kanchan (24m ⇒ [3m]), penchan (12m ⇒ [3m]), shanpon
   (22m33p ⇒ [2m, 3p]), a multi-wait composite, junsei chuuren 1112345678999m ⇒
   all nine m-ranks, ascending-order pin on a hand whose waits span suits.

4. **Special-form fixtures** (`describe('chiitoitsu and kokushi waits')`) —
   chiitoitsu six-pairs-plus-single ⇒ the single's kind only; the triplet-blocked
   chiitoitsu near-tenpai (222m + five pairs + single — 2m pair already used ⇒
   whatever standard/noten result derives by hand); kokushi 13-sided ⇒ all 13
   kokushi kinds; kokushi single-wait ⇒ 1 kind.

5. **Exhaustion-convention fixtures** (`describe('exhausted kinds')`) — the AC's
   named edge, one per producer:
   - concealed four-of-a-kind: `1111m234m567m999p` — 1m structurally completes
     (11111 = triplet + pair) but is excluded; waits = [4m] (derived by hand).
   - own-meld exhaustion: ankan 1m + concealed `23m456p789s11z` — ryanmen waits
     1m/4m structurally; 1m excluded ⇒ [4m].
   - all-waits-exhausted NOTEN: pon 5z + three other melds + concealed [5z] tanki
     ⇒ visible 5z = 4 ⇒ waits = [], isTenpai false — the documented convention's
     sharpest consequence, pinned.

6. **Noten and contract fixtures** (`describe('contract')`) — garbage 13-tile hand
   ⇒ []; both RangeError messages (wrong arity at 0 and 1+ melds, > 4 melds);
   purity (inputs unmutated incl. meld objects, repeat-call equality); isTenpai
   mirrors emptiness on a tenpai and a noten hand.

7. **Properties** (`describe('waits properties')`):
   - builder self-test (budget + winner validity, ~200 runs);
   - winner-minus-one: `removed ∈ waits(hand13, melds)` when its visible count
     < 4 (construction-guaranteed, oracle-free anti-vacuity), plus full 34-kind
     biconditional vs decomposeAgari + visibleCounts, and ascending-order check
     (~300 runs);
   - random multiset draws at meld arity 0 (13 tiles from the 136-pool):
     biconditional + noten ⇒ empty waits ⇒ isTenpai false (~300 runs). Meld-
     bearing negatives come from the winner-minus-one line (random content-honest
     melds are exactly what the builder makes; FAKE_MELDS-style stubs are unusable
     here — documented in the header).

## Ordering of changes

1. `waits.ts` complete (module compiles, purity-clean) + barrel line — one commit.
2. Fixture suites (§3–6) — one commit; module contract locked before generators.
3. Builders + property suites (§2, §7) — one commit.

Fixtures before properties: if a fixture exposes a convention error, the cheap
artifact changes first; the builders are the suite's largest moving part and land
last against an already-pinned contract.
