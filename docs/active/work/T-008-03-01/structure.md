# T-008-03-01 — score-breakdown-screen — Structure

File-level blueprint. Not code — the shape of the code.

## Files touched

| File | Change |
|---|---|
| `src/core/settlement.ts` | Modified — refactor `pricedReadingsOf`/add `bestReadingOf`, add `limitNameOf`, add `STARTING_SCORE_DISPLAY`, add `scoreBreakdownOf` export + `ScoreBreakdown`/`YakuLine`/`LimitName` types |
| `src/core/settlement.test.ts` | Modified — new `describe('scoreBreakdownOf', ...)` block reusing existing fixtures |
| `src/app/HandEnd.svelte` | **New** — the breakdown component |
| `src/app/Table.svelte` | Modified — replace inline win-summary/ryuukyoku markup with `<HandEnd {table} />` |
| `src/app/app.ssr.test.ts` | Modified — hand-end/ryuukyoku describe blocks updated to assert the new markup; source of the yaku-name assertion moves from `won.win!.yaku` to `scoreBreakdownOf(won).yaku` |

No files deleted. No changes to `record.ts`, `game.ts`, `han.ts`, `fu.ts`, `yaku.ts`,
`yakuman.ts`, `App.svelte`, `drive.ts`, `ClaimPrompt.svelte`, `Tile.svelte`.

## `src/core/settlement.ts` — internal shape

Ordering of changes within the file (top to bottom, matching the file's existing
section order):

1. **New exported types**, placed directly after the existing `SeatDeltas` type
   (line 69), before `DEALER_SEAT`:
   - `export type LimitName = 'mangan' | 'haneman' | 'baiman' | 'sanbaiman' | 'yakuman'`
   - `export interface YakuLine { readonly name: WinYakuName; readonly han: number }`
   - `export type ScoreBreakdown = { kind: 'agari'; ... } | { kind: 'ryuukyoku'; ... }`
     (full shape per design.md Decision 2)

2. **New constant**, beside the existing tier constants (after `YAKUMAN_BASE`,
   line 81): `const STARTING_SCORE_DISPLAY = 25000` with the cross-reference comment to
   `game.ts`'s `STARTING_SCORE` (design.md Decision 6).

3. **`pricedReadingsOf` → refactored in place** (was: `function pricedReadingsOf(win,
   doraHan): number[]`, line 165). New private interface `PricedReading { yaku:
   YakuLine[]; doraHan: number; han: number; fu: number; base: number }`; the function
   becomes `pricedReadingCandidatesOf(win, doraHan): PricedReading[]`, building the
   `YakuLine[]` via `yaku.map(name => ({ name, han: hanOf(name, win.melds) }))` alongside
   the existing `hanOfNames`/`fuOf`/`baseOf` calls it already makes per candidate. Same
   loop structure and same filter (non-kokushi, `yaku.length > 0`) as today — only the
   pushed element grows from a number to a record.

4. **New private `bestReadingOf(win, doraKinds): PricedReading`**, replacing
   `bestBaseOf`'s body (line 186): the yakuman branch builds a `PricedReading` directly
   from `yakuOf(win)` (`yaku: yakuOf(win).map(name => ({name, han: hanOf(name, win.melds)}))`,
   `doraHan: 0`, `han: hanOfNames(...)`, `fu: 0`, `base: baseOf(han, 0)`); the
   non-yakuman branch is `pricedReadingCandidatesOf(win, doraHanOf(win, doraKinds))`
   reduced to the max-`base` element (`reduce((best, c) => (c.base > best.base ? c :
   best))` — candidates list is never empty per the existing non-empty-by-construction
   guarantee, documented already on `pricedReadingsOf`).

5. **`bestBaseOf` becomes a one-line wrapper**: `function bestBaseOf(win, doraKinds):
   number { return bestReadingOf(win, doraKinds).base }` — kept as a private name so
   `settlementOf`'s existing call site (line 255) is untouched.

6. **New private `limitNameOf(base: number): LimitName | null`**, placed after
   `bestBaseOf`: the five-way comparison against the tier constants (design.md
   Decision 4).

7. **New exported `scoreBreakdownOf(state: TableState): ScoreBreakdown`**, placed
   directly after `settlementOf` (end of file, after line 260) since it is the sibling
   entrypoint `settlementOf` is refactored to share internals with:
   - `'playing'` guard: same `RangeError` message pattern as `settlementOf`'s.
   - `'ryuukyoku'` arm: `tenpaiFlagsOf(state)` + `notenBappuOf(tenpai)` (both already
     exist, reused verbatim) → `{ kind: 'ryuukyoku', tenpai, deltas, scores:
     deltas.map(d => STARTING_SCORE_DISPLAY + d) }`.
   - `'agari'` arm: `winOf(state)` (existing) → `bestReadingOf(win, state.doras)` (new)
     → `ronDeltas`/`tsumoDeltas` (existing, unchanged) → assemble the full `ScoreBreakdown`
     per design.md Decision 2/3/4, with `points: deltas[ended.winner]`.

