import { describe, it, expect, vi } from 'vitest';
import { GitHubClient } from '../src/github/client.js';
describe('GitHubClient', () => {
    it('builds request with appropriate headers including auth token', async () => {
        let capturedUrl = '';
        let capturedHeaders = {};
        const mockFetch = vi.fn().mockImplementation((url, init) => {
            capturedUrl = url.toString();
            capturedHeaders = init.headers;
            return Promise.resolve(new Response(JSON.stringify({ total_count: 0, items: [] }), {
                status: 200,
                headers: {
                    'x-ratelimit-limit': '30',
                    'x-ratelimit-remaining': '29',
                    'x-ratelimit-reset': '1800000000',
                    'x-ratelimit-used': '1',
                },
            }));
        });
        const client = new GitHubClient({
            token: 'ghp_test_token_123',
            fetchFn: mockFetch,
        });
        await client.searchRepositories('test query', { page: 1, perPage: 50, sort: 'stars', order: 'desc' });
        expect(capturedUrl).toContain('/search/repositories?q=test+query&page=1&per_page=50&sort=stars&order=desc');
        expect(capturedHeaders['Authorization']).toBe('Bearer ghp_test_token_123');
        expect(capturedHeaders['User-Agent']).toBe('github-discovery-engine/1.0');
        expect(capturedHeaders['Accept']).toBe('application/vnd.github+json');
        expect(capturedHeaders['X-GitHub-Api-Version']).toBe('2022-11-28');
        const rateLimit = client.getRateLimitInfo();
        expect(rateLimit).toEqual({
            limit: 30,
            remaining: 29,
            reset: 1800000000,
            used: 1,
        });
    });
    it('triggers exponential backoff on HTTP 429 or secondary rate limit', async () => {
        let attempts = 0;
        const mockFetch = vi.fn().mockImplementation(() => {
            attempts++;
            if (attempts === 1) {
                return Promise.resolve(new Response(JSON.stringify({ message: 'You have exceeded a secondary rate limit' }), {
                    status: 403,
                    headers: {
                        'retry-after': '1',
                    },
                }));
            }
            return Promise.resolve(new Response(JSON.stringify({ id: 12345, name: 'recovered-repo' }), {
                status: 200,
            }));
        });
        const client = new GitHubClient({
            fetchFn: mockFetch,
            initialBackoffMs: 10,
        });
        const res = await client.request('/repos/test/repo');
        expect(attempts).toBe(2);
        expect(res.id).toBe(12345);
    });
    it('detects early exit when rate limit remaining is below threshold', async () => {
        const mockFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ total_count: 0, items: [] }), {
            status: 200,
            headers: {
                'x-ratelimit-limit': '30',
                'x-ratelimit-remaining': '1', // <= minRemainingRateLimit (2)
                'x-ratelimit-reset': '1800000000',
            },
        }));
        const client = new GitHubClient({
            fetchFn: mockFetch,
            minRemainingRateLimit: 2,
        });
        await client.searchRepositories('test');
        expect(client.shouldExitEarly()).toBe(true);
        // Subsequent request should fail fast with early exit message
        await expect(client.searchRepositories('another')).rejects.toThrow('Early exit triggered');
    });
    it('detects early exit when request budget is reached', async () => {
        const mockFetch = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ total_count: 0, items: [] }), {
            status: 200,
            headers: {
                'x-ratelimit-limit': '30',
                'x-ratelimit-remaining': '25',
                'x-ratelimit-reset': '1800000000',
            },
        })));
        const client = new GitHubClient({
            fetchFn: mockFetch,
            maxRequestsPerRun: 2,
        });
        await client.searchRepositories('query1');
        await client.searchRepositories('query2');
        expect(client.shouldExitEarly()).toBe(true);
    });
});
//# sourceMappingURL=github-client.test.js.map