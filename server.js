// ===== Family Rummy — Stage 3 Server =====
// Builds on Stage 2: adds real reconnection (players are identified by a
// persistent token, not the transient socket connection), a manual way to
// un-stick a table, and a flexible table size (2-6 for now — the full
// up-to-10 + lobby/password system is its own later step).

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { checkDeclare, cardScoreValue } = require('./engine');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const SUITS = ['S','H','D','C'];
const MIN_PLAYERS = 2;
const MAX_PLAYERS = 6;
const HAND_SIZE = 13;
const DROP_PENALTY_FIRST_TURN = 10;
const DROP_PENALTY_LATER = 40;
const FALSE_DECLARE_PENALTY = 80;
const DISCONNECT_GRACE_NOTE_MS = 0; // no auto-timer yet — host can manually skip; see skipDisconnectedTurn

let table = null;

function freshTable() {
  return {
    players: [],      // { token, socketId, name, hand, connected, falseDeclareCount, dropped, dropScore }
    tableSize: 3,      // desired number of players; host can change before start
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

function makeDeck(numPlayers) {
  const numDecks = numPlayers >= 4 ? 2 : 1; // matches the rules spec: 2 decks for 4-6 players
  const cards = [];
  let id = 1;
  for (let d = 0; d < numDecks; d++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        cards.push({ id: id++, rank, suit, isPrintedJoker: false });
      }
    }
    cards.push({ id: id++, rank: null, suit: null, isPrintedJoker: true });
    cards.push({ id: id++, rank: null, suit: null, isPrintedJoker: true });
  }
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
  return { token: p.token, name: p.name, cardCount: p.hand.length, connected: p.connected, dropped: p.dropped };
}

function activePlayers() {
  return table.players.filter(p => !p.dropped);
}

function currentPlayer() {
  const ap = activePlayers();
  if (ap.length === 0) return null;
  return ap[table.turnIndex % ap.length];
}

function playerBySocket(socketId) {
  return table.players.find(p => p.socketId === socketId);
}

function stateFor(socketId) {
  const me = playerBySocket(socketId);
  if (!table.started) {
    return {
      started: false,
      players: table.players.map(publicPlayer),
      youAreHost: table.players[0] && table.players[0].socketId === socketId,
      tableSize: table.tableSize,
      canStart: table.players.length === table.tableSize,
      log: table.log,
      yourToken: me ? me.token : null,
    };
  }
  const ap = activePlayers();
  const cp = currentPlayer();
  return {
    started: true,
    roundOver: table.roundOver,
    cutJokerRank: table.cutJokerRank,
    cutJokerCard: table.cutJokerCard,
    stockCount: table.deck.length,
    discardTop: table.discardPile[table.discardPile.length - 1] || null,
    players: table.players.map(publicPlayer),
    yourHand: me ? me.hand : [],
    yourTurn: !!(me && cp && cp.token === me.token),
    currentPlayerName: cp ? cp.name : null,
    currentPlayerToken: cp ? cp.token : null,
    currentPlayerConnected: cp ? cp.connected : null,
    hasDrawnThisTurn: table.hasDrawnThisTurn,
    log: table.log,
    yourToken: me ? me.token : null,
  };
}

function broadcastState() {
  for (const p of table.players) {
    if (p.connected) io.to(p.socketId).emit('state', stateFor(p.socketId));
  }
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
    for (let i = table.deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [table.deck[i], table.deck[j]] = [table.deck[j], table.deck[i]];
    }
    table.discardPile = top ? [top] : [];
    log('Stock ran out — discard pile reshuffled into a new stock.');
  }
}

function endRound(resultText, scoreByToken) {
  table.roundOver = true;
  log(resultText);
  const scoreLines = table.players.map(p => `${p.name}: ${scoreByToken[p.token] ?? 0} points`);
  log(scoreLines.join(' | '));
  broadcastState();
  for (const p of table.players) {
    if (p.connected) io.to(p.socketId).emit('roundEnded', { resultText, scores: scoreByToken, scoreLines });
  }
}

function startRound() {
  const deck = makeDeck(table.players.length);
  table.players.forEach(p => {
    p.hand = [];
    p.falseDeclareCount = 0;
    p.dropped = false;
    p.dropScore = null;
  });
  for (let i = 0; i < HAND_SIZE; i++) {
    table.players.forEach(p => p.hand.push(deck.pop()));
  }
  const indicator = deck.pop();
  table.cutJokerCard = indicator;
  table.cutJokerRank = indicator.isPrintedJoker ? null : indicator.rank;
  table.deck = deck;
  table.discardPile = [];
  table.turnIndex = 0;
  table.started = true;
  table.roundOver = false;
  table.hasDrawnThisTurn = false;
  log(`New round dealt (${table.players.length} players, ${deck.length >= 100 ? 2 : 1} deck(s)). Cut joker rank: ${table.cutJokerRank || 'printed jokers only'}.`);
  broadcastState();
}

