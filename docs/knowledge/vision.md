# Mahjong — Vision

**A pocket mahjong parlor that teaches you to play — offline, in your palm, real tiles.**

Mahjong is a faithful implementation of four-player Riichi (Japanese) mahjong against three AI
opponents. It is entry #4 in the b28.dev tortoise-vs-hare series, and it is deliberately the
tortoise's home court: a real, above-the-line project worth maintaining in its own repo, not a
frozen demo. Riichi is the assumed ruleset — the most popular among young players and the
richest to teach (riichi, dora, yaku, han/fu scoring) — but the ruleset choice (Riichi vs.
Chinese Classical vs. Hong Kong) is one the owner can still redirect; the engine isolates it so
the redirect stays cheap. **Owner direction (2026-07-02): the first alternate ruleset, gated
behind the definition of done, is Taiwanese 16-tile (16-tile hands, flowers in play, tai
scoring); the tile aesthetic is Taiwan-style from the start, with the eight flower tiles drawn
into the original art set.**

## The series bet

The unifying thesis of the series is a **regime map**. Below the line — a program that fits in
under a thousand lines and holds in a single context — the one-shot hare wins outright and the
pipeline is pure overhead. Above the line — a program larger than any single response can hold —
the one-shot can't finish at all, and the tortoise's whole story is the *effort* it takes to get
there. Full four-player mahjong sits firmly **above the line**: wall building, the dead wall and
dora indicators, draws and discards, calls (chi/pon/kan), riichi and tenpai, yaku detection, and
han/fu scoring do not fit one response. The hare can one-shot a *tile-matching solitaire* — the
lesser game most people have actually tapped — because that game is below the line: no opponents,
no calls, no yaku, no scoring, just matching pairs on a layout. It cannot one-shot a *parlor
where a real hand is dealt, called, and scored*. That gap is the exhibit.

## Definition of done

**"Someone who only ever tapped mahjong-solitaire finishes a real hand — and calls riichi on
purpose."** Not a demo bar — a learning bar. Most young people have only ever played mahjong
*solitaire* (tile-matching on a layout), a different and lesser game. Success is the moment a
solitaire-tapper sits down at a real four-player table, reaches tenpai, understands why, declares
riichi deliberately, and wins the hand knowing which yaku they made. Retention comes from
actually learning the yaku — the app is worth reopening because you are getting better at a real
game.

## What it is

- **Real four-player Riichi mahjong** — a full wall of 136 tiles, dead wall, dora indicator,
  deal, draw and discard, legal calls (chi/pon/kan), win detection (agari), and han/fu scoring,
  played as a hanchan (East + South) or the shorter tonpuusen (East only).
- **Three competent, non-cheating bots** — solo play is first-class; the opponents see only what
  a player would see, draw from the same wall, and play a real defensive game.
- **Teaching-first** — the point is fun *and* learning. Shanten/tenpai awareness, legible yaku,
  dora explained, safe-tile hints, and post-hand review are the crown, not decoration.
- **Offline-first, semi-PWA** — saved to the iOS home screen and fully playable with no network:
  a young person learning real mahjong solo on the train, on a couch, anywhere.
- **Original tile art** — mahjong is a traditional public-domain game, so the name is used
  freely, but the artwork is drawn original. We never ship a specific commercial tile set
  (artwork-copyright / asset-provenance rule).
- Deployed at `mahjong.b28.dev`, embedded in the b28.dev games showdown page, auto-deployed from
  GitHub on push to main.

## What it is not

- **Not a game service** — no accounts, no server, no online play, no multiplayer lobbies, no
  matchmaking, no anti-cheat, no ranking ladder. One learner, one phone, offline. The threat
  model is "a person on a train with no signal."
- **Not tile-matching solitaire** — the thing most people call "mahjong" on a phone is a
  single-player pair-matching layout puzzle. This is the actual four-player game those tiles were
  made for, and drawing the distinction is half the point.
- **Not a commercial tile set** — original art only; no scanned or cloned proprietary tiles.
