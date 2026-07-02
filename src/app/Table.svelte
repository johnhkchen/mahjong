<script lang="ts">
  import type { TileId } from '../core'

  // Stateless presentational table: derived data in via props, markup out. It never
  // builds, sorts, or mutates the wall — state ownership stays one level up (App).
  let { wall }: { wall: readonly TileId[] } = $props()

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
    </div>
  {/each}
  <div class="center">
    <span class="count">{wall.length}</span>
    <span class="label">tiles in the wall</span>
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

  .center {
    grid-area: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.25rem;
    border: 1px solid var(--felt-edge);
    border-radius: 0.75rem;
    margin: 12%;
  }
  .count {
    font-size: 2rem;
    font-weight: 700;
    color: var(--ink);
    font-variant-numeric: tabular-nums;
  }
  .label {
    font-size: 0.7rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
</style>
