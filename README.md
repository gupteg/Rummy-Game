# Family Rummy — Stage 2 (test build)

Two people, one table, deliberately ugly. This exists to prove the live
connection, hidden hands, and turn-by-turn rules actually work — not to
look good yet.

## Running it

```
npm install
npm start
```

Then open the URL it gives you. Share that same URL with the second player.
First person to join is the host and sees a "Start Game" button once the
second player has joined.

## What's real here

- The server holds the actual deck and both hands. Each browser is only ever
  told its own cards, plus how many cards the other player is holding.
- Draw, discard, drop, and declare are all enforced turn-by-turn on the server.
- Declaring uses the exact rules engine from Stage 1 (see `engine.js`) —
  the same one that was tested against every example from the rules
  conversation before this stage was built.
- Invalid declares apply the 80-point penalty and let the round continue,
  per the rules specification.

## What's still missing (on purpose — later stages)

- Only two players. More players, the lobby/password system, and host
  settings come in Stage 3.
- No turn timer yet.
- No cumulative scoring across multiple rounds yet — each round is scored
  and shown, then you can "Play Again" for a fresh one.
- No reconnect handling beyond what the browser does automatically.
- Looks like this README, not like a card table. That's Stage 4.
