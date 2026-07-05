// T-011-02-01: the two outcome-notice conditions claim-window-race.tap.svelte.test.ts
// (T-011-01-01's own fixture) can't cover in the SAME walk as the loss case:
//
// - "never when the player passed" — reuses that file's seed-344 mixed-race window,
//   but taps "pass" instead of the losing chi. No new mining.
// - "never when it wins" — needs a DIFFERENT fixture. Continuing seed 344's own
//   walk into a player's own SUCCESSFUL claim (tapping the second window's chi
//   uncontested) was tried first and rejected: it surfaces a real, pre-existing,
//   OUT-OF-SCOPE crash in src/core/legal.ts's furitenSeal/waits — neither gates on
//   `state.mustDiscard`, so the instant the player's own chi/pon/daiminkan lands
//   (a real, reachable 11-concealed/1-meld shape awaiting its claim discard),
//   `waits()` throws `RangeError: waits requires 10 concealed tiles with 1 melds,
//   got 11`. No existing suite exercises a PLAYER's own successful claim through
//   the mounted App, so this was never caught before. It is out of this ticket's
//   scope (E-011 is view/drive-only; this is a src/core/ bug) — flagged in
//   review.md for separate follow-up, not fixed here.
//
// A TSUMO sidesteps that bug entirely: record.ts's applyWinTail never mutates
// `hands[seat]` for a win (the winning tile is merged only for the yaku computation,
// see applyWinTail), so the concealed-tile count furitenSeal/waits expects is
// untouched by a win — and a tsumo is always uncontested by construction (no bot
// competes for a self-draw). WIN_GAME_SEED (below) was mined for exactly this.

import { flushSync, mount, unmount } from 'svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  discardPolicy,
  foldRecord,
  kindIndexOf,
  kindOf,
  legalActions,
  seatView,
  type HandAction,
  type TableState,
  type TileId,
} from '../core'
import { claimChoices, forcedAction, PLAYER, riichiPrompt, settleWindow, winChoice } from './drive'
import { callTerm, setTerminology, windTerm, type Terminology } from './dictionary.svelte'
import { setPromptEveryLegalCall } from './call-prompt-settings.svelte'
import App from './App.svelte'

const BOT_DELAY_MS = 250
const MOUNT_GUARD_MS = 200 // ClaimPrompt.svelte/RiichiPrompt.svelte's own mount-guard.ts constant, duplicated for the timer advance

// T-011-02-03: every fixture in this file is driven under both terminologies —
// dictionary.svelte.ts's `current` rune is module-scoped, so setting it before a
// mount and reading `windTerm`/`callTerm` for the expected DOM text (rather than
// hardcoding English) is enough; no new mining is needed to prove the notice's
// content is terminology-correct end to end (app.terminology.coverage.ssr.test.ts
// already owns literal translation-correctness at the component level — this file's
// job is the DOM wiring, so reading the expectation off the same production
// functions the app itself calls is the right level of tautology here, not a gap).
const TERMINOLOGIES: readonly Terminology[] = ['romaji', 'zh-hant']

// The mixed-race fixture, verbatim from claim-window-race.tap.svelte.test.ts (that
// file's own header documents how it was mined): five tsumogiri rounds land a
// window offering West a pon and East (the player) a chi on the same tile.
const RACE_GAME_SEED = 2654435561

// Mined (scratchpad scan, core seeds 1..500, player driven via discardPolicy —
// declining every claim/ron/riichi offer, taking only an eventual tsumo — real
// bots throughout via forcedAction/settleWindow/discardPolicy/callPolicy, the
// exact functions App.svelte itself calls): core seed 396 reaches an uncontested
// tsumo for the player in 33 total actions (9 of them the player's own turns) —
// small enough for a real, un-hardcoded DOM-driven walk. `396 ^ 0x9e3779b1 >>> 0`
// is the GAME seed whose hand-0 core seed is 396 (game.ts's own handSeedOf).
const WIN_GAME_SEED = 2654435389

