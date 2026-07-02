# T-004-01-01 — chi-pon-claim-fold-semantics — Review

Self-assessment and handoff. Read with design.md (the five decisions) beside it.

## What changed

**`src/core/record.ts`** (+~200 lines) — the ticket's entire production surface:

- `HandAction` grew `chi` and `pon` members: `{type, seat, tile, uses: [TileId,
  TileId]}`. The claimed `tile` is deliberate redundancy (the seat-tag precedent — a
  claim naming anything but the fresh discard is corruption and throws); `uses` are
  the caller's physical hand tiles, stated in the log because no wall-order authority
  exists for which copies a caller exposes.
- New exported `Meld` interface: `{type: 'chi'|'pon', claimed, from, own: [TileId,
  TileId]}`.
- `TableState` grew `melds` (per-seat, claim order), `claimable` (the fresh discard
  open to claims: `{seat, tile} | null`), and `mustDiscard` (true exactly from a claim
  until the caller's discard). The conservation partition widened to
  hands / melds' `own` / ponds / drawn / live / dead — **the claimed tile stays
  counted in the discarder's pond** (the pond remains the complete discard history;
  `(from, claimed)` on the meld is the pond mark; design.md D4 is the rationale and
  the rejected alternatives).
- The step: every playing discard opens the claim window; a draw closes it
  (staleness) — and throws while a claim discard is owed; `applyClaim` validates
  chi (left neighbor only: caller = discarder+1 mod 4) and pon (any non-discarder)
  through a frozen guard order — window → seat → tile → uses-distinct → uses-held →
  shape — then splices `uses` from the hand, exposes the meld, jumps `turn` to the
  caller, and sets `mustDiscard`. The caller's discard is hand-only (no drawn tile).
  Every rejection is `RangeError` naming the action index, in the module's voice.

**`src/core/record.test.ts`** (+~250 lines): the empty-log TableState literal gained
the three new fields; two new suites (below). No other existing test needed touching.

**Untouched, by design:** `legal.ts` (offers are T-004-01-03), `dynamics.test.ts`
(claim sampling is T-004-01-04), `index.ts` (the barrel re-exports `Meld` via
`export *`), all of `src/app/` (TableState growth is additive; `just check` proves
the consumers compile).

Commits: `553a05b` (state growth), `c9cde7e` (claim step + positive suite),
`44df5b9` (negative matrix), plus this artifacts commit.

## Acceptance criteria — verified line by line

- **Chi, left neighbor only** — positive: seed-1 anchor (South chis East's 8s with
  7s+9s); negative: West with a *valid run shape* is refused by the seat guard.
- **Pon, any seat** — adjacent pon (seed 1) and non-adjacent pon (seed 3: South pons
  North's discard, skipping East entirely — East's hand stays 13, the live wall
  proves East's draw never happened).
- **Meld exposed for the calling seat** — exact `Meld` literals asserted, hand
  shrinkage to 11 asserted tile-by-tile.
- **Claimed tile marked in its discarder's pond** — the tile remains in
  `ponds[from]` (discard history preserved for future furiten/defense reads) and the
  meld's `(from, claimed)` join identifies it; asserted both ways.
- **Turn jumps to the caller who must then discard** — `turn`/`mustDiscard`
  asserted after each claim; the caller's tedashi folds, reopens the window, and
  advances the turn; a caller's draw throws.
- **Pon-over-chi deterministic from the record** — the seed-3 discard is chi-able
  AND pon-able; each logged resolution double-folds to equal, mutually distinct
  states (the record *is* the resolution — no precedence logic in the fold).
- **Wrong-tile / wrong-seat / stale-discard claims throw RangeError naming the
  action index** — 14-case matrix, each case asserting the `action N` fragment.

## Test coverage

22 new tests (124 total, all green; `just check` and `just build` clean):
8 positive/invariant (meld exposure ×2, pond mark, forced discard, turn jump, race
determinism, 136-tile conservation at *every prefix* of four claim-bearing anchors,
record immutability + fresh-array double-fold) and 14 negative (one per guard, plus
guard-order exhibits). Expectations are wall-derived or hand-derived frozen literals
(seed 1 from the existing goldens; seed 3 from a scratchpad scan, derivation
comments inline, "never regenerate" per house precedent) — never read back from the
fold under test.

**Coverage gaps, deliberate and owned downstream:** no property-based generation of
claim-bearing records (T-004-01-04's charter — today's anchors are example-based);
no legalActions claim offers, so the agreement suite doesn't yet know claims exist
(T-004-01-03); kan forms, rinshan, kan-dora untouched (T-004-01-02). No `/verify`
app drive: claims are unreachable from the app until legalActions offers them — the
app builds actions exclusively from the offered set. Unchanged app behavior is
covered by the untouched drive/SSR suites.

## Open concerns for a human reviewer

1. **The pond-keeps-the-claimed-tile decision (design.md D4)** is the one judgment
   call with long reach: it optimizes for the pond as *discard history* (furiten,
   defense reads, T-004-02-02's pond mark) over physical-table fidelity (tile moves
   to the meld area). The UI ticket renders the meld from `claimed`+`own` and
   grays/rotates the pond tile via the meld join. If you'd rather the pond drop the
   tile, the conservation partition and two tests change — nothing else.
2. **`Meld.claimed`/`from` are non-nullable** — ankan (T-004-01-02) has neither; that
   ticket will widen the shape (TableState is the derived view, not the frozen
   record contract, so this is a planned seam, not a freeze violation).
3. **Turn-window subtlety worth a second pair of eyes:** after a discard, `turn`
   already points at the rotation seat while `claimable` stays open — a chi caller
   *is* that seat, a pon caller overwrites it. The interaction is tested (adjacent +
   non-adjacent anchors) but it is the least obvious piece of the state machine.
4. **`isRun` stays module-local** in record.ts; T-004-01-03 will want it (chi-variant
   enumeration) and should extract rather than duplicate.

No TODOs left in code; no known bugs; nothing skipped silently.
