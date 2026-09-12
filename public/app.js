// Callbridge Master Application Logic
// State Management with Dynamic Players and Custom Main Colour (Trump)

let gameState = {
  active: false,
  id: null,
  date: null,
  players: ['Player 1', 'Player 2', 'Player 3', 'Player 4'],
  trumpRule: 'S', // 'S', 'H', 'D', 'C', 'rotate', 'dealer', 'NT'
  currentRoundTrump: 'S',
  tricksPerRound: 13,
  totalRounds: 5,
  startingDealer: 0, // index 0 to (numPlayers-1)
  rounds: [], // array of round objects
  editingRoundIndex: null,
  settings: {
    failPenalty: 'full_negative', // full_negative, zero, double_negative
    overtrickBonus: 0.1,         // 0.1, 1.0, 0.0
    minCalls: 0                  // 0, 10, 11
  }
};

let matchesHistory = [];

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  loadRuleSettings();
  handlePlayerCountChange(); // setup player input grid on startup
  loadSavedGameState();
  fetchMatchHistory();
});

// Tab Switching
function switchTab(tabName) {
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.remove('active');
    tab.classList.remove('hidden');
    tab.style.display = 'none';
  });
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));

  const targetTab = document.getElementById(`tab-${tabName}`);
  if (targetTab) {
    targetTab.classList.remove('hidden');
    targetTab.classList.add('active');
    targetTab.style.display = 'block';
  }
  
  const targetBtn = document.getElementById(`tab-${tabName}-btn`);
  if (targetBtn) {
    targetBtn.classList.add('active');
  }

  if (tabName === 'history') {
    fetchMatchHistory();
  }

  if (tabName === 'advisor') {
    if (typeof initAdvisor === 'function') {
      initAdvisor();
    }
  }
}

// -------------------------------------------------------------
// DYNAMIC PLAYER SETUP & MAIN COLOUR (TRUMP) HANDLING
// -------------------------------------------------------------

function handlePlayerCountChange() {
  const countEl = document.getElementById('player-count');
  if (!countEl) return;
  const count = parseInt(countEl.value, 10) || 4;

  const titleEl = document.getElementById('players-section-title');
  if (titleEl) {
    titleEl.innerText = `👥 Player Names (${count} Players)`;
  }

  const container = document.getElementById('players-input-grid');
  if (container) {
    // Preserve existing names if user changes count back and forth
    const existingNames = [];
    for (let i = 0; i < 6; i++) {
      const inp = document.getElementById(`p${i + 1}-name`);
      if (inp && inp.value.trim()) {
        existingNames.push(inp.value.trim());
      }
    }

    container.innerHTML = '';
    for (let i = 0; i < count; i++) {
      const pColorClass = `player-color-${(i % 6) + 1}`;
      const defaultName = existingNames[i] || `Player ${i + 1}`;

      const div = document.createElement('div');
      div.className = `player-input-group ${pColorClass}`;
      div.innerHTML = `
        <span class="player-badge">P${i + 1}</span>
        <input type="text" id="p${i + 1}-name" value="${defaultName}" placeholder="Player ${i + 1} Name" required oninput="updateDealerOptions()">
      `;
      container.appendChild(div);
    }
  }

  updateDealerOptions();
}

function updateDealerOptions() {
  const countEl = document.getElementById('player-count');
  const dealerSelect = document.getElementById('starting-dealer');
  if (!countEl || !dealerSelect) return;

  const count = parseInt(countEl.value, 10) || 4;
  const currentVal = dealerSelect.value;

  let optionsHTML = '';
  for (let i = 0; i < count; i++) {
    const inp = document.getElementById(`p${i + 1}-name`);
    const name = (inp && inp.value.trim()) || `Player ${i + 1}`;
    optionsHTML += `<option value="${i}">${name}</option>`;
  }
  optionsHTML += `<option value="random">🎲 Random Choice</option>`;

  dealerSelect.innerHTML = optionsHTML;
  if (currentVal === 'random' || (parseInt(currentVal, 10) < count)) {
    dealerSelect.value = currentVal;
  } else {
    dealerSelect.value = '0';
  }
}

function getRoundTrump(roundNum) {
  const rule = gameState.trumpRule || 'S';
  if (rule === 'rotate') {
    const cycle = ['S', 'H', 'D', 'C'];
    return cycle[(roundNum - 1) % 4];
  }
  if (rule === 'dealer') {
    return gameState.currentRoundTrump || 'S';
  }
  return rule; // 'S', 'H', 'D', 'C', 'NT'
}

function getTrumpDetails(suitId) {
  switch (suitId) {
    case 'S': return { id: 'S', symbol: '♠', name: 'Spades', color: 'spades' };
    case 'H': return { id: 'H', symbol: '♥', name: 'Hearts', color: 'hearts' };
    case 'D': return { id: 'D', symbol: '♦', name: 'Diamonds', color: 'diamonds' };
    case 'C': return { id: 'C', symbol: '♣', name: 'Clubs', color: 'clubs' };
    case 'NT': return { id: 'NT', symbol: '🚫', name: 'No Trump', color: 'nt' };
    default: return { id: 'S', symbol: '♠', name: 'Spades', color: 'spades' };
  }
}

