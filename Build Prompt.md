# GitHub Discovery: Database-Free Build Prompt (Option B)

Prompt for an autonomous coding agent. Target: $0 hosting. Static React site on Vercel Hobby, GitHub Actions as the background worker, JSON files on a `data` branch instead of a database.

## 1. Project Overview

Build a web application that continuously discovers newly created public GitHub repositories and displays them in a minimal, Google-inspired interface.

The app is a global discovery feed. Users do not enter interests, keywords, languages or topics to get value. Discovery runs automatically in the background, without requiring any website to stay open.

This is NOT a traditional GitHub search app. Users can search the collected data, but the core product is automatic discovery.

### Hard constraints (zero-cost hosting)

- No database server, no Redis, no Docker, no always-on server, no paid service.
- Frontend: static site deployed on Vercel Hobby.
- Background work: GitHub Actions scheduled workflows in a public repository.
- Storage: JSON files committed to a dedicated `data` branch.
- Secrets (GitHub token, Telegram token) exist only in GitHub Actions secrets. Never place any secret in frontend code or in committed files.

### Honesty requirement

The app must NOT claim to capture every GitHub repository or to provide real-time discovery. GitHub's APIs make that impossible, and scheduled workflows are best-effort. The UI and README must state that discovery is best-effort, updates every 10-15 minutes or so, and may miss repositories.

## 2. Technology Stack

### Frontend (apps/web)

- React, TypeScript, Vite, Tailwind CSS, Lucide React, React Router, TanStack Query

### Discovery job (packages/discovery)

- Node.js 20+, TypeScript, run by GitHub Actions
- Official GitHub REST API via `fetch` (or Octokit if it keeps the code simpler)
- Telegram Bot API over HTTPS
- Optional email through the Resend HTTP API (free tier) or SMTP via nodemailer

### Shared (packages/shared)

- TypeScript types, constants and zod schemas used by both the frontend and the job

### Tooling

- npm workspaces, Vitest, ESLint, Prettier
- Use stable, mutually compatible versions and pin them

## 3. Architecture

```
GitHub Actions (cron every ~10-15 min, plus manual dispatch)
  -> packages/discovery runs one time-boxed discovery cycle
  -> reads state from the data branch, fetches new repos, merges, dedupes
  -> writes shard files, manifest, checkpoint, notified-ids
  -> sends Telegram / email notifications for new repos
  -> publishes the data branch as a single squashed commit

Vercel (static site built from main)
  -> fetches manifest.json and day shards from the data branch over HTTPS
  -> search, filter, sort and pagination run in the browser
```

The frontend never calls the GitHub API for discovery and never needs a token. It reads only the published JSON files.

## 4. Discovery Engine (most important component)

Build a reliable discovery engine first, then build the UI around it.

### 4.1 Verify API behavior before designing around it

Before writing the engine, read the current GitHub docs and test real responses. Document in `docs/discovery-notes.md`:

- What fields `GET /repositories?since={id}` actually returns. It returns a minimal repository representation and may lack stars, language, creation date and topics. Do not assume rich metadata.
- What ordering and pagination semantics both endpoints have. Do not assume repository IDs form a gap-free or real-time creation stream.
- Current rate limits for core and Search endpoints, with and without a token, and the secondary rate limits.
- Search indexing lag (newly created repos may take time to appear).

### 4.2 Primary method: Search API with created-date windows

Use `GET https://api.github.com/search/repositories` with the `created:` qualifier, because it returns full metadata in one call. Example query: `created:2026-11-02T10:00:00Z..2026-11-02T10:05:00Z fork:false`.

Implement:

- Time-window planning: each cycle scans from the checkpoint up to `now - SEARCH_LAG_MINUTES` (default 3).
- Overlapping windows: re-scan the last `OVERLAP_MINUTES` (default 10) on every cycle to catch late-indexed repositories.
- Pagination: `per_page=100`, up to 10 pages per window.
- Cap handling: if a window reports `total_count` above 1000, split it in half recursively until each piece is at or below 1000 or reaches a 1-second minimum. A 1-second window that still exceeds 1000 results must be recorded as `truncated` in the run log and the manifest. Never hide truncation.
- Ordering inside a window: use `sort=stars&order=desc` so that if a window is truncated, the most notable repositories are the ones captured.
- Query filters are configurable (defaults: `fork:false`, public only). Do not filter by language, topic or keyword by default.
- Deduplication: by GitHub repository ID (`id`), across windows, across runs and across methods.

### 4.3 Secondary method: public repositories endpoint

Implement `GET https://api.github.com/repositories?since={id}` as a secondary, best-effort method that is disabled by default and enabled via `ENABLE_PUBLIC_REPOS_SCAN`.

