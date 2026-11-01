import { Repository, calculateRepoScore } from '@github-discovery/shared';

/**
 * Deduplicates a list of repositories by GitHub ID.
 * When duplicates exist, the latest updated/synced version is kept,
 * preserving the original discoveredAt timestamp.
 */
export function deduplicateRepositories(repos: Repository[]): Repository[] {
  const map = new Map<number, Repository>();

  for (const repo of repos) {
    const existing = map.get(repo.id);
    if (!existing) {
      map.set(repo.id, { ...repo });
    } else {
      map.set(repo.id, mergeRepositoryRecords(existing, repo));
    }
  }

  return Array.from(map.values());
}

/**
 * Merges two versions of the same repository record.
 * Preserves initial discoveredAt timestamp while updating metrics and metadata.
 */
export function mergeRepositoryRecords(existing: Repository, incoming: Repository): Repository {
  const earliestDiscoveredAt =
    new Date(existing.discoveredAt).getTime() < new Date(incoming.discoveredAt).getTime()
      ? existing.discoveredAt
      : incoming.discoveredAt;

  const merged: Repository = {
    ...existing,
    ...incoming,
    discoveredAt: earliestDiscoveredAt,
    lastSyncedAt: new Date().toISOString(),
    // Keep non-empty description/language/topics if incoming lacks them
    description: incoming.description !== null && incoming.description !== undefined ? incoming.description : existing.description,
    language: incoming.language || existing.language,
    topics: incoming.topics && incoming.topics.length > 0 ? incoming.topics : existing.topics,
    license: incoming.license || existing.license,
    // Take max of stars/forks/watchers in case of stale cache
    stars: Math.max(existing.stars || 0, incoming.stars || 0),
    forks: Math.max(existing.forks || 0, incoming.forks || 0),
    watchers: Math.max(existing.watchers || 0, incoming.watchers || 0),
    openIssues: incoming.openIssues !== undefined ? incoming.openIssues : existing.openIssues,
  };

  merged.score = calculateRepoScore(merged);
  return merged;
}

