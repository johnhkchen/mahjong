<script lang="ts">
  import { foldRecord, legalActions, type HandAction, type TileId } from '../core'
  import {
    forcedAction,
    PLAYER,
    promptChoices,
    settleWindow,
    tapClaim,
    tapDiscard,
    winChoice,
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
  // The player's claim prompt list — deduped for presentation — and his one win
  // offer: together non-empty exactly when forcedAction waits on the player's
  // window or win, so the prompt shows precisely while the loop pauses (one
  // predicate family in drive.ts). The tsumo point is the family's tap-state
  // member: the loop waits there for the discard choice regardless, and the win
  // button simply joins the live tap surface.
  const prompt = $derived(promptChoices(offered, PLAYER))
  const win = $derived(winChoice(offered, PLAYER))
  // Houtei-only presentation state: declining a houtei ron has no action to append
  // (the hand is already provisionally ended), so the pass tap just lowers the
  // prompt. Never authoritative, never reset — a single hand ends there either way.
  let dismissed = $state(false)

  // Pacing is presentation: one forced action per tick keeps ponds and the wall
  // counter landing visibly, action by action, instead of a whole bot round at once.
  const BOT_DELAY_MS = 250

  function tap(tile: TileId) {
    const action = tapDiscard(offered, PLAYER, tile)
    if (action !== null) actions.push(action)
  }

  // The three window answers all fold through settleWindow: the player's tap is one
  // candidate among the bots' callPolicy answers, and the earliest offered non-draw
  // wins the window (offered position is the rules' precedence) — a tapped chi can
  // lose to a bot's pon, any claim to a bot's ron, exactly as at a real table.
  function claim(choice: ClaimChoice) {
    const action = tapClaim(offered, PLAYER, choice)
    if (action === null) return
    const settled = settleWindow(table, offered, PLAYER, action)
    if (settled !== null) actions.push(settled)
  }

  function pass() {
    const settled = settleWindow(table, offered, PLAYER, null)
    if (settled !== null) actions.push(settled)
    else dismissed = true // nothing to fold — the houtei dismissal
  }

  function takeWin() {
    if (win === null) return
    const settled = settleWindow(table, offered, PLAYER, win)
    if (settled !== null) actions.push(settled)
  }

  // The reactive fixed point that runs the table: each append re-folds and re-derives
  // `offered`, which re-runs this effect — draws (the player's included) and the
  // bots' policy decisions (discards, calls, wins) land one per tick until
  // forcedAction yields null, i.e. the player's discard choice, his claim window
  // (the prompt owns it: claim/pass/win taps resolve the wait through settleWindow),
  // or the empty offering at ryuukyoku. Cleanup drops the pending timer on re-run
  // and unmount. $effect never runs in SSR, where the dealt fold renders statically.
  $effect(() => {
    const action = forcedAction(table, offered, PLAYER)
    if (action === null) return
    const timer = setTimeout(() => actions.push(action), BOT_DELAY_MS)
    return () => clearTimeout(timer)
  })
</script>

<main>
  <header>mahjong</header>
  <Table {table} ontap={tap} />
  <!-- Visibility is the drive predicate family: claim choices or the win offer.
       The claimed tile is the window's when one is open (a claim offer implies
       one); the tsumo and houtei moments have none and the prompt renders
       headerless. canPass hides the pass at the tsumo point only — declining a
       tsumo IS tapping a discard on the table below. -->
  <!-- The console: an always-reserved slot at the very bottom of the thumb zone,
       so a one-row prompt appears without moving the hand above it. Visibility
       stays the owner's fact — the {#if} merely lives inside the slot now. -->
  <div class="console">
    {#if (prompt.length > 0 || win !== null) && !dismissed}
      <ClaimPrompt
        claimed={table.claimable?.tile ?? null}
        choices={prompt}
        {win}
        canPass={win?.type !== 'tsumo'}
        onclaim={claim}
        onpass={pass}
        onwin={takeWin}
      />
    {/if}
  </div>
</main>

<style>
  :global(html, body) {
    margin: 0;
    background: #10241b;
    color-scheme: dark;
  }

  /* A pinned column, not a centered float: header up top, the felt stretching
     to fill (its own flex: 1), the console slot at the bottom edge — so the
     hand and prompt live in the thumb zone on any viewport height. Narrow side
     padding buys the 7-tiles-per-row hand at 360px; the bottom edge respects
     the iOS home-indicator inset. */
  main {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    gap: 0.5rem;
    min-height: 100dvh;
    padding: 1rem 0.5rem max(0.5rem, env(safe-area-inset-bottom));
    box-sizing: border-box;
    font-family: system-ui, sans-serif;
  }

  /* The reserved prompt slot: min-height, never height — a stacked multi-choice
     window may grow it, the common one-row prompt never shifts the hand. */
  .console {
    display: flex;
    align-items: flex-start;
    justify-content: center;
    width: 100%;
    max-width: 26rem;
    /* Sized to a one-row prompt exactly (44px button + prompt padding/border,
       measured 66px) — the common window opens without moving the hand above. */
    min-height: 4.25rem;
  }

  header {
    color: #a8c7b8;
    font-size: 0.9rem;
    letter-spacing: 0.2em;
    text-transform: uppercase;
  }
</style>