function setRoundDealerTrump(suitId) {
  gameState.currentRoundTrump = suitId;
  saveGameState();
  updateUI();
}

// Set Main Colour (Trump Suit) directly from the in-game toolbar
function setGameMainColour(suitId) {
  if (!gameState.active) return;
  gameState.currentRoundTrump = suitId;
  gameState.trumpRule = suitId;

  saveGameState();
  updateUI();
  syncMatchToBackend();
}

// Open AI Advisor pre-configured with the current match context
function openAdvisorWithMatchContext() {
  const roundNum = (gameState.rounds ? gameState.rounds.length : 0) + 1;
  const activeTrump = getRoundTrump(roundNum);
  const pCount = (gameState.players && gameState.players.length) || 4;

  if (typeof window.setAdvisorTrump === 'function') {
    window.setAdvisorTrump(activeTrump);
  }
  if (typeof window.setAdvisorPlayerCount === 'function') {
    window.setAdvisorPlayerCount(pCount);
  }

  switchTab('advisor');
  const advEl = document.getElementById('tab-advisor');
  if (advEl) {
    advEl.scrollIntoView({ behavior: 'smooth' });
  }
}

// -------------------------------------------------------------
// IN-GAME MATCH CUSTOMIZATION MODAL (PLAYERS & RULES)
// -------------------------------------------------------------

function openGameCustomizationModal() {
  if (!gameState.active) return;

  const count = (gameState.players && gameState.players.length) || 4;
  const countSelect = document.getElementById('modal-player-count');
  if (countSelect) countSelect.value = count;

  renderModalPlayerInputs(count, gameState.players);

  const trumpRuleSelect = document.getElementById('modal-trump-rule');
  if (trumpRuleSelect) trumpRuleSelect.value = gameState.trumpRule || 'S';

  const tricksInput = document.getElementById('modal-tricks-per-round');
  if (tricksInput) tricksInput.value = gameState.tricksPerRound || 13;

  const roundsInput = document.getElementById('modal-total-rounds');
  if (roundsInput) roundsInput.value = gameState.totalRounds || 5;

  const modal = document.getElementById('game-customization-modal');
  if (modal) modal.classList.remove('hidden');
}

function closeGameCustomizationModal() {
  const modal = document.getElementById('game-customization-modal');
  if (modal) modal.classList.add('hidden');
}

function handleModalOverlayClick(e) {
  if (e.target.id === 'game-customization-modal') {
    closeGameCustomizationModal();
  }
}

function handleModalPlayerCountChange(val) {
  const count = parseInt(val, 10) || 4;
  const existingNames = [];
  for (let i = 0; i < 6; i++) {
    const inp = document.getElementById(`modal-p${i + 1}-name`);
    if (inp && inp.value.trim()) {
      existingNames.push(inp.value.trim());
    }
  }
  renderModalPlayerInputs(count, existingNames);

  // Auto-adjust default tricks per round
  const tricksInput = document.getElementById('modal-tricks-per-round');
  if (tricksInput) {
    let defTricks = 13;
    if (count === 3) defTricks = 17;
    else if (count === 5) defTricks = 10;
    else if (count === 6) defTricks = 8;
    tricksInput.value = defTricks;
  }
}

function renderModalPlayerInputs(count, existingNames = []) {
  const container = document.getElementById('modal-players-input-grid');
  if (!container) return;

  container.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const pColorClass = `player-color-${(i % 6) + 1}`;
    const defaultName = (existingNames && existingNames[i]) || (gameState.players && gameState.players[i]) || `Player ${i + 1}`;

    const div = document.createElement('div');
    div.className = `player-input-group ${pColorClass}`;
    div.innerHTML = `
      <span class="player-badge">P${i + 1}</span>
      <input type="text" id="modal-p${i + 1}-name" value="${defaultName}" placeholder="Player ${i + 1} Name" required>
    `;
    container.appendChild(div);
  }
}

function handleSaveGameCustomization(e) {
  e.preventDefault();

  const countSelect = document.getElementById('modal-player-count');
  const newCount = parseInt(countSelect.value, 10) || 4;

  const newNames = [];
  for (let i = 0; i < newCount; i++) {
    const inp = document.getElementById(`modal-p${i + 1}-name`);
    newNames.push((inp && inp.value.trim()) || `Player ${i + 1}`);
  }

  // If reducing player count when rounds were already recorded, confirm with user
  if (newCount < gameState.players.length && gameState.rounds && gameState.rounds.length > 0) {
    const ok = confirm(`Reducing player count from ${gameState.players.length} to ${newCount} will trim scores for removed players. Continue?`);
    if (!ok) return;
  }

  // Safely adjust existing completed rounds data arrays
  if (gameState.rounds && gameState.rounds.length > 0) {
    gameState.rounds.forEach(r => {
      if (newCount > r.calls.length) {
        while (r.calls.length < newCount) {
          r.calls.push(0);
          r.won.push(0);
          r.scores.push(0);
        }
      } else if (newCount < r.calls.length) {
        r.calls = r.calls.slice(0, newCount);
        r.won = r.won.slice(0, newCount);
        r.scores = r.scores.slice(0, newCount);
      }
      if (r.dealerIndex >= newCount) {
        r.dealerIndex = r.dealerIndex % newCount;
      }
    });
  }

  // Update Game State
  gameState.players = newNames;
  if (gameState.startingDealer >= newCount) {
    gameState.startingDealer = 0;
  }

  const trumpRule = document.getElementById('modal-trump-rule').value;
  gameState.trumpRule = trumpRule;
  if (trumpRule !== 'rotate' && trumpRule !== 'dealer') {
    gameState.currentRoundTrump = trumpRule;
  }

  const newTricks = parseInt(document.getElementById('modal-tricks-per-round').value, 10) || 13;
  gameState.tricksPerRound = newTricks;

  const newTotalRounds = parseInt(document.getElementById('modal-total-rounds').value, 10) || 5;
  gameState.totalRounds = newTotalRounds;

  closeGameCustomizationModal();
  saveGameState();
  updateUI();
  syncMatchToBackend();
}


