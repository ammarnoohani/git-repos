import { Repository, calculateRepoScore } from '@github-discovery/shared';
import { GitHubSearchItem, GitHubPublicRepoItem } from './types.js';

/**
 * Maps a raw GitHub API repository item (from search or detail endpoint)
 * to our standardized Repository domain model.
 */
export function mapGitHubSearchItemToRepository(
  item: GitHubSearchItem,
  discoveryMethod: 'search' | 'enriched' = 'search',
  nowIso: string = new Date().toISOString()
): Repository {
  const repo: Repository = {
    id: item.id,
    nodeId: item.node_id,
    name: item.name || '',
    fullName: item.full_name || `${item.owner?.login || 'unknown'}/${item.name || 'unknown'}`,
    description: item.description ?? null,
    owner: {
      login: item.owner?.login || 'unknown',
      id: item.owner?.id,
      avatarUrl: item.owner?.avatar_url || 'https://github.com/ghost.png',
      htmlUrl: item.owner?.html_url || `https://github.com/${item.owner?.login || 'ghost'}`,
      type: item.owner?.type,
    },
    htmlUrl: item.html_url || `https://github.com/${item.full_name}`,
    createdAt: item.created_at || nowIso,
    updatedAt: item.updated_at || item.created_at || nowIso,
    pushedAt: item.pushed_at ?? null,
    language: item.language ?? null,
    stars: item.stargazers_count ?? 0,
    forks: item.forks_count ?? 0,
    watchers: item.watchers_count ?? 0,
    openIssues: item.open_issues_count ?? 0,
    defaultBranch: item.default_branch || 'main',
    visibility: item.visibility || 'public',
    license: item.license
      ? {
          key: item.license.key,
          name: item.license.name,
          spdxId: item.license.spdx_id ?? null,
          url: item.license.url ?? null,
        }
      : null,
    topics: Array.isArray(item.topics) ? item.topics : [],
    archived: Boolean(item.archived),
    fork: Boolean(item.fork),
    isTemplate: Boolean(item.is_template),
    discoveredAt: nowIso,
    lastSyncedAt: nowIso,
    discoveryMethod,
  };

  repo.score = calculateRepoScore(repo);
  return repo;
}

/**
 * Maps an enriched repository from public repo list + repo detail call.
 */
export function mapEnrichedItemToRepository(
  minimal: GitHubPublicRepoItem,
  detail: Partial<GitHubSearchItem>,
  nowIso: string = new Date().toISOString()
): Repository {
  const merged: GitHubSearchItem = {
    id: minimal.id,
    node_id: minimal.node_id,
    name: detail.name || minimal.name,
    full_name: detail.full_name || minimal.full_name,
    owner: {
      login: detail.owner?.login || minimal.owner?.login || 'unknown',
      id: detail.owner?.id || minimal.owner?.id,
      avatar_url: detail.owner?.avatar_url || minimal.owner?.avatar_url || 'https://github.com/ghost.png',
      html_url: detail.owner?.html_url || minimal.owner?.html_url || `https://github.com/${minimal.owner?.login || 'ghost'}`,
      type: detail.owner?.type || minimal.owner?.type,
    },
    html_url: detail.html_url || minimal.html_url,
    description: detail.description !== undefined ? detail.description : minimal.description,
    fork: detail.fork !== undefined ? detail.fork : minimal.fork,
    created_at: detail.created_at || nowIso,
    updated_at: detail.updated_at || detail.created_at || nowIso,
    pushed_at: detail.pushed_at,
    stargazers_count: detail.stargazers_count || 0,
    watchers_count: detail.watchers_count || 0,
    language: detail.language || null,
    forks_count: detail.forks_count || 0,
    open_issues_count: detail.open_issues_count || 0,
    default_branch: detail.default_branch || 'main',
    visibility: detail.visibility || 'public',
    topics: detail.topics || [],
    license: detail.license || null,
    archived: detail.archived || false,
    is_template: detail.is_template || false,
  };

  return mapGitHubSearchItemToRepository(merged, 'enriched', nowIso);
}

