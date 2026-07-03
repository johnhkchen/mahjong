// SSR smoke test: the view renders through the real Svelte compiler, and everything
// on the table is derived from core's seeded record fold — not typed into the markup.
// Asserts content (tile kinds, counts, labels) and aria landmarks only, never classes
// or structure, so Table's and Tile's internals stay free to change. Mid-hand and
// wall-exhausted states render Table directly with hand-authored folded records — the
// stateless view's whole contract is its one prop.

import { render } from 'svelte/server'
import { describe, expect, it } from 'vitest'
import { foldRecord, kindOf, legalActions, type HandAction, type TileId } from '../core'
import { PLAYER, promptChoices, winChoice } from './drive'
import App from './App.svelte'
import ClaimPrompt from './ClaimPrompt.svelte'
import Table from './Table.svelte'

// The walking-skeleton boot seed in App.svelte. If the app's seed changes, this is the
// one place the test learns about it.
const BOOT_SEED = 1

/**
 * Every tile-looking text token in the SSR output. Nothing else on the table can
 * match: wind names are words, counts have no single-digit [mpsz] suffix.
 */
function tileTokensOf(body: string): string[] {
  return [...body.matchAll(/>([1-9][mpsz])</g)].map((m) => m[1])
}

/**
 * The tile tokens inside the element labeled `label`, in document order. Slices from
 * the aria-label to the first `closeTag` after it — sound because every labeled tile
 * region is a flat list (no nested elements of its own tag). Fails loudly on a missing
 * label so a rename can't pass as empty-equals-empty.
 */
function regionTokens(body: string, label: string, closeTag = '</ul>'): string[] {
  const start = body.indexOf(`aria-label="${label}"`)
  expect(start, `no element labeled "${label}" in the SSR output`).toBeGreaterThanOrEqual(0)
  const end = body.indexOf(closeTag, start)
  return tileTokensOf(body.slice(start, end + closeTag.length))
}

/**
 * An all-tsumogiri script of n full turns: turn k is seat k%4 drawing and immediately
 * discarding. Draws consume the post-deal live wall head-first (the frozen wall
 * convention), so turn k's tile is live[k] — read off the empty fold, never recomputed.
 */
function tsumogiriTurns(live: readonly TileId[], n: number): HandAction[] {
  return Array.from({ length: n }, (_, k): HandAction[] => {
    const seat = (k % 4) as 0 | 1 | 2 | 3
    return [
      { type: 'draw', seat },
      { type: 'discard', seat, tile: live[k] },
    ]
  }).flat()
}

describe('dealt-table view (SSR)', () => {
  const { body } = render(App)
  const table = foldRecord({ seed: BOOT_SEED, actions: [] })

  it('renders exactly the 13 dealt tiles and the dora indicator, derived via the core fold', () => {
    const expected = [...table.hands[0].map(kindOf), kindOf(table.doraIndicator)]
    // Multiset equality: containment of the dealt hand + indicator, and nothing more
    // renders as a tile.
    expect([...tileTokensOf(body)].sort()).toEqual([...expected].sort())
  })

  it('names the hand and dora-indicator regions for assistive tech', () => {
    expect(body).toContain('aria-label="your hand"')
    expect(body).toContain('aria-label="dora indicator"')
  })

  it('renders every hand tile as a labeled discard button — the tap surface', () => {
    const start = body.indexOf('aria-label="your hand"')
    const hand = body.slice(start, body.indexOf('</ul>', start))
    expect(hand.split('aria-label="discard ').length - 1).toBe(13)
  })

  it('replaces the wall-count placeholder with the live-wall remaining count', () => {
    expect(body).toContain(`${table.live.length} tiles left`)
    expect(body).not.toContain('tiles in the wall')
  })

  it('renders all four wind seats exactly once', () => {
    for (const wind of ['East', 'South', 'West', 'North']) {
      expect(body.split(wind).length - 1).toBe(1)
    }
  })

  it('exposes the table landmark', () => {
    expect(body).toContain('aria-label="mahjong table"')
  })
})

// Hand-authored mid-hand record: 8 complete turns (each seat discards twice) with
// East's first discard swapped to tedashi of a dealt tile — so East's pond order is a
// fact only the log explains, not any sort — then a pending 9th draw by East. One
// record exercises ponds, turn marker, drawn tile, and wall countdown at once.
const dealt = foldRecord({ seed: BOOT_SEED, actions: [] })
const midHandActions = tsumogiriTurns(dealt.live, 8)
midHandActions[1] = { type: 'discard', seat: 0, tile: dealt.hands[0][0] }
midHandActions.push({ type: 'draw', seat: 0 })
const midHand = foldRecord({ seed: BOOT_SEED, actions: midHandActions })

