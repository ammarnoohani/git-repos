import { describe, it, expect } from 'vitest';
import { RepositorySchema } from '@github-discovery/shared';
import { mapGitHubSearchItemToRepository, mapEnrichedItemToRepository } from '../src/github/mapper.js';
import { GitHubSearchItem, GitHubPublicRepoItem } from '../src/github/types.js';

describe('GitHub Item Mapper', () => {
  it('maps a full GitHub search item and passes Zod validation', () => {
    const raw: GitHubSearchItem = {
      id: 987654,
      node_id: 'R_kgDO1234',
      name: 'super-tool',
      full_name: 'acme/super-tool',
      owner: {
        login: 'acme',
        id: 111,
        avatar_url: 'https://avatars.githubusercontent.com/u/111',
        html_url: 'https://github.com/acme',
        type: 'Organization',
      },
      html_url: 'https://github.com/acme/super-tool',
      description: 'A revolutionary database-free discovery tool',
      fork: false,
      created_at: '2026-11-01T10:00:00Z',
      updated_at: '2026-11-01T12:00:00Z',
      pushed_at: '2026-11-01T12:05:00Z',
      stargazers_count: 42,
      watchers_count: 42,
      language: 'TypeScript',
      forks_count: 5,
      open_issues_count: 2,
      default_branch: 'main',
      visibility: 'public',
      topics: ['tools', 'github-api', 'typescript'],
      license: {
        key: 'mit',
        name: 'MIT License',
        spdx_id: 'MIT',
        url: 'https://api.github.com/licenses/mit',
      },
      archived: false,
      is_template: false,
    };

    const repo = mapGitHubSearchItemToRepository(raw, 'search');
    expect(repo.id).toBe(987654);
    expect(repo.name).toBe('super-tool');
    expect(repo.stars).toBe(42);
    expect(repo.score).toBeGreaterThan(0);
    expect(repo.discoveryMethod).toBe('search');

    // Strict validation against Zod schema
    const validation = RepositorySchema.safeParse(repo);
    expect(validation.success).toBe(true);
  });

  it('safely handles missing, null, or undefined fields in API item', () => {
    const rawIncomplete: GitHubSearchItem = {
      id: 555555,
      name: 'sparse-repo',
      full_name: 'ghost/sparse-repo',
      owner: {
        login: 'ghost',
        avatar_url: '',
        html_url: '',
      },
      html_url: '',
      description: null,
      fork: false,
      created_at: '',
      updated_at: '',
      stargazers_count: 0,
      watchers_count: 0,
      language: null,
      forks_count: 0,
      open_issues_count: 0,
      default_branch: '',
      license: null,
      topics: undefined,
    };

    const repo = mapGitHubSearchItemToRepository(rawIncomplete, 'search');
    expect(repo.description).toBeNull();
    expect(repo.language).toBeNull();
    expect(repo.license).toBeNull();
    expect(repo.topics).toEqual([]);
    expect(repo.defaultBranch).toBe('main');

    const validation = RepositorySchema.safeParse(repo);
    expect(validation.success).toBe(true);
  });

  it('maps enriched item correctly from public repo item and detail item', () => {
    const minimal: GitHubPublicRepoItem = {
      id: 777777,
      name: 'minimal-repo',
      full_name: 'user/minimal-repo',
      owner: {
        login: 'user',
        avatar_url: 'https://github.com/ghost.png',
        html_url: 'https://github.com/user',
      },
      html_url: 'https://github.com/user/minimal-repo',
      description: 'Minimal public description',
      fork: false,
    };

    const detail: Partial<GitHubSearchItem> = {
      created_at: '2026-11-01T08:00:00Z',
      stargazers_count: 10,
      language: 'Rust',
      topics: ['rust', 'cli'],
    };

    const repo = mapEnrichedItemToRepository(minimal, detail);
    expect(repo.id).toBe(777777);
    expect(repo.stars).toBe(10);
    expect(repo.language).toBe('Rust');
    expect(repo.discoveryMethod).toBe('enriched');

    const validation = RepositorySchema.safeParse(repo);
    expect(validation.success).toBe(true);
  });
});

