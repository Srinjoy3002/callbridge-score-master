// Callbridge Master — Probability Engine & AI Strategy Advisor
// Supports Dynamic Player Count (2-6 players) and Custom Main Colour / Trump Suit (♠, ♥, ♦, ♣, No Trump)

const SUITS_DATA = [
  { id: 'S', name: 'Spades', symbol: '♠', color: 'spades' },
  { id: 'H', name: 'Hearts', symbol: '♥', color: 'hearts' },
  { id: 'D', name: 'Diamonds', symbol: '♦', color: 'diamonds' },
  { id: 'C', name: 'Clubs', symbol: '♣', color: 'clubs' }
];

const RANKS_DATA = [
  { rank: 'A', value: 14, name: 'Ace', hcp: 4 },
  { rank: 'K', value: 13, name: 'King', hcp: 3 },
  { rank: 'Q', value: 12, name: 'Queen', hcp: 2 },
  { rank: 'J', value: 11, name: 'Jack', hcp: 1 },
  { rank: '10', value: 10, name: '10', hcp: 0 },
  { rank: '9', value: 9, name: '9', hcp: 0 },
  { rank: '8', value: 8, name: '8', hcp: 0 },
  { rank: '7', value: 7, name: '7', hcp: 0 },
  { rank: '6', value: 6, name: '6', hcp: 0 },
  { rank: '5', value: 5, name: '5', hcp: 0 },
  { rank: '4', value: 4, name: '4', hcp: 0 },
  { rank: '3', value: 3, name: '3', hcp: 0 },
  { rank: '2', value: 2, name: '2', hcp: 0 }
];

// Helper to generate full 52 card deck
function generateFullDeck() {
  const deck = [];
  SUITS_DATA.forEach(s => {
    RANKS_DATA.forEach(r => {
      deck.push({
        id: `${r.rank}${s.id}`,
        suit: s.id,
        rank: r.rank,
        value: r.value,
        symbol: s.symbol,
        color: s.color,
        hcp: r.hcp
      });
    });
  });
  return deck;
}

const FULL_DECK = generateFullDeck();
const CARD_MAP = {};
FULL_DECK.forEach(c => { CARD_MAP[c.id] = c; });

// Advisor Global State
const advisorState = {
  selectedHand: [], // array of card IDs (e.g. ['AS', 'KS', ...])
  simResults: null,
  trumpSuit: 'S', // 'S', 'H', 'D', 'C', 'NT' (No Trump)
  playerCount: 4, // 2, 3, 4, 5, 6
  handSize: 13,   // 13 for 4p, 17 for 3p, 10 for 5p, 8 for 6p, 13 for 2p
  
  // Live Trick Play State
  liveTrick: {
    active: false,
    trickNumber: 1,
    leadPosition: 'opp_0',
    plays: {}, // e.g. { opp_0: 'AS', user: 'KS', ... }
    tricksWonUser: 0,
    tricksWonOthers: {},
    initialBid: 4,
    handRemaining: [], // user's remaining hand during trick play
    playedCardsHistory: [],
    trickLog: []
  }
};

let advisorInitialized = false;

function initAdvisor() {
  renderDeckPickerGrid();
  setupAdvisorEventListeners();
  if (advisorState.selectedHand.length === 0) {
    dealPresetHand('balanced');
  } else {
    updateHandDisplays();
    recalculateAdvisor();
  }
  advisorInitialized = true;
}

// Initialize Advisor UI on load or immediately if DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAdvisor);
} else {
  initAdvisor();
}

// Expose functions globally to window
window.initAdvisor = initAdvisor;
window.setAdvisorTrump = setAdvisorTrump;
window.setAdvisorPlayerCount = setAdvisorPlayerCount;
window.dealRandomHand = dealRandomHand;
window.dealPresetHand = dealPresetHand;
window.clearAdvisorHand = clearAdvisorHand;
window.resetLiveTrickPlayState = resetLiveTrickPlayState;
window.executeUserPlay = executeUserPlay;
window.setTrickLead = setTrickLead;
window.selectOpponentTrickCard = selectOpponentTrickCard;

// Setup event listeners
function setupAdvisorEventListeners() {
  const customBidInput = document.getElementById('advisor-custom-bid');
  if (customBidInput) {
    customBidInput.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      if (!isNaN(val) && val >= 1 && val <= advisorState.handSize) {
        advisorState.liveTrick.initialBid = val;
        updateLiveContractDisplay();
      }
    });
  }
}

// -------------------------------------------------------------
// MAIN COLOUR (TRUMP) & PLAYER COUNT CONFIGURATION
// -------------------------------------------------------------