const PONDS = ['east pond', 'south pond', 'west pond', 'north pond'] as const

describe('mid-hand table view (SSR)', () => {
  const { body } = render(Table, { props: { table: midHand } })

  it('renders all four ponds with their tiles in discard order', () => {
    for (const [seat, label] of PONDS.entries()) {
      // Ordered deep-equal, not multiset: the pond's order IS its meaning.
      expect(regionTokens(body, label), label).toEqual(midHand.ponds[seat].map(kindOf))
    }
  })

  it('marks exactly the active seat', () => {
    expect(midHand.turn).toBe(0) // fixture sanity: it is East's turn
    expect(body.split('aria-current="true"').length - 1).toBe(1)
    // East is the first seat in document order — the one marked seat precedes South's.
    expect(body.indexOf('aria-current="true"')).toBeLessThan(body.indexOf('South'))
  })

  it('shows the freshly drawn tile apart from the 13-tile sorted hand', () => {
    expect(midHand.drawn).not.toBeNull()
    expect(regionTokens(body, 'drawn tile', '</span>')).toEqual([kindOf(midHand.drawn!)])
    expect(regionTokens(body, 'your hand')).toHaveLength(13)
  })

  it('renders the drawn tile as a labeled discard button — tsumogiri is a tap too', () => {
    const start = body.indexOf('aria-label="drawn tile"')
    const drawn = body.slice(start, body.indexOf('</button>', start))
    expect(drawn).toContain(`aria-label="discard ${kindOf(midHand.drawn!)}"`)
  })

  it('counts down the live wall', () => {
    expect(midHand.live.length).toBe(61) // fixture sanity: 70 − 9 draws
    expect(body).toContain(`${midHand.live.length} tiles left`)
  })
})

// The seed-15 mixed claim window (the frozen drive.test.ts anchor): after eight
// tsumogiri turns North discards 45 (3p); East holds a pon [44,47] and two
// shape-distinct chis [41,51] (2p+4p) and [51,55] (4p+5p). The prompt's props are
// DERIVED here — promptChoices over the live offering — never typed in.
describe('claim prompt view (SSR)', () => {
  const dealt15 = foldRecord({ seed: 15, actions: [] })
  const window15 = foldRecord({ seed: 15, actions: tsumogiriTurns(dealt15.live, 8) })
  const choices = promptChoices(legalActions(window15), PLAYER)
  const { body } = render(ClaimPrompt, {
    props: { claimed: window15.claimable!.tile, choices },
  })

  it('exposes the call-or-pass group landmark', () => {
    expect(body).toContain('aria-label="call or pass"')
  })

  it('renders the claimed tile and every choice\'s hand tiles, in offered order', () => {
    // Header 3p, then pon 3p+3p, chi 2p+4p, chi 4p+5p — document order is the
    // frozen offered order (pon before chis, shapes ascending).
    expect(regionTokens(body, 'call or pass', '</aside>')).toEqual([
      '3p',
      '3p',
      '3p',
      '2p',
      '4p',
      '4p',
      '5p',
    ])
  })

  it('labels one call button per deduped choice — chi variants named by their shapes', () => {
    expect(choices).toHaveLength(3) // fixture sanity: the anchor's pon + two chis
    expect(body).toContain('aria-label="pon 3p with 3p 3p"')
    expect(body).toContain('aria-label="chi 3p with 2p 4p"')
    expect(body).toContain('aria-label="chi 3p with 4p 5p"')
  })

  it('renders the pass button', () => {
    expect(body).toContain('aria-label="pass"')
  })

  it('displays a daiminkan choice as a kan button', () => {
    // The seed-212 anchor: East's three 8s copies — three pon pairs dedupe to one
    // button and the kan keeps its own. Vocabulary: the button says "kan"; the
    // payload keeps the record's discriminant.
    const dealt212 = foldRecord({ seed: 212, actions: [] })
    const window212 = foldRecord({ seed: 212, actions: tsumogiriTurns(dealt212.live, 6) })
    const kanChoices = promptChoices(legalActions(window212), PLAYER)
    const kan = render(ClaimPrompt, {
      props: { claimed: window212.claimable!.tile, choices: kanChoices },
    }).body
    expect(body).not.toContain('aria-label="kan') // the mixed window offers no kan
    expect(kan).toContain('aria-label="pon 8s with 8s 8s"')
    expect(kan).toContain('aria-label="kan 8s with 8s 8s 8s"')
  })

  it('shows no prompt at the freshly dealt boot — nothing is claimable', () => {
    expect(render(App).body).not.toContain('call or pass')
  })
})

