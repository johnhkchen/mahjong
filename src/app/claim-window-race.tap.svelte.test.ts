// T-011-01-01: characterization tests for the E-011 "gummed claim prompt" report
// (owner playtest 2026-07-04: "the chi dialogue appears twice... seems like a race
// condition"). Mounts the REAL App (mirrors app.riichi.tap.svelte.test.ts's
// fake-timer/flushSync pattern) and drives it through real taps, pinning CURRENT
// behavior with `// DEFECT:` markers where the E-011 fix tickets (T-011-02-*) will
// flip the assertions. settleWindow's arbitration itself is correct and untested
// here — drive.test.ts already covers it at the pure-function level; this suite
// only asks what the PLAYER SEES when it runs inside the mounted app.
//
// Seed 344 (frozen, mined by src/app/drive.ts-style forcedAction/settleWindow
// driving — a scratchpad scan over gameSeeds 1..400, tsumogiri on the player's own
// turns, replayed once and pinned): five tsumogiri rounds (East draws+discards,
// then South/West/North by real policy) land North's 5th discard on tile 30 (8m).
// The window offers West a pon [28, 29] (both 8m) AND East (the player) two
// duplicate-copy chi variants using [37, 44]/uses differ only in which 6m copy —
// deduped by promptChoices to the one button "chi 8m with 6m 7m". A pon is offered
// before any chi (legal.ts's frozen precedence), so the window is a genuine mixed
// race: tapping the player's only chi choice loses to West's pon regardless. West
// then owes its claim discard (tile 38), North draws and discards tile 76 (2s) —
// and THAT discard opens a second window, offering the player three chi variants
// on 2s (uses [83,87]/[83,84]/[83,86], all "3s4s" in kind), deduped to one button
// "chi 2s with 3s 4s" — a different window, same call type, same one-button
// layout, opening within three forced bot ticks (~750ms) of the first window
// closing. This is the exact "appears twice" shape from the report.
const RACE_GAME_SEED = 2654435561 // `344 ^ 0x9e3779b1 >>> 0` — game.ts's handSeedOf(gameSeed, 0) === 344

import { flushSync, mount, unmount } from 'svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { callTerm, setTerminology, windTerm, type Terminology } from './dictionary.svelte'
import App from './App.svelte'

const BOT_DELAY_MS = 250 // App.svelte's own pacing constant, duplicated per convention
const MOUNT_GUARD_MS = 200 // ClaimPrompt.svelte's own mount-guard.ts constant, duplicated per convention

// T-011-02-03: the whole lifecycle walk (open → lose → notice → reopen → remount →
// cascade-preempt) runs under both terminologies — the DOM-structural assertions
// (isConnected, className, !==) are terminology-independent and unchanged; only the
// notice/aria-label text expectations are read off callTerm/windTerm instead of
// hardcoded English (app.terminology.coverage.ssr.test.ts owns literal translation-
// correctness at the component level).
const TERMINOLOGIES: readonly Terminology[] = ['romaji', 'zh-hant']

