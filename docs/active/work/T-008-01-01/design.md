# T-008-01-01 — fu-calculation — Design

Options, tradeoffs, decision. Grounded in research.md.

## 1. Input shape: reuse `WinContext` or define a fu-local type?

**Option A — take `yaku.ts`'s `WinContext` verbatim.** It already carries exactly
`(decomposition, melds, winningKind, source, lastTile, seatWind, roundWind)` — the
ticket's "(winning decomposition, win context)" phrasing almost quotes its shape.

**Option B — define a separate `FuContext` in fu.ts.** Decouples fu from yaku.ts so
neither module depends on the other, but duplicates seven fields for no behavioral
gain — every field WinContext carries is one fu.ts also needs (fu needs `lastTile`?
No — checked: haitei/houtei affect YAKU, not fu. But `source` and `melds` and
`seatWind`/`roundWind` are all needed for tsumo/ron, open/closed, and pair-value
fu. Only `lastTile` goes unused by fu.ts, which is fine — WinContext's shape is a
superset, not a mismatch).

**Decision: Option A.** Import `type { WinContext } from './yaku'` — a type-only
import, so it doesn't create a runtime dependency, and it keeps one "everything
about one reading of a win" shape instead of two near-identical ones drifting apart.
This mirrors `yakuman.ts`, which imports `WinContext`'s sibling types (`WindKind`,
`YakuName`) from `yaku.ts` already — cross-module type reuse is the established
pattern; re-implementing PREDICATES locally (not re-implementing TYPES) is the
established pattern from research.md §2.

## 2. Wait-type ambiguity resolution