function setAdvisorTrump(suitId) {
  advisorState.trumpSuit = suitId;

  // Update button active states
  document.querySelectorAll('#advisor-trump-selector .trump-toggle-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  const activeBtn = document.getElementById(`trump-btn-${suitId.toLowerCase()}`);
  if (activeBtn) activeBtn.classList.add('active');

  // Update Deck Picker TRUMP tags
  renderDeckPickerGrid();
  resetLiveTrickPlayState();
  updateHandDisplays();
  recalculateAdvisor();
}

function setAdvisorPlayerCount(count) {
  count = parseInt(count, 10) || 4;
  advisorState.playerCount = count;

  // Standard hand sizes based on player count
  if (count === 3) advisorState.handSize = 17;
  else if (count === 5) advisorState.handSize = 10;
  else if (count === 6) advisorState.handSize = 8;
  else advisorState.handSize = 13;

  // Update button active states
  document.querySelectorAll('#advisor-player-selector .player-toggle-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  const activeBtn = document.getElementById(`player-btn-${count}`);
  if (activeBtn) activeBtn.classList.add('active');

  const hintEl = document.getElementById('advisor-hand-size-hint');
  if (hintEl) hintEl.innerText = `(${advisorState.handSize} cards / ${advisorState.handSize} tricks)`;

  // Trim hand if currently selected cards exceed new handSize
  if (advisorState.selectedHand.length > advisorState.handSize) {
    advisorState.selectedHand = advisorState.selectedHand.slice(0, advisorState.handSize);
  }

  // Update input max in trick advisor
  const customBidInput = document.getElementById('advisor-custom-bid');
  if (customBidInput) {
    customBidInput.max = advisorState.handSize;
    if (parseInt(customBidInput.value, 10) > advisorState.handSize) {
      customBidInput.value = Math.min(4, advisorState.handSize);
      advisorState.liveTrick.initialBid = parseInt(customBidInput.value, 10);
    }
  }

  resetLiveTrickPlayState();
  updateHandDisplays();
  recalculateAdvisor();
}

// -------------------------------------------------------------
// 1. DECK PICKER & HAND SELECTION UI
// -------------------------------------------------------------

function renderDeckPickerGrid() {
  const container = document.getElementById('deck-picker-suits');
  if (!container) return;

  container.innerHTML = '';

  SUITS_DATA.forEach(suit => {
    const isTrump = suit.id === advisorState.trumpSuit;
    const suitRow = document.createElement('div');
    suitRow.className = `suit-picker-row suit-${suit.color}`;

    const label = document.createElement('div');
    label.className = 'suit-label';
    label.innerHTML = `
      <span class="suit-icon">${suit.symbol}</span> 
      <span class="suit-name">${suit.name}</span> 
      ${isTrump ? '<span class="trump-tag">MAIN COLOUR (TRUMP)</span>' : ''}
    `;
    suitRow.appendChild(label);

    const cardsGrid = document.createElement('div');
    cardsGrid.className = 'suit-cards-list';

    RANKS_DATA.forEach(rank => {
      const cardId = `${rank.rank}${suit.id}`;
      const isSelected = advisorState.selectedHand.includes(cardId);
      const isPlayed = advisorState.liveTrick.active && advisorState.liveTrick.playedCardsHistory.includes(cardId);

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `picker-card-btn card-${suit.color} ${isSelected ? 'selected' : ''} ${isPlayed ? 'played' : ''}`;
      btn.id = `picker-card-${cardId}`;
      btn.innerHTML = `
        <span class="card-rank">${rank.rank}</span>
        <span class="card-symbol">${suit.symbol}</span>
      `;
      btn.onclick = () => toggleCardSelection(cardId);
      cardsGrid.appendChild(btn);
    });

    suitRow.appendChild(cardsGrid);
    container.appendChild(suitRow);
  });
}

function toggleCardSelection(cardId) {
  const maxCards = advisorState.handSize;
  const idx = advisorState.selectedHand.indexOf(cardId);
  if (idx >= 0) {
    advisorState.selectedHand.splice(idx, 1);
  } else {
    if (advisorState.selectedHand.length >= maxCards) {
      alert(`You already have ${maxCards} cards selected for a ${advisorState.playerCount}-player game! Remove a card to pick another, or click Clear.`);
      return;
    }
    advisorState.selectedHand.push(cardId);
  }

  // Sort hand: Trump suit first (if any), then others; rank descending (Ace to 2)
  sortUserHand();

  resetLiveTrickPlayState();
  updateHandDisplays();
  recalculateAdvisor();
}

function sortUserHand() {
  const trump = advisorState.trumpSuit;
  // Put trump suit first, then Spades, Hearts, Diamonds, Clubs
  const defaultOrder = { 'S': 1, 'H': 2, 'D': 3, 'C': 4 };
  if (trump && trump !== 'NT') {
    defaultOrder[trump] = 0;
  }

  advisorState.selectedHand.sort((a, b) => {
    const cardA = CARD_MAP[a];
    const cardB = CARD_MAP[b];
    if (defaultOrder[cardA.suit] !== defaultOrder[cardB.suit]) {
      return defaultOrder[cardA.suit] - defaultOrder[cardB.suit];
    }
    return cardB.value - cardA.value;
  });
}

function updateHandDisplays() {
  const count = advisorState.selectedHand.length;
  const maxCards = advisorState.handSize;
  const countBadge = document.getElementById('hand-count-badge');
  const countProgress = document.getElementById('hand-count-progress');

  if (countBadge) {
    countBadge.innerText = `${count} / ${maxCards} Selected`;
    countBadge.className = `badge-pill ${count === maxCards ? 'badge-success' : 'badge-warning'}`;
  }
  if (countProgress) {
    countProgress.style.width = `${Math.min(100, (count / maxCards) * 100)}%`;
  }

  // Update card buttons in picker
  FULL_DECK.forEach(card => {
    const btn = document.getElementById(`picker-card-${card.id}`);
    if (btn) {
      if (advisorState.selectedHand.includes(card.id)) {
        btn.classList.add('selected');
      } else {
        btn.classList.remove('selected');
      }
    }
  });

  renderSelectedHandTray();
}

function renderSelectedHandTray() {
  const tray = document.getElementById('selected-hand-tray');
  if (!tray) return;

  tray.innerHTML = '';

  if (advisorState.selectedHand.length === 0) {
    tray.innerHTML = `<div class="empty-hand-msg">Click cards above or tap <strong>🎲 Deal Random</strong> to select ${advisorState.handSize} cards.</div>`;
    return;
  }

  advisorState.selectedHand.forEach(cardId => {
    const card = CARD_MAP[cardId];
    const isTrump = card.suit === advisorState.trumpSuit;

    const cardEl = document.createElement('div');
    cardEl.className = `playing-card card-${card.color} ${isTrump ? 'is-trump-card' : ''}`;
    cardEl.innerHTML = `
      ${isTrump ? '<span class="trump-card-badge">★</span>' : ''}
      <div class="card-corner top-left">
        <span class="rank">${card.rank}</span>
        <span class="suit">${card.symbol}</span>
      </div>
      <div class="card-center">${card.symbol}</div>
      <div class="card-corner bottom-right">
        <span class="rank">${card.rank}</span>
        <span class="suit">${card.symbol}</span>
      </div>
      <button class="remove-card-btn" title="Remove card" onclick="event.stopPropagation(); toggleCardSelection('${card.id}')">&times;</button>
    `;
    tray.appendChild(cardEl);
  });
}

function clearAdvisorHand() {
  advisorState.selectedHand = [];
  resetLiveTrickPlayState();
  updateHandDisplays();
  recalculateAdvisor();
}

function dealRandomHand() {
  const maxCards = advisorState.handSize;
  const shuffled = [...FULL_DECK].sort(() => Math.random() - 0.5);
  advisorState.selectedHand = shuffled.slice(0, maxCards).map(c => c.id);
  sortUserHand();
  resetLiveTrickPlayState();
  updateHandDisplays();
  recalculateAdvisor();
}

function dealPresetHand(type) {
  const maxCards = advisorState.handSize;
  const trump = advisorState.trumpSuit !== 'NT' ? advisorState.trumpSuit : 'S';
  const otherSuits = ['S', 'H', 'D', 'C'].filter(s => s !== trump);

  let cards = [];
  if (type === 'strong') {
    cards = [
      `A${trump}`, `K${trump}`, `Q${trump}`, `J${trump}`, `10${trump}`,
      `A${otherSuits[0]}`, `K${otherSuits[0]}`,
      `A${otherSuits[1]}`, `K${otherSuits[1]}`,
      `A${otherSuits[2]}`, `K${otherSuits[2]}`,
      `5${otherSuits[0]}`, `4${otherSuits[1]}`
    ];
  } else if (type === 'trump_heavy') {
    cards = [
      `A${trump}`, `K${trump}`, `J${trump}`, `9${trump}`, `7${trump}`, `5${trump}`, `2${trump}`,
      `K${otherSuits[0]}`, `10${otherSuits[0]}`,
      `Q${otherSuits[1]}`, `3${otherSuits[1]}`,
      `8${otherSuits[2]}`, `4${otherSuits[2]}`
    ];
  } else if (type === 'void_heavy') {
    cards = [
      `A${trump}`, `Q${trump}`, `8${trump}`, `6${trump}`, `4${trump}`,
      `A${otherSuits[0]}`, `K${otherSuits[0]}`, `Q${otherSuits[0]}`, `J${otherSuits[0]}`, `9${otherSuits[0]}`, `2${otherSuits[0]}`,
      `K${otherSuits[1]}`, `3${otherSuits[1]}`
    ];
  } else {
    cards = [
      `A${trump}`, `10${trump}`, `6${trump}`, `2${trump}`,
      `K${otherSuits[0]}`, `Q${otherSuits[0]}`, `8${otherSuits[0]}`,
      `A${otherSuits[1]}`, `J${otherSuits[1]}`, `4${otherSuits[1]}`,
      `Q${otherSuits[2]}`, `9${otherSuits[2]}`, `3${otherSuits[2]}`
    ];
  }

  // Adjust for different hand sizes
  if (cards.length > maxCards) {
    cards = cards.slice(0, maxCards);
  } else if (cards.length < maxCards) {
    const cardSet = new Set(cards);
    const fillers = FULL_DECK.filter(c => !cardSet.has(c.id)).map(c => c.id);
    while (cards.length < maxCards && fillers.length > 0) {
      cards.push(fillers.shift());
    }
  }

  advisorState.selectedHand = [...cards];
  sortUserHand();
  resetLiveTrickPlayState();
  updateHandDisplays();
  recalculateAdvisor();
}

// -------------------------------------------------------------
// 2. PROBABILITY & MONTE CARLO BID ENGINE
// -------------------------------------------------------------

function recalculateAdvisor() {
  const hand = advisorState.selectedHand.map(id => CARD_MAP[id]);
  const statsContainer = document.getElementById('advisor-stats-panel');
  const maxCards = advisorState.handSize;

  if (hand.length < maxCards) {
    if (statsContainer) statsContainer.classList.add('dimmed');
    updateIncompleteHandStats(hand);
    return;
  }

  if (statsContainer) statsContainer.classList.remove('dimmed');

  // Compute Hand Metrics based on chosen Trump Suit
  const metrics = computeHandMetrics(hand);
  renderHandMetrics(metrics);

  // Run Monte Carlo Simulation adapted to Player Count and Trump Suit
  const sim = runMonteCarloSimulation(hand, 800);
  advisorState.simResults = sim;

  // Render Probabilities & Recommendations
  renderBidRecommendations(metrics, sim);
  renderProbabilityChart(sim);
  renderSuitBreakdown(metrics);

  // Synchronize with Live Trick Tab
  syncLiveTrickHand();
}

function computeHandMetrics(hand) {
  let hcp = 0;
  const suitCounts = { 'S': 0, 'H': 0, 'D': 0, 'C': 0 };
  const suitCards = { 'S': [], 'H': [], 'D': [], 'C': [] };
  const trump = advisorState.trumpSuit;

  hand.forEach(c => {
    hcp += c.hcp;
    suitCounts[c.suit]++;
    suitCards[c.suit].push(c);
  });

  // Distribution points: Voids = 3, Singletons = 2, Doubletons = 1 (if holding at least 3 trumps)
  let distPoints = 0;
  const trumpCount = trump !== 'NT' ? suitCounts[trump] : 0;

  if (trump !== 'NT') {
    ['S', 'H', 'D', 'C'].forEach(s => {
      if (s !== trump) {
        if (suitCounts[s] === 0) distPoints += (trumpCount >= 3 ? 3 : 1);
        else if (suitCounts[s] === 1) distPoints += (trumpCount >= 3 ? 2 : 1);
        else if (suitCounts[s] === 2) distPoints += 1;
      }
    });
  }

  // Calculate Heuristic Expected Tricks per Suit
  const suitExpectancy = {};
  let totalHeuristicExpected = 0;

  SUITS_DATA.forEach(s => {
    const cards = suitCards[s.id];
    let exp = 0;
    const hasA = cards.some(c => c.rank === 'A');
    const hasK = cards.some(c => c.rank === 'K');
    const hasQ = cards.some(c => c.rank === 'Q');
    const hasJ = cards.some(c => c.rank === 'J');
    const count = cards.length;
    const isThisSuitTrump = s.id === trump;

    if (isThisSuitTrump) {
      // Main Colour (Trump) evaluation
      if (hasA) exp += 1.0;
      if (hasK) exp += (hasA || count >= 2) ? 0.9 : 0.7;
      if (hasQ) exp += (hasA && hasK) ? 0.85 : (hasA || hasK || count >= 3) ? 0.65 : 0.4;
      if (hasJ && count >= 3) exp += 0.4;

      // Small trump ruffing value based on voids/singletons in other suits
      let ruffs = 0;
      ['S', 'H', 'D', 'C'].forEach(side => {
        if (side !== trump) {
          if (suitCounts[side] === 0) ruffs += 1.3;
          else if (suitCounts[side] === 1) ruffs += 0.8;
        }
      });

      const smallTrumps = Math.max(0, count - (hasA ? 1 : 0) - (hasK ? 1 : 0) - (hasQ ? 1 : 0));
      exp += Math.min(ruffs, smallTrumps * 0.85);

      if (count >= 5) exp += (count - 4) * 0.6;
    } else {
      // Side suit / No Trump evaluation
      if (hasA) exp += (trump === 'NT' ? 0.98 : 0.90);
      if (hasK) {
        if (hasA) exp += 0.82;
        else if (count >= 2 && count <= 4) exp += 0.60;
        else exp += 0.35;
      }
      if (hasQ) {
        if (hasA && hasK) exp += 0.75;
        else if ((hasA || hasK) && count >= 3) exp += 0.40;
        else exp += 0.15;
      }
      if (hasJ && hasA && hasK && hasQ) exp += 0.6;
    }

    exp = Math.round(exp * 10) / 10;
    suitExpectancy[s.id] = exp;
    totalHeuristicExpected += exp;
  });

  return {
    hcp,
    distPoints,
    totalPoints: hcp + distPoints,
    suitCounts,
    suitCards,
    suitExpectancy,
    heuristicExpected: Math.round(totalHeuristicExpected * 10) / 10
  };
}

// Monte Carlo Simulation adapted to Player Count (2-6 players) and Trump
function runMonteCarloSimulation(userHand, iterations = 800) {
  const userIds = new Set(userHand.map(c => c.id));
  const remainingDeck = FULL_DECK.filter(c => !userIds.has(c.id));
  const oppCount = advisorState.playerCount - 1;
  const cardsPerOpp = advisorState.handSize;
  const maxTricks = advisorState.handSize;

  const winCounts = new Array(maxTricks + 1).fill(0);

  for (let iter = 0; iter < iterations; iter++) {
    const shuffled = [...remainingDeck];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = shuffled[i];
      shuffled[i] = shuffled[j];
      shuffled[j] = temp;
    }

    // Deal cards to opponents
    const oppHands = [];
    for (let o = 0; o < oppCount; o++) {
      const start = o * cardsPerOpp;
      oppHands.push(shuffled.slice(start, start + cardsPerOpp));
    }

    const won = simulateRoundTricks(userHand, oppHands);
    winCounts[Math.min(won, maxTricks)]++;
  }

  // Cumulative Probabilities P(won >= k)
  const probAtLeast = new Array(maxTricks + 1).fill(0);
  let cumulative = 0;
  for (let k = maxTricks; k >= 0; k--) {
    cumulative += winCounts[k];
    probAtLeast[k] = Math.round((cumulative / iterations) * 100);
  }

  // Expected Tricks
  let expSum = 0;
  for (let k = 0; k <= maxTricks; k++) {
    expSum += k * (winCounts[k] / iterations);
  }
  const expectedTricks = Math.round(expSum * 10) / 10;

  // Best Expected Value Bid
  let bestBid = 1;
  let maxEV = -999;
  for (let b = 1; b <= maxTricks; b++) {
    let ev = 0;
    for (let w = 0; w <= maxTricks; w++) {
      const p = winCounts[w] / iterations;
      if (w >= b) {
        ev += p * (b + 0.1 * (w - b));
      } else {
        ev += p * (-b);
      }
    }
    if (ev > maxEV) {
      maxEV = ev;
      bestBid = b;
    }
  }

  // Safe Bid (Confidence >= 85%)
  let safeBid = 1;
  for (let b = 1; b <= maxTricks; b++) {
    if (probAtLeast[b] >= 85) safeBid = b;
  }

  // Aggressive Bid (Confidence >= 45%)
  let aggBid = safeBid;
  for (let b = 1; b <= maxTricks; b++) {
    if (probAtLeast[b] >= 45) aggBid = b;
  }

  return {
    iterations,
    winCounts,
    probAtLeast,
    expectedTricks,
    bestBid,
    safeBid,
    aggBid,
    maxEV: Math.round(maxEV * 10) / 10
  };
}

// Simulated Round with N players
function simulateRoundTricks(userCards, opps) {
  let tricksWon = 0;
  const numPlayers = opps.length + 1;
  const hands = [[...userCards], ...opps.map(h => [...h])];
  const totalTricks = userCards.length;

  let leader = Math.floor(Math.random() * numPlayers);

  for (let trick = 0; trick < totalTricks; trick++) {
    let leadCard = null;
    let winningPlayer = leader;
    let winningCard = null;

    for (let i = 0; i < numPlayers; i++) {
      const p = (leader + i) % numPlayers;
      const hand = hands[p];
      if (!hand || hand.length === 0) continue;

      let cardToPlay = null;
      if (i === 0) {
        cardToPlay = pickSimLeadCard(hand);
        leadCard = cardToPlay;
        winningCard = cardToPlay;
        winningPlayer = p;
      } else {
        cardToPlay = pickSimFollowCard(hand, leadCard, winningCard);
        if (isBetterCard(cardToPlay, winningCard, leadCard.suit)) {
          winningCard = cardToPlay;
          winningPlayer = p;
        }
      }

      const cIdx = hand.indexOf(cardToPlay);
      if (cIdx >= 0) hand.splice(cIdx, 1);
    }

    if (winningPlayer === 0) {
      tricksWon++;
    }
    leader = winningPlayer;
  }

  return tricksWon;
}

function pickSimLeadCard(hand) {
  const trump = advisorState.trumpSuit;
  const ace = hand.find(c => c.rank === 'A');
  if (ace) return ace;
  if (trump !== 'NT') {
    const highTrump = hand.find(c => c.suit === trump && c.value >= 12);
    if (highTrump) return highTrump;
  }
  return hand[0];
}

function pickSimFollowCard(hand, leadCard, winningCard) {
  const trump = advisorState.trumpSuit;
  const sameSuitCards = hand.filter(c => c.suit === leadCard.suit);

  if (sameSuitCards.length > 0) {
    if (winningCard.suit === leadCard.suit) {
      const beaters = sameSuitCards.filter(c => c.value > winningCard.value);
      if (beaters.length > 0) {
        beaters.sort((a, b) => a.value - b.value);
        return beaters[0];
      }
    }
    sameSuitCards.sort((a, b) => a.value - b.value);
    return sameSuitCards[0];
  }

  // Void in led suit: can trump?
  if (trump !== 'NT') {
    const trumps = hand.filter(c => c.suit === trump);
    if (trumps.length > 0) {
      if (winningCard.suit === trump) {
        const overtrumps = trumps.filter(c => c.value > winningCard.value);
        if (overtrumps.length > 0) {
          overtrumps.sort((a, b) => a.value - b.value);
          return overtrumps[0];
        }
      } else {
        trumps.sort((a, b) => a.value - b.value);
        return trumps[0];
      }
    }
  }

  // Discard lowest non-trump card
  const nonTrumps = trump !== 'NT' ? hand.filter(c => c.suit !== trump) : hand;
  if (nonTrumps.length > 0) {
    nonTrumps.sort((a, b) => a.value - b.value);
    return nonTrumps[0];
  }

  hand.sort((a, b) => a.value - b.value);
  return hand[0];
}

function isBetterCard(newCard, currentWinner, leadSuit) {
  if (!currentWinner) return true;
  const trump = advisorState.trumpSuit;

  if (trump !== 'NT') {
    if (newCard.suit === trump && currentWinner.suit !== trump) return true;
    if (newCard.suit !== trump && currentWinner.suit === trump) return false;
    if (newCard.suit === trump && currentWinner.suit === trump) {
      return newCard.value > currentWinner.value;
    }
  }

  if (newCard.suit === currentWinner.suit) {
    return newCard.value > currentWinner.value;
  }
  return false;
}

// -------------------------------------------------------------
// 3. UI RENDERING: METRICS, PROBABILITIES & BREAKDOWNS
// -------------------------------------------------------------

function updateIncompleteHandStats(hand) {
  const hcpEl = document.getElementById('stat-hcp');
  const expTricksEl = document.getElementById('stat-expected-tricks');
  const trumpsEl = document.getElementById('stat-trumps');
  const trump = advisorState.trumpSuit;

  let hcp = 0;
  let trumps = 0;
  hand.forEach(c => {
    hcp += c.hcp;
    if (trump !== 'NT' && c.suit === trump) trumps++;
  });

  const trumpInfo = getTrumpDetails(trump);

  if (hcpEl) hcpEl.innerText = `${hcp} pts`;
  if (trumpsEl) trumpsEl.innerText = trump !== 'NT' ? `${trumps} ${trumpInfo.symbol}` : 'No Trump';
  if (expTricksEl) expTricksEl.innerText = `Select ${advisorState.handSize - hand.length} more`;
}

function renderHandMetrics(metrics) {
  const hcpEl = document.getElementById('stat-hcp');
  const totalPtsEl = document.getElementById('stat-total-pts');
  const trumpsEl = document.getElementById('stat-trumps');
  const expTricksEl = document.getElementById('stat-expected-tricks');
  const trump = advisorState.trumpSuit;
  const trumpInfo = getTrumpDetails(trump);

  if (hcpEl) hcpEl.innerText = `${metrics.hcp} HCP`;
  if (totalPtsEl) totalPtsEl.innerText = `${metrics.totalPoints} pts`;
  if (trumpsEl) {
    trumpsEl.innerText = trump !== 'NT' ? `${metrics.suitCounts[trump]} ${trumpInfo.name}` : 'No Trump';
  }
  if (expTricksEl) expTricksEl.innerText = `${metrics.heuristicExpected} tricks`;
}

function renderBidRecommendations(metrics, sim) {
  const safeBidEl = document.getElementById('rec-safe-bid');
  const safeProbEl = document.getElementById('rec-safe-prob');
  const optBidEl = document.getElementById('rec-opt-bid');
  const optEvEl = document.getElementById('rec-opt-ev');
  const aggBidEl = document.getElementById('rec-agg-bid');
  const aggProbEl = document.getElementById('rec-agg-prob');

  if (safeBidEl) safeBidEl.innerText = `Call ${sim.safeBid}`;
  if (safeProbEl) safeProbEl.innerText = `${sim.probAtLeast[sim.safeBid]}% success chance`;

  if (optBidEl) optBidEl.innerText = `Call ${sim.bestBid}`;
  if (optEvEl) optEvEl.innerText = `EV: +${sim.maxEV} pts (${sim.probAtLeast[sim.bestBid]}% win)`;

  if (aggBidEl) aggBidEl.innerText = `Call ${sim.aggBid}`;
  if (aggProbEl) aggProbEl.innerText = `${sim.probAtLeast[sim.aggBid]}% success chance`;

  advisorState.liveTrick.initialBid = sim.bestBid;
  const customBidInput = document.getElementById('advisor-custom-bid');
  if (customBidInput) customBidInput.value = sim.bestBid;
  updateLiveContractDisplay();
}

function renderProbabilityChart(sim) {
  const container = document.getElementById('prob-bars-container');
  if (!container) return;

  container.innerHTML = '';

  const maxBidToShow = Math.min(advisorState.handSize, Math.max(sim.aggBid + 2, 6));

  for (let b = 1; b <= maxBidToShow; b++) {
    const prob = sim.probAtLeast[b];
    const isOptimal = b === sim.bestBid;
    const isSafe = b === sim.safeBid;

    let barColor = '#10b981';
    if (prob < 50) barColor = '#ef4444';
    else if (prob < 80) barColor = '#f59e0b';

    const row = document.createElement('div');
    row.className = `prob-row ${isOptimal ? 'highlight-opt' : ''}`;
    row.innerHTML = `
      <div class="prob-label">
        <strong>Bid ${b}</strong>
        ${isOptimal ? '<span class="badge-opt">BEST EV</span>' : ''}
        ${isSafe && !isOptimal ? '<span class="badge-safe">SAFE</span>' : ''}
      </div>
      <div class="prob-bar-track">
        <div class="prob-bar-fill" style="width: ${prob}%; background-color: ${barColor};"></div>
      </div>
      <div class="prob-val">${prob}%</div>
    `;
    container.appendChild(row);
  }
}

function renderSuitBreakdown(metrics) {
  const container = document.getElementById('suit-breakdown-cards');
  if (!container) return;

  container.innerHTML = '';
  const trump = advisorState.trumpSuit;

  SUITS_DATA.forEach(suit => {
    const count = metrics.suitCounts[suit.id];
    const exp = metrics.suitExpectancy[suit.id];
    const cards = metrics.suitCards[suit.id];
    const cardStr = cards.map(c => c.rank).join(' ') || 'Void (None)';
    const isTrump = suit.id === trump;

    let tacticalNote = '';
    if (isTrump) {
      if (count >= 5) tacticalNote = `Dominant main colour (${count} ${suit.symbol}). Pull opponents' trumps early!`;
      else if (count >= 3) tacticalNote = `Solid trump support (${count} ${suit.symbol}). Cut side suits with smaller honors.`;
      else tacticalNote = `Weak trumps (${count} ${suit.symbol}). Conserve for high-value cuts.`;
    } else {
      if (count === 0) tacticalNote = trump !== 'NT' ? `⚡ Void! Can ruff with ${getTrumpDetails(trump).name} from Round 1!` : `Void (cannot lead or follow).`;
      else if (count === 1) tacticalNote = `Singleton (${cards[0].rank}). Can ruff on Round 2 after this card is played!`;
      else if (cards.some(c => c.rank === 'A')) tacticalNote = `Ace held. High-priority guaranteed winner if led early.`;
      else if (cards.some(c => c.rank === 'K')) tacticalNote = `King held. Protected by ${count - 1} card(s); strong scoring potential.`;
      else tacticalNote = `Safe discard fodder when unable to follow other suits.`;
    }

    const cardEl = document.createElement('div');
    cardEl.className = `suit-analysis-card border-${suit.color} ${isTrump ? 'highlight-trump' : ''}`;
    cardEl.innerHTML = `
      <div class="suit-card-header">
        <span class="suit-badge suit-${suit.color}">
          <span class="icon">${suit.symbol}</span> ${suit.name} ${isTrump ? '<span class="trump-tag">MAIN</span>' : ''}
        </span>
        <span class="suit-exp-badge">Expected: ~${exp} tricks</span>
      </div>
      <div class="suit-cards-held">
        <strong>Cards (${count}):</strong> <span class="card-ranks-text">${cardStr}</span>
      </div>
      <p class="suit-tactical-note">${tacticalNote}</p>
    `;
    container.appendChild(cardEl);
  });
}

// -------------------------------------------------------------
// 4. LIVE TRICK PLAY ADVISOR (DYNAMIC FOR 2-6 PLAYERS)
// -------------------------------------------------------------

function resetLiveTrickPlayState() {
  advisorState.liveTrick = {
    active: false,
    trickNumber: 1,
    leadPosition: 'opp_0',
    plays: {},
    tricksWonUser: 0,
    tricksWonOthers: {},
    initialBid: advisorState.simResults ? advisorState.simResults.bestBid : 4,
    handRemaining: [...advisorState.selectedHand],
    playedCardsHistory: [],
    trickLog: []
  };
  syncLiveTrickHand();
  renderLiveTrickArena();
}

function syncLiveTrickHand() {
  if (!advisorState.liveTrick.active || advisorState.liveTrick.handRemaining.length === 0) {
    advisorState.liveTrick.handRemaining = [...advisorState.selectedHand];
  }
  updateLiveContractDisplay();
  renderLiveTrickArena();
}

function getSeatList() {
  const oppCount = advisorState.playerCount - 1;
  const seats = [];
  for (let o = 0; o < oppCount; o++) {
    seats.push(`opp_${o}`);
  }
  seats.push('user');
  return seats;
}

function getSeatLabel(pos) {
  const oppCount = advisorState.playerCount - 1;
  if (pos === 'user') return 'YOU (Your Hand)';

  if (oppCount === 1) return 'Opponent';
  if (oppCount === 2) {
    return pos === 'opp_0' ? 'Left Opponent' : 'Right Opponent';
  }
  if (oppCount === 3) {
    if (pos === 'opp_0') return 'Left Opponent';
    if (pos === 'opp_1') return 'Partner (Across)';
    return 'Right Opponent';
  }

  const idx = parseInt(pos.replace('opp_', ''), 10);
  return `Opponent ${idx + 1}`;
}

function setTrickLead(position) {
  advisorState.liveTrick.leadPosition = position;
  advisorState.liveTrick.plays = {};
  renderLiveTrickArena();
}

function selectOpponentTrickCard(position, cardId) {
  advisorState.liveTrick.plays[position] = cardId || null;
  renderLiveTrickArena();
}

function getTurnOrder() {
  const seats = getSeatList();
  let leadIdx = seats.indexOf(advisorState.liveTrick.leadPosition);
  if (leadIdx < 0) leadIdx = 0;

  const order = [];
  for (let i = 0; i < seats.length; i++) {
    order.push(seats[(leadIdx + i) % seats.length]);
  }
  return order;
}

function getCurrentTrickLeadSuit() {
  const order = getTurnOrder();
  const leadPos = order[0];
  const leadCardId = advisorState.liveTrick.plays[leadPos];
  return leadCardId ? CARD_MAP[leadCardId].suit : null;
}

function getCurrentWinningPlay() {
  const order = getTurnOrder();
  const leadPos = order[0];
  const leadCardId = advisorState.liveTrick.plays[leadPos];
  if (!leadCardId) return null;

  const leadCard = CARD_MAP[leadCardId];
  let winningCard = leadCard;
  let winningPos = leadPos;

  order.forEach(pos => {
    const cardId = advisorState.liveTrick.plays[pos];
    if (cardId) {
      const card = CARD_MAP[cardId];
      if (isBetterCard(card, winningCard, leadCard.suit)) {
        winningCard = card;
        winningPos = pos;
      }
    }
  });

  return { winningCard, winningPos };
}

// Compute Legal Plays for User's Turn
function computeLegalUserCards() {
  const remainingHand = advisorState.liveTrick.handRemaining.map(id => CARD_MAP[id]);
  const leadSuit = getCurrentTrickLeadSuit();
  const trump = advisorState.trumpSuit;

  if (!leadSuit) {
    return remainingHand; // User leads, any card legal
  }

  // 1. Must follow suit if possible
  const followCards = remainingHand.filter(c => c.suit === leadSuit);
  if (followCards.length > 0) {
    const winInfo = getCurrentWinningPlay();
    if (winInfo && winInfo.winningCard.suit === leadSuit) {
      const beaters = followCards.filter(c => c.value > winInfo.winningCard.value);
      if (beaters.length > 0) {
        return beaters;
      }
    }
    return followCards;
  }

  // 2. Void in led suit: Must or can play Trump suit
  if (trump !== 'NT') {
    const trumps = remainingHand.filter(c => c.suit === trump);
    if (trumps.length > 0) {
      const winInfo = getCurrentWinningPlay();
      if (winInfo && winInfo.winningCard.suit === trump) {
        const overtrumps = trumps.filter(c => c.value > winInfo.winningCard.value);
        if (overtrumps.length > 0) {
          return overtrumps;
        }
      }
      return trumps;
    }
  }

  // 3. Any card discard
  return remainingHand;
}

// AI Analysis: Which Card Should You Play?
function analyzeCardRecommendations() {
  const remainingHand = advisorState.liveTrick.handRemaining.map(id => CARD_MAP[id]);
  const legalCards = computeLegalUserCards();
  const legalIds = new Set(legalCards.map(c => c.id));
  const leadSuit = getCurrentTrickLeadSuit();
  const winInfo = getCurrentWinningPlay();
  const order = getTurnOrder();
  const userTurnIndex = order.indexOf('user');
  const trump = advisorState.trumpSuit;

  const opponentsAfterUser = Math.max(0, (order.length - 1) - userTurnIndex);
  const scoredCards = [];

  legalCards.forEach(card => {
    let score = 50;
    let winChance = 50;
    let rationale = '';
    let tag = 'Viable';

    const wouldWinCurrent = winInfo ? isBetterCard(card, winInfo.winningCard, leadSuit) : true;

    if (userTurnIndex === order.length - 1) {
      // Last Seat: Outcome is 100% known
      if (wouldWinCurrent) {
        winChance = 100;
        tag = 'Guaranteed Win';
        score = 100 - (card.value * 0.5);
        rationale = `Plays last seat and wins trick immediately. Lowest winning card chosen to conserve strength.`;
      } else {
        winChance = 0;
        tag = 'Safe Duck';
        score = 80 - (card.value * 2);
        rationale = `Cannot win trick. Discard lowest value card to preserve higher honors for future tricks.`;
      }
    } else {
      // Earlier seats
      if (wouldWinCurrent) {
        if (trump !== 'NT' && card.suit === trump && leadSuit !== trump) {
          winChance = Math.max(30, 95 - (opponentsAfterUser * 15));
          tag = 'Ruff Trick';
          score = 85 - (card.value * 1.5);
          rationale = `Ruffs with ${card.rank}${card.symbol} to seize control of opponent's suit.`;
        } else if (card.rank === 'A') {
          winChance = Math.max(40, 95 - (opponentsAfterUser * 10));
          tag = 'Power Ace';
          score = 90;
          rationale = `Master card of the suit. Wins trick unless cut by an opponent void.`;
        } else if (card.value >= 12) {
          winChance = 70;
          tag = 'High Honor';
          score = 75;
          rationale = `Strong honor with high probability of securing trick.`;
        } else {
          winChance = 50;
          tag = 'Tempo Play';
          score = 65;
          rationale = `Currently takes trick; carries slight risk from opponents playing after you.`;
        }
      } else {
        winChance = 0;
        tag = 'Duck & Save';
        score = 70 - (card.value * 1.5);
        rationale = `Cannot beat current leader. Ducking with lowest card to preserve strength.`;
      }
    }

    scoredCards.push({
      card,
      score,
      winChance,
      tag,
      rationale
    });
  });

  scoredCards.sort((a, b) => b.score - a.score);

  return {
    scoredCards,
    bestPlay: scoredCards[0] || null,
    legalCards,
    legalIds
  };
}

// Render the Live Trick Arena UI
function renderLiveTrickArena() {
  const arena = document.getElementById('live-trick-arena');
  if (!arena) return;

  const { bestPlay, legalIds } = analyzeCardRecommendations();
  const seatsRow = document.getElementById('seats-row-container');

  // Render Opponent Seats Dynamically
  if (seatsRow) {
    seatsRow.innerHTML = '';
    const oppCount = advisorState.playerCount - 1;
    for (let o = 0; o < oppCount; o++) {
      const pos = `opp_${o}`;
      const seatBox = document.createElement('div');
      seatBox.className = 'seat-box';
      seatBox.id = `seat-control-${pos}`;
      seatsRow.appendChild(seatBox);
      renderSeatPosition(pos, getSeatLabel(pos));
    }
  }

  // Render Live Status Banner
  const statusEl = document.getElementById('trick-status-summary');
  const winInfo = getCurrentWinningPlay();
  const leadSuit = getCurrentTrickLeadSuit();
  const trumpInfo = getTrumpDetails(advisorState.trumpSuit);

  if (statusEl) {
    if (!leadSuit) {
      statusEl.innerHTML = `
        <span>🏁 <strong>Trick #${advisorState.liveTrick.trickNumber}</strong>: Awaiting Lead. Select who leads or choose an opponent card.</span>
        <span>👑 Main Colour: <strong class="badge-suit-${trumpInfo.color}">${trumpInfo.symbol} ${trumpInfo.name}</strong></span>
      `;
    } else {
      const winnerName = getSeatLabel(winInfo.winningPos);
      statusEl.innerHTML = `
        <span>♠️ Lead: <strong>${CARD_MAP[advisorState.liveTrick.plays[getTurnOrder()[0]]].rank}${leadSuit}</strong></span>
        <span>👑 Main Colour: <strong class="badge-suit-${trumpInfo.color}">${trumpInfo.symbol} ${trumpInfo.name}</strong></span>
        <span>🏆 Winning: <strong class="text-gold">${winInfo.winningCard.rank}${winInfo.winningCard.symbol} (${winnerName})</strong></span>
      `;
    }
  }

  // Render AI Top Recommendation Card
  const aiBox = document.getElementById('ai-play-suggestion-box');
  if (aiBox) {
    if (bestPlay) {
      aiBox.innerHTML = `
        <div class="ai-best-header">
          <div class="ai-icon-chip">🔮 AI RECOMMENDATION</div>
          <div class="ai-confidence-chip">${bestPlay.winChance}% Est. Win Rate</div>
        </div>
        <div class="ai-best-body">
          <div class="best-card-badge card-${bestPlay.card.color}">
            <span class="rank">${bestPlay.card.rank}</span>
            <span class="suit">${bestPlay.card.symbol}</span>
          </div>
          <div class="best-card-details">
            <h4>Play ${bestPlay.card.rank}${bestPlay.card.symbol} (${bestPlay.tag})</h4>
            <p>${bestPlay.rationale}</p>
          </div>
          <button class="btn btn-primary btn-sm" onclick="executeUserPlay('${bestPlay.card.id}')">
            ✨ Play This Card
          </button>
        </div>
      `;
    } else {
      aiBox.innerHTML = `<p class="text-muted">No cards remaining in your hand for this trick.</p>`;
    }
  }

  // Render User Hand in Trick Play Area
  const userHandContainer = document.getElementById('user-trick-hand');
  if (userHandContainer) {
    userHandContainer.innerHTML = '';
    advisorState.liveTrick.handRemaining.forEach(cardId => {
      const card = CARD_MAP[cardId];
      const isLegal = legalIds.has(cardId);
      const isBest = bestPlay && bestPlay.card.id === cardId;
      const isTrump = card.suit === advisorState.trumpSuit;

      const cardBtn = document.createElement('button');
      cardBtn.type = 'button';
      cardBtn.className = `playing-card interactive card-${card.color} ${isLegal ? 'legal' : 'illegal'} ${isBest ? 'best-recommendation' : ''}`;
      cardBtn.innerHTML = `
        ${isBest ? '<span class="best-tag">BEST</span>' : ''}
        ${isTrump ? '<span class="trump-card-badge">★</span>' : ''}
        <div class="card-corner top-left">
          <span class="rank">${card.rank}</span>
          <span class="suit">${card.symbol}</span>
        </div>
        <div class="card-center">${card.symbol}</div>
        <div class="card-corner bottom-right">
          <span class="rank">${card.rank}</span>
          <span class="suit">${card.symbol}</span>
        </div>
      `;
      if (isLegal) {
        cardBtn.onclick = () => executeUserPlay(cardId);
      } else {
        cardBtn.disabled = true;
        cardBtn.title = 'Illegal move (must follow suit if in hand)';
      }
      userHandContainer.appendChild(cardBtn);
    });
  }

  updateLiveContractDisplay();
}

function renderSeatPosition(pos, label) {
  const container = document.getElementById(`seat-control-${pos}`);
  if (!container) return;

  const currentPlayedId = advisorState.liveTrick.plays[pos];
  const isLead = advisorState.liveTrick.leadPosition === pos;

  const userHandSet = new Set(advisorState.selectedHand);
  const playedSet = new Set(advisorState.liveTrick.playedCardsHistory);

  let optionsHTML = `<option value="">-- No Card Played Yet --</option>`;

  SUITS_DATA.forEach(suit => {
    const suitCards = FULL_DECK.filter(c => c.suit === suit.id && !userHandSet.has(c.id) && !playedSet.has(c.id));
    if (suitCards.length > 0) {
      optionsHTML += `<optgroup label="${suit.name} (${suit.symbol})">`;
      suitCards.forEach(c => {
        const isSelected = currentPlayedId === c.id ? 'selected' : '';
        optionsHTML += `<option value="${c.id}" ${isSelected}>${c.rank} of ${c.name} (${c.symbol})</option>`;
      });
      optionsHTML += `</optgroup>`;
    }
  });

  container.innerHTML = `
    <div class="seat-header ${isLead ? 'is-lead' : ''}">
      <span>${label} ${isLead ? '👑 LEAD' : ''}</span>
      <button class="btn-micro" onclick="setTrickLead('${pos}')" title="Set this seat as trick leader">👑 Lead</button>
    </div>
    <div class="seat-card-slot ${currentPlayedId ? 'filled' : 'empty'}">
      ${currentPlayedId ? `
        <div class="mini-played-card card-${CARD_MAP[currentPlayedId].color}">
          <span>${CARD_MAP[currentPlayedId].rank}</span>
          <span>${CARD_MAP[currentPlayedId].symbol}</span>
        </div>
      ` : '<span class="empty-slot-text">Waiting</span>'}
    </div>
    <select class="seat-card-select" onchange="selectOpponentTrickCard('${pos}', this.value)">
      ${optionsHTML}
    </select>
  `;
}

function executeUserPlay(cardId) {
  advisorState.liveTrick.active = true;
  advisorState.liveTrick.plays.user = cardId;
  evaluateAndCompleteTrick();
}

function evaluateAndCompleteTrick() {
  const plays = advisorState.liveTrick.plays;
  const leadSuit = getCurrentTrickLeadSuit();
  const oppCount = advisorState.playerCount - 1;
  const userHandSet = new Set(advisorState.selectedHand);
  const playedSet = new Set(advisorState.liveTrick.playedCardsHistory);

  for (let o = 0; o < oppCount; o++) {
    const pos = `opp_${o}`;
    if (!plays[pos]) {
      const available = FULL_DECK.filter(c => !userHandSet.has(c.id) && !playedSet.has(c.id) && !Object.values(plays).includes(c.id));
      if (available.length > 0) {
        const sameSuit = available.filter(c => c.suit === leadSuit);
        const cardPick = sameSuit.length > 0 ? sameSuit[Math.floor(Math.random() * sameSuit.length)] : available[0];
        plays[pos] = cardPick.id;
      }
    }
  }

  const winInfo = getCurrentWinningPlay();
  const winnerPos = winInfo.winningPos;
  const winnerCard = winInfo.winningCard;

  if (winnerPos === 'user') {
    advisorState.liveTrick.tricksWonUser++;
  } else {
    advisorState.liveTrick.tricksWonOthers[winnerPos] = (advisorState.liveTrick.tricksWonOthers[winnerPos] || 0) + 1;
  }

  const userCardId = plays.user;
  const remIdx = advisorState.liveTrick.handRemaining.indexOf(userCardId);
  if (remIdx >= 0) {
    advisorState.liveTrick.handRemaining.splice(remIdx, 1);
  }

  Object.values(plays).forEach(cId => {
    if (cId) advisorState.liveTrick.playedCardsHistory.push(cId);
  });

  advisorState.liveTrick.trickLog.unshift({
    trickNum: advisorState.liveTrick.trickNumber,
    lead: advisorState.liveTrick.leadPosition,
    plays: { ...plays },
    winner: winnerPos,
    winnerCard: winnerCard
  });

  advisorState.liveTrick.trickNumber++;
  advisorState.liveTrick.leadPosition = winnerPos;
  advisorState.liveTrick.plays = {};

  updateHandDisplays();
  renderLiveTrickArena();
  renderTrickLog();
}

function updateLiveContractDisplay() {
  const targetBid = advisorState.liveTrick.initialBid;
  const won = advisorState.liveTrick.tricksWonUser;
  const totalTricks = advisorState.handSize;
  const tricksLeft = totalTricks - (advisorState.liveTrick.trickNumber - 1);

  const contractBadge = document.getElementById('contract-status-badge');
  const progressFill = document.getElementById('contract-progress-bar');
  const contractText = document.getElementById('contract-summary-text');

  if (contractText) {
    contractText.innerText = `Goal: ${targetBid} Tricks | Won: ${won} | Remaining: ${Math.max(0, tricksLeft)} tricks left`;
  }

  if (progressFill) {
    const pct = Math.min(100, Math.round((won / targetBid) * 100));
    progressFill.style.width = `${pct}%`;
  }

  if (contractBadge) {
    if (won >= targetBid) {
      contractBadge.className = 'status-pill success';
      contractBadge.innerText = `🎉 Contract Made! (${won}/${targetBid})`;
    } else if (won + tricksLeft < targetBid) {
      contractBadge.className = 'status-pill danger';
      contractBadge.innerText = `❌ Contract Failed (Cannot reach ${targetBid})`;
    } else {
      contractBadge.className = 'status-pill info';
      contractBadge.innerText = `⏳ In Progress (${won}/${targetBid})`;
    }
  }
}

function renderTrickLog() {
  const logContainer = document.getElementById('trick-history-log');
  if (!logContainer) return;

  if (advisorState.liveTrick.trickLog.length === 0) {
    logContainer.innerHTML = `<p class="text-muted">No tricks played yet in this simulation.</p>`;
    return;
  }

  logContainer.innerHTML = '';
  advisorState.liveTrick.trickLog.forEach(t => {
    const isUserWin = t.winner === 'user';
    const winnerName = isUserWin ? 'YOU 🏆' : getSeatLabel(t.winner);

    let cardsHTML = '';
    if (t.plays.user) {
      cardsHTML += `<span>You: <strong>${CARD_MAP[t.plays.user].rank}${CARD_MAP[t.plays.user].symbol}</strong></span>`;
    }
    Object.keys(t.plays).forEach(pos => {
      if (pos !== 'user' && t.plays[pos]) {
        cardsHTML += `<span>${getSeatLabel(pos)}: ${CARD_MAP[t.plays[pos]].rank}${CARD_MAP[t.plays[pos]].symbol}</span>`;
      }
    });

    const row = document.createElement('div');
    row.className = `trick-log-item ${isUserWin ? 'user-won' : ''}`;
    row.innerHTML = `
      <div class="trick-log-header">
        <strong>Trick #${t.trickNum}</strong> &bull; Won by <strong>${winnerName}</strong> with ${t.winnerCard.rank}${t.winnerCard.symbol}
      </div>
      <div class="trick-log-cards">
        ${cardsHTML}
      </div>
    `;
    logContainer.appendChild(row);
  });
}
