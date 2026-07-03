# Review — T-009-03-02: furiten badge and yakuless notice

## Summary

Two "why can't I win" teaching facts, both sourced from new core queries and
rendered as ambient, always-on status lines beside the player's hand (not the
turn-gated console slot the riichi prompt/shanten hint use):

- **Furiten badge** — `振聴 — ron is sealed on {tile}; tsumo still wins`,
  shown whenever any of the three furiten kinds (basic/temporary/riichi) gates
  the player's ron.
- **Yakuless notice** — `no yaku — this hand can only win by tsumo; riichi
  would fix this`, shown for a closed, unlocked, tenpai hand whose every
  current wait would ron with no yaku.

## Files changed

| File | Change |
|---|---|
| `src/core/legal.ts` | +57 lines: two new exported functions, `furitenSeal` and `yakulessTenpai`, plus a header addendum. No existing function touched. |
| `src/core/legal.furiten.test.ts` (new) | 9 unit tests, all frozen-seed fixtures (5 reused from `legal.win.test.ts`'s own anchors, 1 synthetic override). |
| `src/app/Table.svelte` | Two new optional props (`furitenTile`, `yakulessTenpai`), rendered as plain `{#if}`-gated presentational markup inside the existing `{#if seat.you}` block, plus matching CSS. No new imports; still computes nothing. |
| `src/app/App.svelte` | Two new `$derived` values reading `table` directly through the new core queries (mirroring the existing `riichiPrompt`/`winChoice` pattern), passed through to `<Table>`. No change to the console slot's cascade. |
| `src/app/app.ssr.test.ts` | New `describe` block, 4 tests, rendering `Table` directly against real folded states through the real Svelte compiler. |

Total: 6 files (1 new), ~250 lines including tests. No file deleted, no
existing exported signature changed, no `TableState`/`SeatView` field added.

## Design decisions worth a reviewer's attention

1. **Both queries live in `legal.ts`**, not a new module — they reuse that
   file's existing private helpers (`waits`, `winYaku`, `isMenzen`) verbatim,
   in the same file, so there was nothing to restate. See design.md Decision 1
   for why a new module or a widened `SeatView` were both rejected.
2. **`furitenSeal` returns a physical `TileId`**, not a `TileKind` — required
   for `Tile.svelte` reuse (a bare kind string would silently render a blank
   chip). See design.md Decision 2.
3. **The pond scan is deliberately NOT "any pond, any wait-kind match."** Own
   pond first (exactly `discardFuriten`'s existing test, restated to return a
   value); the cross-pond widening only runs when `tempFuriten`/`riichiFuriten`
   is already set by the fold, because `sealPassedWins` never seals a seat
   from its own discard, and a same-kind match in another seat's pond that
   never triggered a real seal must not be reported as one. See design.md
   Decision 3, including a **known, documented, accepted gap**: a call
   (chi/pon) folded by the sealed seat during the temp-furiten window can
   reshape its waits before the fold-tracked flag clears (only cleared by that
   seat's own draw), in which case `furitenSeal` can return `null` while
   `ronOffers` still withholds the ron. No fixture in the codebase exercises
   this (every existing furiten fixture is pure tsumogiri), and fixing it
   would mean threading the actual sealing tile through `TableState` at
   `sealPassedWins`'s own site — a larger change than this ticket's AC asks
   for.
4. **`yakulessTenpai` requires ALL current waits to be yakuless**, not "at
   least one," and gates on a closed hand — both to keep the notice's exact
   copy always true. See design.md Decision 4 for why menzen-tsumo's
   unconditional closed-hand yaku licenses "can only win by tsumo" without a
   separate tsumo probe.
5. **Badge copy drops "you discarded"** from the ticket's own illustrative
   Context text, since that phrasing is only accurate for basic (self-pond)
   furiten — temp/riichi furiten seal on ANOTHER seat's discard that this
   seat merely passed on. See design.md Decision 6.
6. **Rendered in `Table.svelte`, not the console slot.** Both facts are true
   across many turns, not just at a decision point — cramming them into the
   riichi-prompt/hint cascade would either hide them most of the time or need
   an artificial gating condition. See design.md Decision 5 for the full
   reasoning and the rejected `FuritenBadge.svelte`/`YakulessNotice.svelte`
   component-pair alternative.

## Test coverage

- **Core unit** (`legal.furiten.test.ts`, 9 tests): all three furiten kinds
  named correctly (basic/temporary/riichi), temporary furiten's clearing
  transition, riichi furiten's permanence, the no-furiten baseline;
  `yakulessTenpai`'s true case, has-yaku false case, riichi-locked false case,
  and an open-hand false case (a synthetic `TableState` override — folding a
  real triplet from the yakuless fixture's own hand into a pon meld,
  otherwise untouched, to isolate the `isMenzen` gate specifically).
- **View SSR** (`app.ssr.test.ts`, 4 new tests): the furiten region present
  with the correct tile token and "tsumo still wins," present-then-absent
  across the temporary seal's lifting, the yakuless region present with its
  exact copy, and neither region on a freshly dealt hand.
- All fixtures are either reused verbatim from `legal.win.test.ts`'s own
  frozen anchors, or freshly mined and pinned (never regenerated, per house
  convention): a seat-0-specific yakuless-tenpai seed (`20899`) was mined
  because no existing fixture targets seat 0 (the app's fixed `PLAYER`
  seat) for this exact fact.
- Full suite: `npx vitest run` → 899 passed, 4 failed — the 4 failures are
  pre-existing and unrelated (confirmed against a clean, unmodified tree
  before any of this ticket's edits existed; see progress.md for the
  verification method and the shared `+riichi`-fixture-drift signature they
  all carry). `svelte-check` and `tsc -p tsconfig.node.json --noEmit` are both
  clean.

## Gaps and open concerns

- **The documented furiten-naming gap** (Decision 3, above): a rare,
  currently-untested scenario (a call during the temp-furiten window) where
  the badge can fail to name a tile even though ron stays sealed. Flagging
  for a human call on whether it's worth a follow-up ticket — my read is no,
  given no fixture anywhere in the codebase has ever needed to model it.
- **No property test** was added for either new query — both are thin,
  already-covered compositions (`waits`, `winYaku`, the fold's own furiten
  fields), and the ticket's AC asks for pinned "SSR tests," which this
  delivers. If a reviewer wants an invariant (e.g., "`furitenSeal` is
  non-null iff `ronOffers` would withhold a ron for every completing tile,"
  modulo the documented gap), that would be a reasonable follow-up, not a
  gap in THIS ticket's own AC.
- **A working-tree incident** occurred mid-session (an over-broad `git stash
  -u` briefly stashed this ticket's edits alongside unrelated concurrent WIP,
  and the pop partially failed); fully recovered with no data loss, but as a
  side effect the first commit (`dae5c92`) also swept in an unrelated,
  pre-existing, not-mine change to `dynamics.test.ts`/`legal.test.ts` (another
  in-flight ticket's own WIP, restored intact rather than dropped). Content is
  correct either way; only the commit attribution is imprecise. See
  progress.md for the full account and the lesson recorded there.
- **Pre-existing failing tests** (4, unrelated — see above) were left
  untouched, per this ticket's scope. A human should confirm whether a
  separate ticket already tracks reconciling the riichi-offering bots against
  those older frozen fixtures.

## Manual verification

SSR markup was printed and eyeballed for both the furiten badge and the
yakuless notice (well-formed HTML, correct tile chip, correct copy) via a
disposable scratch test, not committed. No browser/dev-server walkthrough was
done — reaching either state via real play requires ~20 turns end-to-end;
the SSR suite (rendering through the real Svelte compiler against real folded
states) is the practical verification surface here, matching every other
ambient/prompt component's own test convention in this codebase.
