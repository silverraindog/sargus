# Sargus 🎯

> **Inactive Target & Battle Stat Finder for Torn City MMORPG**

**Sargus** is a web application designed for Torn City (`torn.com`) players to discover inactive target accounts (offline for 30+ days / 1 month or more), estimate their battle stats using the **FFScouter v2** algorithm, and launch direct attack links to maximize Fair Fight respect during faction chains.

---

## 🚀 Key Features

* **🔑 Torn API Authentication**: Connect securely using your standard public Torn API key (`torn.com/preferences.php#tab=api`).
* **⏳ Inactive Target Finder (≥ 30 Days Offline)**: Filter players who haven't logged on in **1 month (30d+)**, 2 months, 3 months, 6 months, or 1 year+.
* **📊 FFScouter Battle Stat Estimation**: Calculates target battle stats based on public metrics:
  * Base Level curve formula
  * Xanax taken multiplier ($3,100\text{ BS} / \text{xanax}$)
  * Energy refills ($2,600\text{ BS} / \text{refill}$)
  * Working stats ($0.12 \times \text{total working stats}$)
  * Account age factor
* **🎨 Color-Coded Difficulty Indicators**:
  * 🟢 **VERY EASY (100% Win)**: Target stats $<35\%$ of your total stats (Free Hit)
  * 🧪 **EASY (High Respect)**: Target stats $35\%\text{--}75\%$ of your total stats
  * 🟡 **MEDIUM (Fair Fight 2.0x--3.0x)**: Target stats $75\%\text{--}125\%$ of your total stats
  * 🟧 **HARD (High Risk)**: Target stats $125\%\text{--}200\%$ of your total stats
  * 🔴 **DANGER (Outmatched)**: Target stats $>200\%$ of your total stats
  * 🔘 **UNAVAILABLE**: Target currently in Hospital, Jail, or Traveling
* **⚔️ Direct Attack Action**: One-click **ATTACK** buttons redirecting directly to `https://www.torn.com/page.php?sid=attack&user2ID={target_id}`.
* **🛡️ Live Faction Scanner**: Enter any Torn Faction ID (e.g. `9812`, `1042`) or choose from preset dead factions to scan members in real time.
* **✨ Gemini AI Hit Advisor**: AI-powered chain hit analysis using `@google/genai` to evaluate top targets and suggest temporary items (Pepper Spray, Tear Gas) and hit sequencing.
* **🔖 Saved Target Queue & Notes**: Bookmark high-value targets and record custom hit notes saved locally in your browser.

---

## 🛠️ How to Use

1. **Log In**: Click **API KEY** in the top header and enter your Torn API Key (or click **Use Example Key ("KS2IeiX56Cl52z3B")**).
2. **Filter Inactive Targets**: Select your preferred offline duration threshold (e.g., `≥ 1 Month (30d+)`).
3. **Analyze Difficulty**: Review the color-coded **FFScouter** badge showing estimated battle stats and Fair Fight respect multiplier relative to your actual stats.
4. **Attack**: Click the red **ATTACK** button to open the target in Torn's official attack interface.
5. **Scan Factions**: Switch to the **Faction Scanner** tab to scan specific target factions for inactive members.

---

## 🐳 Running with Docker & Docker Compose

### Prerequisites
* [Docker](https://www.docker.com/) and [Docker Compose](https://docs.docker.com/compose/) installed.

### Run via GitHub Container Registry (GHCR)
```bash
# Pull published Docker image from GHCR
docker pull ghcr.io/YOUR_GITHUB_USERNAME/sargus:latest

# Run container on port 3000
docker run -d -p 3000:3000 --name sargus ghcr.io/YOUR_GITHUB_USERNAME/sargus:latest
```

### Build and Run locally with Docker Compose
```bash
# Clone repository and navigate to root directory
cd sargus

# Start the application in detached mode
docker compose up --build -d
```

Access the application at `http://localhost:3000`.

### Stop the Container
```bash
docker compose down
```

---

## 💻 Local Development Setup

### Prerequisites
* Node.js v20+
* npm

```bash
# Install dependencies
npm install

# Start Express & Vite development server
npm run dev
```

The application will launch at `http://localhost:3000`.

---

## ⚙️ Environment Variables

Copy `.env.example` to `.env` to configure optional server variables:

```env
# Optional Gemini API key for AI Tactical Advisor
GEMINI_API_KEY="YOUR_GEMINI_API_KEY"

# Server Port (default 3000)
PORT=3000
```

---

## 🤖 Continuous Integration & Automated Tagging (CI)

This repository includes a GitHub Actions CI workflow in `.github/workflows/docker-ci.yml` that:
1. **Automated Semantic Tagging**: Automatically calculates and pushes git tags starting at `v0.0.1` and incrementing patch versions (`v0.0.2`, `v0.0.3`...) on every push to `main`/`master`.
2. **GHCR Publishing**: Builds and pushes Docker images tagged with `ghcr.io/user/sargus:v0.0.x`, `ghcr.io/user/sargus:latest`, and git commit SHA.
3. **Container Health Validation**: Tests deployment integrity on every commit using Docker Compose and health check endpoints.

---

## 🛠️ Tech Stack

* **Frontend**: React 19, TypeScript, Tailwind CSS, Lucide Icons, Motion
* **Backend**: Express.js (Node.js), Vite Server Middleware
* **AI Engine**: `@google/genai` (Gemini 2.5 Flash)
* **DevOps**: Docker Multi-stage builds, Docker Compose, GitHub Actions CI