- On first use, probe for a recent repository ID and start the cursor near the newest IDs. Never try to backfill GitHub's full history.
- Walk forward with `since`, bounded by a per-run request budget.
- Because it returns minimal data, enrich only a small, bounded number of repositories per run (configurable), using the core API.
- Merge results with the primary method's, deduplicated by ID.

### 4.4 Checkpoints and recovery

- Store checkpoints in `state/checkpoint.json`: last fully completed window end, secondary cursor, last successful run time, status.
- Advance the checkpoint only after the corresponding windows have been fully fetched AND written to shards. Never advance past a window that failed or was only partially processed.
- Failed windows are recorded in a `pendingWindows` list and retried on the next cycle. Never silently discard a failed batch.
- A crash at any point must be recoverable: the next run re-reads state and resumes.

### 4.5 Reliability

- Retry with exponential backoff and jitter for 5xx, network errors and secondary rate limits.
- Read `x-ratelimit-remaining`, `x-ratelimit-reset` and `retry-after`. When remaining is low, stop gracefully, save state and exit successfully. Do not burn the whole job waiting.
- Enforce a total time budget (`RUN_TIME_BUDGET_SECONDS`, default 480) and a request budget per run. Exit cleanly when either is reached, with state saved.
- Structured JSON logging with a run ID.
- Discovery health data written to the manifest: last successful run, consecutive failures, windows pending, truncated windows in the last 24 hours, rate-limit status.

### 4.6 Repository metadata

For every repository, collect: GitHub ID (primary external ID), full name, name, description, owner login, owner avatar URL, HTML URL, created date, last updated date, primary language, stars, forks, watchers, open issues, default branch, visibility, license (SPDX id/name when available), topics (when available), archived flag, fork flag, plus `discoveredAt` and `lastSyncedAt` set by the job.

Use only metadata returned by list/search responses. Do not make per-repository detail calls except the bounded enrichment in 4.3.

## 5. Data Storage (JSON on a `data` branch)

The `data` branch holds only data files. The `main` branch holds code. Vercel builds only `main`, so data updates never trigger a deploy.

```
data branch
  manifest.json            # lastUpdated, totalDiscovered (cumulative counter), shard list, health, retention settings
  repos/YYYY-MM-DD.json    # one shard per UTC creation day, minified JSON array of repositories
  state/checkpoint.json    # discovery cursors and pending windows
  state/notified.json      # repository IDs already notified, per channel, with timestamps
  state/runs.json          # last 100 discovery runs with statistics
```

Rules:

- Dedupe by repository ID within and across shards. Updating an existing record (for example new star counts) must overwrite it, not duplicate it.
- Retention: keep the last `RETENTION_DAYS` of shards (default 14). Delete older shards. `totalDiscovered` is a cumulative counter that is not reduced by pruning.
- Size control: cap shards at `MAX_REPOS_PER_SHARD` (default 5000) and keep each shard under roughly 5 MB. When over the cap, keep the most notable records and record the overflow in the manifest. Use compact fields and minified JSON.
- Atomic writes: write to a temp file, then rename. Validate every file against the zod schemas in packages/shared before publishing. Never publish invalid JSON.
- Publishing: the job publishes the data branch as a single squashed commit (orphan commit, force push) so that git history does not grow without bound. Use a workflow `concurrency` group so two runs never publish at once.
- Define a manifest `schemaVersion` and handle version mismatches in the frontend.

## 6. GitHub Actions

### .github/workflows/discover.yml

- Triggers: `schedule` (cron every 10 minutes by default; document that GitHub treats scheduled runs as best-effort and may delay or skip them) and `workflow_dispatch` with inputs: `force_full_scan` (boolean) and `test_notification` (boolean).
- `concurrency: { group: discover, cancel-in-progress: false }`.
- Permissions: `contents: write` only.
- Steps: checkout main, set up Node, install, check out the data branch into `./data` (create it if missing), run the discovery job, publish the data branch.
- Token: use the built-in `GITHUB_TOKEN`, or an optional `GH_API_TOKEN` secret (fine-grained token with NO scopes, public data only) for higher limits.
- Timeout: `timeout-minutes: 12`.

### .github/workflows/digest.yml

- Scheduled hourly. The job decides whether an hourly, 6-hourly or daily digest is due, using timestamps in `state/notified.json`. It sends a digest and records it.

### .github/workflows/ci.yml

- On pull requests and pushes to main: install, lint, typecheck, test, build.

### Scheduled workflow caveats to document

- GitHub may disable scheduled workflows in public repositories after a long period without repository activity. Verify the current behavior and document how to re-enable.
- Scheduled runs may be delayed under load.

## 7. Notifications

Notifications are optional. The app must work fully with none configured.

### Telegram

