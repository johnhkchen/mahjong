<script lang="ts">
  import { kindIndexOf, kindOf, type TableState } from '../core'
  import Tile from './Tile.svelte'

  // Stateless presentational table: the folded TableState in via one prop, markup out.
  // It never derives game facts — every fact below is a field read off the fold. The
  // one computation is the display sort of the player's hand, which core explicitly
  // assigns to the view ("never sorted; sorting is presentation", deal.ts/TableState).
  let { table }: { table: TableState } = $props()

  // Seat 0 (East) is the player. Stable copy-sort into canonical kind order via the
  // public accessors — draw order is the record's truth and stays untouched upstream.
  const hand = $derived(
    [...table.hands[0]].sort((a, b) => kindIndexOf(kindOf(a)) - kindIndexOf(kindOf(b))),
  )

  // Riichi seating is counterclockwise with the player (East) at the bottom:
  // South right, West top, North left. Grid areas are named by wind, not screen
  // edge — the mapping lives once in grid-template-areas below.
  const SEATS = [
    { wind: 'East', area: 'east', you: true },
    { wind: 'South', area: 'south', you: false },
    { wind: 'West', area: 'west', you: false },
    { wind: 'North', area: 'north', you: false },
  ] as const
</script>

<section class="table" aria-label="mahjong table">
  {#each SEATS as seat (seat.area)}
    <div class="seat {seat.area}" class:you={seat.you}>
      {seat.wind}{#if seat.you}<span class="you-mark">you</span>{/if}
      {#if seat.you}
        <ul class="hand" aria-label="your hand">
          {#each hand as id (id)}
            <li><Tile {id} /></li>
          {/each}
        </ul>
      {/if}
    </div>
  {/each}
  <div class="center">
    <div class="dora" aria-label="dora indicator">
      <Tile id={table.doraIndicator} />
      <span class="label">dora indicator</span>
    </div>
    <span class="label">{table.live.length} tiles left</span>
  </div>
</section>

<style>
  .table {
    --felt: #1e6b4e;
    --felt-edge: #124534;
    --ink: #eaf3ee;
    --ink-dim: #a8c7b8;

    display: grid;
    grid-template-areas:
      '. west .'
      'north center south'
      '. east .';
    grid-template-columns: 1fr 2fr 1fr;
    grid-template-rows: 1fr 2fr 1fr;
    aspect-ratio: 1;
    width: min(100%, 70dvh);
    background: var(--felt);
    border: 0.5rem solid var(--felt-edge);
    border-radius: 1.25rem;
    color: var(--ink-dim);
  }

  .seat {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.15rem;
    font-size: 0.85rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .east {
    grid-area: east;
  }
  .south {
    grid-area: south;
  }
  .west {
    grid-area: west;
  }
  .north {
    grid-area: north;
  }

  .seat.you {
    color: var(--ink);
    font-weight: 600;
  }
  .you-mark {
    font-size: 0.65rem;
    font-weight: 400;
    color: var(--ink-dim);
    text-transform: lowercase;
  }

  .hand {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.15rem;
    margin: 0.35rem 0 0;
    padding: 0;
    list-style: none;
    text-transform: none;
  }

  .center {
    grid-area: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    border: 1px solid var(--felt-edge);
    border-radius: 0.75rem;
    margin: 12%;
  }
  .dora {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.3rem;
  }
  .label {
    font-size: 0.7rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
</style>
