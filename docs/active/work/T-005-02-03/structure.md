# T-005-02-03 — win-prompt-and-hand-end-screen — Structure

The blueprint: files, boundaries, interfaces, and ordering. No core (`src/core/`)
file changes — this ticket is entirely `src/app/` plus its two test suites.

## 1. File inventory

| File | Change | Nature |
|---|---|---|
| `src/app/drive.ts` | modify | `winChoice` added; `forcedAction`/`passClaim` guards widened; header doc extended |
| `src/app/ClaimPrompt.svelte` | modify | `win`/`canPass` props, nullable `claimed`, win button, `onwin` |
| `src/app/App.svelte` | modify | `win` derived, `takeWin`/widened `pass` handlers, `dismissed` flag, mount condition |
| `src/app/Table.svelte` | modify | hand-end block in the center panel |
| `src/app/drive.test.ts` | modify | new anchors + `winChoice` suite + agari walk + widened batteries |
| `src/app/app.ssr.test.ts` | modify | win-prompt renders + hand-end renders |
| (scratchpad probe) | temp | seed miner, never committed — -02's deleted-after-capture precedent |

Nothing created, nothing deleted, no barrel changes (`src/core/index.ts` already
exports everything consumed: `foldRecord`, `legalActions`, `kindOf`, types).

## 2. drive.ts — the seam's new public interface

Insertion point: after `passClaim`, before `tapDiscard` (the claim family stays
contiguous; `winChoice` sits between the claim selectors and the discard selector,
mirroring the offered order wins-between-draws-and-calls).

```ts
/** The seat-scoped win-offer predicate AND selector (at most one exists). */
export function winChoice(offered: readonly HandAction[], player: Seat): HandAction | null
```

- Implementation: `offered.find(a => (a.type === 'tsumo' || a.type === 'ron') && a.seat === player) ?? null`.
  `find` (not filter) is correct AND documents atamahane: the first offered ron is
  head-bump order — the doc carries the future-bot-recorder note from -01/-02.