- Secrets: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`.
- Message contents: repository name, description, owner, language, creation date, stars, GitHub URL.
- Global discovery produces far more repositories than a person can read. Therefore:
  - Immediate mode sends at most `NOTIFY_MAX_PER_RUN` individual messages per run (default 10), choosing the highest-scoring new repositories (stars, has description, has topics, has license). The remainder is mentioned in one summary line (for example: `+143 more discovered, see the site`).
  - Optional env-based notification filters (minimum stars, languages, include or exclude keywords) are allowed but empty by default.
- Respect Telegram rate limits (about 1 message per second per chat): send sequentially with a small delay and handle HTTP 429 with the `retry_after` value.

### Digest

- Frequencies: every hour, every 6 hours, daily (`DIGEST_FREQUENCY`). One message listing the top N new repositories since the last digest.

### Email (optional)

- Secrets: `RESEND_API_KEY` and `NOTIFY_EMAIL`, or SMTP settings. Same digest and immediate rules.

### Deduplication and isolation

- Record every notified repository ID per channel in `state/notified.json` and never notify the same repository on the same channel twice.
- Notification failures are logged and retried on the next run, and must never block or fail discovery. Discovery state is saved before notifications are sent.
- `workflow_dispatch` with `test_notification=true` sends a single test message and nothing else.

## 8. Frontend UI/UX

Very simple and fast, inspired by Google Search. No sidebars, no heavy cards, no complicated navigation.

### 8.1 Homepage (/)

- Top bar: small logo and app name, a few small links (Explore, About), a settings icon.
- Center: logo or icon; heading `Discover What's New on GitHub.`; subtitle `Explore newly created public repositories from developers around the world.`; a large rounded search bar with a search button; a prominent `Explore New Projects` button.
- Below: total repositories discovered (from the manifest), latest discovery timestamp, and a discovery health indicator (healthy, delayed, failing) computed from the manifest.
- Clean and spacious. Light and dark mode.

### 8.2 Explore page (/explore)

- A clean vertical list of lightweight items (not large cards). Each shows: repository name, owner, short description, language, stars, forks, creation date, discovery date, topics, and an external GitHub link.
- Sort: newest first, oldest first, most starred, most recently updated.
- Pagination or infinite scroll that loads day shards lazily, newest first. Do not load every shard up front. Use virtualization or windowing for long lists.
- Show a clear empty state and an error state (for example when the data branch is unreachable).

### 8.3 Search

- Client-side search over the loaded shards across name, full name, description, owner, language and topics.
- Optional filters: creation date range, language, minimum stars, include/exclude archived, include/exclude forks.
- Make search responsive: debounce input, and use a precomputed lowercase search field or a lightweight in-memory index. Do not block the main thread on large datasets (use a Web Worker if needed).
- Make clear in the UI that search covers the retained window (for example the last 14 days), not all of GitHub.

### 8.4 Repository details (/repo/:githubId)

- Name, description, owner info with avatar, creation date, last update, language, stars and forks, topics, license, and a button to open the original repository on GitHub.
- Resolve the repository from the shards. If it has been pruned, show a friendly not-found message with a link to GitHub.

### 8.5 Settings page (/settings)

- No server-side settings exist, so be honest about it:
  - Local preferences stored in `localStorage` (theme, default sort, page size), all wrapped in try/catch.
  - Discovery status panel: last run, failures, pending and truncated windows, retention, schema version.
  - Notification setup guide: step-by-step instructions to configure Telegram and email through repository secrets and variables, and how to run a test with the `workflow_dispatch` test input. Do not build forms that pretend to save server-side settings.

### 8.6 Data loading

- Base URL from `VITE_DATA_BASE_URL` (for example `https://raw.githubusercontent.com/<owner>/<repo>/data`). Document alternatives such as a CDN mirror, and note caching delays.
- Use TanStack Query with sensible stale times, retries and a manual refresh button.
- Validate fetched JSON with the zod schemas and fail gracefully on invalid or outdated data.
- Never call the GitHub API from the browser for discovery. Never include secrets in the bundle.

## 9. Project Structure

```
github-discovery/
  .github/workflows/        discover.yml, digest.yml, ci.yml
  apps/web/                 Vite React app
    src/{components,pages,layouts,hooks,services,types,utils}/
  packages/discovery/       Node job
    src/{github,windows,merge,storage,checkpoint,notify,health,cli}/
    tests/
  packages/shared/          types, constants, zod schemas
  docs/                     discovery-notes.md, architecture.md, deployment.md
  .env.example
  vercel.json
  README.md
```

Adapt the structure where needed, keeping clear separation between the discovery job, the shared schemas and the frontend.

## 10. Configuration

Document every variable in `.env.example` and the README. At minimum:

- `GITHUB_TOKEN` or `GH_API_TOKEN` (optional, scopeless)
- `DISCOVERY_QUERY_FILTERS`, `SEARCH_LAG_MINUTES`, `OVERLAP_MINUTES`
- `RUN_TIME_BUDGET_SECONDS`, `MAX_REQUESTS_PER_RUN`
- `RETENTION_DAYS`, `MAX_REPOS_PER_SHARD`
- `ENABLE_PUBLIC_REPOS_SCAN`, `ENRICH_PER_RUN`
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `NOTIFY_MAX_PER_RUN`, `DIGEST_FREQUENCY`
- `RESEND_API_KEY`, `NOTIFY_EMAIL`
- `VITE_DATA_BASE_URL` (frontend, public value only)

No hardcoded credentials. Secrets are only read from the environment, never logged, and never written to data files.

## 11. Testing

Use Vitest. Mock all GitHub, Telegram and email HTTP calls. Ordinary tests must not touch live APIs.

Test at least:

1. GitHub client: request building, headers, pagination, error mapping.
2. Metadata mapping from API responses to the stored schema, including missing fields.
3. Time-window planning, overlap, and recursive splitting when `total_count` exceeds 1000, including the 1-second truncation case.
4. Deduplication across windows, runs, shards and methods.
5. Checkpoint management: advances only after successful writes, never past failed windows, recovers after a simulated crash.
6. Rate-limit handling and graceful early exit.
7. Retry and exponential backoff behavior.
8. Shard writing, retention pruning, atomic writes, schema validation.
9. Notification selection (top N, summary line), delivery, 429 handling.
10. Notification deduplication and failure isolation from discovery.
11. Digest scheduling logic.
12. Frontend: search and filtering, sorting, lazy shard loading, error and empty states, invalid data handling.

Provide a small opt-in live smoke test (disabled by default) that confirms the real GitHub API still returns the fields the mapper expects.

## 12. Deployment

Write `docs/deployment.md` and the README so a person with $0 can deploy:

1. Create a public GitHub repository and push the code.
2. Create the `data` branch (the first workflow run may create it automatically).
3. Add optional secrets and variables for GitHub token and Telegram or email.
4. Enable Actions and run `discover` once manually with `workflow_dispatch`.
5. Import the repo into Vercel (Hobby), set the root directory to `apps/web`, set `VITE_DATA_BASE_URL`, and deploy from `main`.
6. Verify the site shows real discovered repositories.

Also document: Vercel Hobby is intended for non-commercial use, free-tier limits can change, and a local development workflow (`npm run dev`, `npm run discover:once`) that runs without Docker.

## 13. Implementation Instructions

Work autonomously and complete the project.

Before starting: inspect the existing workspace, identify existing files, preserve useful work, avoid unnecessary overwrites, and write a short implementation plan.

Then implement, in this order:

1. Monorepo configuration and shared schemas.
2. GitHub client with rate-limit and retry handling.
3. Window planner and search discovery with splitting and dedupe.
4. Storage layer (shards, manifest, checkpoint, notified, runs) with atomic writes and pruning.
5. Checkpoint recovery and health reporting.
6. Secondary public-repositories scan.
7. Notifications and digests.
8. GitHub Actions workflows.
9. Frontend (data layer first, then pages).
10. Tests.
11. Documentation.

Rules:

- Do not stop after creating the structure. Do not deliver static mockups.
- Do not leave important features as TODO comments.
- Do not use fake repository data in the production app. Test fixtures are allowed only inside tests.
- Do not claim a feature works unless it actually works.
- When credentials are unavailable, implement the integration fully using environment variables and document the setup.
- If a decision is ambiguous, choose a sensible production-ready default and document it.
- Run tests, type checks, linting and production builds. Fix all errors before finishing.

## 14. Definition of Done

The project is complete only when:

- `npm run discover:once` fetches real public repositories (with a token if needed), writes valid data files, and is idempotent on repeat runs.
- Checkpoints persist across runs and recovery after a failed run works.
- Duplicates are never stored.
- Truncated and failed windows are recorded and retried, never silently lost.
- The frontend builds and shows real discovered repositories from the data files.
- Explore, search, filters, sorting and repository details all work.
- Telegram and email notifications work when configured, are deduplicated, and never block discovery.
- The app works fully with no notifications configured.
- All workflows are valid and the discover workflow publishes the data branch as a single squashed commit.
- Tests, type checks, lint and production builds pass.
- The README and docs contain complete $0 deployment instructions and state the discovery limitations clearly.

## 15. Final Product Vision

The site should feel as simple as Google Search. A user opens it, immediately understands it, sees the latest discovered GitHub projects, searches the collected window, opens interesting repositories, and optionally receives notifications. No interests or criteria need to be configured, and discovery happens automatically in the background.

**Most important priority: build a reliable discovery engine first, then build a simple and polished interface around it.**
