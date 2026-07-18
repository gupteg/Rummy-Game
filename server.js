// ===== Family Rummy — Stage 2 Server =====
// One fixed table. Two players. Real hidden hands. Real turns.
// Deliberately ugly on the screen — the point of this stage is proving
// the live connection and the rules work, not looking nice yet.

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { checkDeclare, cardScoreValue, evaluateGroup } = require('./engine');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const SUITS = ['S','H','D','C'];
const MAX_PLAYERS = 3; // Stage 2 test: now supports up to three people.
const HAND_SIZE = 13;
const DROP_PENALTY_FIRST_TURN = 10;
const DROP_PENALTY_LATER = 40;
const FALSE_DECLARE_PENALTY = 80;

// ---------- Table state (single table for this stage) ----------
let table = null;

function freshTable() {
  return {
    players: [],           // { id, name, hand: [card], connected, falseDeclareCount, dropped, dropScore }
    deck: [],
    discardPile: [],
    cutJokerRank: null,
    cutJokerCard: null,
    turnIndex: 0,
    started: false,
    roundOver: false,
    hasDrawnThisTurn: false,
    log: [],
  };
}
table = freshTable();

function makeDeck() {
  const cards = [];
  let id = 1;
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      cards.push({ id: id++, rank, suit, isPrintedJoker: false });
    }
  }
  // Two printed jokers, matching "1 deck for 2 players" from the rules spec.
  cards.push({ id: id++, rank: null, suit: null, isPrintedJoker: true });
  cards.push({ id: id++, rank: null, suit: null, isPrintedJoker: true });
  // Shuffle (Fisher-Yates)
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

function log(msg) {
  table.log.push(msg);
  if (table.log.length > 200) table.log.shift();
}

function publicPlayer(p) {
  return { id: p.id, name: p.name, cardCount: p.hand.length, connected: p.connected, dropped: p.dropped };
}

// What a given player is allowed to see: their own hand in full, everyone
// else only as a card count. This is the whole point of having a server.
function stateFor(socketId) {
  if (!table.started) {
    return {
      started: false,
      players: table.players.map(publicPlayer),
      youAreHost: table.players[0] && table.players[0].id === socketId,
      canStart: table.players.length === MAX_PLAYERS,
      maxPlayers: MAX_PLAYERS,
      log: table.log,
    };
  }
  const me = table.players.find(p => p.id === socketId);
  const activePlayers = table.players.filter(p => !p.dropped);
  return {
    started: true,
    roundOver: table.roundOver,
    cutJokerRank: table.cutJokerRank,
    cutJokerCard: table.cutJokerCard,
    stockCount: table.deck.length,
    discardTop: table.discardPile[table.discardPile.length - 1] || null,
    players: table.players.map(publicPlayer),
    yourHand: me ? me.hand : [],
    yourTurn: activePlayers[table.turnIndex] ? activePlayers[table.turnIndex].id === socketId : false,
    hasDrawnThisTurn: table.hasDrawnThisTurn,
    log: table.log,
  };
}

function broadcastState() {
  for (const p of table.players) {
    io.to(p.id).emit('state', stateFor(p.id));
  }
}

function activePlayers() {
  return table.players.filter(p => !p.dropped);
}

function currentPlayer() {
  const ap = activePlayers();
  return ap[table.turnIndex % ap.length];
}

function advanceTurn() {
  const ap = activePlayers();
  if (ap.length <= 1) return;
  table.turnIndex = (table.turnIndex + 1) % ap.length;
  table.hasDrawnThisTurn = false;
}

function reshuffleIfNeeded() {
  if (table.deck.length === 0) {
    const top = table.discardPile.pop();
    table.deck = table.discardPile;
    // simple shuffle
    for (let i = table.deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [table.deck[i], table.deck[j]] = [table.deck[j], table.deck[i]];
    }
    table.discardPile = top ? [top] : [];
    log('Stock ran out — discard pile reshuffled into a new stock.');
  }
}

function endRound(resultText, scoreByPlayerId) {
  table.roundOver = true;
  log(resultText);
  const scoreLines = table.players.map(p => `${p.name}: ${scoreByPlayerId[p.id] ?? 0} points`);
  log(scoreLines.join(' | '));
  broadcastState();
  io.emit('roundEnded', { resultText, scores: scoreByPlayerId, scoreLines });
}

function startRound() {
  const deck = makeDeck();
  table.players.forEach(p => {
    p.hand = [];
    p.falseDeclareCount = 0;
    p.dropped = false;
    p.dropScore = null;
  });
  for (let i = 0; i < HAND_SIZE; i++) {
    table.players.forEach(p => p.hand.push(deck.pop()));
  }
  // Turn up the cut joker indicator
  let indicator = deck.pop();
  // If we happened to flip a printed joker, only printed jokers are wild — per the rules.
  table.cutJokerCard = indicator;
  table.cutJokerRank = indicator.isPrintedJoker ? null : indicator.rank;
  table.deck = deck;
  table.discardPile = [];
  table.turnIndex = 0;
  table.started = true;
  table.roundOver = false;
  table.hasDrawnThisTurn = false;
  log(`New round dealt. Cut joker rank: ${table.cutJokerRank || 'printed jokers only'}.`);
  broadcastState();
}

