<script lang="ts">
  import {
    foldGame,
    legalActions,
    seatView,
    type GameRecord,
    type HandAction,
    type TileId,
  } from '../core'
  import {
    forcedAction,
    PLAYER,
    promptChoices,
    riichiPrompt,
    seatScoresOf,
    settleWindow,
    tapClaim,
    tapDiscard,
    tenpaiHint,
    winChoice,
    type ClaimChoice,
  } from './drive'
  import ClaimPrompt from './ClaimPrompt.svelte'
  import RiichiPrompt from './RiichiPrompt.svelte'
  import Table from './Table.svelte'

  // A fresh table per visit: the seed is drawn at boot (or pinned by a `?seed=` URL
  // param — a seeded link reproduces the exact game, the bug-report contract), and
  // redrawn by the new-game button. Determinism is untouched: the record still carries
  // its seed; only WHICH seed boots is random. Tests pin `initialSeed` as a prop.
  function drawSeed(): number {
    return Math.floor(Math.random() * 0x100000000) >>> 0
  }
  function bootSeed(): number {
    if (typeof location !== 'undefined') {
      const pinned = Number(new URLSearchParams(location.search).get('seed'))
      if (Number.isFinite(pinned) && pinned > 0) return pinned >>> 0
    }
    return drawSeed()
  }
  const { initialSeed = bootSeed() }: { initialSeed?: number } = $props()
  // svelte-ignore state_referenced_locally — initial capture is the intent: the prop
  // seeds the first game; newGame() owns every later value.
  let gameSeed = $state(initialSeed)
  // The app's authoritative state is the GAME record (T-008-03-02): a seed plus one
  // action log per hand played so far, the active hand always the LAST element
  // (game.ts's own GameRecord shape, mirrored directly rather than split across two
  // $state variables — see design.md Decision 1). Appends only, same discipline as
  // before: every pushed action is an element of legalActions output, selected
  // through the drive seam — the app never computes legality. `foldGame` derives
  // each hand's wall from `handSeedOf(gameSeed, handIndex)`, never `gameSeed`
  // directly, so a `?seed=` pin still reproduces a whole game deterministically, not
  // just its first hand.
  let hands = $state<HandAction[][]>([[]])
  const record = $derived<GameRecord>({ seed: gameSeed, hands })
  const game = $derived(foldGame(record))
  const table = $derived(game.table)
  const offered = $derived(legalActions(table))
  // Carried scores, reindexed from GameState's Player-space into THIS hand's
  // engine-Seat space — see drive.ts's seatScoresOf for why the remap is needed.
  const seatScores = $derived(seatScoresOf(game.scores, game.dealer))
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
  // The riichi decision point (T-009-03-01) — "you're tenpai, declare riichi?" — and
  // the pre-tenpai teaching hint, both pure reads over the same seatView; riichiPrompt
  // already defers to `win` on its own (drive.ts's own guard), and `hint` is gated
  // behind riichi being absent purely to skip a redundant shanten call on every
  // reactive re-run while the prompt is live (tenpaiHint already returns null at
  // shanten 0 regardless).
  const riichi = $derived(riichiPrompt(table, offered, PLAYER))
  const hint = $derived(riichi === null ? tenpaiHint(seatView(table, PLAYER)) : null)

  // Pacing is presentation: one forced action per tick keeps ponds and the wall
  // counter landing visibly, action by action, instead of a whole bot round at once.
  const BOT_DELAY_MS = 250

  // The active hand's growing action log — always the record's LAST element.
  // Read fresh on every call (never cached) so a push always lands on whichever
  // hand is currently active, across a next-hand append.
  function activeHand(): HandAction[] {
    return hands[hands.length - 1]
  }

  function tap(tile: TileId) {
    const action = tapDiscard(offered, PLAYER, tile)
    if (action !== null) activeHand().push(action)
  }

  // The three window answers all fold through settleWindow: the player's tap is one
  // candidate among the bots' callPolicy answers, and the earliest offered non-draw
  // wins the window (offered position is the rules' precedence) — a tapped chi can
  // lose to a bot's pon, any claim to a bot's ron, exactly as at a real table.
  function claim(choice: ClaimChoice) {
    const action = tapClaim(offered, PLAYER, choice)
    if (action === null) return
    const settled = settleWindow(table, offered, PLAYER, action)
    if (settled !== null) activeHand().push(settled)
  }

  function pass() {
    const settled = settleWindow(table, offered, PLAYER, null)
    if (settled !== null) activeHand().push(settled)
    else dismissed = true // nothing to fold — the houtei dismissal
  }

  function takeWin() {
    if (win === null) return
    const settled = settleWindow(table, offered, PLAYER, win)
    if (settled !== null) activeHand().push(settled)
  }

  // Both riichi buttons fold one of drive.ts's own riichiPrompt pair directly — no
  // settleWindow arbitration needed (this is the player's own-turn decision, not a
  // claim window another seat could also answer).
  function declareRiichi() {
    if (riichi === null) return
    activeHand().push(riichi.declare)
  }

  function declineRiichi() {
    if (riichi === null) return
    activeHand().push(riichi.decline)
  }

  // Append a fresh empty hand to the record — the "next hand" control (on the
  // score screen, HandEnd.svelte). Guarded defensively (the button itself is only
  // ever rendered once the active hand has ended, HandEnd's own breakdown !== null
  // gate): appending while still 'playing' would leave foldGame with two
  // simultaneously-open hands, which it rejects.
  function newHand() {
    if (table.phase === 'playing') return
    hands.push([])
  }

  // End the current GAME and start a fresh one: a new seed, a single empty hand,
  // the houtei dismissal lowered. Everything else — scores, dealer, winds —
  // re-derives from the fold. This absorbs the pre-T-008-03-02 new-game behavior
  // (which only ever reset one hand) one level up: now it also drops any prior
  // hands and their carried scores.
  function newGame() {
    gameSeed = drawSeed()
    hands = [[]]
    dismissed = false
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
    const timer = setTimeout(() => activeHand().push(action), BOT_DELAY_MS)
    return () => clearTimeout(timer)
  })
</script>

<main>
  <header>
    <span>mahjong</span>
    <button class="new-game" onclick={newGame}>new game</button>
  </header>
  <Table {table} ontap={tap} scores={seatScores} onnext={newHand} />
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
    {:else if riichi !== null}
      <RiichiPrompt tile={riichi.tile} ondeclare={declareRiichi} ondecline={declineRiichi} />
    {:else if hint !== null}
      <p class="hint">{hint} away from tenpai</p>
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

  /* The pre-tenpai teaching hint: "subtle" per the ticket — a bare line, no chrome,
     no button — sitting in the same reserved slot the prompts otherwise fill. */
  .hint {
    margin: 0;
    padding: 0.5rem 0;
    color: #a8c7b8;
    font-size: 0.75rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  header {
    display: flex;
    align-items: center;
    gap: 1rem;
    color: #a8c7b8;
    font-size: 0.9rem;
    letter-spacing: 0.2em;
    text-transform: uppercase;
  }

  /* Same visual register as the header wordmark, but a real ≥44px touch target
     (padding carries the hit area; the border keeps it discoverable as a control). */
  .new-game {
    font: inherit;
    font-size: 0.75rem;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: #a8c7b8;
    background: none;
    border: 1px solid #3d5c4c;
    border-radius: 0.375rem;
    padding: 0.65rem 0.9rem;
    min-height: 44px;
    cursor: pointer;
  }
  .new-game:active {
    background: #1c3a2c;
  }
</style>
