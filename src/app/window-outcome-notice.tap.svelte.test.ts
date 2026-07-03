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
import App from './App.svelte'

const BOT_DELAY_MS = 250

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
})

beforeEach(() => {
  vi.useFakeTimers()
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

describe('the notice never appears when the player passed (seed 344)', () => {
  it("shows nothing after passing the player's own claim, even though West's pon still resolves the window", async () => {
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
    passBtn!.click()
    flushSync()

    // The window still resolves (West's pon takes it regardless of the player's
    // own answer) — but a decline is never a lost tap, so nothing names it.
    expect(claimPrompt(target)).toBeNull()
    expect(target.querySelector('[aria-label="west melds"]')).not.toBeNull()
    expect(noticeEl(target)).toBeNull()
  }, 20_000)
})

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
    passBtn.click()
    flushSync()
    if (settled === null) throw new Error('step: unexpected dismissal while mining toward a win')
    actions.push(settled)
    return
  }
  const forced = forcedAction(state, offered, PLAYER)
  if (forced !== null) {
    await vi.advanceTimersByTimeAsync(BOT_DELAY_MS)
    flushSync()
    actions.push(forced)
    return
  }
  const rp = riichiPrompt(state, offered, PLAYER)
  if (rp !== null) {
    const notYet = target.querySelector<HTMLButtonElement>('[aria-label="not yet"]')
    if (notYet === null) throw new Error("step: expected the riichi prompt's decline button")
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

describe('the notice never appears when the player wins outright (seed 396, tsumo)', () => {
  it('shows nothing before or after taking an uncontested tsumo', async () => {
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

    winButton!.click()
    flushSync()

    // The hand ended by the player's own win — no notice was ever shown, and
    // taking an uncontested win doesn't manufacture one after the fact either.
    expect(claimPrompt(target)).toBeNull()
    expect(noticeEl(target)).toBeNull()
  }, 20_000)
})