`settlementOf` itself (line 247) is **not** rewritten to call `scoreBreakdownOf` — it
keeps calling `bestBaseOf`/`ronDeltas`/`tsumoDeltas`/`tenpaiFlagsOf`/`notenBappuOf`
directly, exactly as today, since `bestBaseOf` is now a thin wrapper over the same
`bestReadingOf` the new function uses. This keeps the diff to `settlementOf` at zero
lines changed.

## `src/app/HandEnd.svelte` — new component

Props: `{ table: TableState }` — matches `Table.svelte`'s own prop shape.

Internal structure (script section):
- Import `scoreBreakdownOf`, `type TableState` from `'../core'`.
- `const breakdown = $derived(table.phase === 'playing' ? null : scoreBreakdownOf(table))`.
- A local `SEATS`-equivalent wind-name array (`['East', 'South', 'West', 'North']`,
  indexed by Seat) — duplicated locally rather than imported from `Table.svelte` (nothing
  is exported from a `.svelte` file's `<script>` for another component to import; this
  matches the existing per-file small-constant duplication convention, e.g. `windKindOf`
  duplicated across three core files).

Markup structure (template section), rendered only when `breakdown !== null`:

```
{#if breakdown !== null}
  <div class="hand-end" role="status">
    {#if breakdown.kind === 'ryuukyoku'}
      <p class="ended">ryuukyoku — exhaustive draw</p>
      <ul aria-label="tenpai">
        {#each breakdown.tenpai as isTenpai, seat}
          <li>{WIND[seat]}: {isTenpai ? 'tenpai' : 'noten'}</li>
        {/each}
      </ul>
    {:else}
      <p class="ended">
        {WIND[breakdown.winner]}{breakdown.winner === 0 ? ' (you)' : ''} wins by
        {breakdown.by}{breakdown.by === 'ron' ? ` from ${WIND[breakdown.from]}` : ''}
      </p>
      <ul aria-label="yaku">
        {#each breakdown.yaku as line}
          <li>{line.name} {line.han}han</li>
        {/each}
      </ul>
      {#if breakdown.doraHan > 0}
        <p aria-label="dora">dora {breakdown.doraHan}</p>
      {/if}
      <p aria-label="points line">
        {#if breakdown.limitName !== null}
          {breakdown.limitName} {breakdown.points}
        {:else}
          {breakdown.fu}fu {breakdown.han}han {breakdown.points}
        {/if}
      </p>
    {/if}
    <ul aria-label="scores">
      {#each breakdown.scores as score, seat}
        <li>{WIND[seat]}: {score}</li>
      {/each}
    </ul>
  </div>
{/if}
```

The winning-tile region (`aria-label="winning tile"`) currently rendered by
`Table.svelte`'s inline block moves into `HandEnd.svelte` alongside the win sentence,
since it is part of the same win-only branch — `Table.svelte` no longer reads
`table.win` directly at all once this moves.

## `src/app/Table.svelte` — structural change

- Remove the entire `{#if table.phase === 'agari' && table.win !== null}` block and the
  standalone `{#if table.phase === 'ryuukyoku'}` `<p class="ended">` line (both currently
  inside `.center`, lines ~111-132).
- Add `import HandEnd from './HandEnd.svelte'` and render `<HandEnd {table} />` in their
  place, inside `.center`, after the wall-count `<span class="label">`.
- `.win-summary`/`.yaku`/`.winning-tile` CSS rules and their `@keyframes reveal-rise`
  motion hookup move to `HandEnd.svelte`'s own `<style>` block (Svelte scopes styles per
  component, so this is a cut-and-paste, not a rewrite) — the class names on the moved
  elements stay the same so the existing reveal animation keeps working unchanged.
- New CSS added in `HandEnd.svelte` only: rules for `.tenpai`/`.scores`/`.dora`/`.points`
  lists, styled consistently with the existing `.yaku` list (small caps, `--ink` color,
  flex-wrap row).

## Ordering / dependency notes for Plan

- `settlement.ts`'s refactor (steps 1-7 above) must land and be green in `settlement.test.ts`
  before `HandEnd.svelte` is written, since the component's only computation is a call to
  `scoreBreakdownOf` — writing the component against a real, tested return shape avoids
  discovering a shape mismatch mid-UI-work.
- `HandEnd.svelte` must exist before `Table.svelte`'s markup is removed (so the app never
  sits mid-refactor without a hand-end screen at all) — but both land in the same commit
  in practice since Svelte's compiler would otherwise flag an unused import either way.
- `app.ssr.test.ts` updates land last, verifying the whole wired-up path end to end.