// -------------------------------------------------------------
// SETTINGS & MATCH CREATION
// -------------------------------------------------------------

function saveRuleSettings() {
  gameState.settings.failPenalty = document.getElementById('rule-fail-penalty').value;
  gameState.settings.overtrickBonus = parseFloat(document.getElementById('rule-overtrick').value);
  gameState.settings.minCalls = parseInt(document.getElementById('rule-min-calls').value, 10);

  localStorage.setItem('callbridge_settings', JSON.stringify(gameState.settings));
  if (gameState.active) {
    updateUI();
  }
}

function loadRuleSettings() {
  const saved = localStorage.getItem('callbridge_settings');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      gameState.settings = { ...gameState.settings, ...parsed };
      document.getElementById('rule-fail-penalty').value = gameState.settings.failPenalty;
      document.getElementById('rule-overtrick').value = gameState.settings.overtrickBonus;
      document.getElementById('rule-min-calls').value = gameState.settings.minCalls;
    } catch (e) {
      console.error('Failed to parse settings', e);
    }
  }
}

// Start New Game Handler
function handleStartGame(e) {
  e.preventDefault();

  const countEl = document.getElementById('player-count');
  const count = parseInt(countEl.value, 10) || 4;

  const playerNames = [];
  for (let i = 0; i < count; i++) {
    const inp = document.getElementById(`p${i + 1}-name`);
    playerNames.push((inp && inp.value.trim()) || `Player ${i + 1}`);
  }

  const trumpRuleEl = document.getElementById('match-trump-rule');
  const trumpRule = trumpRuleEl ? trumpRuleEl.value : 'S';

  const totalRounds = parseInt(document.getElementById('total-rounds').value, 10);
  let dealerInput = document.getElementById('starting-dealer').value;
  let dealerIdx = 0;
  if (dealerInput === 'random') {
    dealerIdx = Math.floor(Math.random() * count);
  } else {
    dealerIdx = parseInt(dealerInput, 10);
  }

  // Calculate tricks per round based on player count
  let tricksPerRound = 13;
  if (count === 3) tricksPerRound = 17;
  else if (count === 5) tricksPerRound = 10;
  else if (count === 6) tricksPerRound = 8;
  else if (count === 2) tricksPerRound = 13;

  gameState.active = true;
  gameState.id = 'match_' + Date.now();
  gameState.date = new Date().toISOString();
  gameState.players = playerNames;
  gameState.trumpRule = trumpRule;
  gameState.currentRoundTrump = trumpRule === 'rotate' ? 'S' : (trumpRule === 'dealer' ? 'S' : trumpRule);
  gameState.tricksPerRound = tricksPerRound;
  gameState.totalRounds = totalRounds;
  gameState.startingDealer = dealerIdx;
  gameState.rounds = [];
  gameState.editingRoundIndex = null;

  saveGameState();
  updateUI();
}

function startNewGameFromBanner() {
  gameState.active = false;
  document.getElementById('active-game-view').classList.add('hidden');
  document.getElementById('setup-view').classList.remove('hidden');
  document.getElementById('game-over-banner').classList.add('hidden');
}

// -------------------------------------------------------------
// SCORING & ROUND SUBMISSION
// -------------------------------------------------------------

function calculatePlayerScore(call, won) {
  const { failPenalty, overtrickBonus } = gameState.settings;
  call = parseInt(call, 10);
  won = parseInt(won, 10);

  if (isNaN(call) || isNaN(won)) return 0;

  if (won >= call) {
    const extra = won - call;
    const score = call + (extra * overtrickBonus);
    return Math.round(score * 10) / 10;
  } else {
    if (failPenalty === 'zero') return 0;
    if (failPenalty === 'double_negative') return -2 * call;
    return -call; // default full negative
  }
}

