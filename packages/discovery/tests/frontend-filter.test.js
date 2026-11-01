import { describe, it, expect } from 'vitest';
import { filterAndSortRepositories } from '../../../apps/web/src/utils/filterRepos.js';
describe('Frontend Search & Filtering Logic', () => {
    const sampleRepos = [
        {
            id: 1,
            name: 'react-fast-table',
            fullName: 'dev/react-fast-table',
            description: 'Super fast table library for modern React web apps',
            owner: { login: 'dev', avatarUrl: '', htmlUrl: '' },
            htmlUrl: '',
            createdAt: '2026-11-01T10:00:00Z',
            updatedAt: '2026-11-01T15:00:00Z',
            language: 'TypeScript',
            stars: 50,
            forks: 5,
            watchers: 50,
            openIssues: 0,
            defaultBranch: 'main',
            visibility: 'public',
            topics: ['react', 'table', 'ui'],
            license: { key: 'mit', name: 'MIT', spdxId: 'MIT' },
            archived: false,
            fork: false,
            discoveredAt: '2026-11-01T10:05:00Z',
            lastSyncedAt: '2026-11-01T10:05:00Z',
            score: 250,
        },
        {
            id: 2,
            name: 'deep-learning-core',
            fullName: 'ai-lab/deep-learning-core',
            description: 'Neural network kernels in Python and CUDA',
            owner: { login: 'ai-lab', avatarUrl: '', htmlUrl: '' },
            htmlUrl: '',
            createdAt: '2026-11-02T08:00:00Z',
            updatedAt: '2026-11-02T08:30:00Z',
            language: 'Python',
            stars: 120,
            forks: 15,
            watchers: 120,
            openIssues: 1,
            defaultBranch: 'main',
            visibility: 'public',
            topics: ['ai', 'cuda', 'deep-learning'],
            license: { key: 'apache-2.0', name: 'Apache 2.0', spdxId: 'Apache-2.0' },
            archived: false,
            fork: false,
            discoveredAt: '2026-11-02T08:05:00Z',
            lastSyncedAt: '2026-11-02T08:05:00Z',
            score: 600,
        },
        {
            id: 3,
            name: 'archived-fork',
            fullName: 'copier/archived-fork',
            description: 'A legacy fork of something old',
            owner: { login: 'copier', avatarUrl: '', htmlUrl: '' },
            htmlUrl: '',
            createdAt: '2026-10-25T05:00:00Z',
            updatedAt: '2026-10-25T05:00:00Z',
            language: 'JavaScript',
            stars: 0,
            forks: 0,
            watchers: 0,
            openIssues: 0,
            defaultBranch: 'main',
            visibility: 'public',
            topics: [],
            license: null,
            archived: true,
            fork: true,
            discoveredAt: '2026-10-25T05:10:00Z',
            lastSyncedAt: '2026-10-25T05:10:00Z',
            score: -10,
        },
    ];
    it('filters by free text query across name, description and topics', () => {
        const resTable = filterAndSortRepositories(sampleRepos, { query: 'table' });
        expect(resTable.length).toBe(1);
        expect(resTable[0].id).toBe(1);
        const resAi = filterAndSortRepositories(sampleRepos, { query: 'cuda' });
        expect(resAi.length).toBe(1);
        expect(resAi[0].id).toBe(2);
    });
    it('filters by language', () => {
        const res = filterAndSortRepositories(sampleRepos, { language: 'python' });
        expect(res.length).toBe(1);
        expect(res[0].id).toBe(2);
    });
    it('filters by minimum stars', () => {
        const res = filterAndSortRepositories(sampleRepos, { minStars: 100 });
        expect(res.length).toBe(1);
        expect(res[0].id).toBe(2);
    });
    it('excludes forks and archived repositories when toggled off', () => {
        const res = filterAndSortRepositories(sampleRepos, {
            includeForks: false,
            includeArchived: false,
        });
        expect(res.length).toBe(2);
        expect(res.some((r) => r.id === 3)).toBe(false);
    });
    it('filters by creation date range', () => {
        const res = filterAndSortRepositories(sampleRepos, {
            startDate: '2026-11-02',
            endDate: '2026-11-02',
        });
        expect(res.length).toBe(1);
        expect(res[0].id).toBe(2);
    });
    it('sorts correctly by stars descending', () => {
        const res = filterAndSortRepositories(sampleRepos, {}, 'stars');
        expect(res[0].stars).toBe(120);
        expect(res[1].stars).toBe(50);
        expect(res[2].stars).toBe(0);
    });
    it('sorts correctly by newest first', () => {
        const res = filterAndSortRepositories(sampleRepos, {}, 'newest');
        expect(res[0].id).toBe(2); // 2026-11-02
        expect(res[1].id).toBe(1); // 2026-11-01
        expect(res[2].id).toBe(3); // 2026-10-25
    });
});
//# sourceMappingURL=frontend-filter.test.js.map