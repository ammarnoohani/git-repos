# GitHub Discovery 🚀

> An autonomous, database-free web application that continuously uncovers newly created public GitHub repositories and presents them in a minimal, Google-inspired interface. Built for **$0 hosting cost**.

[![CI](https://github.com/nooha/github-discovery/actions/workflows/ci.yml/badge.svg)](https://github.com/nooha/github-discovery/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## 🎯 Honesty Notice & Discovery Limitations

This app **does NOT** claim to capture every GitHub repository or provide instantaneous real-time discovery:
1. **Best-Effort Scheduling**: GitHub Actions cron schedules are treated by GitHub as best-effort. Runs may experience delays or jitter under heavy infrastructure load.
2. **Search Indexing Lag**: Newly created repositories take roughly 1–5 minutes to index on GitHub. Discovery queries up to `now - 3m` with a 10-minute overlap window.
3. **Retention Policy**: To maintain zero database costs and prevent infinite git growth, repositories are stored in daily JSON shards retained for the last 14 days.

---

## 🏗️ Architecture

```
GitHub Actions (cron every ~10-15 min, plus manual dispatch)
  -> packages/discovery executes one time-boxed discovery cycle
  -> reads state from the 'data' branch
  -> queries GitHub Search API for time window [T_start .. T_end]
  -> merges, dedupes, scores repositories
  -> writes repos/YYYY-MM-DD.json shards, manifest.json, checkpoint.json
  -> sends Telegram / Email notifications (optional)
  -> publishes the 'data' branch as a single squashed commit

Vercel (static site built from main)
  -> fetches manifest.json and day shards over HTTPS from the data branch
  -> client-side search, filtering, sorting and pagination run in browser
  -> 0 database servers, 0 Redis instances, 0 always-on machines
```

---

## ✨ Features

- **Google-Inspired Minimal UI**: Fast, clean, centered homepage, light & dark theme, zero clutter.
- **Autonomous Global Discovery**: Repositories are discovered in the background automatically. No manual topic or keyword setup required.
- **Client-Side Filtering & Search**: Instant, debounced search across names, descriptions, owners, and topics with language and star filters.
- **Lazy Shard Loading**: Daily shards (`repos/YYYY-MM-DD.json`) load on-demand, newest first.
- **Resilient Engine**:
  - Exponential backoff and jitter on 5xx and rate limits.
  - Automatic recursive window bisection when search hits the 1,000-result cap down to 1 second.
  - Truncation tracking and logging in `manifest.json`.
  - Atomic file writes (`.tmp` + rename) with Zod validation.
  - Checkpoint advances only after successful writes; failed windows are queued in `pendingWindows`.
- **Optional Notifications & Digests**:
  - Telegram bot messages (top N scored discoveries + summary line, respecting rate limits).
  - Resend email alerts.
  - Periodic digests (hourly, 6-hourly, daily).
  - Isolated: notification failures never disrupt discovery.

---

## 🛠️ Quickstart (Local Development)

Run the entire system on your machine without Docker or background databases:

### 1. Install Dependencies
```bash
npm install
```

### 2. Run a Discovery Cycle Locally
```bash
npm run discover:once
```
*Discovered repositories and checkpoints will be written to `./data`.*

### 3. Start the Web App
```bash
npm run dev
```
*Open [http://localhost:3000](http://localhost:3000) in your browser. The local Vite server automatically serves the `./data` folder.*

### 4. Run Tests & Typechecks
```bash
npm test
npm run typecheck
npm run build
```

---

## 🚀 $0 Cloud Deployment

Full step-by-step instructions are available in [docs/deployment.md](docs/deployment.md).

1. Push this repository to a **public GitHub repository**.
2. In GitHub repository **Settings** &rarr; **Actions** &rarr; **General**, grant **Read and write permissions**.
3. Under the **Actions** tab, trigger **Discover Repositories** with `workflow_dispatch`. This creates the `data` branch.
4. Import your repository into **Vercel Hobby**:
   - Set **Root Directory** to `apps/web`.
   - Add environment variable `VITE_DATA_BASE_URL` pointing to `https://raw.githubusercontent.com/<user>/<repo>/data`.
5. Deploy! Your site will continuously show newly discovered GitHub repositories.

---

## ⚙️ Configuration

Copy `.env.example` to `.env` to customize settings:

| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `GITHUB_TOKEN` / `GH_API_TOKEN` | *None* | Fine-grained GitHub token (scopeless) for higher API limits (5,000 req/hr). |
| `DISCOVERY_QUERY_FILTERS` | `fork:false` | Extra GitHub Search filters. |
| `SEARCH_LAG_MINUTES` | `3` | Minutes to hold back from current time to account for index lag. |
| `OVERLAP_MINUTES` | `10` | Overlap window re-scanned each cycle to catch late-indexed repos. |
| `RUN_TIME_BUDGET_SECONDS` | `480` | Safety limit before discovery terminates gracefully. |
| `MAX_REQUESTS_PER_RUN` | `50` | Maximum GitHub API calls permitted per cycle. |
| `RETENTION_DAYS` | `14` | Days of repository shards retained before automatic pruning. |
| `MAX_REPOS_PER_SHARD` | `5000` | Maximum repositories per single daily shard file. |
| `TELEGRAM_BOT_TOKEN` | *None* | Telegram Bot API token. |
| `TELEGRAM_CHAT_ID` | *None* | Destination chat ID for instant Telegram notifications. |
| `RESEND_API_KEY` | *None* | API key for email notifications. |
| `NOTIFY_EMAIL` | *None* | Destination email address. |
| `VITE_DATA_BASE_URL` | `/data` | Base URL where web app fetches manifest and shards. |

---

## 📁 Repository Structure

```
.
├── .github/workflows/       # GitHub Actions: discover.yml, digest.yml, ci.yml
├── apps/
│   └── web/                 # Vite + React + Tailwind frontend
│       ├── src/components/  # Navbar, Footer, RepoCard, HealthBadge, AboutModal
│       ├── src/pages/       # HomePage, ExplorePage, RepoDetailPage, SettingsPage
│       └── src/services/    # Data fetching & schema validation
├── packages/
│   ├── discovery/           # Autonomous Node.js discovery engine
│   │   ├── src/github/      # Rate-limited HTTP client & item mapper
│   │   ├── src/windows/     # Window planner & recursive bisection searcher
│   │   ├── src/storage/     # Sharding, atomic writes & retention pruning
│   │   ├── src/checkpoint/  # Checkpoints, recovery & pending window retries
│   │   ├── src/notify/      # Telegram & Resend notifications & digests
│   │   └── src/cli/         # CLI runner (discover:once, digest, test:notify)
│   └── shared/              # Zod validation schemas, domain types, scoring
├── docs/                    # Architecture notes, API investigation & deployment
├── .env.example
├── vercel.json
└── README.md
```

---

## 📜 License

MIT License. Free for open-source and personal use.
