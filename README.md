# ♠️ Callbridge Master — Score Calculator & Match Tracker

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Srinjoy3002/callbridge-score-master)

A full-featured, mobile-responsive Web Application designed for calculating, entering, tracking, and storing scores for the popular card game **Callbridge**, featuring a built-in **AI Probability Engine & Strategy Advisor**.

**GitHub Repository:** [https://github.com/Srinjoy3002/callbridge-score-master](https://github.com/Srinjoy3002/callbridge-score-master)

---

## 📱 Mobile App Usage (Add to Home Screen)
You can use Callbridge Master directly on your smartphone (iPhone or Android):
1. Open your deployed Vercel URL in Safari (iOS) or Chrome (Android).
2. **iOS**: Tap the **Share** button &rarr; tap **"Add to Home Screen"**.
3. **Android**: Tap the **Three Dots Menu (&vellip;)** &rarr; tap **"Add to Home screen"** or **"Install app"**.
4. Launch it like a native full-screen app!

---

## ✨ Features

- **👥 Dynamic Player Count (2 to 6 Players)**:
  - Play with **2, 3, 4, 5, or 6 players** with automatic hand-size and tricks-per-round scaling:
    - **2 Players**: 13 cards / 13 tricks.
    - **3 Players**: 17 cards / 17 tricks (1 card removed).
    - **4 Players**: 13 cards / 13 tricks (Standard).
    - **5 Players**: 10 cards / 10 tricks (2 cards removed).
    - **6 Players**: 8 cards / 8 tricks (4 cards removed).
  - Dynamic player name inputs, live leaderboard ranking cards, and scoreboards that automatically adapt to the exact number of players.
- **👑 Customizable Main Colour / Trump Suit**:
  - Choose your preferred trump suit for the match or advisor:
    - **♠️ Spades (Classic)**
    - **♥️ Hearts**
    - **♦️ Diamonds**
    - **♣️ Clubs**
    - **🔄 Rotates Each Round** (♠ &rarr; ♥ &rarr; ♦ &rarr; ♣)
    - **🎲 Dealer's Choice** (Dealer sets the trump each round)
    - **🚫 No Trump** (High card wins, trumps disabled)
- **🔮 AI Probability & Live Trick Play Advisor**:
  - **Dynamic Card Hand Selector**: Visual 52-card deck picker with quick presets (Random Deal, Strong Hand, Trump Heavy, Void Heavy) adapted to any player count and trump choice.
  - **Monte Carlo Simulation Engine (800 Deals)**: Simulates hundreds of deals across opponents to compute the exact win probability curve.
  - **Smart Bid Recommendations**: Conservative Safe Bid, Optimal EV Bid, and Aggressive Bid.
  - **Live Trick Play Advisor**: Interactive table arena for any player count, real-time AI card recommendations with win rates, tactical reasoning, and contract progress tracking.

---

## 🚀 Quick Start Instructions

### Running the App
1. Open terminal in `D:\hermesproject`.
2. Start the server:
   ```bash
   npm start
   ```
3. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

*(Alternatively, you can open `public/index.html` directly in any web browser for offline client-side storage.)*

---

## 📂 Project Structure

```
D:\hermesproject\
├── package.json          # Node.js dependencies & scripts
├── server.js            # Express API server for persistent disk storage
├── data/
│   └── matches.json     # Saved match history JSON database
├── public/
│   ├── index.html       # Responsive web application interface
│   ├── styles.css       # Dark theme CSS styling
│   ├── app.js          # Core game engine, scoring rules, and UI logic
│   └── advisor.js      # Probability calculator & AI trick play engine
└── README.md            # App documentation
```