let cleanups: Array<() => void> = []
afterEach(() => {
  for (const cleanup of cleanups) cleanup()
  cleanups = []
  vi.useRealTimers()
  setTerminology('romaji') // app.terminology.coverage.ssr.test.ts's own reset convention
  // T-012-01-02: restore the default (filtered) setting — this suite's own step()
  // driver predates the call-prompt filter and assumes every claim/win prompts.
  setPromptEveryLegalCall(false)
  localStorage.clear()
})

beforeEach(() => {
  vi.useFakeTimers()
  // The PON_RON_GAME_SEED fixture's pon is one callPolicy itself would decline
  // (T-012-01-02's research.md) — "prompt every legal call" keeps this suite's
  // pre-ticket assumption that every offered claim/win is visible intact.
  setPromptEveryLegalCall(true)
})

function mountApp(initialSeed: number) {
  const target = document.createElement('div')
  document.body.appendChild(target)
  const app = mount(App, { target, props: { initialSeed } })
  cleanups.push(() => {
    unmount(app)
    target.remove()
  })
  flushSync()
  return target
}

function drawnButton(target: HTMLElement): HTMLButtonElement | null {
  return target.querySelector<HTMLButtonElement>('[aria-label="drawn tile"] button')
}
function callButtons(target: HTMLElement): HTMLButtonElement[] {
  return Array.from(target.querySelectorAll<HTMLButtonElement>('.prompt .call'))
}
function claimPrompt(target: HTMLElement): HTMLElement | null {
  return target.querySelector<HTMLElement>('[aria-label="call or pass"]')
}
function noticeEl(target: HTMLElement): HTMLElement | null {
  return target.querySelector<HTMLElement>('.notice')
}

async function tickUntil(
  target: HTMLElement,
  done: () => boolean,
  maxTicks = 30,
): Promise<number> {
  for (let tick = 0; tick < maxTicks; tick++) {
    if (done()) return tick
    await vi.advanceTimersByTimeAsync(BOT_DELAY_MS)
    flushSync()
  }
  throw new Error('tickUntil: exceeded maxTicks')
}

/**
 * One step of a generic driver (houtei-dismissal.tap.svelte.test.ts's own shape,
 * extended): decline every claim/ron/win offered to the player EXCEPT a tsumo
 * (which the caller stops for and takes itself), tick the bot timer when
 * `forcedAction` fires, decline a riichi offer, else play `discardPolicy`'s own
 * recommendation via a real tap. Recomputes from a state fold built alongside the
 * mount (never ahead of it), the same functions App.svelte itself calls.
 */
async function step(
  target: HTMLElement,
  state: TableState,
  offered: readonly HandAction[],
  actions: HandAction[],
): Promise<void> {
  const win = winChoice(offered, PLAYER)
  const playerClaims = claimChoices(offered, PLAYER)
  if (win !== null || playerClaims.length > 0) {
    const settled = settleWindow(state, offered, PLAYER, null)
    const passBtn = target.querySelector<HTMLButtonElement>('[aria-label="pass"]')
    if (passBtn === null) throw new Error('step: expected a pass button on an offered claim/win')
    await vi.advanceTimersByTimeAsync(MOUNT_GUARD_MS)
    flushSync()
    passBtn.click()
    flushSync()
    if (settled === null) throw new Error('step: unexpected dismissal while mining toward a win')
    actions.push(settled)
    return
  }
  const forced = forcedAction(state, offered, PLAYER, true)
  if (forced !== null) {
    await vi.advanceTimersByTimeAsync(BOT_DELAY_MS)
    flushSync()
    actions.push(forced)
    return
  }
  const rp = riichiPrompt(state, offered, PLAYER)
  if (rp !== null) {
    // A class selector, not the aria-label: T-011-02-03 runs this driver under
    // both terminologies, and RiichiPrompt's decline button's aria-label is itself
    // `term('notYet')` — terminology-dependent, unlike its stable `.pass` class.
    const notYet = target.querySelector<HTMLButtonElement>('.riichi .pass')
    if (notYet === null) throw new Error("step: expected the riichi prompt's decline button")
    await vi.advanceTimersByTimeAsync(MOUNT_GUARD_MS)
    flushSync()
    notYet.click()
    flushSync()
    actions.push(rp.decline)
    return
  }
  const rec = discardPolicy(seatView(state, PLAYER), offered)
  if (rec.type !== 'discard' || rec.seat !== PLAYER) {
    throw new Error(`step: discardPolicy returned an unexpected action: ${JSON.stringify(rec)}`)
  }
  if (state.drawn === rec.tile) {
    const button = drawnButton(target)
    if (button === null) throw new Error('step: expected the drawn-tile button')
    button.click()
  } else {
    const sorted = [...state.hands[PLAYER]].sort(
      (a, b) => kindIndexOf(kindOf(a)) - kindIndexOf(kindOf(b)),
    )
    const index = sorted.indexOf(rec.tile)
    if (index < 0) throw new Error('step: discardPolicy tile not found in the sorted hand')
    const handButtons = Array.from(
      target.querySelectorAll<HTMLButtonElement>('[aria-label="your hand"] button'),
    )
    handButtons[index]!.click()
  }
  flushSync()
  actions.push(rec)
}

