// ===== Family Rummy — Rules Engine (Stage 1) =====
// Pure logic. No UI. This is the "brain in a jar."

const RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const RANK_LOW  = { A:1, '2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10, J:11, Q:12, K:13 };
const RANK_HIGH = { A:14,'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10, J:11, Q:12, K:13 };

function cardLabel(c) {
  if (c.isPrintedJoker) return 'Printed Joker';
  return `${c.rank}${c.suit}`;
}

function trySet(naturals, wildCount) {
  if (naturals.length === 0) return { valid: false, reason: 'needs at least one natural (non-wild) card' };
  const rank0 = naturals[0].rank;
  if (!naturals.every(c => c.rank === rank0)) {
    return { valid: false, reason: 'the natural cards are not all the same rank' };
  }
  const size = naturals.length + wildCount;
  if (size < 3) return { valid: false, reason: 'fewer than 3 cards' };
  if (size > 4) return { valid: false, reason: 'a set cannot have more than 4 cards' };
  return { valid: true };
}

function trySequence(naturals, wildCount, requirePure) {
  if (naturals.length === 0) return { valid: false, reason: 'needs at least one natural card to anchor the sequence' };
  const ranks = naturals.map(c => c.rank);
  if (new Set(ranks).size !== ranks.length) {
    return { valid: false, reason: 'two natural cards share the same rank — not a valid sequence' };
  }
  if (requirePure) {
    if (wildCount > 0) return { valid: false, reason: 'a pure sequence cannot contain a joker or wild card' };
    const suit0 = naturals[0].suit;
    if (!naturals.every(c => c.suit === suit0)) {
      return { valid: false, reason: 'a pure sequence must all be the same suit' };
    }
  }
  for (const mapping of [RANK_LOW, RANK_HIGH]) {
    const vals = naturals.map(c => mapping[c.rank]).sort((a, b) => a - b);
    const min = vals[0], max = vals[vals.length - 1];
    const span = max - min + 1;
    const gapsNeeded = span - vals.length;
    if (gapsNeeded >= 0 && wildCount >= gapsNeeded && (naturals.length + wildCount) >= 3) {
      return { valid: true };
    }
  }
  return { valid: false, reason: 'ranks are not consecutive, even allowing for jokers to fill gaps' };
}

// A cut-joker-rank card can be used as itself OR as a wild — it's the interpretation
// that makes the group work, not something the player has to flag in advance.
// We search interpretations that use the FEWEST cut-rank cards as wild first (the
// honest, cheapest reading), and only reach for more wild reinterpretations if that
// fails. Within a tier, pure beats impure beats set.
function evaluateGroup(cards, cutJokerRank) {
  if (cards.length === 0) return { ok: false, type: 'invalid', message: 'empty group' };

  const printedJokers = cards.filter(c => c.isPrintedJoker);
  const cutRankCards = cards.filter(c => !c.isPrintedJoker && cutJokerRank && c.rank === cutJokerRank);
  const fixedNaturals = cards.filter(c => !c.isPrintedJoker && !(cutJokerRank && c.rank === cutJokerRank));
  const n = cutRankCards.length;

  const allReasons = [];

  // masksByWildCount[k] = list of masks that mark exactly k of the cut-rank cards as wild
  const masksByWildCount = Array.from({ length: n + 1 }, () => []);
  for (let mask = 0; mask < (1 << n); mask++) {
    let bits = 0;
    for (let i = 0; i < n; i++) if (mask & (1 << i)) bits++;
    masksByWildCount[bits].push(mask);
  }

  for (let tier = 0; tier <= n; tier++) {
    let tierBest = null; // 'pure' | 'impure' | 'set'
    let tierBestWildIds = null;

    for (const mask of masksByWildCount[tier]) {
      const wildFromCutRank = [];
      const naturalFromCutRank = [];
      for (let i = 0; i < n; i++) {
        if (mask & (1 << i)) wildFromCutRank.push(cutRankCards[i]);
        else naturalFromCutRank.push(cutRankCards[i]);
      }
      const naturals = fixedNaturals.concat(naturalFromCutRank);
      const wildCount = printedJokers.length + wildFromCutRank.length;

      const pure = trySequence(naturals, wildCount, true);
      if (pure.valid) { tierBest = 'pure'; tierBestWildIds = wildFromCutRank.map(c => c.id); break; } // nothing beats pure
      const impure = trySequence(naturals, wildCount, false);
      if (impure.valid && tierBest !== 'impure') { tierBest = tierBest || 'impure'; if (!tierBestWildIds) tierBestWildIds = wildFromCutRank.map(c => c.id); }
      const set = trySet(naturals, wildCount);
      if (set.valid && !tierBest) { tierBest = 'set'; tierBestWildIds = wildFromCutRank.map(c => c.id); }
      [pure.reason, impure.reason, set.reason].forEach(r => { if (r) allReasons.push(r); });
    }

    if (tierBest) {
      const msg = tierBest === 'pure' ? 'Pure sequence ✓' : tierBest === 'impure' ? 'Impure sequence ✓' : 'Set ✓';
      return { ok: true, type: tierBest, message: msg, wildIds: tierBestWildIds };
    }
  }

  const uniqueReasons = [...new Set(allReasons)];
  return { ok: false, type: 'invalid', message: 'Not a valid meld — ' + uniqueReasons[uniqueReasons.length - 1], wildIds: [] };
}

// handCards: [{id, rank, suit, isPrintedJoker, wildChoice, groupId}]
// groupId === null means "unassigned"
function checkDeclare(handCards, cutJokerRank) {
  const ungrouped = handCards.filter(c => c.groupId === null);
  const groupIds = [...new Set(handCards.filter(c => c.groupId !== null).map(c => c.groupId))];
  const groupResults = groupIds.map(gid => ({
    groupId: gid,
    cards: handCards.filter(c => c.groupId === gid),
    result: evaluateGroup(handCards.filter(c => c.groupId === gid), cutJokerRank),
  }));

  const problems = [];
  if (ungrouped.length > 0) {
    problems.push(`${ungrouped.length} card(s) are not assigned to any group.`);
  }
  groupResults.forEach((g, i) => {
    if (!g.result.ok) problems.push(`Group ${i + 1}: ${g.result.message}`);
  });
  const hasPure = groupResults.some(g => g.result.ok && g.result.type === 'pure');
  if (ungrouped.length === 0 && groupResults.every(g => g.result.ok) && !hasPure) {
    problems.push('No pure sequence is present — one is required to declare.');
  }

  return { valid: problems.length === 0, problems, groupResults };
}

function cardScoreValue(card, cutJokerRank) {
  if (card.isPrintedJoker) return 0;
  if (cutJokerRank && card.rank === cutJokerRank) return 0; // wild-rank cards always score 0
  if (card.rank === 'A') return 1;
  if (['J', 'Q', 'K'].includes(card.rank)) return 10;
  return Number(card.rank);
}

// Scores a hand AS IF this player lost the round.
function scoreHand(handCards, cutJokerRank, exclusionOn) {
  const groupIds = [...new Set(handCards.filter(c => c.groupId !== null).map(c => c.groupId))];
  const groupResultByGid = {};
  groupIds.forEach(gid => {
    groupResultByGid[gid] = evaluateGroup(handCards.filter(c => c.groupId === gid), cutJokerRank);
  });
  const hasPureValidGroup = Object.values(groupResultByGid).some(g => g.ok && g.type === 'pure');

  let total = 0;
  const breakdown = handCards.map(card => {
    const inValidMeld = card.groupId !== null && groupResultByGid[card.groupId] && groupResultByGid[card.groupId].ok;
    let value;
    let reason;
    if (exclusionOn && hasPureValidGroup && inValidMeld) {
      value = 0;
      reason = 'excluded (part of a meld, pure sequence present)';
    } else {
      value = cardScoreValue(card, cutJokerRank);
      reason = inValidMeld ? 'counted (exclusion off or no pure sequence yet)' : 'deadwood';
    }
    total += value;
    return { card, value, reason };
  });

  return { total, breakdown, hasPureValidGroup, exclusionOn };
}

module.exports = { evaluateGroup, checkDeclare, scoreHand, cardScoreValue, RANKS };
