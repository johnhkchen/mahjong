<script lang="ts">
  import {
    foldGame,
    furitenSeal,
    legalActions,
    openYakulessTenpai,
    seatView,
    serializeGameRecord,
    yakulessTenpai,
    type GameRecord,
    type HandAction,
    type TileId,
  } from '../core'
  import {
    buildIssueUrl,
    buildReportText,
    claimWindowInterrupts,
    forcedAction,
    ownKanChoices,
    PLAYER,
    promptChoices,
    riichiPrompt,
    seatScoresOf,
    settleWindow,
    tapClaim,
    tapDiscard,
    tenpaiHint,
    winChoice,
    windowOutcome,
    type ClaimChoice,
    type WindowOutcome,
  } from './drive'
  import { promptEveryLegalCall, setPromptEveryLegalCall } from './call-prompt-settings.svelte'
  import ClaimPrompt from './ClaimPrompt.svelte'
  import { activeTerminology, setTerminology, term, type Terminology } from './dictionary.svelte'
  import KanPrompt from './KanPrompt.svelte'
  import ReportBug from './ReportBug.svelte'
  import RiichiPrompt from './RiichiPrompt.svelte'
  import Table from './Table.svelte'
  import WindowNotice from './WindowNotice.svelte'

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
  // T-012-01-02: a claim window only renders when it's interrupt-worthy — a win,
  // the "prompt every legal call" toggle, or callPolicy itself would take one of
  // the offered claims (the same accept rule every bot already calls, reused
  // rather than re-derived). A window that fails all three auto-passes through
  // forcedAction's existing settleWindow arms below, never rendering a prompt at
  // all — claimsInterrupt is the single fact both `prompt`'s visibility and the
  // loop's wait (in the $effect below) now consult, keeping them one predicate
  // family exactly as promptChoices/claimChoices always were.
  const claimsInterrupt = $derived(
    claimWindowInterrupts(table, offered, PLAYER, promptEveryLegalCall()),
  )
  const prompt = $derived(claimsInterrupt ? promptChoices(offered, PLAYER) : [])
  const win = $derived(winChoice(offered, PLAYER))
  // A window's own identity (T-011-02-02): the claimable discard's seat+tile, the
  // same vocabulary record.ts's `claimable` field already uses. A string (not the
  // claimable object itself) so the identity is legible at the call site and stays
  // value-stable across incidental re-folds that don't touch claimable (e.g. a
  // furiten seal flipping elsewhere never remounts the prompt). The tsumo point
  // has no claimable discard; it falls back to a stable literal since it ends the
  // hand and never needs to distinguish itself from a reopened window.
  const promptKey = $derived(
    table.claimable !== null ? `${table.claimable.seat}:${table.claimable.tile}` : 'no-window',
  )
  // Houtei-only presentation state: declining a houtei ron has no action to append
  // (the hand is already provisionally ended), so the pass tap just lowers the
  // prompt. Never authoritative, never reset — a single hand ends there either way.
  let dismissed = $state(false)
  // The E-011 outcome notice (T-011-02-01): who actually took a window the player
  // tapped into and lost, or null when there is nothing to report (the tap won, the
  // player passed, or the auto-dismiss timer below has cleared it). Never derived
  // from `table`/`offered` — it describes an event that already happened, so it is
  // assigned explicitly by claim()/pass()/takeWin() below, the only three places a
  // window resolves. windowOutcome (drive.ts) does the one comparison; this file
  // only renders whatever it returns.
  let notice = $state<WindowOutcome | null>(null)
  // A readable beat, deliberately longer than the 750ms the claim-window-race
  // fixture's own reopened window can arrive in (docs/active/work/T-011-02-01/
  // design.md) — long enough that the cascade below (claim prompt > notice), not
  // this timer, is what preempts a still-live notice when a fresh window reopens.
  const NOTICE_DURATION_MS = 2000
  // The riichi decision point (T-009-03-01) — "you're tenpai, declare riichi?" — and
  // the pre-tenpai teaching hint, both pure reads over the same seatView; riichiPrompt
  // already defers to `win` on its own (drive.ts's own guard), and `hint` is gated
  // behind riichi being absent purely to skip a redundant shanten call on every
  // reactive re-run while the prompt is live (tenpaiHint already returns null at
  // shanten 0 regardless).
  const riichi = $derived(riichiPrompt(table, offered, PLAYER))
  const hint = $derived(riichi === null ? tenpaiHint(seatView(table, PLAYER)) : null)
  // The own-turn kan decision (owner report #6): ankan/shouminkan offers existed in
  // legalActions since E-004 with no view consumer — the player literally could not
  // kan. Dismissal is presentation-only and keyed to the record's total action count:
  // "not now" hides the prompt for THIS decision point only; any fold (the discard,
  // a bot turn) moves the count and a later offer prompts afresh.
  const kans = $derived(ownKanChoices(offered, PLAYER))
  const actionsTotal = $derived(hands.reduce((n, hand) => n + hand.length, 0))
  let kanDismissedAt = $state(-1)
  // The furiten badge and yakuless notice (T-009-03-02) — ambient "why can't I
  // win" facts, true across many turns rather than at one decision point, so
  // they render inside Table (near the hand) rather than the console's
  // turn-gated cascade above. Both read straight off `table`, the same way
  // `riichiPrompt`/`winChoice` already do — core's own exported queries, no
  // computation of either fact happens here.
  const furitenTile = $derived(furitenSeal(table, PLAYER))
  const yakuless = $derived(yakulessTenpai(table, PLAYER))
  // The open-hand sibling (owner report #4): calls made the hand yakuless — a
  // cannot-win tenpai the closed-hand notice's menzen gate deliberately skips.
  const openYakuless = $derived(openYakulessTenpai(table, PLAYER))

  // T-013-02-01's report-bug dialog (E-013): a bug report IS a hand log
  // (architecture.md §2), so the report text is just the record's OWN notation plus
  // context, formatted by drive.ts's pure buildReportText — this file only supplies
  // the values, never assembles the string itself. `reportOpen` gates both the
  // dialog's own showModal()/close() (ReportBug.svelte's own $effect) and the input
  // guards below (design.md Decision 8 — belt-and-suspenders with the native modal's
  // own inertness, and the one thing this app's own jsdom tests can observe).
  let reportOpen = $state(false)
  let reportMessage = $state('')
  const handIndex = $derived(hands.length - 1)
  const actionCount = $derived(activeHand().length)
  const origin = $derived(typeof location !== 'undefined' ? location.origin : 'offline')
  const reportNotation = $derived(serializeGameRecord(record))
  const reportText = $derived(
    buildReportText({
      message: reportMessage,
      notation: reportNotation,
      terminology: activeTerminology(),
      handIndex,
      actionCount,
      origin,
      build: typeof __BUILD_ID__ === 'undefined' ? 'dev' : __BUILD_ID__,
      calls: promptEveryLegalCall() ? 'all' : 'quiet',
    }),
  )
  const issueLink = $derived(buildIssueUrl('Bug report', reportText))

  function openReport() {
    reportOpen = true
  }

  function closeReport() {
    reportOpen = false
  }

  function setReportMessage(text: string) {
    reportMessage = text
  }

  // Pacing is presentation: one forced action per tick keeps ponds and the wall
  // counter landing visibly, action by action, instead of a whole bot round at once.
  const BOT_DELAY_MS = 250

  // The header toggle's own display names (T-010-01-02) — NOT a dictionary.svelte.ts
  // TERMS entry: a terminology's own name doesn't change meaning under the other
  // terminology (design.md Decision 4). The button always names the terminology a
  // tap switches TO, never the one currently active.
  const TERMINOLOGY_LABEL: Record<Terminology, string> = { romaji: 'romaji', 'zh-hant': '中文' }

  function otherTerminology(t: Terminology): Terminology {
    return t === 'romaji' ? 'zh-hant' : 'romaji'
  }

  function toggleTerminology() {
    setTerminology(otherTerminology(activeTerminology()))
  }

  // The call-prompt-filter toggle's own button (T-012-01-02): names the mode a tap
  // switches TO, the identical convention TERMINOLOGY_LABEL's button already uses —
  // "prompt every call" while filtered (the default), "quiet calls" once restored.
  function toggleCallPrompting() {
    setPromptEveryLegalCall(!promptEveryLegalCall())
  }

  // The active hand's growing action log — always the record's LAST element.
  // Read fresh on every call (never cached) so a push always lands on whichever
  // hand is currently active, across a next-hand append.
  function activeHand(): HandAction[] {
    return hands[hands.length - 1]
  }

  function tap(tile: TileId) {
    // T-013-02-01 (design.md Decision 8): the table is paused while the report
    // dialog is open — belt-and-suspenders with the native <dialog>'s own modal
    // inertness, and the one guard this app's own jsdom tests can observe directly.
    if (reportOpen) return
    const action = tapDiscard(offered, PLAYER, tile)
    if (action !== null) activeHand().push(action)
  }

  // The three window answers all fold through settleWindow: the player's tap is one
  // candidate among the bots' callPolicy answers, and the earliest offered non-draw
  // wins the window (offered position is the rules' precedence) — a tapped chi can
  // lose to a bot's pon, any claim to a bot's ron, exactly as at a real table.
  function claim(choice: ClaimChoice) {
    if (reportOpen) return
    const action = tapClaim(offered, PLAYER, choice)
    if (action === null) return
    const settled = settleWindow(table, offered, PLAYER, action)
    if (settled !== null) activeHand().push(settled)
    notice = windowOutcome(action, settled)
  }

  function pass() {
    if (reportOpen) return
    const settled = settleWindow(table, offered, PLAYER, null)
    if (settled !== null) activeHand().push(settled)
    // Dismissal exists ONLY for houtei — the player holds a ron on the final
    // discard and nothing is foldable. Any OTHER null settle is a stray tap (a
    // phone double-tap, or a tap landing after the window already resolved):
    // ignore it. Before this guard a stray pass set dismissed=true and hid every
    // prompt for the rest of the hand while the engine waited — the live
    // "prompts stopped appearing" deadlock.
    else if (win !== null) dismissed = true
    // A decline is never a lost tap (there was no tap) — clear any notice left
    // over from an earlier window rather than let it survive into this one.
    notice = null
  }

  function takeWin() {
    if (reportOpen || win === null) return
    const settled = settleWindow(table, offered, PLAYER, win)
    if (settled !== null) activeHand().push(settled)
    notice = windowOutcome(win, settled)
  }

  // An own-turn kan folds directly, like riichi — no settleWindow arbitration
  // (chankan does not exist in this slice; no other seat can answer). The rinshan
  // draw and kan-dora flip are the fold's own derivations (E-004), so after the
  // push the player simply holds the replacement tile and discards as usual.
  function declareKan(choice: HandAction) {
    activeHand().push(choice)
  }

  function passKan() {
    kanDismissedAt = actionsTotal
  }

  // Both riichi buttons fold one of drive.ts's own riichiPrompt pair directly — no
  // settleWindow arbitration needed (this is the player's own-turn decision, not a
  // claim window another seat could also answer).
  function declareRiichi() {
    if (reportOpen || riichi === null) return
    activeHand().push(riichi.declare)
  }

  function declineRiichi() {
    if (reportOpen || riichi === null) return
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
    // Presentation state is per-hand: a houtei dismissal from the ENDED hand must
    // not hide the next hand's prompts (pre-E-008 this flag never outlived a hand;
    // with continuation it did — the gummed-notifications bug). `notice` gets the
    // identical reset for the identical reason — a lost-window notice from the
    // hand that just ended has nothing to say about the next one.
    dismissed = false
    notice = null
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
    notice = null
  }

  // T-013-02-02's paste-to-reproduce loader (E-013's owner half): wholesale-replace
  // the record, the same shape newGame() already uses, plus close the dialog and
  // clear its own message (a message about the DISCARDED game is misleading once a
  // different hand is loaded). `record` is fully readonly-typed; `hands` is a plain
  // mutable HandAction[][] (activeHand() pushes onto its last element), so each
  // hand needs a shallow copy — HandAction's own fields are all readonly, so this
  // never needs a deep clone.
  function loadRecord(record: GameRecord) {
    gameSeed = record.seed
    hands = record.hands.map((hand) => [...hand])
    dismissed = false
    notice = null
    reportOpen = false
    reportMessage = ''
  }

  // The reactive fixed point that runs the table: each append re-folds and re-derives
  // `offered`, which re-runs this effect — draws (the player's included) and the
  // bots' policy decisions (discards, calls, wins) land one per tick until
  // forcedAction yields null, i.e. the player's discard choice, his claim window
  // (the prompt owns it: claim/pass/win taps resolve the wait through settleWindow),
  // or the empty offering at ryuukyoku. Cleanup drops the pending timer on re-run
  // and unmount. $effect never runs in SSR, where the dealt fold renders statically.
  $effect(() => {
    const action = forcedAction(table, offered, PLAYER, promptEveryLegalCall())
    if (action === null) return
    const timer = setTimeout(() => activeHand().push(action), BOT_DELAY_MS)
    return () => clearTimeout(timer)
  })

  // The notice's own readable beat: independent of the pacing effect above (the
  // table keeps advancing underneath regardless of what the console shows) — this
  // just clears `notice` after NOTICE_DURATION_MS so it never lingers once nothing
  // higher in the cascade is preempting it. Re-runs whenever `notice` changes,
  // including to null (where it's a no-op), so a fresh notice always gets its own
  // full beat rather than inheriting a partially-elapsed timer.
  $effect(() => {
    if (notice === null) return
    const timer = setTimeout(() => {
      notice = null
    }, NOTICE_DURATION_MS)
    return () => clearTimeout(timer)
  })
