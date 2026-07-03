<script lang="ts">
  import type { TileId } from '../core'
  import Tile from './Tile.svelte'

  // The P2-crown moment, charter.md's own quoted example ("you're tenpai — declare
  // riichi?"), made concrete: pure input wiring like ClaimPrompt, computation-free.
  // `tile` is drive.ts's riichiPrompt result — the ONE candidate the console asks
  // about (never "pick a tile," this ticket's scope: a single yes/no declaration).
  // `ondeclare`/`ondecline` fire the two fold targets; the owner already holds both
  // HandAction elements (drive.ts's RiichiPrompt.declare/decline) and appends
  // whichever the tap selects — this component builds neither.
  let {
    tile,
    ondeclare,
    ondecline,
  }: {
    tile: TileId
    ondeclare?: () => void
    ondecline?: () => void
  } = $props()
</script>

<aside class="prompt riichi" role="group" aria-label="riichi prompt">
  <p class="ask">
    you're tenpai — declare riichi with <Tile id={tile} />?
  </p>
  <ul class="stakes">
    <li aria-label="stake hand-locks">hand locks — every later turn discards whatever you draw</li>
    <li aria-label="stake stick">a 1000-point stick moves to the table pot — the next winner takes it</li>
    <li aria-label="stake yaku">riichi is its own yaku, and a win flips extra dora for a chance at more</li>
  </ul>
  <div class="buttons">
    <button type="button" class="call declare" aria-label="declare riichi" onclick={() => ondeclare?.()}>
      declare riichi
    </button>
    <button type="button" class="pass" aria-label="not yet" onclick={() => ondecline?.()}>
      not yet
    </button>
  </div>
</aside>

<style>
  .prompt {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.4rem;
    padding: 0.5rem 0.9rem;
    background: #124534;
    border: 1px solid #2e7d4f;
    border-radius: 0.75rem;
    color: #eaf3ee;
    font-size: 0.85rem;
  }

  .ask {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    margin: 0;
    letter-spacing: 0.02em;
  }

  .stakes {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    margin: 0;
    padding: 0;
    list-style: none;
    font-size: 0.7rem;
    letter-spacing: 0.02em;
    color: #a8c7b8;
    text-align: center;
  }

  .buttons {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.4rem;
  }

  /* Same visual register as ClaimPrompt's call/pass — a real 44px touch target. */
  .call,
  .pass {
    display: inline-flex;
    align-items: center;
    min-height: 2.75rem;
    padding: 0.4rem 0.8rem;
    background: #1e6b4e;
    border: 1px solid #2e7d4f;
    border-radius: 0.5rem;
    color: #eaf3ee;
    font: inherit;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    cursor: pointer;
    touch-action: manipulation;
  }

  .declare {
    background: #2e7d4f;
    border-color: #4da372;
  }

  .pass {
    background: none;
    font-weight: 400;
  }
</style>