// T-011-02-03: mined (scratchpad scan, core seeds 1..50000, driven by the exact
// same forcedAction/discardPolicy/riichiPrompt/settleWindow functions as `step`
// below): core seed 85 reaches, at 78 actions, a window offering the player ONLY a
// pon (tile 82, 3s, uses [83, 80]) while South (seat 1) holds a ron on the same
// tile — a pon can never outrank a ron (legal.ts's frozen precedence), so tapping
// it loses the window to South's ron. A ron always completes the hand, so this
// fixture — unlike seed 344's chi-vs-pon race — reaches `agari` mid-notice: the
// first fixture anywhere in this suite that exercises `newHand()`'s `notice = null`
// reset (T-011-02-01 review.md's own open concern #2) for real, alongside T-011-02-01
// review.md's third open concern (a ron-vs-claim outcome, not just pon-vs-pon).
// `85 ^ 0x9e3779b1 >>> 0` is the GAME seed whose hand-0 core seed is 85.
const PON_RON_GAME_SEED = 2654435812

for (const terminology of TERMINOLOGIES) {
  describe(`${terminology} terminology`, () => {
    describe('the notice never appears when the player passed (seed 344)', () => {
      it("shows nothing after passing the player's own claim, even though West's pon still resolves the window", async () => {
        setTerminology(terminology)
        const target = mountApp(RACE_GAME_SEED)

        for (let round = 0; round < 5; round++) {
          await tickUntil(target, () => drawnButton(target) !== null)
          drawnButton(target)!.click()
          flushSync()
        }
        await tickUntil(target, () => claimPrompt(target) !== null)
        expect(callButtons(target)).toHaveLength(1)

        const passBtn = target.querySelector<HTMLButtonElement>('[aria-label="pass"]')
        expect(passBtn).not.toBeNull()
        await vi.advanceTimersByTimeAsync(MOUNT_GUARD_MS)
        flushSync()
        passBtn!.click()
        flushSync()

        // The window still resolves (West's pon takes it regardless of the
        // player's own answer) — but a decline is never a lost tap, so nothing
        // names it, in either terminology.
        expect(claimPrompt(target)).toBeNull()
        expect(target.querySelector('[aria-label="west melds"]')).not.toBeNull()
        expect(noticeEl(target)).toBeNull()
      }, 20_000)
    })

    describe('the notice never appears when the player wins outright (seed 396, tsumo)', () => {
      it('shows nothing before or after taking an uncontested tsumo', async () => {
        setTerminology(terminology)
        const target = mountApp(WIN_GAME_SEED)
        const CORE_SEED = 396
        const actions: HandAction[] = []

        for (let guard = 0; guard < 60; guard++) {
          const state = foldRecord({ seed: CORE_SEED, actions })
          const offered = legalActions(state)
          const win = winChoice(offered, PLAYER)
          if (win !== null && win.type === 'tsumo') break
          await step(target, state, offered, actions)
        }

        // Fixture sanity: the win button is up, and it is the tsumo (not a ron).
        const state = foldRecord({ seed: CORE_SEED, actions })
        const offered = legalActions(state)
        const win = winChoice(offered, PLAYER)
        expect(win?.type).toBe('tsumo')
        const winButton = target.querySelector<HTMLButtonElement>('.prompt .call.win')
        expect(winButton).not.toBeNull()
        expect(noticeEl(target)).toBeNull()

        await vi.advanceTimersByTimeAsync(MOUNT_GUARD_MS)
        flushSync()
        winButton!.click()
        flushSync()

        // The hand ended by the player's own win — no notice was ever shown, and
        // taking an uncontested win doesn't manufacture one after the fact either.
        expect(claimPrompt(target)).toBeNull()
        expect(noticeEl(target)).toBeNull()
      }, 20_000)
    })

    describe('the pon/ron window ends the hand mid-notice (seed 85, game seed 2654435812)', () => {
      it("names South and ron as the winner when the player's pon loses, then clears on next-hand", async () => {
        setTerminology(terminology)
        const target = mountApp(PON_RON_GAME_SEED)
        const CORE_SEED = 85
        const actions: HandAction[] = []

        // Drive to the target window: the FIRST state offering the player only a
        // pon while a ron is also offered (a lone, no-competing-offer pon earlier
        // in this same hand is declined by `step` like any other claim window —
        // that decline is the existing "never appears when passed" doctrine, not
        // re-asserted here a second time).
        for (let guard = 0; guard < 200; guard++) {
          const state = foldRecord({ seed: CORE_SEED, actions })
          const offered = legalActions(state)
          const claims = claimChoices(offered, PLAYER)
          const win = winChoice(offered, PLAYER)
          if (
            claims.length === 1 &&
            claims[0]!.type === 'pon' &&
            win === null &&
            offered.some((a) => a.type === 'ron')
          ) {
            break
          }
          await step(target, state, offered, actions)
        }

        const state = foldRecord({ seed: CORE_SEED, actions })
        const offered = legalActions(state)
        const claims = claimChoices(offered, PLAYER)
        expect(claims).toEqual([{ type: 'pon', seat: PLAYER, tile: 82, uses: [83, 80] }])
        expect(offered.some((a) => a.type === 'ron' && a.seat === 1)).toBe(true)

        const ponButton = callButtons(target).find((b) =>
          b.getAttribute('aria-label')?.startsWith(callTerm('pon')),
        )
        expect(ponButton).not.toBeUndefined()
        await vi.advanceTimersByTimeAsync(MOUNT_GUARD_MS)
        flushSync()
        ponButton!.click()
        flushSync()

        // The tapped pon lost to South's ron — the notice names it, in the active
        // terminology (read off the same production functions App.svelte itself
        // calls, not hardcoded English — app.terminology.coverage.ssr.test.ts owns
        // literal translation-correctness at the component level).
        const notice = noticeEl(target)
        expect(notice).not.toBeNull()
        expect(notice!.querySelector('[aria-label="winner"]')!.textContent).toBe(windTerm(1))
        expect(notice!.querySelector('[aria-label="winning call"]')!.textContent).toBe(
          callTerm('ron'),
        )
        expect(notice!.querySelector('[aria-label="your call"]')!.textContent).toBe(
          callTerm('pon'),
        )

        // A ron always ends the hand: the score screen renders ALONGSIDE the
        // still-live notice (App's console cascade and Table's HandEnd are
        // structurally independent — the phase-gated hand-end screen is not one of
        // the console's four cascade tiers).
        expect(claimPrompt(target)).toBeNull()
        const nextButton = target.querySelector<HTMLButtonElement>('.next-hand')
        expect(nextButton).not.toBeNull()
        expect(noticeEl(target)).not.toBeNull()

        // The fix under test (T-011-02-01's `newHand()` reset, never exercised
        // before this fixture): starting the next hand clears the still-showing
        // notice rather than letting it survive into a hand it has nothing to say
        // about.
        nextButton!.click()
        flushSync()
        expect(noticeEl(target)).toBeNull()
      }, 20_000)
    })
  })
}
