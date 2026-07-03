# T-006-02-02 — chiitoi-kokushi-min-combinator — Research

Descriptive map of what exists and where this ticket's work lands. No proposals.

## 1. The ticket, verbatim

`shanten(hand, melds)` returns `min(standard, chiitoi, kokushi)`; tests show a
seven-pairs hand and a thirteen-orphans hand each score lower via their own form
than via standard decomposition. Depends on T-006-02-01 (done — `standardShanten`
lands in `src/core/shanten.ts`, `db1a388`).

## 2. `src/core/shanten.ts` — current state

Exports one function today: `standardShanten(concealed, melds): number`. Internals:

- `countsOf(concealed)` — private 34-slot kind-count builder (TILE_KINDS order).
- `MAX_MELDS = 4`, `TENPAI_TILE_COUNT = 13`, `AGARI_TILE_COUNT = 14` — private
  constants.
- `bestValue(counts, from, blocksLeft, headFree)` — the block-count backtracker;
  private, mutate-recurse-restore on a borrowed array.
- `standardShanten` — the public face: validates melds ≤ 4 and arity (13 or 14
  minus 3·melds concealed tiles), throws `RangeError` naming both accepted counts
  on mismatch, else `8 − 2·melds − bestValue(...)`.

The module's header comment (lines 1-21) already reserves the plain `shanten` name
for this ticket's combinator and states the KIND-level/arity-only conventions
inherited from `agari.ts`. `shanten.test.ts` (18 tests, 6 describe blocks) pins
`standardShanten` fixtures only; one fixture (`1122m3344p5566s7z` → standard
shanten 3) has a comment explicitly noting chiitoitsu reads the SAME hand as
tenpai (0) — "that is T-006-02-02's combinator, and exactly why standardShanten
must NOT [fold chiitoi in]."

## 3. `src/core/agari.ts` — the chiitoitsu/kokushi precedent

`decomposeAgari` already implements both forms as 14-tile, zero-meld-only reads:

- `chiitoitsuOf(counts)`: exactly seven distinct kinds, each count === 2 exactly
  (a count of 4 is NOT two pairs — fails the `!== 2` test by rule). Returns
  `{form:'chiitoitsu', pairs}` or `null`.
- `KOKUSHI_KIND_INDEXES` — private array of the 13 terminal/honor kind indices:
  `[0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33]` (1m, 9m, 1p, 9p, 1s, 9s, then
  1z-7z). Matches `TILE_KINDS` ordering (`buildKinds` in `tiles.ts`): numbered
  suits 1-9 each, then honors 1z-7z.
- `kokushiOf(counts)`: all 13 kokushi kinds present (count ≥ 1), one of them at
  count === 2 is the pair. Returns `{form:'kokushi', pair}` or `null`.

Both are **agari predicates** (win or not), not shanten counters — they answer
the 14-tile complete case only, and are private to `agari.ts` (not exported).
This ticket needs the shanten (distance) generalization of the same two forms,
not these functions directly. The `countsOf` builder is duplicated per module by
established convention (agari.ts, waits.ts, shanten.ts each hold their own private
copy — flagged in T-006-02-01's review.md §4 as a known, deliberately deferred
cleanup item, not to be fixed incidentally here).

## 4. `src/core/waits.ts` — chiitoitsu/kokushi wait fixtures (sanity anchors)

`waits.test.ts` has a `describe('chiitoitsu and kokushi waits', ...)` block with
independently-pinned tenpai fixtures useful as cross-checks for this ticket's
shanten-0 cases:

- `'1122334455667m'`-shaped six-pairs-plus-single hands wait on the single kind
  (chiitoitsu tenpai).
- Four-of-a-kind does NOT read as two chiitoitsu pairs — noten.
- All-13-kokushi-kinds-once (13 tiles) waits on all 13 kinds (kokushi 13-sided,
  the maximal wait).
- 13 kokushi kinds with one doubled minus one missing kind (i.e., 12 distinct +
  1 duplicate) waits on the single missing kind.

