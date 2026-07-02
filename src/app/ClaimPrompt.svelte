<script lang="ts">
  import { kindOf, type HandAction, type TileId } from '../core'
  import type { ClaimChoice } from './drive'
  import Tile from './Tile.svelte'

  // The call/pass prompt: pure input wiring, computation-free. `choices` is
  // promptChoices output — claim elements of the live offered set, already deduped
  // for presentation — and each button echoes its element's own (type, uses) back
  // out through `onclaim`, the ordered-uses contract tapClaim selects by. The
  // claimed tile renders in the header once (it is the window's one tile, common to
  // every choice); a button shows the call name and the tiles that would leave the
  // hand. `onpass` is the decline — the owner resolves it to the head draw. The
  // prompt renders whenever it is mounted; visibility is the OWNER's fact (the same
  // predicate that makes the loop wait), never re-derived here.
  let {
    claimed,
    choices,
    onclaim,
    onpass,
  }: {
    claimed: TileId
    choices: HandAction[]
    onclaim?: (choice: ClaimChoice) => void
    onpass?: () => void
  } = $props()

  // Parlor vocabulary for the button face: a daiminkan is called "kan" at the table.
  // The payload keeps the record's discriminant — display only.
  function callName(type: ClaimChoice['type']): string {
    return type === 'daiminkan' ? 'kan' : type
  }
</script>

<aside class="prompt" role="group" aria-label="call or pass">
  <span class="claimed-label">call on <Tile id={claimed} />?</span>
  <div class="buttons">
    {#each choices as choice}
      <!-- Non-claim actions cannot reach a promptChoices list; the guard keeps the
           prop type HandAction without asserting, and renders nothing for them. -->
      {#if choice.type === 'chi' || choice.type === 'pon' || choice.type === 'daiminkan'}
        <button
          type="button"
          class="call"
          aria-label="{callName(choice.type)} {kindOf(claimed)} with {choice.uses
            .map(kindOf)
            .join(' ')}"
          onclick={() => onclaim?.({ type: choice.type, uses: choice.uses })}
        >
          <span class="name">{callName(choice.type)}</span>
          {#each choice.uses as id (id)}<Tile {id} />{/each}
        </button>
      {/if}
    {/each}
    <button type="button" class="pass" aria-label="pass" onclick={() => onpass?.()}>
      pass
    </button>
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

  .call,
  .pass {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.3rem 0.6rem;
    background: #1e6b4e;
    border: 1px solid #2e7d4f;
    border-radius: 0.5rem;
    color: #eaf3ee;
    font: inherit;
    cursor: pointer;
  }

  .call .name {
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .pass {
    background: none;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
</style>