function renderRoundEntryForm() {
  const container = document.getElementById('round-input-grid-container');
  if (!container) return;

  const numPlayers = gameState.players.length;
  const maxTricks = gameState.tricksPerRound || 13;

  let html = `
    <div class="grid-header-cell">Player</div>
    <div class="grid-header-cell">Call (Bid 1-${maxTricks})</div>
    <div class="grid-header-cell">Tricks Won (0-${maxTricks})</div>
    <div class="grid-header-cell text-right">Preview Score</div>
  `;

  for (let i = 0; i < numPlayers; i++) {
    const name = gameState.players[i];
    const pColorClass = `player-color-${(i % 6) + 1}`;
    html += `
      <div class="player-name-cell ${pColorClass}" id="entry-p${i}-label">
        <span class="player-badge-mini">P${i + 1}</span> ${name}
      </div>
      <div>
        <input type="number" id="bid-p${i}" min="1" max="${maxTricks}" class="input-bid" placeholder="Call" required oninput="calculatePreviewScores()">
      </div>
      <div>
        <input type="number" id="won-p${i}" min="0" max="${maxTricks}" class="input-won" placeholder="Won" required oninput="calculatePreviewScores()">
      </div>
      <div class="score-preview-cell" id="prev-score-p${i}">0.0</div>
    `;
  }

  container.innerHTML = html;
}

function calculatePreviewScores() {
  let tricksSum = 0;
  let validWonCount = 0;
  const numPlayers = gameState.players.length;
  const targetTricks = gameState.tricksPerRound || 13;

  for (let i = 0; i < numPlayers; i++) {
    const callInput = document.getElementById(`bid-p${i}`);
    const wonInput = document.getElementById(`won-p${i}`);
    const previewEl = document.getElementById(`prev-score-p${i}`);
    if (!callInput || !wonInput || !previewEl) continue;

    const callVal = callInput.value;
    const wonVal = wonInput.value;

    if (wonVal !== '' && !isNaN(parseInt(wonVal, 10))) {
      const won = parseInt(wonVal, 10);
      tricksSum += won;
      validWonCount++;
    }

    if (callVal !== '' && wonVal !== '') {
      const score = calculatePlayerScore(callVal, wonVal);
      previewEl.innerText = score > 0 ? `+${score.toFixed(1)}` : score.toFixed(1);
      previewEl.className = `score-preview-cell ${score < 0 ? 'neg' : ''}`;
    } else {
      previewEl.innerText = '0.0';
      previewEl.className = 'score-preview-cell';
    }
  }

  const counterBadge = document.getElementById('tricks-counter-badge');
  const counterVal = document.getElementById('current-tricks-sum');
  if (counterVal) counterVal.innerText = tricksSum;

  const expectedVal = document.getElementById('expected-tricks-total');
  if (expectedVal) expectedVal.innerText = targetTricks;

  if (counterBadge) {
    if (tricksSum === targetTricks) {
      counterBadge.className = 'tricks-counter valid';
    } else {
      counterBadge.className = 'tricks-counter invalid';
    }
  }
}

function handleRoundSubmit(e) {
  e.preventDefault();

  const numPlayers = gameState.players.length;
  const maxTricks = gameState.tricksPerRound || 13;

  const roundCalls = [];
  const roundWon = [];
  const roundScores = [];

  let sumWon = 0;
  let sumCalls = 0;

  for (let i = 0; i < numPlayers; i++) {
    const call = parseInt(document.getElementById(`bid-p${i}`).value, 10);
    const won = parseInt(document.getElementById(`won-p${i}`).value, 10);

    if (isNaN(call) || call < 1 || call > maxTricks) {
      showError(`${gameState.players[i]} call must be between 1 and ${maxTricks}.`);
      return;
    }
    if (isNaN(won) || won < 0 || won > maxTricks) {
      showError(`${gameState.players[i]} tricks won must be between 0 and ${maxTricks}.`);
      return;
    }

    sumCalls += call;
    sumWon += won;
    roundCalls.push(call);
    roundWon.push(won);
    roundScores.push(calculatePlayerScore(call, won));
  }

  if (sumWon !== maxTricks) {
    showError(`Total tricks won MUST equal ${maxTricks} (currently ${sumWon}). Please adjust tricks won.`);
    return;
  }

  if (gameState.settings.minCalls > 0 && sumCalls < gameState.settings.minCalls) {
    const confirmProceed = confirm(`Total calls (${sumCalls}) is less than minimum recommended (${gameState.settings.minCalls}). Proceed anyway?`);
    if (!confirmProceed) return;
  }

  hideError();

  const currentRoundNum = gameState.editingRoundIndex !== null 
    ? gameState.editingRoundIndex + 1 
    : gameState.rounds.length + 1;

  const dealerIdx = (gameState.startingDealer + (currentRoundNum - 1)) % numPlayers;
  const activeTrump = getRoundTrump(currentRoundNum);

  const roundData = {
    roundNumber: currentRoundNum,
    dealerIndex: dealerIdx,
    trump: activeTrump,
    calls: roundCalls,
    won: roundWon,
    scores: roundScores
  };

  if (gameState.editingRoundIndex !== null) {
    gameState.rounds[gameState.editingRoundIndex] = roundData;
    gameState.editingRoundIndex = null;
    document.getElementById('cancel-edit-btn').classList.add('hidden');
    document.getElementById('submit-round-btn').innerText = '✅ Submit Round Scores';
  } else {
    gameState.rounds.push(roundData);
  }

  clearInputForm();
  saveGameState();
  updateUI();
  syncMatchToBackend();
}