These pin shanten=0 boundary cases once this ticket's chiitoi/kokushi shanten
functions exist: `waits().length > 0 ⟺ shanten === 0` is exactly the biconditional
T-006-02-03 formalizes as a property, but the individual fixtures here are usable
as example-based cross-checks now (the standardShanten precedent already borrows
waits.test.ts fixtures in comments).

## 5. `src/core/tiles.ts` — the domain

`KIND_COUNT = 34`, `TILE_KINDS` in canonical order (1m-9m, 1p-9p, 1s-9s, 1z-7z),
`kindIndexOf(kind)`. Import-free, foundation module — nothing to change here.

## 6. `src/core/record.ts` — `Meld`

Discriminated union (`chi`/`pon`/`daiminkan`/`shouminkan`/`ankan`), each variant
carrying `own: readonly TileId[]` of fixed arity. `standardShanten` and
`decomposeAgari` both read melds for **`.length` only** — this ticket's new code
will do the same, since chiitoitsu/kokushi are additionally constrained to
**zero melds by rule** (any call breaks both forms — stated explicitly in
`agari.ts`'s `AgariDecomposition` doc comment).

## 7. Downstream consumers (what the combinator must serve)

- **T-006-02-03** (`brute-force-reference-property-tests`, depends on this
  ticket): property-tests `shanten` (the combinator) against an independent
  brute-force oracle, plus `shanten === 0 ⟺ waits().length > 0`. Only consumes
  the top-level `shanten` export — no mention of needing chiitoi/kokushi shanten
  individually.
- **T-006-03-01** (`discard-policy`, depends on this ticket + T-006-01-01/seatView):
  picks the shanten-minimizing discard over `SeatView`'s offered legal actions.
  Also only names `shanten`/the policy, not the sub-forms.

No ticket in the visible backlog (`docs/active/tickets/*006*`) references a
chiitoitsu-specific or kokushi-specific shanten export by name. The AC's own
phrasing — `shanten(hand, melds) returns min(standard, chiitoi, kokushi)` — names
one function.

## 8. Well-known formulas (external domain knowledge, not yet in this codebase)

Standard closed-form shanten formulas for the two special forms (used by
essentially every reference shanten calculator; no equivalent exists in this repo
yet, so this is domain knowledge, not a codebase fact):

- **Chiitoitsu**: `6 − pairs + max(0, 7 − kinds)`, where `pairs` = count of kinds
  with `count ≥ 2` (naturally ≤ 7 since a 13/14-tile hand can't hold 8 pairs), and
  `kinds` = count of distinct kinds present (also naturally ≤ 13). The second term
  penalizes hands with duplicate-heavy kinds (e.g. four-of-a-kind) that have pairs
  but too few DISTINCT kinds to ever reach seven pairs without breaking one down.
- **Kokushi**: `13 − kinds − hasPair`, where `kinds` = count of the 13
  terminal/honor kinds present at least once, `hasPair` = 1 iff any kokushi kind
  is present at count ≥ 2, else 0.

Both are concealed-hand-only (melds.length must be 0) and read the 13-or-14-tile
concealed arity identically to `standardShanten`'s zero-meld case — no new arity
math needed beyond what `TENPAI_TILE_COUNT`/`AGARI_TILE_COUNT` already express.

## 9. Constraints and open questions for Design

- Whether chiitoitsu/kokushi shanten become their own exported functions or stay
  private helpers folded only into `shanten` — `bestValue` is private and
  `standardShanten` is the sole public face for the standard form; whether the
  same single-face discipline applies here, given no downstream ticket names the
  sub-forms.
- How the combinator's arity validation composes: `standardShanten` already
  throws on bad arity/melds; the two new forms only apply at `melds.length === 0`
  and share that same arity. Avoiding duplicate/inconsistent RangeError messages
  across three internal computations is a Design-phase question.
- Whether to hand-roll two new backtrack-free counting passes (chiitoi/kokushi
  are O(34) linear scans, not backtracking problems — much simpler than
  `bestValue`) or attempt to reuse `agari.ts`'s `KOKUSHI_KIND_INDEXES` (private,
  not exported — reuse would require exporting it, a small cross-module coupling
  decision).