</script>

<main>
  <header>
    <span>mahjong</span>
    <button class="new-game" onclick={newGame}>new game</button>
    <button
      class="terminology-toggle"
      onclick={toggleTerminology}
      aria-label={`switch to ${TERMINOLOGY_LABEL[otherTerminology(activeTerminology())]}`}
    >
      {TERMINOLOGY_LABEL[otherTerminology(activeTerminology())]}
    </button>
    <button
      class="call-prompt-toggle"
      onclick={toggleCallPrompting}
      aria-label={promptEveryLegalCall() ? term('quietCalls') : term('promptEveryCall')}
    >
      {promptEveryLegalCall() ? term('quietCalls') : term('promptEveryCall')}
    </button>
    <button class="report-bug-toggle" onclick={openReport} aria-label={term('reportBug')}>
      {term('reportBug')}
    </button>
  </header>
  <Table {table} ontap={tap} scores={seatScores} onnext={newHand} {furitenTile} yakulessTenpai={yakuless} {openYakuless} pot={game.pot} />
  <!-- Visibility is the drive predicate family: claim choices or the win offer.
       The claimed tile is the window's when one is open (a claim offer implies
       one); the tsumo and houtei moments have none and the prompt renders
       headerless. canPass hides the pass at the tsumo point only — declining a
       tsumo IS tapping a discard on the table below. -->
  <!-- The console: an always-reserved slot at the very bottom of the thumb zone,
       so a one-row prompt appears without moving the hand above it. Visibility
       stays the owner's fact — the {#if} merely lives inside the slot now. -->
  <!-- The four-tier cascade (T-011-02-01): claim prompt > outcome notice > riichi
       prompt > tenpai hint. A live decision (a claim/win offer) always preempts a
       still-showing notice — never hide an urgent tap behind a transient toast, and
       a fresh window's own claim prompt is exactly what makes a stale notice from
       the PRIOR window stop rendering, well before its own timer would clear it
       (claim-window-race.tap.svelte.test.ts's reopened-window assertion exercises
       this directly). A notice, in turn, always preempts the ordinary per-turn
       cascade beneath it — the player learns what just happened before being asked
       what's next. riichi/hint keep their prior relative order, unchanged. -->
  <div class="console">
    {#if (prompt.length > 0 || win !== null) && !dismissed}
      <!-- Keyed on the window's own identity (claimable seat+tile) so a new window
           always remounts — never patches the prior prompt's DOM in place — which is
           what lets the entry beat (ClaimPrompt.svelte) restart on every window. -->
      {#key promptKey}
        <ClaimPrompt
          claimed={table.claimable?.tile ?? null}
          choices={prompt}
          {win}
          canPass={win?.type !== 'tsumo'}
          onclaim={claim}
          onpass={pass}
          onwin={takeWin}
        />
      {/key}
    {:else if notice !== null}
      <WindowNotice outcome={notice} />
    {:else if kans.length > 0 && kanDismissedAt !== actionsTotal}
      <!-- Kan precedes riichi in the cascade: its "not now" is a pure dismissal
           (nothing folds), so a declined kan falls straight through to the riichi
           prompt at the SAME decision point — the reverse order would fold riichi's
           decline discard and lose the kan chance. -->
      <KanPrompt choices={kans} ondeclare={declareKan} onpass={passKan} />
    {:else if riichi !== null}
      <RiichiPrompt tile={riichi.tile} ondeclare={declareRiichi} ondecline={declineRiichi} />
    {:else if hint !== null}
      <!-- hint 0 = tenpai with no riichi prompt owning the moment (an open hand,
           or riichi unaffordable/unavailable) — say it plainly (owner report #4). -->
      <p class="hint">
        {#if hint === 0}{term('tenpai')} — a discard can keep it{:else}{hint} away from {term('tenpai')}{/if}
      </p>
    {/if}
  </div>
  <ReportBug
    open={reportOpen}
    message={reportMessage}
    report={reportText}
    {issueLink}
    onmessage={setReportMessage}
    onclose={closeReport}
    onload={loadRecord}
  />
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
     (padding carries the hit area; the border keeps it discoverable as a control).
     Shared with .terminology-toggle via this selector, not a shared class name —
     `.new-game` stays a functionally meaningful class elsewhere (e.g.
     app.controls.svelte.test.ts's `querySelector('.new-game')`), so the toggle gets
     its own class and only borrows the declarations (design.md Decision 3). */
  .new-game,
  .terminology-toggle,
  .call-prompt-toggle,
  .report-bug-toggle {
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
  .new-game:active,
  .terminology-toggle:active,
  .call-prompt-toggle:active,
  .report-bug-toggle:active {
    background: #1c3a2c;
  }
</style>
