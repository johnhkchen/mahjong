# T-004-02-02 — call-pass-prompt-and-meld-display — Structure

The shape of the code implementing design.md. One new file, four modified,
zero deleted. Core untouched (contract closed).

## Files

| File | Change | Design |
|---|---|---|
| src/app/drive.ts | MODIFY: + `promptChoices` export (~25 lines with doc) | D3 |
| src/app/ClaimPrompt.svelte | CREATE: the call/pass prompt (~80 lines) | D1, D2 |
| src/app/Table.svelte | MODIFY: melds per seat + pond claim marks (~50 lines) | D4 |
| src/app/App.svelte | MODIFY: delete auto-pass arm; prompt wiring (~20 lines net) | D2, D5 |
| src/app/drive.test.ts | MODIFY: `promptChoices` block; daiminkan anchor if scan lands | D6 |
| src/app/app.ssr.test.ts | MODIFY: prompt/meld/mark describe blocks | D6 |

## src/app/drive.ts — promptChoices

Appended after `claimChoices` (they read as a pair). Signature and contract:

```ts
export function promptChoices(offered: readonly HandAction[], player: Seat): HandAction[]
```

- Body: `claimChoices(offered, player)` filtered through a `Set<string>` of
  seen keys, key = `type + '|' + uses.map(kindOf).join(',')`. First occurrence
  kept; frozen order preserved; elements of `offered` itself (the module's one
  shape — never rebuilt).
- New import from '../core': `kindOf` (first game-vocabulary read in this
  module; stays within the "app builds actions via legalActions" charter
  because kinds are used only to GROUP offers, never to construct one).
- Doc comment states: presentation dedupe over the complete claim set
  (identical-kind copy variants collapse; shape-distinct variants and distinct
  call forms never do); empty ⇔ claimChoices empty, so prompt visibility and
  the loop's wait stay one predicate family.

No other drive.ts change. forcedAction/passClaim/tapClaim untouched.

## src/app/ClaimPrompt.svelte — new component