function clearInputForm() {
  const numPlayers = gameState.players.length;
  for (let i = 0; i < numPlayers; i++) {
    const b = document.getElementById(`bid-p${i}`);
    const w = document.getElementById(`won-p${i}`);
    const p = document.getElementById(`prev-score-p${i}`);
    if (b) b.value = '';
    if (w) w.value = '';
    if (p) {
      p.innerText = '0.0';
      p.className = 'score-preview-cell';
    }
  }
  const counterVal = document.getElementById('current-tricks-sum');
  if (counterVal) counterVal.innerText = '0';
  const counterBadge = document.getElementById('tricks-counter-badge');
  if (counterBadge) counterBadge.className = 'tricks-counter';
}

function showError(msg) {
  const errBox = document.getElementById('entry-error-msg');
  if (errBox) {
    errBox.innerText = msg;
    errBox.classList.remove('hidden');
  }
}

function hideError() {
  const errBox = document.getElementById('entry-error-msg');
  if (errBox) errBox.classList.add('hidden');
}

// Edit Previous Round
function editRound(index) {
  const round = gameState.rounds[index];
  if (!round) return;

  gameState.editingRoundIndex = index;

  renderRoundEntryForm();

  for (let i = 0; i < gameState.players.length; i++) {
    const b = document.getElementById(`bid-p${i}`);
    const w = document.getElementById(`won-p${i}`);
    if (b) b.value = round.calls[i];
    if (w) w.value = round.won[i];
  }

  calculatePreviewScores();

  document.getElementById('entry-card-title').innerText = `Edit Round ${index + 1} Scores`;
  document.getElementById('cancel-edit-btn').classList.remove('hidden');
  document.getElementById('submit-round-btn').innerText = `💾 Update Round ${index + 1}`;

  document.getElementById('round-entry-card').scrollIntoView({ behavior: 'smooth' });
}

function cancelEditingRound() {
  gameState.editingRoundIndex = null;
  clearInputForm();
  document.getElementById('cancel-edit-btn').classList.add('hidden');
  document.getElementById('submit-round-btn').innerText = '✅ Submit Round Scores';
  updateUI();
}

function getPlayerTotals() {
  const numPlayers = gameState.players.length;
  const totals = new Array(numPlayers).fill(0);
  const totalCalls = new Array(numPlayers).fill(0);
  const totalWon = new Array(numPlayers).fill(0);

  gameState.rounds.forEach(r => {
    for (let i = 0; i < numPlayers; i++) {
      totals[i] += (r.scores[i] || 0);
      totalCalls[i] += (r.calls[i] || 0);
      totalWon[i] += (r.won[i] || 0);
    }
  });

  return {
    totals: totals.map(t => Math.round(t * 10) / 10),
    totalCalls,
    totalWon
  };
}

// -------------------------------------------------------------
// UI RENDERING: LEADERBOARD, SCOREBOARD & ROUND VIEWS
// -------------------------------------------------------------

