# Family Rummy — Stage 3 (real cards, drag-and-drop, reliable reconnection)

## Running it

```
npm install
npm start
```

Open the URL it gives you. Whoever opens it first sets the table size (2–6
players) and becomes host; share the same link with everyone else.

## What's new since Stage 2

**Reconnection actually works now.** Each player is identified by a token
stored in their browser (not by the temporary connection), so closing the
tab, losing signal, or refreshing the page and coming back on the *same
device* restores your seat and your hand exactly as you left it — no
retyping your name, no losing your cards, no "game already in progress"
dead end.

**A stuck table can always be un-stuck.** The "Reset table" link (top of
every screen) clears the table for everyone and is not restricted to the
host — on purpose, since the host might be the one who's unreachable.

**If someone's turn stalls because they're disconnected**, everyone sees a
clear "waiting for X to reconnect" banner. The host gets a "Skip
disconnected player" button that plays a safe turn on their behalf (draws
and discards) so the table isn't stuck waiting on one missing person
forever.

**Real drag-and-drop.** Arranging your hand into groups for a declare is
now done by actually dragging cards, using pointer events so it works the
same way with a mouse or a finger on a phone — no more dropdown menus.

**Real-looking cards.** Corner ranks, suit colour, a felt table, brass
accents — the visual pass that was originally planned for a later stage,
brought forward.

**Flexible table size.** 2 to 6 players, chosen by the host before the
game starts. Tables of 4 or more automatically deal from two shuffled
decks, matching the rules specification.

## What's still deliberately not here

- No lobby password / "anyone can become host" system yet — first joiner
  is simply always host.
- No turn timer.
- No cumulative scoring across multiple rounds — each round is scored on
  its own, then Play Again deals a fresh one.
- No host settings panel (deck count is automatic, jokers fixed at 2 per
  deck, exclusion scoring rule not yet wired in).
- Up to 6 players, not the full 10 from the rules spec.

## What I tested before sending this

Everything server-side is covered by automated tests run against the real
running server (not just read through): reconnecting with the same token
restores the exact same hand rather than a fresh deal; a genuinely new
player is cleanly rejected with a helpful message once a game is under
way; resetting the table un-sticks it for everyone; skipping a
disconnected player's turn correctly draws and discards on their behalf
and hands the turn back; and multi-deck dealing gives the right number of
cards for a 4-player table. 14 checks, all passing.

The drag-and-drop interaction and the visual design itself couldn't be
tested this way — they need real eyes and real fingers. That's exactly
what your test round is for.
