import { describe, it, expect } from 'vitest';
import { RepositorySchema } from '@github-discovery/shared';
import { GitHubClient } from '../src/github/client.js';
import { mapGitHubSearchItemToRepository } from '../src/github/mapper.js';
describe('Opt-in Live GitHub Smoke Test', () => {
    const isLiveTestEnabled = process.env.RUN_LIVE_TEST === 'true';
    const testFn = isLiveTestEnabled ? it : it.skip;
    testFn('confirms real GitHub Search API returns expected fields and conforms to schema', async () => {
        const client = new GitHubClient();
        const res = await client.searchRepositories('stars:>5000 fork:false', {
            perPage: 1,
            sort: 'stars',
            order: 'desc',
        });
        expect(res.items.length).toBeGreaterThan(0);
        const firstItem = res.items[0];
        const mapped = mapGitHubSearchItemToRepository(firstItem, 'search');
        expect(mapped.id).toBeTypeOf('number');
        expect(mapped.name).toBeTypeOf('string');
        expect(mapped.fullName).toContain('/');
        expect(mapped.owner.login).toBeTypeOf('string');
        // Strict schema validation
        const parsed = RepositorySchema.safeParse(mapped);
        expect(parsed.success).toBe(true);
    });
});
//# sourceMappingURL=smoke.live.test.js.map