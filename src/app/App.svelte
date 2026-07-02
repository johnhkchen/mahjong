<script lang="ts">
  import { foldRecord, legalActions, type HandAction, type TileId } from '../core'
  import { forcedAction, passClaim, PLAYER, tapDiscard } from './drive'
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

  // Pacing is presentation: one forced action per tick keeps ponds and the wall
  // counter landing visibly, action by action, instead of a whole bot round at once.
  const BOT_DELAY_MS = 250

  function tap(tile: TileId) {
    const action = tapDiscard(offered, PLAYER, tile)
    if (action !== null) actions.push(action)
  }

  // The reactive fixed point that runs the table: each append re-folds and re-derives
  // `offered`, which re-runs this effect — draws (the player's included) and bot
  // tsumogiri land one per tick until forcedAction yields null, i.e. the player's
  // discard choice or the empty offering at ryuukyoku. Cleanup drops the pending
  // timer on re-run and unmount. $effect never runs in SSR, where the dealt fold
  // renders statically.
  $effect(() => {
    // The `?? passClaim` arm is the interim auto-pass: forcedAction now waits when
    // the player may claim, and until T-004-02-02's call/pass prompt replaces this
    // line, the app declines for him — trajectories stay exactly the unclaimed ones.
    const action = forcedAction(offered, PLAYER) ?? passClaim(offered, PLAYER)
    if (action === null) return
    const timer = setTimeout(() => actions.push(action), BOT_DELAY_MS)
    return () => clearTimeout(timer)
  })
</script>

<main>
  <header>mahjong</header>
  <Table {table} ontap={tap} />
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
