<script lang="ts">
  import { scoreBreakdownOf, type TableState } from '../core'
  import { term, windTerm } from './dictionary.svelte'
  import Tile from './Tile.svelte'

  // The hand-end report: stateless and presentational, like every other component
  // here — one prop in (the same `{ table }` shape Table.svelte itself takes),
  // markup out. scoreBreakdownOf is core's own scorer, called once; every number
  // and name below is read straight off its return, never recomputed (the "no
  // scoring arithmetic in src/app/" contract — this file contains no +, *, or
  // han/fu table of its own, only string formatting and a wind-name lookup).
  //
  // `scores` (T-008-03-02): the CARRIED game total, seat-indexed for THIS hand
  // (App.svelte remaps GameState's Player-indexed running scores through the
  // active dealer before passing it down — design.md Decision 3). Optional so
  // every caller that omits it (every existing single-hand test) falls back to
  // breakdown's own hand-only total exactly as before — zero behavior change
  // when the prop is absent. `onnext` fires "next hand" — also optional, so the
  // button only ever renders for a caller that actually wants it.
  let {
    table,
    scores,
    onnext,
  }: {
    table: TableState
    scores?: readonly [number, number, number, number]
    onnext?: () => void
  } = $props()

  const breakdown = $derived(table.phase === 'playing' ? null : scoreBreakdownOf(table))
  const displayScores = $derived(scores ?? breakdown?.scores)
</script>

{#if breakdown !== null}
  <div class="hand-end" role="status">
    {#if breakdown.kind === 'ryuukyoku'}
      <p class="ended">{term('ryuukyoku')} — exhaustive draw</p>
      <ul class="tenpai" aria-label="tenpai">
        {#each breakdown.tenpai as isTenpai, seat (seat)}
          <li>{windTerm(seat)}: {isTenpai ? term('tenpai') : term('noten')}</li>
        {/each}
      </ul>
    {:else}
      <p class="ended">
        {windTerm(breakdown.winner)}{breakdown.winner === 0 ? ' (you)' : ''} wins by
        {breakdown.by === 'ron' ? term('ron') : term('tsumo')}{breakdown.by === 'ron' ? ` from ${windTerm(breakdown.from ?? 0)}` : ''}
      </p>
      <span class="winning-tile" aria-label="winning tile">
        <Tile id={table.win!.tile} />
      </span>
      <ul class="yaku" aria-label="yaku">
        {#each breakdown.yaku as line (line.name)}
          <li>{line.name} {line.han}han</li>
        {/each}
      </ul>
      {#if breakdown.doraHan > 0}
        <p class="dora" aria-label="dora">{term('dora')} {breakdown.doraHan}</p>
      {/if}
      <p class="points" aria-label="points line">
        {#if breakdown.limitName !== null}
          {breakdown.limitName} {breakdown.points}
        {:else}
          {breakdown.fu}{term('fu')} {breakdown.han}{term('han')} {breakdown.points}
        {/if}
      </p>
    {/if}
    <ul class="scores" aria-label="scores">
      {#each displayScores ?? [] as score, seat (seat)}
        <li>{windTerm(seat)}: {score}</li>
      {/each}
    </ul>
    {#if onnext}
      <button type="button" class="next-hand" onclick={onnext}>{term('nextHand')}</button>
    {/if}
  </div>
{/if}

<style>
  .hand-end {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.3rem;
  }

  .ended {
    margin: 0;
    color: var(--ink, #eaf3ee);
    font-size: 0.8rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .yaku,
  .tenpai,
  .scores {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.5rem;
    margin: 0;
    padding: 0;
    list-style: none;
    font-size: 0.7rem;
    letter-spacing: 0.08em;
    color: var(--ink, #eaf3ee);
  }

  .dora,
  .points {
    margin: 0;
    font-size: 0.7rem;
    letter-spacing: 0.08em;
    color: var(--ink, #eaf3ee);
    text-transform: uppercase;
  }

  /* Same visual register as App.svelte's header .new-game button — a real
     ≥44px touch target, the score screen's own control. */
  .next-hand {
    margin-top: 0.2rem;
    font: inherit;
    font-size: 0.75rem;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: var(--ink, #eaf3ee);
    background: none;
    border: 1px solid #3d5c4c;
    border-radius: 0.375rem;
    padding: 0.65rem 0.9rem;
    min-height: 44px;
    cursor: pointer;
  }
  .next-hand:active {
    background: #1c3a2c;
  }

  /* Hand-end reveal: the same quiet rise Table.svelte's win-summary always used. */
  @media (prefers-reduced-motion: no-preference) {
    .hand-end {
      animation: reveal-rise 220ms ease-out;
    }
    @keyframes reveal-rise {
      from {
        opacity: 0;
        transform: translateY(0.35rem);
      }
    }
  }
</style>
