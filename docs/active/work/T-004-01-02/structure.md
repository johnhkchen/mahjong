# T-004-01-02 — kan-three-forms-rinshan-kandora — Structure

The blueprint: which files change, the internal shape of each change, and the
commit ordering. Decisions referenced by number are design.md's D1–D6.

## Files

| File | Change |
|---|---|
| `src/core/record.ts` | MODIFIED — the ticket's entire production surface (~150 lines: 3 action members, Meld union, 2 TableState fields, kan step) |
| `src/core/record.test.ts` | MODIFIED — 2 field additions to existing literals; ~3 new describe blocks |
| `docs/active/work/T-004-01-02/*` | CREATED — RDSPI artifacts |

**Explicitly untouched:** `wall.ts` (the frozen layout table is already
written there; this ticket only consumes it), `dora.ts` (doraKindOf already
handles kan-dora indicators — kind-level), `deal.ts`, `legal.ts` +
`legal.test.ts` (offers are T-004-01-03), `dynamics.test.ts` (claim/kan
sampling is T-004-01-04; its generator can't reach kans through legalActions),
`index.ts` (barrel `export *` re-exports the widened types for free), all of
`src/app/` (additive TableState growth; `just check` proves compilation —
Table.svelte:72 reads the untouched singular `doraIndicator`).

## record.ts — internal organization after the change

Order within the module (existing anatomy preserved; new pieces slot in):

1. **`HandAction`** — grows the three D1 members, appended after `pon`.
   Doc-comment additions to the CONTRACT FREEZE block: kan actions record
   `uses`/`tile` per the redundancy rule; the rinshan tile and flipped
   indicator are NEVER recorded (wall-order authority); `ankan.uses` may
   include the drawn tile; `shouminkan.tile` names the added copy.
2. **`HandRecord`** — untouched.
3. **`Meld`** — becomes the D2 discriminated union. The doc comment keeps the
   pond-mark paragraph (claimed stays counted in ponds[from] for
   chi/pon/daiminkan/shouminkan) and adds: ankan contributes all four tiles as
   `own`; shouminkan preserves the upgraded pon's `claimed`/`from` and index.
4. **`TableState`** — gains, after `dora`:
   - `doraIndicators: TileId[]` — every flipped indicator in flip order,
     `[0]` always the initial `doraIndicator`; kans append (D4).
   - `doras: TileKind[]` — the mapped kinds, same order.
   Doc updates: the conservation sentence on `drawn` already names melds'
   `own`; the `dead` comment gains the mutation note (rinshan leaves the
   front, the live tail joins the end, length is always 14); the `phase`
   comment gains "kans shorten the live wall, so exhaustive draw arrives one
   discard earlier per kan — through this same condition".
5. **`isRun`** — untouched.
6. **`applyClaim`** — untouched (chi/pon only; daiminkan gets its own guard
   run because its guard tail diverges — kan availability, 3 uses, kind
   equality — and grafting it in would unfreeze -01's guard order).
7. **NEW module-local helpers**, between `applyClaim` and `applyAction`:
   - `kansMade(state): number` — kan-type melds across all seats; the single
     definition of "kans made so far" (doraIndicators.length − 1 equals it by
     construction; the meld count is the semantic truth).
   - `guardRinshanAvailable(state, index, type)` — throws `action ${index}`
     RangeError when `kansMade === 4` ("no rinshan tile remains — four kans
     already made") or `live.length === 0` ("no live tile remains to replace
     the rinshan draw"). Called by all three forms (D5 fixes where in each
     guard order).
   - `applyKanTail(state)` — the shared D5 tail, in this exact order:
     flip (`const k = kansMade(state)` BEFORE the meld was pushed — see note
     below), rinshan draw (`state.drawn = state.dead.shift()!`), replenish
     (`state.dead.push(state.live.pop()!)`).
     **Ordering note (load-bearing):** the flip reads `dead[6 + k]` with k =
     kans made BEFORE this kan, against the not-yet-mutated dead array (after
     k shifts + k pushes, original index 6 + 2k sits at 6 + k). Simplest safe
     shape: compute `k` and the indicator FIRST, then push/upgrade the meld,
     then draw + replenish — the helper takes `k` as an argument computed by
     each caller before it mutates `melds`.
   - `takeFromHandOrDrawn(state, seat, tile)` — used by ankan (per use) and
     shouminkan: removes `tile` from the hand or consumes `drawn`; the caller
     handles the append-surviving-drawn rule once, after all takes: if
     `drawn` was not consumed, it is appended to the hand and cleared (the
     tedashi-append precedent), because the rinshan draw is about to occupy
     `drawn`. (Exact factoring may collapse into the two call sites if the
     helper reads worse than inline code — plan step 2 decides; the SEMANTICS
     above are fixed.)
8. **`applyAction`** — three new cases, appended after `'pon'`:
   - `case 'daiminkan':` guard run per D5 (window → own-discard → tile →
     rinshan → uses distinct → uses held → kinds equal), then: splice 3 uses,
     push `{type:'daiminkan', claimed, from, own}`, `turn = seat`,
     `claimable = null`, tail.
   - `case 'ankan':` guards (turn → mustDiscard → drawn → rinshan → distinct →
     held-or-drawn → kinds equal), take 4 uses, append surviving drawn, push
     `{type:'ankan', own}`, tail. Turn unchanged.
   - `case 'shouminkan':` guards (turn → mustDiscard → drawn → rinshan →
     tile held-or-drawn → owned pon of kindOf(tile) exists), take the tile,
     append surviving drawn, REPLACE the pon in place
     (`melds[seat][i] = {type:'shouminkan', claimed, from, own: [...pon.own,
     tile]}`), tail. Turn unchanged.
   Each case may delegate to a module-local `applyDaiminkan`/`applyAnkan`/
   `applyShouminkan` beside `applyClaim` if the switch grows past legibility —
   same threshold call -01 made when it extracted `applyClaim`.
9. **`foldRecord`** — initial state literal gains
   `doraIndicators: [doraIndicator]`, `doras: [dora kind]`. Nothing else.

Error-message voice (frozen at implement time, module dialect): every new
throw is `RangeError` starting `action ${index}:` and naming the failed rule
concretely — e.g. `ankan uses tile N, which seat S neither holds nor just
drew`, `shouminkan of tile N, but seat S has no pon of kind K`, `daiminkan of
tiles a+b+c+d (kinds …) do not form four of a kind`, `no rinshan tile remains
— four kans already made`, `kan on an empty live wall — no replacement tile
remains`.

## record.test.ts — organization of the new coverage

1. **Two existing full-state literals** (empty-log property :70, and any other
   TableState literal) gain `doraIndicators`/`doras`. The seed-1 golden gains
   two assert lines (`doraIndicators: [24]`, `doras: ['8m']`). No other
   existing test moves.
2. **NEW `describe('kan forms fold')`** — per-form positive anchors from the
   scratchpad scan (frozen literals + derivation comments, house rule),
   covering: meld shape & hand shrinkage; daiminkan turn jump + pond mark;
   ankan with drawn among uses AND with drawn appended; shouminkan in-place
   pon upgrade (same index, claimed/from preserved); `drawn` === original
   dead[k]; dead stays 14 and gained the live tail tile; doraIndicators walk
   [dead[4], dead[6], …] with hand-derived `doras`; live shortened by
   draws + kans; the rinshan discard folding through the unchanged discard
   step and reopening the claim window.
3. **NEW `describe('kan wall accounting')`** — the two-kan sequence anchor
   (rinshan order dead[0] then dead[1], indicators original dead[6] then
   dead[8]); the ryuukyoku-one-earlier property (a kan-bearing full hand ends
   with live empty after one fewer discard, phase flips on the same
   condition); conservation of all 136 ids at every prefix of every kan
   anchor (the widened `allZonesWithMelds` — unchanged, `own` covers all meld
   shapes); double-fold determinism + record immutability on a kan-bearing
   record.
4. **NEW `describe('illegal kans throw …')`** — the D5 matrix via the existing
   `expectClaimThrows` pattern (prefix + bad action + fragment + `action N`),
   one test per guard, guard-order exhibits where a case carries
   otherwise-valid parts.

## Ordering (three green commits, the -01 cadence)

1. **State growth** — Meld union, TableState plurals, foldRecord literal,
   test-literal updates. All existing tests green (additive only).
2. **The kan step + positive suites** — action members, helpers, three cases,
   `describe` blocks 2–3 with scan-derived anchors.
3. **The negative matrix** — `describe` block 4, plus any guard-message
   polish it forces.

Gates per commit: `just test`, `just check`; `just build` at the end.
