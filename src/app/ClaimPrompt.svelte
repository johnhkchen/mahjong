<script lang="ts">
  import { kindOf, type HandAction, type TileId } from '../core'
  import type { ClaimChoice } from './drive'
  import { callTerm } from './dictionary.svelte'
  import {
    markPromptClosed,
    MOUNT_GUARD_MS,
    prefersReducedMotion,
    shouldGuardMount,
  } from './mount-guard'
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

  // T-012-01-01, retuned after the owner's 2026-07-05 hand-log report ("double-
  // prompt"): the guard arms ONLY when another prompt closed within mount-guard.ts's
  // reopen window — the one geometry where a tap aimed at the old prompt can land on
  // this one's buttons. A cold mount takes fast taps immediately: a primed pon tapped
  // within the beat was being silently eaten, so the prompt seemed to ask twice.
  // While armed, buttons are visibly `disabled` (never a silent swallow); the beat
  // then clears it. SSR renders unguarded ($effect never runs there; shouldGuardMount
  // is boot-cold in Node).
  let guarded = $state(shouldGuardMount() && !prefersReducedMotion())
  $effect(() => {
    if (!guarded) return
    const timer = setTimeout(() => {
      guarded = false
    }, MOUNT_GUARD_MS)
    return () => clearTimeout(timer)
  })
  // Mark this prompt's close so the NEXT mount knows it reopened hot.
  $effect(() => () => markPromptClosed())
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
        disabled={guarded}
        aria-label={win.type === 'ron' ? `${callTerm('ron')} ${kindOf(win.tile)}` : callTerm('tsumo')}
        onclick={() => {
          if (!guarded) onwin?.()
        }}
      >
        <span class="name">{callTerm(win.type)}</span>
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
          disabled={guarded}
          aria-label="{callTerm(choice.type)} {kindOf(choice.tile)} with {choice.uses
            .map(kindOf)
            .join(' ')}"
          onclick={() => {
            if (!guarded) onclaim?.({ type: choice.type, uses: choice.uses })
          }}
        >
          <span class="name">{callTerm(choice.type)}</span>
          {#each choice.uses as id (id)}<Tile {id} />{/each}
        </button>
      {/if}
    {/each}
    {#if canPass}
      <button
        type="button"
        class="pass"
        disabled={guarded}
        aria-label="pass"
        onclick={() => {
          if (!guarded) onpass?.()
        }}
      >
        pass
      </button>
    {/if}
  </div>
</aside>

<style>
  /* The armed mount guard made visible: never a silently-inert button. */
  button:disabled {
    opacity: 0.55;
  }

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

  /* Motion: a fresh window enters with a visible beat, never a silent patch.
     App.svelte keys this component on the window's own claimable seat+tile
     (T-011-02-02), so a new window always mounts a brand-new `.prompt` — this
     transition fires every time by construction, the same "recreation is what
     restarts it" relationship Table.svelte's own motion comments describe.
     Insertion transition via @starting-style (client-only, so SSR output is
     untouched), matching Table.svelte's `.pond li`/`.drawn` shape rather than
     Svelte's `transition:` directive — this codebase's own E-007 convention.
     200ms sits inside App.svelte's 250ms BOT_DELAY_MS tick, so the beat settles
     before the next forced action could land. This duration is mount-guard.ts's
     MOUNT_GUARD_MS, kept in sync with the JS input guard above by hand (CSS can't
     import the constant) — change one, change both. */
  @media (prefers-reduced-motion: no-preference) {
    .prompt {
      transition:
        opacity 200ms ease-out,
        transform 200ms ease-out;
      @starting-style {
        opacity: 0;
        transform: translateY(0.3rem);
      }
    }
  }
</style>