Per research.md §4, a single decomposition + winningKind can admit multiple valid
"which slot did the winning tile fill" attributions (tanki vs. kanchan when the pair
kind also anchors a run at the matching rank; shanpon vs. run-absorption when a
triplet's kind is also reachable through a run).

**Option A — enumerate every structurally-valid attribution, take the max total
fu.** Mirrors `concealedTripletCount`'s existing "favorable interpretation"
precedent (a ron-completed triplet is NOT downgraded when a run could equally have
absorbed the tile) and matches how real scoring tools (Tenhou, majsoul) resolve this
exact ambiguity — always score the player's most favorable legal reading.

**Option B — fix one canonical attribution order (e.g., "prefer run absorption over
triplet, prefer triplet over pair").** Simpler code, but arbitrary — and WRONG in
some cases relative to standard rules, which do maximize fu here (a kanchan/penchan
wait scores more than a tanki in isolation, but a tanki wait on a yakuhai pair with a
matching triplet elsewhere might outscore a kanchan; only exhaustive comparison is
correct for all shapes).

**Decision: Option A.** For the pair-vs-triplet-vs-run ambiguity, this reduces to a
small closed set of candidate "roles" for the winning tile within one decomposition
(never more than: tanki-if-pair-matches, triplet-completion-if-a-triplet-matches,
run-completion-for-every-run-containing-it), each fully determines a total fu
independently (set fu for all OTHER sets is attribution-independent — only the ONE
set/pair containing winningKind changes), so "compute all candidates, take max" is a
handful of arithmetic branches, not a search. This is the same shape as
`concealedTripletCount`'s existing adjustment, generalized from "triplet-or-not" to
"which structural slot."

## 3. Set fu / closed-vs-open determination

Concealed `triplet` sets are closed (anko) UNLESS the winning tile completed that
EXACT triplet by ron AND no run in the decomposition could have absorbed it instead
(the ron-adjustment from research.md §2, reused verbatim from
`concealedTripletCount`'s logic, but applied per-triplet for a fu RATE rather than
globally for a han-relevant COUNT). Concealed `run` sets always contribute 0 fu.
Melds map directly: `chi`→0, `pon`→open triplet, `daiminkan`/`shouminkan`→open kan,
`ankan`→closed kan — no ambiguity, melds are always fully determined by their type.

**Rejected alternative**: treating EVERY ron-completed triplet as open regardless of
run-absorption possibility. Rejected because it contradicts the already-shipped
`concealedTripletCount` convention this exact codebase established for the identical
structural question (favorable/ambiguous-resolves-to-player's-benefit) — diverging
would mean sanankou (han side) and fu (this ticket) disagree about whether the same
triplet is "concealed" for the same hand, which is incoherent within one scoring
pass even though the two modules don't call each other.

## 4. Pinfu-shape and kuipinfu special cases

Pinfu-shape (for fu purposes, NOT the yaku) = decomposition is `standard`, every set
is a `run` (concealed sets only — melds present at all means NOT this shape for fu
purposes, matching `yaku.ts`'s `pinfu` predicate's `melds.length > 0` rejection),
pair is not yakuhai (dragon/seat-wind/round-wind), and the winning tile completes a
run via `completesRyanmen`. This is computed structurally in fu.ts, independent of
whether the caller separately determines the `pinfu` YAKU fired — the ticket
forbids importing han/yaku names into this module, and the shape test is cheap to
re-derive (≈8 lines, same as `yaku.ts`'s own predicate).

Given pinfu-shape:
- Closed (`isMenzen`) + ron → fixed 30 (20 base + 10 menzen; the raw sum already
  equals exactly this, so "fixed" and "computed" agree — stated as fixed only to
  make the fixture-pinned invariant explicit, matching the AC's phrasing).
- Closed + tsumo → fixed 20 (raw sum would be 20 base + 2 tsumo = 22; this is the
  ONE case where the tsumo +2 does not apply — a named exception, not a rounding
  artifact).
- OPEN (any meld beyond ankan present) pinfu-shape + ron → raw sum is exactly 20
  (20 base, no menzen bonus, 0 everywhere else) → bumped to 30 by the kuipinfu
  convention (AC names this explicitly). Tsumo needs no special case: 20 + 2 = 22,
  rounds up to 30 through the ordinary round-up-to-10 rule — already correct without
  a named exception.

Implementation: rather than four special-cased branches, compute the RAW sum
generically first (base + menzen-ron + tsumo + set-fu + wait-fu + pair-fu, letting
open-pinfu-shape's every term legitimately evaluate to 0 except base), then apply
exactly two overrides in order: (1) closed pinfu-shape + tsumo forces 20 instead of
the generic 22, (2) if the raw total (after override 1) is exactly 20 AND the hand
is open, bump to 30 before rounding. This keeps the fu table itself
(`SET_FU`/pair-fu/wait-fu) the single source of truth and confines pinfu's
weirdness to two named overrides instead of duplicating the whole formula in a
branch — verified against all four AC fixtures in Plan.

## 5. Chiitoitsu and kokushi

Chiitoitsu: fixed 25, no other component, no rounding (25 is already the returned
value — never enters the round-up path). No wait/pair/set fu applies; the seven
distinct pairs and the always-closed, always-ron-or-tsumo-agnostic nature of the
form make every other component vacuous by rule, not by omitted code — stated
directly as a form-level early return.

Kokushi: fu is not applicable — yakuman price flat by han (13 han) regardless of
fu, and `AgariDecomposition`'s kokushi arm carries no `sets`/pair-in-the-fu-sense at
all. **Decision**: `fuOf` throws `RangeError` on a kokushi decomposition, mirroring
`decomposeAgari`'s and `yakuOf`'s existing precedent of throwing on
domain-inapplicable input rather than returning a meaningless number. (Rejected:
returning 0 or 20 — either invites a caller to silently multiply a real number by a
yakuman's fu, which is always a scoring bug.)

## 6. Rounding

`Math.ceil(raw / 10) * 10`, applied AFTER every override in §4, for every form
except chiitoitsu (which never reaches the rounding step — its 25 is a direct
return). Standard convention; no rejected alternative — round-HALF-up or
round-down are not standard riichi rules and no ticket or fixture calls for them.

## 7. Public API

```ts
export function fuOf(ctx: WinContext): number
```
One function, matching `standardYakuOf(ctx: WinContext): YakuName[]`'s shape exactly
— same input type, analogous "one reading in, one fact out" contract. No separate
exported helpers (wait-type, set-fu-of) — internal only, mirroring `yaku.ts`'s
module-private predicate table.
