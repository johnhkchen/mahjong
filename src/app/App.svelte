<script lang="ts">
  import { foldRecord, legalActions, type HandAction, type TileId } from '../core'
  import {
    forcedAction,
    passClaim,
    PLAYER,
    promptChoices,
    tapClaim,
    tapDiscard,
    type ClaimChoice,
  } from './drive'
  import ClaimPrompt from './ClaimPrompt.svelte'
  import Table from './Table.svelte'

  // Arbitrary walking-skeleton seed (it matches the frozen golden vector in
  // wall.test.ts). Seed selection becomes a real feature with the game-start ticket.
  let seed = $state(1)
  // The app's authoritative state is the hand record — the seed plus this growing
  // action log. Appends only; everything on the table is re-derived by folding after
  // every append (architecture.md: the table DOM is small, re-render is cheap), and
  // every appended action is an element of legalActions output, selected through the
  // drive seam — the app never computes legality.
  let actions = $state<HandAction[]>([])
  const table = $derived(foldRecord({ seed, actions }))
  const offered = $derived(legalActions(table))
  // The player's claim prompt list — deduped for presentation, non-empty exactly
  // when forcedAction waits on the player's claim window, so the prompt shows
  // precisely while the loop pauses (one predicate family in drive.ts).
  const prompt = $derived(promptChoices(offered, PLAYER))

  // Pacing is presentation: one forced action per tick keeps ponds and the wall
  // counter landing visibly, action by action, instead of a whole bot round at once.
  const BOT_DELAY_MS = 250

  function tap(tile: TileId) {
    const action = tapDiscard(offered, PLAYER, tile)
    if (action !== null) actions.push(action)
  }

  function claim(choice: ClaimChoice) {
    const action = tapClaim(offered, PLAYER, choice)
    if (action !== null) actions.push(action)
  }

  function pass() {
    const action = passClaim(offered, PLAYER)
    if (action !== null) actions.push(action)
  }

  // The reactive fixed point that runs the table: each append re-folds and re-derives
  // `offered`, which re-runs this effect — draws (the player's included) and bot
  // tsumogiri land one per tick until forcedAction yields null, i.e. the player's
  // discard choice, his claim window (the prompt owns it: claim/pass taps resolve
  // the wait), or the empty offering at ryuukyoku. Cleanup drops the pending timer
  // on re-run and unmount. $effect never runs in SSR, where the dealt fold renders
  // statically.
  $effect(() => {
    const action = forcedAction(offered, PLAYER)
    if (action === null) return
    const timer = setTimeout(() => actions.push(action), BOT_DELAY_MS)
    return () => clearTimeout(timer)
  })
</script>

<main>
  <header>mahjong</header>
  <Table {table} ontap={tap} />
  <!-- The claimable-window conjunct is a type guard, not policy: a claim offer
       implies an open window; visibility is promptChoices alone. -->
  {#if prompt.length > 0 && table.claimable !== null}
    <ClaimPrompt claimed={table.claimable.tile} choices={prompt} onclaim={claim} onpass={pass} />
  {/if}
</main>

<style>
  :global(html, body) {
    margin: 0;
    background: #10241b;
    color-scheme: dark;
  }

  main {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    min-height: 100dvh;
    padding: 1rem;
    box-sizing: border-box;
    font-family: system-ui, sans-serif;
  }

  header {
    color: #a8c7b8;
    font-size: 0.9rem;
    letter-spacing: 0.2em;
    text-transform: uppercase;
  }
</style>
