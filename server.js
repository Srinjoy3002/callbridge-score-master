const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.VERCEL ? '/tmp' : path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'matches.json');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Ensure data directory and file exist
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (e) {}
}
if (!fs.existsSync(DATA_FILE)) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2), 'utf8');
  } catch (e) {}
}

// Helper to read matches
function readMatches() {
  try {
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading matches file:', err);
    return [];
  }
}

// Helper to write matches
function writeMatches(matches) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(matches, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error writing matches file:', err);
    return false;
  }
}

// API Routes
// Get all saved matches
app.get('/api/matches', (req, res) => {
  const matches = readMatches();
  res.json({ success: true, matches });
});

// Save a completed or updated match
app.post('/api/matches', (req, res) => {
  const match = req.body;
  if (!match || !match.id) {
    return res.status(400).json({ success: false, message: 'Invalid match data' });
  }

  const matches = readMatches();
  const existingIdx = matches.findIndex(m => m.id === match.id);

  if (existingIdx >= 0) {
    matches[existingIdx] = match;
  } else {
    matches.unshift(match); // newest first
  }

  if (writeMatches(matches)) {
    res.json({ success: true, match });
  } else {
    res.status(500).json({ success: false, message: 'Failed to save match' });
  }
});

// Delete a match by ID
app.delete('/api/matches/:id', (req, res) => {
  const matchId = req.params.id;
  let matches = readMatches();
  matches = matches.filter(m => m.id !== matchId);

  if (writeMatches(matches)) {
    res.json({ success: true, message: 'Match deleted' });
  } else {
    res.status(500).json({ success: false, message: 'Failed to delete match' });
  }
});

// Clear all match history
app.delete('/api/matches', (req, res) => {
  if (writeMatches([])) {
    res.json({ success: true, message: 'History cleared' });
  } else {
    res.status(500).json({ success: false, message: 'Failed to clear history' });
  }
});

if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`♠️ Callbridge Score Server running at http://localhost:${PORT}`);
  });
}

module.exports = app;
