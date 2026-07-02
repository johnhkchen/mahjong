<script lang="ts">
  import { kindIndexOf, kindOf, type TableState, type TileId } from '../core'
  import Tile from './Tile.svelte'

  // Stateless presentational table: the folded TableState in via one prop, markup out.
  // It never derives game facts — every fact below (hands, ponds, turn, drawn, phase,
  // wall count) is a field read off the fold; the only conditionals are presentation
  // gates on those reads. The one computation is the display sort of the player's
  // hand, which core explicitly assigns to the view ("never sorted; sorting is
  // presentation", deal.ts/TableState). `ontap` is input wiring OUT, not a fact in:
  // taps report the tile, and legality lives entirely with the owner of the record —
  // buttons render whenever their tiles do, an illegal tap is the caller's no-op.
  let { table, ontap }: { table: TableState; ontap?: (tile: TileId) => void } = $props()

  // Seat 0 (East) is the player. Stable copy-sort into canonical kind order via the
  // public accessors — draw order is the record's truth and stays untouched upstream.
  const hand = $derived(
    [...table.hands[0]].sort((a, b) => kindIndexOf(kindOf(a)) - kindIndexOf(kindOf(b))),
  )

  // Every claimed-away discard, straight off the melds: core keeps a claimed tile
  // COUNTED in the discarder's pond (the complete discard history — furiten and
  // defense reads), and each claiming meld's (from, claimed) is its mark there.
  // Physical ids are unique, so one Set covers all four ponds; ankan claims nothing
  // and contributes nothing.
  const claimedAway = $derived(
    new Set(table.melds.flat().flatMap((meld) => ('claimed' in meld ? [meld.claimed] : []))),
  )

  // Riichi seating is counterclockwise with the player (East) at the bottom:
  // South right, West top, North left. Grid areas are named by wind, not screen
  // edge — the mapping lives once in grid-template-areas below. SEATS is in Seat
  // order (0=E, 1=S, 2=W, 3=N), so the loop index below reads table.ponds and
  // table.turn directly. Pond labels are deliberately lowercase — a distinct aria
  // vocabulary from the wind display names.
  const SEATS = [
    { wind: 'East', pond: 'east pond', area: 'east', you: true },
    { wind: 'South', pond: 'south pond', area: 'south', you: false },
    { wind: 'West', pond: 'west pond', area: 'west', you: false },
    { wind: 'North', pond: 'north pond', area: 'north', you: false },
  ] as const
</script>

<section class="table" aria-label="mahjong table">
  {#each SEATS as seat, i (seat.area)}
    <!-- The turn marker only means "to act" while the hand is live; after an ending
         the fold parks `turn` at the last discarder, which is not a fact to present. -->
    {@const active = table.phase === 'playing' && i === table.turn}
    <div class="seat {seat.area}" class:you={seat.you} class:active aria-current={active ? 'true' : undefined}>
      {seat.wind}{#if seat.you}<span class="you-mark">you</span>{/if}
      <!-- Discard order straight off the fold — the order IS the pond's meaning. -->
      <ul class="pond" aria-label={seat.pond}>
        {#each table.ponds[i] as id (id)}
          <!-- A claimed-away tile stays in the pond (the fold counts it here — the
               discard history is complete) and wears the mark instead of vanishing. -->
          {#if claimedAway.has(id)}
            <li class="claimed" aria-label="claimed {kindOf(id)}"><Tile {id} /></li>
          {:else}
            <li><Tile {id} /></li>
          {/if}
        {/each}
      </ul>
      {#if table.melds[i].length > 0}
        <!-- Exposed melds in claim order, each: the caller's own tiles, then the
             claimed discard turned sideways — the parlor mark naming whose it was.
             An ankan exposes only its own four. -->
        <ul class="melds" aria-label="{seat.area} melds">
          {#each table.melds[i] as meld}
            <li class="meld">
              {#each meld.own as id (id)}<Tile {id} />{/each}
              {#if 'claimed' in meld}
                <span
                  class="claimed-tile"
                  aria-label="claimed {kindOf(meld.claimed)} from {SEATS[meld.from].area}"
                >
                  <Tile id={meld.claimed} />
                </span>
              {/if}
            </li>
          {/each}
        </ul>
      {/if}
      {#if seat.you}
        <ul class="hand" aria-label="your hand">
          {#each hand as id (id)}
            <li>
              <button type="button" class="tap" aria-label="discard {kindOf(id)}" onclick={() => ontap?.(id)}>
                <Tile {id} />
              </button>
            </li>
          {/each}
        </ul>
        <!-- The draw sits apart from the sorted hand, as core holds it apart from the
             13 tiles. Opponents' draws are concealed information and never render. -->
        {#if table.turn === 0 && table.drawn !== null}
          <span class="drawn" aria-label="drawn tile">
            <button type="button" class="tap" aria-label="discard {kindOf(table.drawn)}" onclick={() => table.drawn !== null && ontap?.(table.drawn)}>
              <Tile id={table.drawn} />
            </button>
          </span>
        {/if}
      {/if}
    </div>
  {/each}
  <div class="center">
    <div class="dora" aria-label="dora indicator">
      <Tile id={table.doraIndicator} />
      <span class="label">dora indicator</span>
    </div>
    <span class="label">{table.live.length} tiles left</span>
    {#if table.phase === 'ryuukyoku'}
      <p class="ended" role="status">ryuukyoku — exhaustive draw</p>
    {/if}
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
  .seat.active {
    color: var(--ink);
    text-decoration: underline;
    text-decoration-color: var(--ink-dim);
    text-underline-offset: 0.35em;
  }
  .you-mark {
    font-size: 0.65rem;
    font-weight: 400;
    color: var(--ink-dim);
    text-transform: lowercase;
  }

  .hand,
  .pond {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.15rem;
    margin: 0.35rem 0 0;
    padding: 0;
    list-style: none;
    text-transform: none;
  }

  /* An empty pond keeps one tile row of height so the felt grid doesn't jump
     as the first discards land. */
  .pond {
    min-height: 1.6em;
    max-width: 9.5rem;
  }

  /* A pond tile claimed away: still counted, visibly taken. */
  .pond .claimed {
    opacity: 0.45;
    transform: rotate(8deg);
  }

  .melds {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.5rem;
    margin: 0.35rem 0 0;
    padding: 0;
    list-style: none;
    text-transform: none;
  }

  .meld {
    display: inline-flex;
    align-items: center;
    gap: 0.1rem;
  }

  /* The claimed tile sits sideways in the meld — the parlor convention. */
  .claimed-tile {
    display: inline-flex;
    transform: rotate(90deg);
    margin: 0 0.25em;
  }

  .drawn {
    margin-top: 0.25rem;
    text-transform: none;
  }

  /* Tap targets carry no chrome of their own — the tile chip stays the visual unit. */
  .tap {
    padding: 0;
    background: none;
    border: none;
    font: inherit;
    cursor: pointer;
  }

  .ended {
    margin: 0;
    color: var(--ink);
    font-size: 0.8rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
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
