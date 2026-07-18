# Family Rummy — Stage 3, rev 4

## Running it

```
npm install
npm start
```

Open the URL it gives you and just type a name — that's it. The lobby is
open: anyone can join at any time before the host clicks Start. The first
person to join is the host, and only the host sees a control to turn the
cut wild-joker on or off. Nobody else can change it, and nobody sets a
player count — the game starts with however many people have joined when
the host presses Start (minimum 2, maximum 10).

## What changed in this revision

**1. Tapping a card no longer yanks it into drag mode.** There's now a
small movement threshold — a plain tap toggles selection, and only a real
drag (finger or mouse actually moving) starts moving the card.

**2. You can reorder cards within your own hand.** Drag a card to a new
spot among your other cards and it moves there. Your arrangement is
remembered as you draw and discard through the round.

**3. You can drag a card straight onto the discard pile** to discard it,
on your turn, after drawing — no need to select-then-press-a-button,
though that option is still there too.

**4. Stock, discard, and the cut-joker indicator are now three clearly
separated boxes**, each in its own bordered slot, instead of running
together with the surrounding text. An empty discard pile and a disabled
cut joker each show a proper placeholder instead of just vanishing.

**5. The lobby is now genuinely open**, and this was the biggest change.
Previously, whoever happened to join first set a player-count target and
a cut-joker preference — which meant if two people opened the link near
each other, they could each set conflicting options for what looked like
the same table. Now: joining is just a name, nobody but the host can touch
game options, and there's no player-count target to conflict over at all
— the lobby simply stays open until the host decides to start.

## What I tested before sending this

29 automated checks now pass against the real running server:

- 12 from rev 1 (reconnection, table reset, skipping a disconnected
  player's turn) — unchanged, still passing.
- 2 from rev 2 (multi-deck dealing at 4 players) — unchanged.
- 6 from rev 3 (7-player 3-deck dealing, cut-joker toggle behaviour).
- 9 new checks for the open lobby: Start is unavailable with fewer than 2
  players and becomes available at exactly 2 with no target count;
  players who haven't joined or aren't the host cannot change settings;
  the host can; a third player can still join after the table is already
  startable; and the game actually starts correctly with a non-fixed
  headcount.

The click-vs-drag feel, in-hand reordering, and drag-to-discard all need
your hands on a real screen to confirm — that's exactly what's left for
your next test.

## What's still deliberately not here

- No turn timer.
- No cumulative scoring across multiple rounds.
- No number-of-jokers-per-deck setting, and no exclusion-scoring toggle
  yet (both named in the rules spec, both still to come).
- No password/host-handoff system — first joiner is simply always host,
  same as before.
