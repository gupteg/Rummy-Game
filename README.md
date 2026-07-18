# Family Rummy — Stage 3, rev 2 (drag fix + real cards)

## Running it

```
npm install
npm start
```

Open the URL it gives you. Whoever opens it first sets the table size (2–6
players) and becomes host; share the same link with everyone else.

## What changed in this revision

**Drag now actually works.** There were two problems, both fixed:

1. Dragging was hidden behind an "Arrange / Declare" button that wasn't
   obvious to find. Cards can now be dragged directly, any time it's your
   turn and you've drawn — no mode to discover first.
2. A real bug: any game update arriving from the server — including your
   own draw or discard — rebuilt the whole hand on screen, which silently
   cancelled a drag in progress if it happened to land at the wrong
   moment. The page now holds off on any redraw while a drag is actively
   happening, so it can't be pulled out from under your finger.

**Cards look like actual playing cards now.** Number cards (2–10) show the
correct pip layout — a 7 shows seven suit symbols arranged the way a real
card does, not one big symbol in the middle. Aces get a single large
centred pip. Jacks, Queens, and Kings get a bordered face-card treatment
with the letter and suit. This was checked programmatically: every rank
from 2 to 10 was verified to render exactly that many pips before this
went out.

**A visible build tag** now sits under the title on the join screen
("Stage 3 test build · rev N") specifically so it's obvious at a glance
whether you're looking at the current version or something stale — this
fixes the confusion from last time, where a redeploy hadn't actually taken
effect and it wasn't easy to tell.

## What I tested before sending this

- All 14 server-side automated checks from the previous revision still
  pass unchanged (reconnection, table reset, skipping a disconnected
  player's turn, multi-deck dealing).
- The pip layout for every number rank (2 through 10) was verified by code
  to contain the correct pip count.
- The drag fix itself — the actual feel of dragging a card on a real
  screen — still needs your hands to confirm. That's what I can't test
  from here.

## What's still deliberately not here

- No lobby password / host-handoff system yet — first joiner is simply
  always host.
- No turn timer.
- No cumulative scoring across multiple rounds.
- No host settings panel (deck count is automatic, jokers fixed at 2 per
  deck, exclusion scoring rule not yet wired in).
- Up to 6 players, not the full 10 from the rules spec.

