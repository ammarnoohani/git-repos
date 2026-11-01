# GitHub Discovery: API Behaviors & Investigation Notes

This document records the exact semantics, rate limits, edge cases, and architectural constraints of the GitHub REST API utilized by `@github-discovery/discovery`.

## 1. Endpoints Comparison

| Feature | Primary: Search API (`GET /search/repositories`) | Secondary: Public Repos (`GET /repositories?since={id}`) |
| :--- | :--- | :--- |
| **Endpoint** | `https://api.github.com/search/repositories?q=...` | `https://api.github.com/repositories?since={id}` |
| **Query Flexibility** | Supports `created:YYYY-MM-DDTHH:MM:SSZ..YYYY-MM-DDTHH:MM:SSZ`, `fork:false`, etc. | Only integer cursor `since={id}`. No query filtering. |
| **Metadata Returned** | **Full**: name, full_name, description, owner, stars (`stargazers_count`), forks, watchers, open_issues, language, topics, license, created_at, updated_at, pushed_at, visibility. | **Minimal**: id, node_id, name, full_name, owner, html_url, description, fork, url. **Lacks**: `stargazers_count`, `language`, `topics`, `license`, `created_at`! |
| **Enrichment Needed** | None (self-sufficient). | Must make individual `GET /repos/{owner}/{repo}` calls (bounded budget) to obtain creation date, stars, language. |
| **Pagination Semantics** | `page` and `per_page` (max 100/page, max 1000 results per query window). | Cursor `since={id}` returns repos with `id > since`, sorted by repository ID ascending. |
| **Rate Limit Bucket** | **Search API bucket**: 30 requests/min (authenticated) / 10 requests/min (unauthenticated). | **Core API bucket**: 5,000 requests/hour (authenticated) / 60 requests/hour (unauthenticated). |

## 2. API Rate Limits & Secondary Limits

### Rate Limit Headers:
- `x-ratelimit-limit`: Maximum requests permitted per period.
- `x-ratelimit-remaining`: Remaining requests in current window.
- `x-ratelimit-reset`: Unix epoch timestamp (seconds) when the bucket resets.
- `x-ratelimit-used`: Number of requests consumed in current window.
- `retry-after`: Present on HTTP 429 (Too Many Requests) or 403 (abuse/secondary rate limit). Number of seconds to wait before retrying.

### Secondary Rate Limits:
GitHub enforces anti-abuse and concurrent request limits:
- Making concurrent requests rapidly or exceeding undocumented velocity triggers HTTP 403 or 429 with error message `"You have exceeded a secondary rate limit"`.
- Mitigation:
  1. Sequential requests with small inter-request delay (e.g., 200ms - 500ms).
  2. Respect `retry-after` header when received.
  3. Exponential backoff with random jitter on 429 / 403 / 5xx.
  4. Graceful early exit when `x-ratelimit-remaining` falls below safety threshold (e.g. <= 2 remaining).

## 3. Search Indexing Lag & Gap-Free Assumptions

1. **Indexing Lag**:
   - Newly created repositories do not appear instantaneously in the Search API.
   - GitHub's Elasticsearch indexer typically experiences a 1 to 5 minute indexing delay.
   - **Solution**: The window planner queries up to `now - SEARCH_LAG_MINUTES` (default 3 minutes).
2. **Late Indexing & Eventual Consistency**:
   - Repositories created during high load may index out-of-order.
   - **Solution**: Every discovery cycle overlaps with the preceding cycle by `OVERLAP_MINUTES` (default 10 minutes).
3. **Repository ID Non-Monotonicity**:
   - Repository IDs in GitHub are monotonically increasing over time in general, but ID assignment does not guarantee gap-free creation timestamps. User forks or converted repositories can disrupt strict temporal sorting.
   - Therefore, the secondary method (`since={id}`) cannot replace time-based search for recent creation discovery. It serves as a supplementary feed.

## 4. 1000-Result Search Limitation & Recursive Splitting

- GitHub's Search API caps result retrieval at 1,000 items (`page * per_page <= 1000`). If a window has `total_count > 1000`, results past item 1000 cannot be paginated.
- **Dynamic Splitting Algorithm**:
  - When `total_count > 1000`, the time window `[T_start, T_end]` is bisected at `T_mid = T_start + (T_end - T_start)/2`.
  - The engine recursively queries `[T_start, T_mid]` and `[T_mid, T_end]`.
  - Termination condition: If `total_count <= 1000`, or window duration reaches 1 second.
  - If a 1-second window still yields `> 1000` results, it is recorded as `truncated` in the checkpoint and manifest. The search is executed with `sort=stars&order=desc` to guarantee the most prominent repositories within the window are captured.