function updateUI() {
  if (!gameState.active) {
    document.getElementById('setup-view').classList.remove('hidden');
    document.getElementById('active-game-view').classList.add('hidden');
    return;
  }

  document.getElementById('setup-view').classList.add('hidden');
  document.getElementById('active-game-view').classList.remove('hidden');

  const numPlayers = gameState.players.length;
  const roundNum = gameState.rounds.length + 1;
  const isFinished = gameState.rounds.length >= gameState.totalRounds;
  const activeTrump = getRoundTrump(roundNum);

  // Update In-Game Customization Toolbar Badges
  const playersBadge = document.getElementById('game-players-badge');
  if (playersBadge) playersBadge.innerText = `👥 ${numPlayers} Players`;
  const tricksBadge = document.getElementById('game-tricks-badge');
  if (tricksBadge) tricksBadge.innerText = `🎯 ${gameState.tricksPerRound || 13} Tricks/Round`;

  // Update In-Game Main Colour Quick Switcher Buttons
  document.querySelectorAll('#game-trump-selector .trump-toggle-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  const activeGameTrumpBtn = document.getElementById(`game-trump-${activeTrump.toLowerCase()}`);
  if (activeGameTrumpBtn) {
    activeGameTrumpBtn.classList.add('active');
  }

  const expectedTricksTotal = document.getElementById('expected-tricks-total');
  if (expectedTricksTotal) expectedTricksTotal.innerText = gameState.tricksPerRound || 13;

  // Round Indicator Bar
  if (isFinished) {
    document.getElementById('round-indicator').innerText = `Match Completed (${gameState.totalRounds} Rounds)`;
    document.getElementById('round-entry-card').classList.add('hidden');
    document.getElementById('game-over-banner').classList.remove('hidden');
  } else {
    document.getElementById('round-indicator').innerText = `Round ${roundNum} of ${gameState.totalRounds}`;
    const nextDealerIdx = (gameState.startingDealer + (roundNum - 1)) % numPlayers;
    document.getElementById('dealer-indicator').innerText = `Dealer: ${gameState.players[nextDealerIdx]}`;

    // Active Main Colour / Trump Indicator
    const trumpInfo = getTrumpDetails(activeTrump);
    const trumpIndicator = document.getElementById('trump-indicator');
    if (trumpIndicator) {
      trumpIndicator.innerHTML = `Main Colour: <strong class="trump-badge-pill suit-${trumpInfo.color}">${trumpInfo.symbol} ${trumpInfo.name}</strong>`;
    }

    // Dealer Trump Picker (if dealer choice mode is active)
    const dealerChoiceWrap = document.getElementById('dealer-trump-choice-wrap');
    if (dealerChoiceWrap) {
      if (gameState.trumpRule === 'dealer') {
        dealerChoiceWrap.classList.remove('hidden');
        document.getElementById('dealer-trump-picker').value = gameState.currentRoundTrump || 'S';
      } else {
        dealerChoiceWrap.classList.add('hidden');
      }
    }

    document.getElementById('round-entry-card').classList.remove('hidden');
    document.getElementById('game-over-banner').classList.add('hidden');

    if (gameState.editingRoundIndex === null) {
      document.getElementById('entry-card-title').innerText = `Enter Round ${roundNum} Scores`;
      document.getElementById('entry-card-subtitle').innerText = `Set calls and tricks won for Round ${roundNum} (Total ${gameState.tricksPerRound} Tricks)`;
    }

    renderRoundEntryForm();
  }

  const { totals, totalCalls, totalWon } = getPlayerTotals();

  // Render Leaderboard Cards
  renderLeaderboard(totals, totalCalls, totalWon);

  // Render Scoreboard Table
  renderScoreboardTable(totals);

  // Render Winner Banner if Game Finished
  if (isFinished) {
    renderWinnerBanner(totals);
  }
}

// Render Leaderboard Cards sorted by rank
function renderLeaderboard(totals, totalCalls, totalWon) {
  const leaderboardContainer = document.getElementById('leaderboard-cards');
  if (!leaderboardContainer) return;
  leaderboardContainer.innerHTML = '';

  const numPlayers = gameState.players.length;
  const playerStats = gameState.players.map((name, idx) => ({
    name,
    idx,
    score: totals[idx] || 0,
    calls: totalCalls[idx] || 0,
    won: totalWon[idx] || 0
  }));

  // Sort descending by score
  playerStats.sort((a, b) => b.score - a.score);

  const ranks = ['1st 🥇', '2nd 🥈', '3rd 🥉', '4th', '5th', '6th'];

  playerStats.forEach((p, rankIndex) => {
    const isDealer = gameState.rounds.length < gameState.totalRounds && 
      ((gameState.startingDealer + gameState.rounds.length) % numPlayers === p.idx);

    const card = document.createElement('div');
    card.className = `player-score-card rank-${Math.min(rankIndex + 1, 6)}`;
    card.innerHTML = `
      <div class="card-top-row">
        <span class="player-tag">
          ${p.name} ${isDealer ? '🃏' : ''}
        </span>
        <span class="rank-pill">${ranks[rankIndex] || `${rankIndex + 1}th`}</span>
      </div>
      <div class="big-score ${p.score < 0 ? 'negative' : ''}">
        ${p.score > 0 ? '+' : ''}${p.score.toFixed(1)}
      </div>
      <div class="card-stats-row">
        <span>Total Calls: ${p.calls}</span>
        <span>Tricks Won: ${p.won}</span>
      </div>
    `;
    leaderboardContainer.appendChild(card);
  });
}

// Render Scoreboard Table
function renderScoreboardTable(totals) {
  const numPlayers = gameState.players.length;
  const thead = document.getElementById('table-header-row');
  const tbody = document.getElementById('scoreboard-body');
  const tfoot = document.getElementById('scoreboard-footer');

  if (!thead || !tbody || !tfoot) return;

  // Render Table Header Row
  let headerHTML = `<th>Round</th><th>Dealer</th><th>Main Colour</th>`;
  for (let p = 0; p < numPlayers; p++) {
    headerHTML += `<th>${gameState.players[p]}</th>`;
  }
  headerHTML += `<th>Actions</th>`;
  thead.innerHTML = headerHTML;

  // Render Table Body Rows
  tbody.innerHTML = '';
  let cumulativeTotals = new Array(numPlayers).fill(0);

  gameState.rounds.forEach((r, idx) => {
    const tr = document.createElement('tr');
    const trumpInfo = getTrumpDetails(r.trump || getRoundTrump(r.roundNumber));

    let rowsHTML = `<td><strong>R${r.roundNumber}</strong></td>`;
    rowsHTML += `<td>🃏 ${gameState.players[r.dealerIndex]}</td>`;
    rowsHTML += `<td><span class="table-trump-badge suit-${trumpInfo.color}">${trumpInfo.symbol} ${trumpInfo.name}</span></td>`;

    for (let p = 0; p < numPlayers; p++) {
      cumulativeTotals[p] += (r.scores[p] || 0);
      cumulativeTotals[p] = Math.round(cumulativeTotals[p] * 10) / 10;

      const call = r.calls[p];
      const won = r.won[p];
      const score = r.scores[p];
      const passed = won >= call;

      rowsHTML += `
        <td>
          <div class="cell-detail">
            <span class="cell-score ${passed ? 'pass' : 'fail'}">
              ${score > 0 ? '+' : ''}${score.toFixed(1)}
            </span>
            <span class="cell-bidwon">(${call} / ${won}) &bull; Tot: ${cumulativeTotals[p].toFixed(1)}</span>
          </div>
        </td>
      `;
    }

    rowsHTML += `
      <td>
        <button class="btn btn-outline btn-sm" onclick="editRound(${idx})">✏️ Edit</button>
      </td>
    `;

    tr.innerHTML = rowsHTML;
    tbody.appendChild(tr);
  });

  // Render Table Footer Totals
  let footerHTML = `<td colspan="3">TOTAL SCORE</td>`;
  for (let p = 0; p < numPlayers; p++) {
    const tot = totals[p] || 0;
    const totStr = tot > 0 ? `+${tot.toFixed(1)}` : tot.toFixed(1);
    footerHTML += `<td class="${tot < 0 ? 'text-danger' : ''}"><strong>${totStr}</strong></td>`;
  }
  footerHTML += `<td>-</td>`;
  tfoot.innerHTML = footerHTML;

  const { totalCalls } = getPlayerTotals();
  const sumCallsAll = totalCalls.reduce((a, b) => a + b, 0);
  const badgeEl = document.getElementById('total-calls-badge');
  if (badgeEl) badgeEl.innerText = `Total Match Calls: ${sumCallsAll}`;
}

// Render Winner Banner
function renderWinnerBanner(totals) {
  let maxScore = -Infinity;
  let winnerIndices = [];

  totals.forEach((score, idx) => {
    if (score > maxScore) {
      maxScore = score;
      winnerIndices = [idx];
    } else if (score === maxScore) {
      winnerIndices.push(idx);
    }
  });

  const winnerNames = winnerIndices.map(i => gameState.players[i]).join(' & ');
  const bannerTitle = document.getElementById('winner-announcement');
  const bannerSub = document.getElementById('winner-subtext');

  if (winnerIndices.length > 1) {
    bannerTitle.innerText = `🤝 Tie Game between ${winnerNames}!`;
  } else {
    bannerTitle.innerText = `🏆 ${winnerNames} Wins the Match!`;
  }

  bannerSub.innerText = `Final Score: ${maxScore.toFixed(1)} points after ${gameState.totalRounds} rounds`;
}

// Confirm Reset Game
function confirmResetGame() {
  if (confirm('Are you sure you want to reset the current match? All round progress for this game will be cleared.')) {
    gameState.rounds = [];
    gameState.editingRoundIndex = null;
    saveGameState();
    updateUI();
  }
}

// Local Storage Persistence
function saveGameState() {
  localStorage.setItem('callbridge_active_game', JSON.stringify(gameState));
}

function loadSavedGameState() {
  const saved = localStorage.getItem('callbridge_active_game');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.active) {
        gameState = { ...gameState, ...parsed };
        updateUI();
      }
    } catch (e) {
      console.error('Failed to parse saved game state', e);
    }
  }
}

