import { describe, it, expect } from 'vitest';
import { Repository } from '@github-discovery/shared';
import { deduplicateRepositories, mergeRepositoryRecords } from '../src/merge/dedupe.js';

describe('Deduplication & Record Merging', () => {
  const baseRepo: Repository = {
    id: 1234,
    name: 'sample-project',
    fullName: 'dev/sample-project',
    description: 'A sample open source project',
    owner: {
      login: 'dev',
      avatarUrl: 'https://avatars.com/dev',
      htmlUrl: 'https://github.com/dev',
    },
    htmlUrl: 'https://github.com/dev/sample-project',
    createdAt: '2026-11-01T12:00:00Z',
    updatedAt: '2026-11-01T12:00:00Z',
    language: 'TypeScript',
    stars: 10,
    forks: 1,
    watchers: 10,
    openIssues: 0,
    defaultBranch: 'main',
    visibility: 'public',
    topics: ['web'],
    license: { key: 'mit', name: 'MIT', spdxId: 'MIT' },
    archived: false,
    fork: false,
    discoveredAt: '2026-11-01T12:10:00Z',
    lastSyncedAt: '2026-11-01T12:10:00Z',
    score: 60,
  };

  it('merges updated stats and preserves original discoveredAt', () => {
    const updatedRepo: Repository = {
      ...baseRepo,
      stars: 25,
      forks: 4,
      updatedAt: '2026-11-01T15:00:00Z',
      discoveredAt: '2026-11-01T15:10:00Z', // later discovery time
      lastSyncedAt: '2026-11-01T15:10:00Z',
    };

    const merged = mergeRepositoryRecords(baseRepo, updatedRepo);
    expect(merged.id).toBe(1234);
    expect(merged.stars).toBe(25);
    expect(merged.forks).toBe(4);
    // Preserves original earliest discovery time!
    expect(merged.discoveredAt).toBe('2026-11-01T12:10:00Z');
    expect(merged.score).toBeGreaterThan(baseRepo.score || 0);
  });

  it('deduplicates a list containing duplicate IDs', () => {
    const repoA: Repository = { ...baseRepo, id: 101, stars: 5 };
    const repoB: Repository = { ...baseRepo, id: 102, stars: 10 };
    const repoADup: Repository = { ...baseRepo, id: 101, stars: 8 };

    const result = deduplicateRepositories([repoA, repoB, repoADup]);
    expect(result.length).toBe(2);

    const mergedA = result.find((r) => r.id === 101);
    expect(mergedA?.stars).toBe(8);
  });
});