let cleanups: Array<() => void> = []
afterEach(() => {
  for (const cleanup of cleanups) cleanup()
  cleanups = []
  vi.useRealTimers()
  setTerminology('romaji')
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

/** Ticks the bot pacing timer forward until `done` is true; returns the tick count
 * actually spent, or throws past maxTicks (mirrors app.riichi.tap.svelte.test.ts's
 * own tickUntil, extended to report how many ticks it took — this suite cares not
 * just THAT a window reopens but how QUICKLY, per the "appears twice" report). */
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

for (const terminology of TERMINOLOGIES) {
  describe(`${terminology} terminology`, () => {
    describe('the mixed claim-window race (seed 344)', () => {
      it("loses the player's chi to West's pon with no visible outcome, then a second chi window opens within three ticks", async () => {
        setTerminology(terminology)
        const target = mountApp(RACE_GAME_SEED)

        // Five tsumogiri rounds — the player tsumogiris his own draw each time, the
        // bots resume by real policy in between (tickUntil, same as every other
        // App-mounted suite; no action count is hardcoded on the app side).
        for (let round = 0; round < 5; round++) {
          await tickUntil(target, () => drawnButton(target) !== null)
          drawnButton(target)!.click()
          flushSync()
        }

        // The window is up: exactly one claim button (the deduped chi variants), no
        // win offer (nobody's tenpai here) — fixture sanity before the race itself.
        await tickUntil(target, () => claimPrompt(target) !== null)
        const firstPromptNode = claimPrompt(target)!
        const firstCalls = callButtons(target)
        expect(firstCalls).toHaveLength(1)
        expect(firstCalls[0]!.getAttribute('aria-label')).toBe(`${callTerm('chi')} 8m with 6m 7m`)
        expect(target.querySelector('[aria-label="west melds"]')).toBeNull()

        const handTilesBefore = target.querySelectorAll('[aria-label="your hand"] button').length

        // T-012-01-01: past the mount-guard beat before the player's tap — this
        // prompt has been up since before the race itself, so the beat is long since
        // over, but a bare click here would otherwise silently no-op.
        await vi.advanceTimersByTimeAsync(MOUNT_GUARD_MS)
        flushSync()

        // The player taps his only claim — and loses the window to West's pon: rules-
        // correct atamahane/priority (pon precedes chi), but nothing in the rendered
        // output says so.
        firstCalls[0]!.click()
        flushSync()

        // The window closed (the prompt is gone — settleWindow resolved to SOMETHING),
        // and the fold went to West, not the player: West holds a fresh meld and
        // North's discard wears the claimed mark, while the player's own hand is
        // untouched.
        expect(claimPrompt(target)).toBeNull()
        expect(target.querySelectorAll('[aria-label="your hand"] button')).toHaveLength(
          handTilesBefore,
        )
        const westMelds = target.querySelector('[aria-label="west melds"]')
        expect(westMelds).not.toBeNull()
        expect(westMelds!.querySelector('[aria-label="claimed 8m from north"]')).not.toBeNull()
        // FIXED (T-011-02-01): the lost tap now names what happened — an outcome
        // notice (App.svelte's `notice` state, drive.ts's windowOutcome) says who
        // took the window and with what, and what the player's own tap was — in the
        // active terminology (T-011-02-03: read off windTerm/callTerm, not
        // hardcoded English).
        const notice = target.querySelector('.notice')
        expect(notice).not.toBeNull()
        expect(notice!.querySelector('[aria-label="winner"]')!.textContent).toBe(windTerm(2))
        expect(notice!.querySelector('[aria-label="winning call"]')!.textContent).toBe(
          callTerm('pon'),
        )
        expect(notice!.querySelector('[aria-label="your call"]')!.textContent).toBe(
          callTerm('chi'),
        )

        // West owes its claim discard, North draws and discards next — and THAT
        // discard opens a second window for the player: same call type (chi), same
        // one-button layout, no distinguishing marker from the first prompt at all.
        // Frozen (mined): this reopening takes exactly 3 forced ticks (West's claim
        // discard, North's draw, North's discard) — well inside the epic's own
        // "~250ms later" description of the report.
        const ticks = await tickUntil(target, () => claimPrompt(target) !== null, 6)
        expect(ticks).toBe(3)

        const secondPromptNode = claimPrompt(target)!
        const secondCalls = callButtons(target)
        expect(secondCalls).toHaveLength(1)
        expect(secondCalls[0]!.getAttribute('aria-label')).toBe(`${callTerm('chi')} 2s with 3s 4s`)

        // FIXED (T-011-02-02): the shared aria-label SHAPE and className are expected
        // chrome for two same-call-type windows, not a defect — what actually matters
        // is that the second prompt is a genuinely fresh mount, never the first prompt
        // patched in place. App.svelte keys the console's ClaimPrompt on the window's
        // own claimable seat+tile, so a new window always tears down the old DOM and
        // mounts a new one — which is what lets the CSS entry beat (ClaimPrompt.svelte,
        // @starting-style, 200ms, prefers-reduced-motion-gated) restart on every
        // window. `isConnected` is the fact a same-node patch cannot produce: a patch
        // leaves the original node attached with updated attributes; a remount detaches
        // it before the new node exists.
        expect(secondPromptNode.getAttribute('aria-label')).toBe(
          firstPromptNode.getAttribute('aria-label'),
        )
        expect(secondPromptNode.className).toBe(firstPromptNode.className)
        expect(secondPromptNode).not.toBe(firstPromptNode)
        expect(firstPromptNode.isConnected).toBe(false)

        // Cascade priority (T-011-02-01, App.svelte: claim prompt > outcome notice >
        // riichi prompt > hint): the first window's notice has a 2000ms readable beat
        // (App.svelte's NOTICE_DURATION_MS) — comfortably longer than the 750ms this
        // reopen took — so it is still logically live right now. The console shows the
        // fresh claim prompt anyway: a live decision always preempts a still-showing
        // notice, never the reverse.
        expect(target.querySelector('.notice')).toBeNull()
      }, 20_000)
    })
  })
}
