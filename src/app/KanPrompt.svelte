<script lang="ts">
  import { kindOf, type HandAction, type TileId } from '../core'
  import { term } from './dictionary.svelte'
  import {
    markPromptClosed,
    MOUNT_GUARD_MS,
    prefersReducedMotion,
    shouldGuardMount,
  } from './mount-guard'
  import Tile from './Tile.svelte'

  // The own-turn kan decision (owner report #6): pure input wiring like RiichiPrompt.
  // `choices` is drive.ts's ownKanChoices output — ankan/shouminkan elements of the
  // live offered set; each button echoes its element back verbatim through `ondeclare`.
  // `onpass` is a PRESENTATION dismissal only: there is no decline action to fold —
  // the discard surface (and the riichi prompt, next in the console cascade) stay
  // live, and the owner re-shows the prompt at the next distinct offer.
  let {
    choices,
    ondeclare,
    onpass,
  }: {
    choices: HandAction[]
    ondeclare?: (choice: HandAction) => void
    onpass?: () => void
  } = $props()

  // The face a kan button shows: ankan carries its four copies, shouminkan its added
  // tile — one representative tile id either way, presentation only.
  function faceOf(choice: HandAction): TileId | null {
    if (choice.type === 'ankan') return choice.uses[0]
    if (choice.type === 'shouminkan') return choice.tile
    return null
  }

  // Same hot-reopen mount guard as ClaimPrompt/RiichiPrompt (mount-guard.ts).
  let guarded = $state(shouldGuardMount() && !prefersReducedMotion())
  $effect(() => {
    if (!guarded) return
    const timer = setTimeout(() => {
      guarded = false
    }, MOUNT_GUARD_MS)
    return () => clearTimeout(timer)
  })
  $effect(() => () => markPromptClosed())
</script>

<aside class="prompt kan" role="group" aria-label="kan prompt">
  <div class="buttons">
    {#each choices as choice}
      {@const face = faceOf(choice)}
      {#if face !== null}
        <button
          type="button"
          class="call declare"
          disabled={guarded}
          aria-label="declare kan {kindOf(face)}"
          onclick={() => {
            if (!guarded) ondeclare?.(choice)
          }}
        >
          <span class="name">{term('kan')}</span>
          <Tile id={face} />
        </button>
      {/if}
    {/each}
    <button
      type="button"
      class="pass"
      disabled={guarded}
      aria-label="pass kan"
      onclick={() => {
        if (!guarded) onpass?.()
      }}
    >
      {term('notYet')}
    </button>
  </div>
</aside>

<style>
  /* The armed mount guard made visible: never a silently-inert button. */
  button:disabled {
    opacity: 0.55;
  }

  .prompt {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.5rem 0.9rem;
    background: #124534;
    border: 1px solid #2e7d4f;
    border-radius: 0.75rem;
    color: #eaf3ee;
    font-size: 0.85rem;
  }

  .buttons {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.4rem;
  }

  /* Same visual register as ClaimPrompt/RiichiPrompt — real 44px touch targets. */
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

  .declare {
    background: #2e7d4f;
    border-color: #4da372;
  }

  .pass {
    background: none;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
</style>