// Backend API Sync
async function syncMatchToBackend() {
  if (!gameState.active) return;

  const { totals } = getPlayerTotals();
  const payload = {
    id: gameState.id,
    date: gameState.date,
    players: gameState.players,
    numPlayers: gameState.players.length,
    trumpRule: gameState.trumpRule,
    tricksPerRound: gameState.tricksPerRound,
    totalRounds: gameState.totalRounds,
    completedRounds: gameState.rounds.length,
    isFinished: gameState.rounds.length >= gameState.totalRounds,
    totals,
    rounds: gameState.rounds,
    settings: gameState.settings
  };

  // Always update local cache
  try {
    let localHistory = JSON.parse(localStorage.getItem('callbridge_matches_history') || '[]');
    const idx = localHistory.findIndex(m => m.id === payload.id);
    if (idx >= 0) localHistory[idx] = payload;
    else localHistory.unshift(payload);
    localStorage.setItem('callbridge_matches_history', JSON.stringify(localHistory));
  } catch (e) {}

  try {
    await fetch('/api/matches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    console.warn('Backend API server not reached, relying on local storage', err);
  }
}

// Fetch & Render History
async function fetchMatchHistory() {
  const historyContainer = document.getElementById('history-list-container');
  if (!historyContainer) return;
  historyContainer.innerHTML = '<p class="text-muted">Loading match history...</p>';

  let matches = [];
  try {
    const res = await fetch('/api/matches');
    if (res.ok) {
      const data = await res.json();
      if (data && data.success && Array.isArray(data.matches)) {
        matches = data.matches;
      }
    }
  } catch (err) {
    console.warn('Backend unavailable for history fetch, reading fallback');
  }

  // Fallback to local storage if API returned no matches or is offline
  if (matches.length === 0) {
    try {
      matches = JSON.parse(localStorage.getItem('callbridge_matches_history') || '[]');
    } catch (e) {}
  } else {
    try {
      localStorage.setItem('callbridge_matches_history', JSON.stringify(matches));
    } catch (e) {}
  }

  matchesHistory = matches;
  renderHistoryList(matches);
}

function renderHistoryList(matches) {
  const historyContainer = document.getElementById('history-list-container');
  if (!historyContainer) return;
  if (!matches || matches.length === 0) {
    historyContainer.innerHTML = '<p class="text-muted">No saved matches found yet. Play a game to record history!</p>';
    return;
  }

  historyContainer.innerHTML = '';

  matches.forEach(m => {
    const item = document.createElement('div');
    item.className = 'history-item';

    const dateStr = new Date(m.date).toLocaleString();

    let maxScore = -Infinity;
    (m.totals || []).forEach(s => { if (s > maxScore) maxScore = s; });

    let playerChips = (m.players || []).map((pName, i) => {
      const score = m.totals ? m.totals[i] : 0;
      const isWin = score === maxScore;
      return `
        <div class="history-player-chip ${isWin ? 'winner' : ''}">
          <span>${pName} ${isWin ? '🏆' : ''}</span>
          <span>${score > 0 ? '+' : ''}${score.toFixed(1)}</span>
        </div>
      `;
    }).join('');

    item.innerHTML = `
      <div class="history-item-header">
        <div>
          <strong>${m.isFinished ? '✅ Completed Match' : '⏳ In Progress'}</strong>
          <span class="text-muted">&bull; ${m.players ? m.players.length : 4} Players &bull; ${m.completedRounds}/${m.totalRounds} Rounds &bull; ${dateStr}</span>
        </div>
        <button class="btn btn-danger btn-sm" onclick="deleteMatchHistoryItem('${m.id}')">🗑️ Delete</button>
      </div>
      <div class="history-item-players">
        ${playerChips}
      </div>
    `;

    historyContainer.appendChild(item);
  });
}

async function deleteMatchHistoryItem(id) {
  if (confirm('Delete this match from history?')) {
    try {
      let local = JSON.parse(localStorage.getItem('callbridge_matches_history') || '[]');
      local = local.filter(m => m.id !== id);
      localStorage.setItem('callbridge_matches_history', JSON.stringify(local));
    } catch (e) {}

    try {
      await fetch(`/api/matches/${id}`, { method: 'DELETE' });
    } catch (e) {}
    fetchMatchHistory();
  }
}

async function confirmClearHistory() {
  if (confirm('Are you sure you want to delete ALL match history?')) {
    try {
      localStorage.removeItem('callbridge_matches_history');
    } catch (e) {}

    try {
      await fetch('/api/matches', { method: 'DELETE' });
    } catch (e) {}
    fetchMatchHistory();
  }
}

// Export CSV / JSON Functions
function exportCurrentMatchCSV() {
  if (!gameState.rounds || gameState.rounds.length === 0) {
    alert('No rounds played yet in this match.');
    return;
  }

  let csv = 'Round,Dealer,Main Colour,' + gameState.players.map(p => `"${p} Call","${p} Won","${p} Score"`).join(',') + '\n';

  gameState.rounds.forEach(r => {
    const trumpInfo = getTrumpDetails(r.trump || getRoundTrump(r.roundNumber));
    const row = [
      `Round ${r.roundNumber}`,
      `"${gameState.players[r.dealerIndex]}"`,
      `"${trumpInfo.symbol} ${trumpInfo.name}"`
    ];
    for (let p = 0; p < gameState.players.length; p++) {
      row.push(r.calls[p], r.won[p], r.scores[p]);
    }
    csv += row.join(',') + '\n';
  });

  const { totals } = getPlayerTotals();
  csv += 'TOTALS,,,' + totals.map(t => `-,,${t}`).join(',') + '\n';

  downloadBlob(csv, `Callbridge_Match_${Date.now()}.csv`, 'text/csv');
}

function exportAllMatchesJSON() {
  downloadBlob(JSON.stringify(matchesHistory, null, 2), `Callbridge_History_${Date.now()}.json`, 'application/json');
}

function downloadBlob(content, filename, contentType) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Expose In-Game Customization and Game Functions to Window
window.setGameMainColour = setGameMainColour;
window.openAdvisorWithMatchContext = openAdvisorWithMatchContext;
window.openGameCustomizationModal = openGameCustomizationModal;
window.closeGameCustomizationModal = closeGameCustomizationModal;
window.handleModalOverlayClick = handleModalOverlayClick;
window.handleModalPlayerCountChange = handleModalPlayerCountChange;
window.renderModalPlayerInputs = renderModalPlayerInputs;
window.handleSaveGameCustomization = handleSaveGameCustomization;
window.setRoundDealerTrump = setRoundDealerTrump;
window.confirmResetGame = confirmResetGame;
window.exportCurrentMatchCSV = exportCurrentMatchCSV;
window.editRound = editRound;
window.cancelEditingRound = cancelEditingRound;
window.handleRoundSubmit = handleRoundSubmit;
window.calculatePreviewScores = calculatePreviewScores;
window.startNewGameFromBanner = startNewGameFromBanner;
window.switchTab = switchTab;