Presentational + input wiring OUT, computation-free (D3 keeps the dedupe in
drive.ts). Structure mirrors Tile/Table conventions (runes, aria hooks,
scoped styles, felt palette vars are Table-scoped so the prompt defines its
own small palette consistent with App's colors).

```ts
let { claimed, choices, onclaim, onpass }: {
  claimed: TileId
  choices: HandAction[]          // promptChoices output — claim elements only
  onclaim: (choice: ClaimChoice) => void
  onpass: () => void
} = $props()
```

Markup:

- Root: `<aside class="prompt" role="group" aria-label="call or pass">` — a
  labeled landmark for SSR tests; visually a compact bar.
- Header row: "call on" + `<Tile id={claimed} />` — the window tile the
  learner is deciding about.
- One button per choice, in given order:
  `aria-label="{name} {kindOf(claimed)} with {uses kinds}"` where name is
  `chi` / `pon` / `kan` (daiminkan displays as "kan" — parlor vocabulary; the
  discriminant stays `daiminkan` in the payload). Button content: the call
  name + a Tile chip per `uses` id (the tiles leaving the hand — the claimed
  tile is in the header). Click → `onclaim({ type, uses })` echoing the
  element's own fields (D2).
- Pass button: `aria-label="pass"`, click → `onpass()`.
- A `never`-guard: non-claim actions in `choices` render nothing (type-narrow
  via the same `type === 'chi' || ...` test; keeps HandAction as the prop type
  without asserting).

Internal helper (display only): `callName(type)` mapping daiminkan → 'kan'.

## src/app/Table.svelte — melds + pond marks

Script additions:

- `import { ... type Meld }` — no: `Meld` fields are accessed structurally in
  markup (`meld.own`, `meld.claimed`); import the type only if a snippet needs
  it. Expected imports unchanged.
- `const claimedAway = $derived(new Set(table.melds.flat().flatMap(m => 'claimed' in m ? [m.claimed] : [])))`
  — the one new derivation, a pure read of the prop (D4). (`'claimed' in m`
  narrows the ankan arm out.)
- `const WINDS = ['east','south','west','north']` already exists as SEATS —
  meld `from` labels reuse `SEATS[from].area` (lowercase wind words).

Markup, inside the per-seat `{#each}`:

- After the pond `</ul>`, gated `{#if table.melds[i].length > 0}`:

```svelte
<ul class="melds" aria-label="{SEATS[i].area} melds">
  {#each table.melds[i] as meld}
    <li class="meld">
      {#each meld.own as id (id)}<Tile {id} />{/each}
      {#if 'claimed' in meld}
        <span class="claimed-tile" aria-label="claimed {kindOf(meld.claimed)} from {SEATS[meld.from].area}">
          <Tile id={meld.claimed} />
        </span>
      {/if}
    </li>
  {/each}
</ul>
```

- Pond `<li>` grows the mark: `{@const taken = claimedAway.has(id)}` →
  `class:claimed={taken}` and, when taken, `aria-label="claimed {kindOf(id)}"`
  on the li. Tile chip unchanged inside.

Styles: `.melds` mirrors `.pond` flex row (no min-height — gated render);
`.meld` groups its tiles tighter (smaller gap, a subtle group outline or just
spacing between melds); `.claimed-tile` rotates 90° (`transform: rotate(90deg)`
with margin compensation) — the parlor sideways-tile convention; pond
`li.claimed` dims (`opacity: .45`) + slight rotation to read as "taken".

East ordering note: for the `you` seat the DOM order becomes pond → melds →
hand → drawn; the melds sit directly above the hand row — "beside East's
hand" reads as adjacent in the seat cell (flex column). No grid change.

## src/app/App.svelte — wiring

Script:

- Imports: `+ promptChoices, tapClaim, type ClaimChoice`; `passClaim` STAYS
  (now called by the pass handler instead of the effect).
- `const prompt = $derived(promptChoices(offered, PLAYER))`
- Effect driver: `const action = forcedAction(offered, PLAYER)` — the
  `?? passClaim` arm and its interim comment deleted (D5); the effect comment
  gains one line: the prompt now owns the claim window (forcedAction is null
  exactly while it shows).
- Handlers, both in tap()'s null-guard shape:

```ts
function claim(choice: ClaimChoice) {
  const action = tapClaim(offered, PLAYER, choice)
  if (action !== null) actions.push(action)
}
function pass() {
  const action = passClaim(offered, PLAYER)
  if (action !== null) actions.push(action)
}
```

Markup: between `<header>` and `<Table>` (a fixed slot above the table keeps
the felt from jumping — actually rendered AFTER Table in DOM, visually below
it, nearest East's hand):

```svelte
{#if prompt.length > 0 && table.claimable !== null}
  <ClaimPrompt claimed={table.claimable.tile} choices={prompt} onclaim={claim} onpass={pass} />
{/if}
```

The `table.claimable !== null` conjunct is a type guard, not policy — a claim
offer implies an open window (legal.ts only enumerates claims off one); the
prompt predicate remains promptChoices alone.

## Test files

**drive.test.ts** — new `describe('promptChoices')` after claimChoices'
block, reusing the frozen anchors verbatim: dedupe at raceWindow3 (length 1,
toBe offered's first variant), pass-through at mixedWindow15 (the pinned
three, toBe identity), empty at beforeSouthDraw/dealt/afterEastDraw/exhausted,
emptiness-equivalence property vs claimChoices over all eight -02-01 anchors.
Plus, if the scratchpad scan (plan step 1) lands an East-daiminkan window: the
frozen anchor, tapClaim positive kan selection, promptChoices containing the
kan offer.

**app.ssr.test.ts** — additions:

- `describe('claim prompt (SSR)')`: `render(ClaimPrompt, { props })` with the
  seed-15 window's promptChoices (recomputed from the fold in the test — the
  house "derived, not typed" rule) — asserts the group landmark, the claimed
  tile in the header, one labeled button per deduped choice (aria names pin
  call name + uses kinds), the pass button; and dealt `render(App)` contains
  no `"call or pass"` (negative gate at boot).
- `describe('meld display (SSR)')`: Table rendered with the seed-3 post-chi
  fold (prefix + chi [37,47] + East's claim discard — the drive.test.ts walk's
  exact actions): east melds region tokens = own kinds + claimed 2p; the
  `claimed 2p from north` aria; north pond STILL lists 2p (regionTokens
  ordered-equal vs fold.ponds[3], unchanged assertion shape) with the claimed
  aria mark present; your-hand button count 11.

Ordering of changes (matters): drive.ts + drive.test.ts first (the helper the
prompt consumes, committed green); then ClaimPrompt + Table + App + SSR tests
as the view commit; artifacts last. Two code commits, mirroring -02-01's
seam-then-wiring split.
