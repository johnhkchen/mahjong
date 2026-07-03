<script lang="ts">
  import { kindIndexOf, kindOf, type TableState, type TileId } from '../core'
  import HandEnd from './HandEnd.svelte'
  import Tile from './Tile.svelte'

  // Stateless presentational table: the folded TableState in via one prop, markup out.
  // It never derives game facts — every fact below (hands, ponds, turn, drawn, phase,
  // wall count) is a field read off the fold; the only conditionals are presentation
  // gates on those reads. The one computation is the display sort of the player's
  // hand, which core explicitly assigns to the view ("never sorted; sorting is
  // presentation", deal.ts/TableState). `ontap` is input wiring OUT, not a fact in:
  // taps report the tile, and legality lives entirely with the owner of the record —
  // buttons render whenever their tiles do, an illegal tap is the caller's no-op.
  // `scores`/`onnext` (T-008-03-02): pure pass-through to HandEnd — Table adds no
  // logic of its own for either, matching `ontap`'s own "input wiring OUT" role.
  let {
    table,
    ontap,
    scores,
    onnext,
  }: {
    table: TableState
    ontap?: (tile: TileId) => void
    scores?: readonly [number, number, number, number]
    onnext?: () => void
  } = $props()

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
    <!-- The hand-end screen: score-breakdown-screen (T-008-03-01) — every yaku with
         its han, dora, fu/points, and the four updated seat scores, all read off
         core's scorer via HandEnd, never computed here. -->
    <HandEnd {table} {scores} {onnext} />
  </div>
</section>

<style>
  .table {
    --felt: #1e6b4e;
    --felt-edge: #124534;
    --ink: #eaf3ee;
    --ink-dim: #a8c7b8;

    display: grid;
    /* Portrait phone bands, one wind→area mapping as ever: West across the top,
       the two side opponents flanking the center info card, the player's whole
       zone as the full-width bottom band. Rows size to content; the 1fr middle
       absorbs the min-height slack so a freshly dealt table still reads as felt. */
    grid-template-areas:
      'west west west'
      'north center south'
      'east east east';
    grid-template-columns: 1fr 7.5rem 1fr;
    grid-template-rows: auto 1fr auto;
    row-gap: 0.4rem;
    flex: 1 1 auto; /* in App's column the felt fills the viewport — the east band bottoms out into the thumb zone */
    width: 100%;
    max-width: 26rem;
    min-height: min(60dvh, 30rem);
    box-sizing: border-box;
    padding: 0.4rem 0.2rem;
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
    min-width: 0; /* a grid track can never be blown out past its share */
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

  /* The hand is the tap zone: chips scale up to a readable face and the 44px
     button pitch below provides the spacing, so the flex gap goes to zero. */
  .hand {
    --tile-scale: 1.5rem;
    gap: 0;
  }

  /* An empty pond keeps one tile row of height so the felt grid doesn't jump
     as the first discards land. Width comes from the seat's band or track — the
     full-width bands hold a mid-hand pond in one glanceable row, the narrow side
     tracks wrap North's and South's at four tiles. */
  .pond {
    min-height: 1.6em;
    max-width: 100%;
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
    --tile-scale: 1.5rem;
    margin-top: 0.25rem;
    text-transform: none;
  }

  /* Tap targets carry no chrome of their own — the tile chip stays the visual
     unit — but the button is the target: a 44px (2.75rem) minimum in both axes,
     chip centered, so every discard is one-thumb tappable. */
  .tap {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 2.75rem;
    min-height: 2.75rem;
    padding: 0;
    background: none;
    border: none;
    font: inherit;
    cursor: pointer;
    touch-action: manipulation;
  }

  .center {
    grid-area: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    align-self: center; /* hug content mid-band, don't stretch the 1fr row */
    min-width: 0;
    gap: 0.5rem;
    border: 1px solid var(--felt-edge);
    border-radius: 0.75rem;
    margin: 0;
    padding: 0.5rem 0.25rem;
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

  /* Motion: claims and hand-ends arrive, they don't pop. Every keyframe below is
     from-only — the implicit `to` is the element's own settled style above, so the
     end states live in exactly one place and, under reduced motion, this whole
     block simply never applies: elements appear directly in those end states.
     Durations sit inside one BOT_DELAY_MS pacing tick, so the next forced action
     never lands mid-reveal. */
  @media (prefers-reduced-motion: no-preference) {
    /* A meld li mounts exactly when the fold first contains the meld — the
       unkeyed each appends new melds and updates existing lis in place, which
       is what keeps a second claim from replaying the first meld's settle. */
    .meld {
      animation: meld-settle 200ms ease-out;
    }
    @keyframes meld-settle {
      from {
        opacity: 0;
        transform: scale(0.85);
      }
    }

    /* The claimed tile turns sideways into the parlor mark. */
    .claimed-tile {
      animation: claim-turn 200ms ease-out;
    }
    @keyframes claim-turn {
      from {
        transform: rotate(0deg);
      }
    }

    /* The pond tile is visibly taken, not blinked dim: the claimed branch swap
       recreates the li, which is what fires this — a class toggle on a kept li
       would not restart it. */
    .pond .claimed {
      animation: claim-taken 200ms ease-out;
    }
    @keyframes claim-taken {
      from {
        opacity: 1;
        transform: rotate(0deg);
      }
    }

  }

  /* Motion: draw + discard entrances — insertion transitions via
     @starting-style (transitions are client-only, so SSR output is untouched;
     pre-@starting-style browsers fall back to tiles appearing instantly, the
     reduced-motion path). The 180ms settle finishes inside the drive's 250ms
     action tick, so each landing reads before the next action folds. On the
     recreated claimed li this transition is preempted by claim-taken above —
     running animations own the shared properties. */
  @media (prefers-reduced-motion: no-preference) {
    /* A discard settling onto the felt: drop + fade. */
    .pond li {
      transition:
        opacity 180ms ease-out,
        transform 180ms ease-out;
      @starting-style {
        opacity: 0;
        transform: translateY(-0.4rem);
      }
    }

    /* The draw arriving from the wall: rise + fade into the drawn slot. */
    .drawn {
      transition:
        opacity 180ms ease-out,
        transform 180ms ease-out;
      @starting-style {
        opacity: 0;
        transform: translateY(0.35rem);
      }
    }
  }
</style>
