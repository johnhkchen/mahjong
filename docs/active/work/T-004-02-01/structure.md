# T-004-02-01 — drive-claim-window-selection — Structure

The shape of the change. Two files modified in `src/app/`, one line in a
third; core untouched; nothing created or deleted outside work artifacts.

## Files

| File | Change | Size delta |
| --- | --- | --- |
| `src/app/drive.ts` | new exports `ClaimChoice`, `claimChoices`, `tapClaim`, `passClaim`; `forcedAction` gains the wait guard; header + doc comments updated | ~64 → ~150 lines |
| `src/app/drive.test.ts` | new anchors, three new describes, claim cases in `forcedAction`'s describe, pass policy in the walk, one new claim-walk describe | ~155 → ~340 lines |
| `src/app/App.svelte` | effect driver becomes `forcedAction(...) ?? passClaim(...)`; import + comment | +2/-1 lines |
| `src/core/**` | none — the offered/fold contract is closed for this ticket | 0 |

No new modules: the seam IS drive.ts, and the ticket extends it in place.
No index/barrel changes (app files import `./drive` directly).

## drive.ts internal organization (top to bottom)

1. **Header comment** — rewritten where it says claims are "never
   auto-taken ... until a claim UI / real bot ticket": bot claims still
   auto-pass (placeholder bots never call); the PLAYER's claims now wait for
   tapClaim/passClaim. The one-sentence contract ("returns an ELEMENT of
   offered or null; nothing computes legality") stands verbatim.
2. `PLAYER` — unchanged.
3. **`type ClaimAction`** (module-local): the chi/pon/daiminkan members of
   `HandAction`, extracted once so the predicate and the exports share it.
   **`isClaim(action): action is ClaimAction`** — the only type test.
4. **`export interface ClaimChoice`** — `{ type: ClaimAction['type'];
   uses: readonly TileId[] }`. The tap's minimal datum (D3); exported so
   -02-02's buttons can type their payloads.
5. **`export function claimChoices(offered, player): HandAction[]`** — filter
   `isClaim(a) && a.seat === player`, original order preserved (D4). The
   shared predicate: forcedAction's wait guard, passClaim's clause (b), the
   prompt's render list.
6. **`export function tapClaim(offered, player, choice): HandAction | null`**
   — find over `claimChoices(offered, player)` matching `type` and `uses`
   pairwise in order (module-local `usesEqual` helper; lengths first). D3.
7. **`export function passClaim(offered, player): HandAction | null`** —
   `offered[0]` iff head is a draw AND `claimChoices` nonempty; else null
   (D2). Doc comment states the complementarity invariant with forcedAction.
8. `tapDiscard` — untouched.
9. **`forcedAction`** — new first guard after the empty check:
   `if (claimChoices(offered, player).length > 0) return null`, with the
   seed-3 geometry (the head can be the player's OWN draw) called out in the
   doc comment as the reason the guard precedes the draw arm (D1). The draw
   arm's comment now reads "bot-only windows auto-pass". Remaining arms
   byte-identical.

Ordering note: `claimChoices` is defined before its three consumers;
`forcedAction` stays last as the loop's composite classifier.

## drive.test.ts organization

1. **Header comment** — extended: the seam now covers the claim window; the
   new teeth are the complementarity of forcedAction/passClaim and claim
   selection by (type, uses).
2. **Anchor block** (after the existing seed-1 anchors, same style —
   derivation comments, "never regenerate"):
   - `racePrefix3` re-stated from legal.test.ts (4 tsumogiri turns, discards
     28/128/25/42): North's 42 (2p), East chi [47,37], South pon [43,41],
     head = East's own draw. Folded: `raceWindow3`.
   - `ponWindowPrefix5` re-stated (`tsumogiriTurns` over seed 5's live, 7
     turns): West's 94 (6s), East pon [93,95], head = North's draw. Folded:
     `ponWindow5`.
   - `chiVariantsPrefixN` — the scanned East multi-chi-variant anchor
     (scratchpad scan, step I1 of plan.md): a North discard East can chi at
     least two ways. Folded: `chiVariantsWindowN`. Frozen with the scan's
     derivation in a comment.
3. **`describe('claimChoices')`** — race window yields exactly East's chi
   (South's pon excluded, toBe into offered); multi-variant window yields
   the variants in frozen order; bot-only window (beforeSouthDraw), plain
   pre-draw (dealt), post-draw (afterEastDraw), ended (exhausted) all yield
   `[]`.
4. **`describe('tapClaim')`** — per-anchor: each of East's offers selected
   by its (type, uses), toBe identity; nulls for South's pon identity under
   PLAYER, doctored list (East's chi filtered out), unoffered uses
   (lookalike variant), reversed-order uses (ordered matching pinned),
   every claim type at dealt/afterEastDraw/exhausted.
5. **`describe('passClaim')`** — head draw toBe at raceWindow3 and
   ponWindow5; null at beforeSouthDraw (bot-only — forcedAction owns it),
   dealt, afterEastDraw, exhausted. One complementarity property over all
   anchored states: exactly one of forcedAction/passClaim is non-null, or
   both null only when the player must discard or the hand ended.
6. **`describe('forcedAction')`** — existing cases kept (seed-1 bot-only
   window re-commented); new: null at raceWindow3 (own-draw head) and
   ponWindow5 (bot-draw head).
7. **Full-hand walk** — the unforced arm splits: player-discard head → tap
   first offered discard (as today); otherwise → `passClaim`, assert toBe
   `offered[0]`, count passes. Final assertions unchanged (140 actions,
   ryuukyoku, [18,18,17,17]) plus the pinned pass count if seed 1 opens
   East windows (scan decides the literal).
8. **`describe('a claim driven through the seam')`** — seed 3: tapClaim
   East's chi → push → fold (no throw) → mustDiscard offering → forcedAction
   null → tapDiscard a hand tile → push → fold → forcedAction resumes the
   bots (non-null). Every push toContain-ed in its fold's offering.

## App.svelte

The `$effect` body only:

```ts
const action = forcedAction(offered, PLAYER) ?? passClaim(offered, PLAYER)
```

with a one-line comment: the `?? passClaim` arm is the interim auto-pass —
T-004-02-02 replaces it with the call/pass prompt. Import adds `passClaim`.
Nothing else in the component moves (D5).

## Ordering of changes (matters)

1. Scratchpad scan → freeze the multi-variant anchor (test data before code
   so the suite lands whole).
2. drive.ts (compiles standalone; existing tests still pass except the walk
   comment — forcedAction's new nulls don't fire at any OLD anchor except
   through the walk if seed 1 opens East windows).
3. drive.test.ts (the AC file, green).
4. App.svelte (+ `just check`, SSR test).

Commit seam+suite together (the suite is the seam's spec); App wiring may
ride along or follow — plan.md sequences the actual commits.

## Interfaces after this ticket (the seam's public face)

```ts
PLAYER: Seat
ClaimChoice { type: 'chi'|'pon'|'daiminkan'; uses: readonly TileId[] }
claimChoices(offered, player): HandAction[]          // render list / predicates
tapClaim(offered, player, choice): HandAction | null // call selection
passClaim(offered, player): HandAction | null        // decline → head draw
tapDiscard(offered, player, tile): HandAction | null // unchanged
forcedAction(offered, player): HandAction | null     // now waits on player claims
```

Everything -02-02 needs and nothing speculative: prompt visibility =
`claimChoices(...).length > 0`, buttons = its elements, tap → tapClaim,
pass → passClaim, loop unchanged.
