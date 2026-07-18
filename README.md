# Family Rummy — Stage 3, rev 5

## Running it

```
npm install
npm start
```

Open the URL it gives you, type a name, and join. Server logic is
unchanged from rev 4 — this revision is entirely about the interaction
and the visuals.

## What changed in this revision

**1. Cross-row hand dragging is fixed.** When your 13 cards wrap onto two
rows, dragging from the top row to the bottom row (or the reverse) now
works correctly. The hand is treated as a single continuous sequence —
the position calculation switched from "compare X position only" to
"find the nearest card by straight-line distance, then decide before/after
it," which is what makes row boundaries stop mattering. Verified against
your exact examples (`1,2,3,4,5,6` → move 2 to the end → `1,3,4,5,6,2`;
move 6 between 1 and 2 → `1,6,2,3,4,5`) plus three synthetic cross-row
cases, all passing.

**2. The Game Log now actually populates.** It turned out the div was
sitting there, but nothing was ever writing into it — a straightforward
miss, now fixed. It's also open by default rather than collapsed.

**3. "Declare Rummy" button replaces the finish-slot drag.** Arrange 13 of
your 14 cards into groups as before, leave one loose, then click
**Declare Rummy** — this arms your next discard to be judged as a declare
rather than a plain, risk-free discard. Discard that loose card the normal
way (select + Discard, or drag it to the discard pile) and that's what
actually triggers the check. A red banner shows while it's armed, with a
Cancel button, so it's never ambiguous whether your next discard is about
to be judged.

**4. Draw Stock / Draw Discard moved next to "Your Hand"**, and both piles
are now clickable directly — tap the stock pile to draw from it, tap the
discard pile to draw from it, no button required (the buttons are still
there too, for anyone who prefers them).

**5. The just-drawn card is highlighted** with a green outline in your
hand until you discard or declare, so it's obvious which card just
arrived.

**6. "It's your turn!" now pulses** with a gentle animated glow instead of
sitting as quiet text (respects reduced-motion settings for anyone who
has that turned on).

**7. Stock, Discard, and Cut Joker are now noticeably bigger**, in their
own clearly bordered boxes, separated from the surrounding text.

## What I tested before sending this

- All 29 server-side checks from rev 1–4 still pass, unchanged — `server.js`
  itself was not touched this revision; everything above is client-only,
  including "Declare Rummy," which reuses the exact same `declare` event
  the server already had.
- 6 new checks specifically validating the reorder algorithm: both of your
  exact examples, plus three cross-row scenarios and a stability check
  (dropping a card back near its own spot doesn't lose or duplicate
  cards). I confirmed the tested algorithm is structurally identical to
  what's actually shipped in `public/index.html`, not just a similar copy.
- Every element ID referenced by the JavaScript was checked to actually
  exist in the HTML, and vice versa for duplicates.

What I still can't verify from here: how the Declare Rummy flow actually
feels in use, whether the turn-pulse animation reads well on a real
screen, and the drag/reorder feel on an actual phone. That's what your
test is for.

## What's still deliberately not here

- No turn timer.
- No cumulative scoring across multiple rounds.
- No number-of-jokers-per-deck setting, no exclusion-scoring toggle.
- No password/host-handoff system — first joiner is still always host.