// The win-prompt moments, props DERIVED from live offers at the frozen drive.test.ts
// win anchors (mined geometries documented there): seed 542630 — East's turn-32 draw
// 69 (9p) is its tsumo point; seed 887141 — North's turn-3 discard 31 (8m) opens a
// window where East holds the ron AND a pon AND chis; seed 1038928 — the final
// discard 21 (6m) is East's houtei chiitoitsu, a ryuukyoku offering with no draw.
describe('win prompt view (SSR)', () => {
  it('renders the tsumo button alone at the tsumo point — no pass, declining IS discarding', () => {
    const dealtT = foldRecord({ seed: 542630, actions: [] })
    const point = foldRecord({
      seed: 542630,
      actions: [...tsumogiriTurns(dealtT.live, 32), { type: 'draw', seat: 0 }],
    })
    const offered = legalActions(point)
    const { body } = render(ClaimPrompt, {
      props: {
        claimed: point.claimable?.tile ?? null,
        choices: promptChoices(offered, PLAYER),
        win: winChoice(offered, PLAYER),
        canPass: false,
      },
    })
    expect(body).toContain('aria-label="tsumo"')
    expect(body).not.toContain('aria-label="pass"')
    expect(body).not.toContain('call on') // no window tile — the button IS the moment
  })

  it('renders the ron beside the coexisting calls at the shanpon window, win first', () => {
    const dealtS = foldRecord({ seed: 887141, actions: [] })
    const window = foldRecord({ seed: 887141, actions: tsumogiriTurns(dealtS.live, 4) })
    const offered = legalActions(window)
    const { body } = render(ClaimPrompt, {
      props: {
        claimed: window.claimable!.tile,
        choices: promptChoices(offered, PLAYER),
        win: winChoice(offered, PLAYER),
        onpass: () => {},
      },
    })
    expect(body).toContain('aria-label="ron 8m"')
    expect(body).toContain('aria-label="pon 8m with 8m 8m"')
    expect(body).toContain('aria-label="pass"')
    // Document order is the offered order: the win leads the calls.
    expect(body.indexOf('aria-label="ron 8m"')).toBeLessThan(
      body.indexOf('aria-label="pon 8m'),
    )
  })

  it('renders the houtei ron with its winning tile and the pass — the dismissal', () => {
    const dealtH = foldRecord({ seed: 1038928, actions: [] })
    const end = foldRecord({ seed: 1038928, actions: tsumogiriTurns(dealtH.live, 70) })
    const offered = legalActions(end)
    const { body } = render(ClaimPrompt, {
      props: {
        claimed: end.claimable?.tile ?? null,
        choices: promptChoices(offered, PLAYER),
        win: winChoice(offered, PLAYER),
      },
    })
    expect(end.phase).toBe('ryuukyoku')
    expect(body).toContain('aria-label="ron 6m"')
    expect(body).toContain('aria-label="pass"')
    expect(body).not.toContain('call on')
  })
})

// The seed-3 race window driven one step further (the drive.test.ts claim walk's
// exact actions): four tsumogiri turns, then East chis North's 42 (2p) with
// [37, 47] (1p+3p) — the fold exposes the meld, keeps 42 counted in North's pond,
// and hands East the claim discard.
describe('meld display (SSR)', () => {
  const dealt3 = foldRecord({ seed: 3, actions: [] })
  const claimed = foldRecord({
    seed: 3,
    actions: [
      ...tsumogiriTurns(dealt3.live, 4),
      { type: 'chi', seat: 0, tile: 42, uses: [37, 47] },
    ],
  })
  const { body } = render(Table, { props: { table: claimed } })

  it('exposes the meld beside the hand: own tiles then the claimed tile, marked with its source', () => {
    expect(claimed.melds[0]).toEqual([{ type: 'chi', claimed: 42, from: 3, own: [37, 47] }])
    expect(regionTokens(body, 'east melds')).toEqual(['1p', '3p', '2p'])
    expect(body).toContain('aria-label="claimed 2p from north"')
  })

  it('keeps the claimed tile counted in the discarder\'s pond, wearing the claimed mark', () => {
    // The pond renders the COMPLETE discard history — the claimed tile is marked,
    // never removed (core's furiten/defense posture made visible).
    expect(claimed.ponds[3].map(kindOf)).toContain('2p')
    expect(regionTokens(body, 'north pond')).toEqual(claimed.ponds[3].map(kindOf))
    expect(body).toContain('aria-label="claimed 2p"')
  })

  it('renders no melds list for seats without melds', () => {
    expect(body).not.toContain('aria-label="south melds"')
    expect(body.split('melds"').length - 1).toBe(1) // exactly one melds region: East's
  })

  it('hands the turn to the caller with the claim discard owed from an 11-tile hand', () => {
    expect(claimed.turn).toBe(0)
    expect(claimed.mustDiscard).toBe(true)
    const start = body.indexOf('aria-label="your hand"')
    const hand = body.slice(start, body.indexOf('</ul>', start))
    expect(hand.split('aria-label="discard ').length - 1).toBe(11)
    // The turn marker sits on East — play resumes from the caller.
    expect(body.indexOf('aria-current="true"')).toBeLessThan(body.indexOf('South'))
  })
})

