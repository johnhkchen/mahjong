<script lang="ts">
  import { foldRecord } from '../core'
  import Table from './Table.svelte'

  // Arbitrary walking-skeleton seed (it matches the frozen golden vector in
  // wall.test.ts). Seed selection becomes a real feature with the game-start ticket.
  let seed = $state(1)
  // The app's authoritative state is the hand record — a seed plus its action log
  // (necessarily empty until action tickets widen HandAction). Everything on the
  // table is a fold of it; nothing else is authoritative.
  const table = $derived(foldRecord({ seed, actions: [] }))
</script>

<main>
  <header>mahjong</header>
  <Table {table} />
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
