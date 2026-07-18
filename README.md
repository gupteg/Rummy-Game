# Family Rummy — Stage 3, rev 3

## Running it

```
npm install
npm start
```

Open the URL it gives you. Whoever opens it first chooses the table size
(2–10 players) and whether the cut wild-joker is on, and becomes host.
Share the same link with everyone else.

## What changed in this revision

**Drag is fixed for real this time.** The rev 2 fix addressed a genuine
bug (a redraw could cancel a drag mid-motion), but there was a second,
more fundamental problem: dragging only worked during the narrow window
of *your own turn, after you'd drawn*. Every other moment — including
simply trying it out to see how it feels — silently did nothing, which is
almost certainly what "drag and drop failed" was actually describing.
Dragging your hand into groups now works at any time; only pressing
**Submit Declare** still correctly waits for your turn.

**Table size is now 2–10**, matching the rules specification, chosen by
the host before the game starts (previously capped at 6). Tables of 7 or
more now correctly deal from three shuffled decks, matching "3 decks for
7+ players" from the rules spec (4–6 players still use 2 decks, 2–3 still
use 1).

**Cut wild-joker can be turned off.** The host picks "Yes" or "No" before
starting. When off, no card is turned up as a wild rank at all — only
printed jokers are wild that round, exactly as the rules specification
describes.

## What I tested before sending this

All 20 automated checks now pass, run against the real running server:

- The 12 reconnection/reset/skip-turn checks from rev 1, unchanged.
- The 2 multi-deck checks from rev 2, unchanged (4 players → 2 decks).
- 6 new checks: 7 players correctly deal from 3 decks; the cut-joker
  toggle is reflected in the lobby before start; turning it off means no
  indicator card and no wild rank; turning it on (the default) still
  works as before.

What I still can't test from here is the actual feel of dragging on a
real screen — that's what your next round is for. If it still doesn't
work, the very first thing to check is whether the join screen says
**"rev 3"** — if it doesn't, the new version hasn't actually deployed yet,
and nothing below matters until it has.

## What's still deliberately not here

- No lobby password / host-handoff system yet — first joiner is simply
  always host.
- No turn timer.
- No cumulative scoring across multiple rounds.
- No number-of-jokers-per-deck setting, and no exclusion-scoring toggle
  yet (both named in the rules spec, both still to come).
