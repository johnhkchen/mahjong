<script lang="ts">
  import { kindOf, type HandAction, type TileId } from '../core'
  import type { ClaimChoice } from './drive'
  import Tile from './Tile.svelte'

  // The call/pass prompt: pure input wiring, computation-free. `choices` is
  // promptChoices output — claim elements of the live offered set, already deduped
  // for presentation — and each button echoes its element's own (type, uses) back
  // out through `onclaim`, the ordered-uses contract tapClaim selects by. `win` is
  // winChoice output — the player's one tsumo/ron element, rendered FIRST (wins
  // precede calls, the offered order made visible) — and its button echoes nothing:
  // the owner already holds the element, so `onwin` is a bare signal like `onpass`.
  // The claimed tile renders in the header once when a window holds one (it is the
  // window's one tile, common to every claim choice); the tsumo and houtei moments
  // have no window tile, and the win button carries the moment by itself (a ron
  // button shows its winning tile either way). `onpass` is the decline — the owner
  // resolves it to the head draw, or to a mere dismissal at houtei where no decline
  // action exists; `canPass` hides the button at the one moment declining is
  // already a tap on the table itself (the tsumo point: declining IS discarding).
  // The prompt renders whenever it is mounted; visibility is the OWNER's fact (the
  // same predicate that makes the loop wait), never re-derived here.
  let {
    claimed,
    choices,
    win = null,
    canPass = true,
    onclaim,
    onpass,
    onwin,
  }: {
    claimed: TileId | null
    choices: HandAction[]
    win?: HandAction | null
    canPass?: boolean
    onclaim?: (choice: ClaimChoice) => void
    onpass?: () => void
    onwin?: () => void
  } = $props()

  // Parlor vocabulary for the button face: a daiminkan is called "kan" at the table.
  // The payload keeps the record's discriminant — display only.
  function callName(type: ClaimChoice['type'] | 'tsumo' | 'ron'): string {
    return type === 'daiminkan' ? 'kan' : type
  }
</script>

<aside class="prompt" role="group" aria-label="call or pass">
  {#if claimed !== null}
    <span class="claimed-label">call on <Tile id={claimed} />?</span>
  {/if}
  <div class="buttons">
    <!-- The win leads, as it leads the offered order. Non-win actions cannot reach
         a winChoice result; the guard type-narrows without asserting. -->
    {#if win !== null && (win.type === 'tsumo' || win.type === 'ron')}
      <button
        type="button"
        class="call win"
        aria-label={win.type === 'ron' ? `ron ${kindOf(win.tile)}` : 'tsumo'}
        onclick={() => onwin?.()}
      >
        <span class="name">{callName(win.type)}</span>
        {#if win.type === 'ron'}<Tile id={win.tile} />{/if}
      </button>
    {/if}
    {#each choices as choice}
      <!-- Non-claim actions cannot reach a promptChoices list; the guard keeps the
           prop type HandAction without asserting, and renders nothing for them. -->
      {#if choice.type === 'chi' || choice.type === 'pon' || choice.type === 'daiminkan'}
        <button
          type="button"
          class="call"
          aria-label="{callName(choice.type)} {kindOf(choice.tile)} with {choice.uses
            .map(kindOf)
            .join(' ')}"
          onclick={() => onclaim?.({ type: choice.type, uses: choice.uses })}
        >
          <span class="name">{callName(choice.type)}</span>
          {#each choice.uses as id (id)}<Tile {id} />{/each}
        </button>
      {/if}
    {/each}
    {#if canPass}
      <button type="button" class="pass" aria-label="pass" onclick={() => onpass?.()}>
        pass
      </button>
    {/if}
  </div>
</aside>

<style>
  .prompt {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 0.6rem;
    padding: 0.5rem 0.9rem;
    background: #124534;
    border: 1px solid #2e7d4f;
    border-radius: 0.75rem;
    color: #eaf3ee;
    font-size: 0.85rem;
  }

  .claimed-label {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }

  /* Call/pass are thumb targets too: a 44px (2.75rem) height floor and tiles
     scaled a notch above pond size so the choice reads at arm's length. */
  .call,
  .pass {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    min-height: 2.75rem;
    padding: 0.4rem 0.8rem;
    background: #1e6b4e;
    border: 1px solid #2e7d4f;
    border-radius: 0.5rem;
    color: #eaf3ee;
    font: inherit;
    cursor: pointer;
    touch-action: manipulation;
  }

  .call {
    --tile-scale: 1rem;
  }

  .call .name {
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  /* The win button leads and glows a shade brighter — the teaching moment. */
  .call.win {
    background: #2e7d4f;
    border-color: #4da372;
  }

  .pass {
    background: none;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
</style>