// The hand-end screen: won records folded from the frozen win anchors. The player's
// tsumo (seed 542630, drive.test.ts's agari walk verbatim) and a bot's ron (core's
// seed-3951 anchor: seat 3 rons East's turn-0 tsumogiri 72, 1s) — the screen names
// winner, winning tile, and yaku off table.win, never off the markup's own math.
describe('hand-end view (SSR)', () => {
  const dealtWin = foldRecord({ seed: 542630, actions: [] })
  const won = foldRecord({
    seed: 542630,
    actions: [
      ...tsumogiriTurns(dealtWin.live, 32),
      { type: 'draw', seat: 0 },
      { type: 'tsumo', seat: 0 },
    ],
  })
  const { body } = render(Table, { props: { table: won } })

  it('names the winner, marked as you when the player won', () => {
    expect(won.win?.winner).toBe(0) // fixture sanity
    // Whitespace-collapsed: the sentence is the fact, the SSR line wrapping is not.
    expect(body.replace(/\s+/g, ' ')).toContain('East (you) wins by tsumo')
  })

  it('shows the winning tile in its own labeled region', () => {
    expect(regionTokens(body, 'winning tile', '</span>')).toEqual([
      kindOf(won.win!.tile),
    ])
  })

  it('lists every yaku the fold recorded, by name', () => {
    expect(won.win?.yaku).toEqual(['menzen-tsumo', 'pinfu']) // fixture sanity
    const start = body.indexOf('aria-label="yaku"')
    expect(start).toBeGreaterThanOrEqual(0)
    const yakuList = body.slice(start, body.indexOf('</ul>', start))
    for (const name of won.win!.yaku) {
      expect(yakuList).toContain(`>${name}<`)
    }
  })

  it('marks no seat active and shows no ryuukyoku line on a won hand', () => {
    expect(body).not.toContain('aria-current')
    expect(body).not.toContain('ryuukyoku')
  })

  it("names a bot winner by wind with the ron's discarder — and no you-mark", () => {
    const live3951 = foldRecord({ seed: 3951, actions: [] }).live
    const botWon = foldRecord({
      seed: 3951,
      actions: [...tsumogiriTurns(live3951, 1), { type: 'ron', seat: 3, tile: 72 }],
    })
    expect(botWon.win).toMatchObject({ by: 'ron', winner: 3, from: 0 })
    const bot = render(Table, { props: { table: botWon } }).body
    expect(bot.replace(/\s+/g, ' ')).toContain('North wins by ron from East')
    expect(bot).not.toContain('(you) wins')
    expect(regionTokens(bot, 'winning tile', '</span>')).toEqual(['1s'])
  })
})

// Wall-exhausted record: all 70 post-deal live tiles drawn and discarded tsumogiri —
// the fold ends in ryuukyoku exactly as the last discard lands.
describe('wall-exhausted table view (SSR)', () => {
  const exhausted = foldRecord({ seed: BOOT_SEED, actions: tsumogiriTurns(dealt.live, 70) })
  const { body } = render(Table, { props: { table: exhausted } })

  it('shows the ryuukyoku end state with the wall at zero', () => {
    expect(exhausted.phase).toBe('ryuukyoku')
    expect(body).toContain('ryuukyoku')
    expect(body).toContain('0 tiles left')
  })

  it('marks no seat as active once the hand has ended', () => {
    expect(body).not.toContain('aria-current')
  })
})