function makeToken() {
  return 'p_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

io.on('connection', (socket) => {
  socket.on('join', ({ name, token }) => {
    // Reconnect path: this token already belongs to a player at this table.
    if (token) {
      const existing = table.players.find(p => p.token === token);
      if (existing) {
        existing.socketId = socket.id;
        existing.connected = true;
        if (name) existing.name = name.slice(0, 20);
        log(`${existing.name} reconnected.`);
        socket.emit('joined', { token: existing.token });
        broadcastState();
        return;
      }
    }

    // Brand new player from here on.
    if (table.started) {
      socket.emit('errorMsg', 'A game is already in progress on this table. If you were already playing, reopening this same link on the same device should reconnect you automatically. If the table seems stuck, the host can use "Reset Table."');
      return;
    }
    if (table.players.length >= table.tableSize) {
      socket.emit('errorMsg', `This table is set for ${table.tableSize} players and is full.`);
      return;
    }
    const newToken = makeToken();
    table.players.push({
      token: newToken, socketId: socket.id, name: (name || 'Player').slice(0, 20),
      hand: [], connected: true, falseDeclareCount: 0, dropped: false, dropScore: null,
    });
    log(`${name || 'A player'} joined the table.`);
    socket.emit('joined', { token: newToken });
    broadcastState();
  });

  socket.on('setTableSize', (n) => {
    if (table.started) return;
    if (table.players.length > 0 && table.players[0]?.socketId !== socket.id) return;
    const size = Math.max(MIN_PLAYERS, Math.min(MAX_PLAYERS, Number(n) || 3));
    table.tableSize = size;
    broadcastState();
  });

  socket.on('startGame', () => {
    if (table.players[0]?.socketId !== socket.id) return;
    if (table.players.length !== table.tableSize) return;
    if (table.players.length < MIN_PLAYERS) return;
    startRound();
  });

  socket.on('playAgain', () => {
    if (!table.roundOver) return;
    startRound();
  });

  socket.on('resetTable', () => {
    log('Table was reset.');
    const previouslyConnected = table.players.filter(p => p.connected).map(p => p.socketId);
    table = freshTable();
    for (const sid of previouslyConnected) {
      io.to(sid).emit('tableWasReset');
      io.to(sid).emit('state', stateFor(sid));
    }
  });

  socket.on('skipDisconnectedTurn', () => {
    // Only the host can do this, and only when the current player is genuinely offline.
    if (table.players[0]?.socketId !== socket.id) return;
    const cp = currentPlayer();
    if (!cp || cp.connected || table.roundOver) return;
    reshuffleIfNeeded();
    if (table.deck.length > 0) {
      const drawn = table.deck.pop();
      cp.hand.push(drawn);
      table.discardPile.push(drawn);
      cp.hand = cp.hand.filter(c => c.id !== drawn.id);
      log(`${cp.name} is disconnected — host skipped their turn (auto drew and discarded).`);
    } else {
      log(`${cp.name} is disconnected — host skipped their turn.`);
    }
    advanceTurn();
    broadcastState();
  });

  socket.on('draw', ({ source }) => {
    const me = playerBySocket(socket.id);
    const cp = currentPlayer();
    if (!me || !cp || cp.token !== me.token || table.roundOver) return;
    if (table.hasDrawnThisTurn) return;
    let card;
    if (source === 'discard') {
      if (table.discardPile.length === 0) return;
      card = table.discardPile.pop();
    } else {
      reshuffleIfNeeded();
      if (table.deck.length === 0) return;
      card = table.deck.pop();
    }
    cp.hand.push(card);
    table.hasDrawnThisTurn = true;
    log(`${cp.name} drew from the ${source === 'discard' ? 'discard pile' : 'stock'}.`);
    broadcastState();
  });

  socket.on('discard', ({ cardId }) => {
    const me = playerBySocket(socket.id);
    const cp = currentPlayer();
    if (!me || !cp || cp.token !== me.token || table.roundOver) return;
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
    const me = playerBySocket(socket.id);
    const cp = currentPlayer();
    if (!me || !cp || cp.token !== me.token || table.roundOver) return;
    const penalty = !table.hasDrawnThisTurn ? DROP_PENALTY_FIRST_TURN : DROP_PENALTY_LATER;
    cp.dropped = true;
    cp.dropScore = penalty;
    table.discardPile.push(...cp.hand);
    cp.hand = [];
    log(`${cp.name} dropped (penalty ${penalty} points).`);

    const remaining = activePlayers();
    if (remaining.length <= 1) {
      const scoreByToken = {};
      table.players.forEach(p => { scoreByToken[p.token] = p.dropped ? p.dropScore : 0; });
      endRound(`${remaining[0] ? remaining[0].name : 'The remaining player'} wins the round — everyone else dropped.`, scoreByToken);
      return;
    }
    table.turnIndex = table.turnIndex % remaining.length;
    table.hasDrawnThisTurn = false;
    broadcastState();
  });

  socket.on('declare', ({ finishCardId, groups }) => {
    const me = playerBySocket(socket.id);
    const cp = currentPlayer();
    if (!me || !cp || cp.token !== me.token || table.roundOver) return;
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
      const scoreByToken = {};
      table.players.forEach(p => {
        if (p.token === cp.token) {
          scoreByToken[p.token] = (cp.falseDeclareCount * FALSE_DECLARE_PENALTY);
        } else if (p.dropped) {
          scoreByToken[p.token] = p.dropScore;
        } else {
          const total = p.hand.reduce((sum, c) => sum + cardScoreValue(c, table.cutJokerRank), 0);
          scoreByToken[p.token] = total + (p.falseDeclareCount * FALSE_DECLARE_PENALTY);
        }
      });
      endRound(`${cp.name} declared Rummy — valid! Round over.`, scoreByToken);
    } else {
      cp.falseDeclareCount += 1;
      log(`${cp.name} declared — INVALID (+${FALSE_DECLARE_PENALTY} penalty, now ${cp.falseDeclareCount} false declare(s) this round). Reasons: ${result.problems.join(' ')}`);
      socket.emit('declareRejected', { problems: result.problems });
      advanceTurn();
      broadcastState();
    }
  });

  socket.on('disconnect', () => {
    const p = playerBySocket(socket.id);
    if (p) {
      p.connected = false;
      log(`${p.name} disconnected.`);
      broadcastState();
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Family Rummy Stage 3 listening on ${PORT}`));
