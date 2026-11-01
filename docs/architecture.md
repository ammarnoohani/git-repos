# Architecture: GitHub Discovery

## Overview

GitHub Discovery is a continuous, autonomous feed of newly created public GitHub repositories.
It is specifically designed for a **$0 hosting target** by utilizing a database-free architecture:
- **Frontend**: Static React single-page app deployed on Vercel Hobby.
- **Worker**: Scheduled GitHub Actions workflows.
- **Database Replacement**: JSON shards and manifest committed directly to an isolated `data` branch.

```
GitHub Actions (cron every ~10-15 min, workflow_dispatch)
  -> packages/discovery runs time-boxed cycle
  -> Reads state from 'data' branch
  -> Queries GitHub Search API for [start..end] created date window
  -> Merges, dedupes, scores repositories
  -> Writes YYYY-MM-DD.json shards, manifest.json, checkpoint.json
  -> Sends Telegram / Email notifications
  -> Publishes single squashed commit to 'data' branch

Vercel Hobby (Static build from 'main' branch)
  -> Fetches manifest.json and day shards over HTTPS from 'data' branch
  -> Client-side search, filtering, and sorting in user's browser
  -> No backend, zero database maintenance, zero ongoing cost
```

## Branch Strategy & Data Flow

1. **`main` Branch**: Contains application source code (`apps/web`, `packages/*`, `.github/`). Builds on Vercel.
2. **`data` Branch**: Contains exclusively data files:
   - `manifest.json`: Cumulative discovery count, shard metadata, discovery pipeline health metrics, retention settings.
   - `repos/YYYY-MM-DD.json`: Daily repository shards (partitioned by UTC creation date).
   - `state/checkpoint.json`: High-water marks for search windows, secondary cursor, pending windows to retry.
   - `state/notified.json`: Notified repository IDs and digest timestamps.
   - `state/runs.json`: Statistics of last 100 discovery runs.
3. **Squashed History**:
   Every run publishes the `data` branch as a single orphan commit (`git push -f origin data`). This prevents the git history of the data branch from ballooning over time with thousands of 10-minute commits.
4. **Decoupling**:
   Commits to `data` do NOT trigger Vercel deployments because Vercel is configured to watch only `main`.

## Primary Discovery Engine

- **Search API Window Planning**:
  - GitHub REST API `GET /search/repositories?q=created:T1..T2 fork:false`.
  - Scans from `lastCompletedWindowEnd` up to `now - 3m` (search lag).
  - Automatically overlaps the preceding 10 minutes to capture late-indexed repositories.
  - Recursively bisects windows if `total_count > 1000` until <= 1000 items or 1 second duration is reached.
  - If a 1-second window exceeds 1000 items, records as `truncated` and sorts by stars descending to capture top repositories.

## Checkpoint & Crash Recovery

- Atomic writes (`.tmp` + rename) ensure partial writes never corrupt data files.
- All writes are validated using Zod schemas before being committed.
- Checkpoints advance **only** after files are validated and written to disk.
- In the event of a network failure, rate limit, or runner timeout, incomplete windows are placed into `pendingWindows` and retried on the subsequent run.

