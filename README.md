# Family Rummy — Stage 2 (test build)

Three people, one table, deliberately ugly. This exists to prove the live
connection, hidden hands, and turn-by-turn rules actually work — not to
look good yet.

## Running it

```
npm install
npm start
```

Then open the URL it gives you. Share that same URL with the other two
players. First person to join is the host and sees a "Start Game" button
once all three players have joined. The table requires exactly three —
Start stays disabled until the third person arrives.

## What's real here

- The server holds the actual deck and all three hands. Each browser is only
  ever told its own cards, plus how many cards the others are holding.
- Draw, discard, drop, and declare are all enforced turn-by-turn on the server,
  rotating correctly through all three players.
- Declaring uses the exact rules engine from Stage 1 (see `engine.js`) —
  the same one that was tested against every example from the rules
  conversation before this stage was built.
- Invalid declares apply the 80-point penalty and let the round continue,
  per the rules specification.
- Dropping works correctly with three players: the round only ends once
  just one active player remains, not as soon as anyone drops.

## What's still missing (on purpose — later stages)

- Fixed at exactly three players. Flexible player counts (2 to 10), the
  lobby/password system, and host settings come in Stage 3.
- No turn timer yet.
- No cumulative scoring across multiple rounds yet — each round is scored
  and shown, then you can "Play Again" for a fresh one.
- No reconnect handling beyond what the browser does automatically.
- Looks like this README, not like a card table. That's Stage 4.
