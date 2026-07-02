# T-002-01-03 — Review: deal four starting hands

Handoff self-assessment. Code commit: `256efb3`.

## What changed

| File | Change | Summary |
| --- | --- | --- |
| `src/core/deal.ts` | created (70 lines) | The deal module: `Seat` (0–3, E/S/W/N dealer order), `SEAT_COUNT`, `STARTING_HAND_SIZE` (13), `DEAL_SIZE` (52, derived), `Deal { hands, live }`, and `dealHands(live)` — a pure function taking the 122-tile live wall and returning four 13-tile hands plus the 70-tile remainder, all fresh arrays. |
| `src/core/deal.test.ts` | created (104 lines) | Six tests: four fast-check properties (conservation, seat-order/4-4-4-1 map, determinism + fresh arrays, input purity), the length guard, and the seed-1 golden. |
| `src/core/index.ts` | modified (+1 line) | `export * from './deal'` — the new surface is public through the barrel. |

Nothing deleted; `wall.ts`/`tiles.ts`/`rng.ts`/`dora.ts` untouched. No app code, no
dependency changes, no ticket-frontmatter edits (lisa owns those).

## Decisions a reviewer should look at (design.md has full rationale)

1. **Frozen deal convention — the physical 4-4-4-1 procedure**, not contiguous 13-tile
   blocks: round r ∈ {0,1,2}, seat s takes `live[16r + 4s .. +3]`, then one single each
   (`live[48 + s]`); remainder `live.slice(52)`. Statistically identical to any other
   assignment, chosen for physical fidelity (T-002-01-02's dead-wall precedent). **This
   is now part of the replay format** — flagged in a CONTRACT FREEZE doc block and
   pinned by the golden; changing it later invalidates every stored seed.
2. **`Seat` introduced here** as `0 | 1 | 2 | 3` with documented E/S/W/N meaning —
   the minimal seat concept T-002-01-04's fold will re-export. No winds/rotation yet.
3. **Hands stay in draw order** — sorting is presentation; the record keeps the true
   sequence. Downstream shanten/render code sorts if it wants to.
4. **Strict guard**: exactly 122 tiles or `RangeError` (not merely ≥ 52) — dealing only
   happens from a full pre-deal live wall, so anything else is engine corruption.

## Acceptance criteria — status

The AC asks for a deal-conservation property test over random seeds with three clauses:

- **4×13 + dead wall + remaining live wall = exactly 136 distinct ids, no duplicates**
  — test #1, ∀ seed property over the full build → partition → deal chain. ✅
- **Hands arrive in E/S/W/N seat order** — test #2 pins each hand to the documented
  index map, which makes "East first, then S/W/N" concrete and freezes the convention
  itself, not just the ordering. ✅
- **Same seed → identical deal** — test #3, deep-equal across two chains with
  fresh-array (`not.toBe`) assertions. ✅

Verification: `just test` → 7 files, **44 tests passing** (was 43 before this ticket:
+6 new, and this count reflects the whole suite including purity and app SSR gates);
`just check` → 0 errors, 0 warnings.

## Test coverage assessment

- Every public behavior of `dealHands` is covered by a property or example test,
  including purity (input not mutated) and freshness of all returned arrays.
- The golden was **captured from two independent derivations** (literal index lists vs.
  the implementation; scratchpad script, per plan.md step 4), sanity-anchored to two
  already-frozen goldens (wall prefix `[64, 53, 95, 45]`, `wall[52]`), and
  **proven to bind** by a perturb-fail-restore check (progress.md).
- `purity.test.ts` auto-gates the new module (imports are `./tiles` + `./wall` only).
- Gap, accepted: properties run over *seeded* walls only, not arbitrary 122-tile
  arrays — fine because the guard test covers shape and the function does pure index
  arithmetic with no value-dependent branches.

## Open concerns / known limitations

- **None blocking.** Flagging for awareness:
- The `Deal.live` field name shadows the `WallPartition.live` concept (pre-deal 122 vs.
  post-deal 70). Deliberate — both mean "the live wall as of this state," and
  T-002-01-04's fold will carry the post-deal one forward — but if the fold review finds
  it confusing, renaming there (e.g. `wallAfterDeal`) is cheap *until* the fold's shape
  ships; after that it's public contract.
- `Seat` lives in `deal.ts`. If later tickets grow real seat semantics (winds,
  rotation), the type may deserve its own module; moving a type alias is
  API-compatible via the barrel.
- The dealer's 14th tile is intentionally NOT dealt (13 each) — it is the first draw of
  play, owned by the future turn-loop ticket. T-002-01-04 folding an empty action log
  should therefore yield 13-tile hands with a 70-tile live wall.

## What this unblocks

T-002-01-04 (hand-record-fold-entrypoint) — the last dependency edge into it is now
satisfied; its fold composes `dealHands(partitionWall(buildWall(seed)).live)` and
re-exposes `Deal`/`Seat` through the record contract.