- No new types: win actions carry no `uses`, so no `WinChoice` payload interface —
  the `HandAction` element itself crosses the seam (same as `passClaim`'s draw).

Guard widenings (both one-line, both documented in place):

- `forcedAction`: `if (claimChoices(...).length > 0 || winChoice(...) !== null) return null`
  — replaces the claim-only guard; the docstring's claim-window bullet widens to
  "a window holding a claim OR WIN offer for the PLAYER waits", plus a new bullet
  for the houtei halt (rons-only offering: head not a draw, no bot discard —
  falls through to null for bots, waits by guard for the player).
- `passClaim`: `claimChoices(...).length > 0` → `claimChoices(...).length > 0 || winChoice(...) !== null`.
  The existing head-must-be-draw check already excludes tsumo (head is a discard)
  and houtei (head is a ron), so ONLY the window-ron case gains a pass — stated in
  the doc. Complementarity with forcedAction survives by the same construction.

Module header: the placeholder-bot paragraph gains "and never win" beside "never
call"; the PLAYER-exception sentence gains the win prompt.

## 3. ClaimPrompt.svelte — widened props, one new button

```ts
let { claimed, choices, win = null, canPass = true, onclaim, onpass, onwin }: {
  claimed: TileId | null          // was TileId — null at tsumo/houtei moments
  choices: HandAction[]
  win?: HandAction | null         // the player's offered win element, rendered first
  canPass?: boolean               // false only at the tsumo point
  onclaim?: (choice: ClaimChoice) => void
  onpass?: () => void
  onwin?: () => void              // no payload — the owner holds the element
} = $props()
```

Render order inside the existing `aria-label="call or pass"` aside:

1. Header: `{#if claimed !== null}` call on `<Tile/>`? — else the win button is the
   header moment (no second header text; the button names it).
2. Win button first (`{#if win !== null && (win.type === 'tsumo' || win.type === 'ron')}`
   — the same type-narrowing-guard idiom as the claim loop): face text via
   `callName` grown to `tsumo`/`ron`; aria `"tsumo"` / `"ron {kindOf(win.tile)}"`.
   Class `win` beside `call` for future styling; same visual chrome initially.
3. The claim buttons, unchanged.
4. Pass button wrapped in `{#if canPass}` — default true keeps every existing
   render (SSR tests pass no `canPass`) identical.

Defaults make ALL existing call sites/tests valid without edits except `claimed`'s
type (call sites already pass a TileId, which satisfies `TileId | null`).

## 4. App.svelte — owner wiring

```ts
const win = $derived(winChoice(offered, PLAYER))
let dismissed = $state(false)              // houtei-only presentation state

function takeWin() { if (win !== null) actions.push(win) }
function pass() {
  const action = passClaim(offered, PLAYER)
  if (action !== null) actions.push(action)
  else dismissed = true                    // reachable only at houtei (documented)
}
```

Mount condition (the claimable conjunct moves into the prop):

```svelte
{#if (prompt.length > 0 || win !== null) && !dismissed}
  <ClaimPrompt
    claimed={table.claimable?.tile ?? null}
    choices={prompt} {win}
    canPass={win?.type !== 'tsumo' || prompt.length > 0}
    onclaim={claim} onpass={pass} onwin={takeWin} />
{/if}
```

`canPass` note: at a pure tsumo point there is nothing to decline INTO (discarding
is the decline); if claims ever coexist with a tsumo (impossible today — tsumo is
post-draw, claims are pre-draw — the `|| prompt.length > 0` arm is a type-level
tautology guard and may be dropped for plain `win?.type !== 'tsumo'`; structure
prefers the simpler form: **`canPass={win?.type !== 'tsumo'}`**).

The `$effect` loop, tap/claim handlers, and everything else: untouched.

## 5. Table.svelte — the hand-end block

In `.center`, beside the ryuukyoku line (phases are exclusive, two sibling `{#if}`s):

```svelte
{#if table.phase === 'agari' && table.win !== null}
  <div class="ended win-summary" role="status">
    <p class="ended">
      {SEATS[table.win.winner].wind}{#if table.win.winner === 0} (you){/if}
      wins by {table.win.by}{#if table.win.by === 'ron'} from {SEATS[table.win.from].wind}{/if}
    </p>
    <span class="winning-tile" aria-label="winning tile"><Tile id={table.win.tile} /></span>
    <ul class="yaku" aria-label="yaku">
      {#each table.win.yaku as name}<li>{name}</li>{/each}
    </ul>
  </div>
{/if}
```

- Aria contract for the SSR suite: `aria-label="winning tile"` (a tile region —
  `regionTokens` compatible with a `</span>` closer, the drawn-tile precedent) and
  `aria-label="yaku"` (a text list; asserted by `toContain` on names, not
  regionTokens — yaku names are not tile tokens).
- Winner naming reuses the `SEATS` table (winds + `you` flag) — no new vocabulary.
- Style: reuse `.ended`; add minimal `.win-summary`/`.yaku` layout rules (column
  flex, no list chrome) in Table's existing style block.
- The `phase === 'playing'` turn-marker gate already excludes agari; no edit.

## 6. Test-file organization

**drive.test.ts** — additions only, no anchor regenerated:

- New frozen anchors (constants beside the seed-212 block, comments carrying the
  mined geometry + derivation cross-check): `TSUMO_SEED` (seat-0 tsumo at turn k)
  with its prefix builder; `RON_SEED_P` (seat-0 ron window) with its prefix.
- New `describe('winChoice')`: element identity (toBe) at both anchors; null for
  PLAYER at every existing anchor (windowless + bot-win + the exhausted state);
  null through the furiten/yakuless lenses — fold the -02 core anchors (23798,
  12754) and assert the seam shows the player-parametric seat nothing (one
  parametric spot-check: `winChoice(offered, 1)` at seed 3951's ron point is
  non-null — the seat-scoping tooth); doctored-list rejection (win offer filtered
  out → null even though the fold would accept).
- `forcedAction`/`passClaim` cases: waits (null) at the player-ron window (the bug
  regression test — MUST fail against the old guard); passClaim returns the head
  draw there; both null at the tsumo point (tap/halt state).
- Complementarity battery: the two new anchors join the anchor list; the both-null
  arm's expected-head shape widens (player discard ∨ undefined ∨ win-wait states).
- New walk: `describe('a win driven through the seam')` — the TSUMO_SEED hand
  played pass-everything until the tsumo point, `winChoice` taken, fold asserted:
  `phase 'agari'`, `legalActions [] `, `win` matches by/winner/tile, `yaku`
  non-empty; then every driver (forcedAction, passClaim, winChoice, tapDiscard)
  returns null/[] — quiescence through the seam.

**app.ssr.test.ts** — two new describes, existing helpers reused:

- `describe('win prompt view (SSR)')`: render ClaimPrompt with derived props at the
  tsumo point (`win` from live offers, `canPass:false`) → tsumo button aria, NO
  pass button; at the player-ron window → `"ron <kind>"` aria + pass present; the
  claims coexistence case if the shanpon bonus anchor landed.
- `describe('hand-end view (SSR)')`: render Table with the folded agari record →
  winner line ("East (you) wins by tsumo"), `regionTokens(body, 'winning tile',
  '</span>')` equals the win kind, every `win.yaku` name present, no
  `aria-current`, ryuukyoku line absent; a bot-win fold (existing seed 3951 ron
  actions) → "North wins by ron from East"-shaped line, no you-mark.

## 7. Ordering of changes (matters)

1. **Mine the anchors first** (scratchpad probe against the derivation stack) — every
   later step consumes them; if mining stalls, the fallback (parametric bot-anchor
   driving) is a design deviation to record in progress.md before proceeding.
2. **drive.ts** + **drive.test.ts** (red-first on the auto-pass regression) — the
   seam is self-contained and `just test` proves it before any view work.
3. **ClaimPrompt.svelte** + its SSR describes.
4. **App.svelte** wiring (compiles only after 2+3 exist).
5. **Table.svelte** hand-end + its SSR describes.
6. Full `just test && just check && just build` sweep.

Steps 2–5 are each one commit-sized; plan.md sequences verification per step.