// ---------- Socket handling ----------
io.on('connection', (socket) => {
  socket.on('join', ({ name }) => {
    if (table.started) {
      socket.emit('errorMsg', 'A round is already in progress on this table.');
      return;
    }
    if (table.players.length >= MAX_PLAYERS) {
      socket.emit('errorMsg', `This table already has ${MAX_PLAYERS} players.`);
      return;
    }
    table.players.push({
      id: socket.id, name: (name || 'Player').slice(0, 20),
      hand: [], connected: true, falseDeclareCount: 0, dropped: false, dropScore: null,
    });
    log(`${name} joined the table.`);
    broadcastState();
  });

  socket.on('startGame', () => {
    if (table.players[0]?.id !== socket.id) return;
    if (table.players.length !== MAX_PLAYERS) return;
    startRound();
  });

  socket.on('playAgain', () => {
    if (!table.roundOver) return;
    startRound();
  });

  socket.on('draw', ({ source }) => {
    const cp = currentPlayer();
    if (!cp || cp.id !== socket.id || table.roundOver) return;
    if (table.hasDrawnThisTurn) return;
    let card;
    if (source === 'discard') {
      if (table.discardPile.length === 0) return;
      card = table.discardPile.pop();
    } else {
      reshuffleIfNeeded();
      if (table.deck.length === 0) return; // truly nothing left, edge case
      card = table.deck.pop();
    }
    cp.hand.push(card);
    table.hasDrawnThisTurn = true;
    log(`${cp.name} drew from the ${source === 'discard' ? 'discard pile' : 'stock'}.`);
    broadcastState();
  });

  socket.on('discard', ({ cardId }) => {
    const cp = currentPlayer();
    if (!cp || cp.id !== socket.id || table.roundOver) return;
    if (!table.hasDrawnThisTurn) return;
    const idx = cp.hand.findIndex(c => c.id === cardId);
    if (idx === -1) return;
    const [card] = cp.hand.splice(idx, 1);
    table.discardPile.push(card);
    log(`${cp.name} discarded ${card.isPrintedJoker ? 'a Joker' : card.rank + card.suit}.`);
    advanceTurn();
    broadcastState();
  });

  socket.on('drop', () => {
    const cp = currentPlayer();
    if (!cp || cp.id !== socket.id || table.roundOver) return;
    const penalty = !table.hasDrawnThisTurn ? DROP_PENALTY_FIRST_TURN : DROP_PENALTY_LATER;
    cp.dropped = true;
    cp.dropScore = penalty;
    table.discardPile.push(...cp.hand);
    cp.hand = [];
    log(`${cp.name} dropped (penalty ${penalty} points).`);

    const remaining = activePlayers();
    if (remaining.length <= 1) {
      const scoreByPlayerId = {};
      table.players.forEach(p => {
        scoreByPlayerId[p.id] = p.dropped ? p.dropScore : 0;
      });
      endRound(`${remaining[0] ? remaining[0].name : 'The remaining player'} wins the round — everyone else dropped.`, scoreByPlayerId);
      return;
    }
    table.turnIndex = table.turnIndex % remaining.length;
    table.hasDrawnThisTurn = false;
    broadcastState();
  });

  socket.on('declare', ({ finishCardId, groups }) => {
    // finishCardId: the one card being thrown away (the "finish slot" from the rules spec).
    // groups: array of arrays of cardId — how the player arranged their remaining 13 cards.
    const cp = currentPlayer();
    if (!cp || cp.id !== socket.id || table.roundOver) return;
    if (!table.hasDrawnThisTurn) return;

    const finishIdx = cp.hand.findIndex(c => c.id === finishCardId);
    if (finishIdx === -1) return;
    const [finishCard] = cp.hand.splice(finishIdx, 1);
    table.discardPile.push(finishCard);

    const cardById = {};
    cp.hand.forEach(c => { cardById[c.id] = c; });
    const assigned = new Set();
    const handWithGroups = [];
    groups.forEach((cardIds, gi) => {
      cardIds.forEach(cid => {
        if (cardById[cid]) {
          handWithGroups.push({ ...cardById[cid], groupId: gi + 1 });
          assigned.add(cid);
        }
      });
    });
    cp.hand.forEach(c => {
      if (!assigned.has(c.id)) handWithGroups.push({ ...c, groupId: null });
    });

    const result = checkDeclare(handWithGroups, table.cutJokerRank);

    if (result.valid) {
      const scoreByPlayerId = {};
      table.players.forEach(p => {
        if (p.id === cp.id) {
          scoreByPlayerId[p.id] = (cp.falseDeclareCount * FALSE_DECLARE_PENALTY);
        } else if (p.dropped) {
          scoreByPlayerId[p.id] = p.dropScore;
        } else {
          const total = p.hand.reduce((sum, c) => sum + cardScoreValue(c, table.cutJokerRank), 0);
          scoreByPlayerId[p.id] = total + (p.falseDeclareCount * FALSE_DECLARE_PENALTY);
        }
      });
      endRound(`${cp.name} declared Rummy — valid! Round over.`, scoreByPlayerId);
    } else {
      cp.falseDeclareCount += 1;
      log(`${cp.name} declared — INVALID (+${FALSE_DECLARE_PENALTY} penalty, now ${cp.falseDeclareCount} false declare(s) this round). Reasons: ${result.problems.join(' ')}`);
      socket.emit('declareRejected', { problems: result.problems });
      advanceTurn();
      broadcastState();
    }
  });

  socket.on('disconnect', () => {
    const p = table.players.find(p => p.id === socket.id);
    if (p) {
      p.connected = false;
      log(`${p.name} disconnected.`);
      broadcastState();
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Family Rummy Stage 2 listening on ${PORT}`));
