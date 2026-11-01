import { describe, it, expect, vi } from 'vitest';
import { WindowPlanner } from '../src/windows/planner.js';
import { WindowSearcher } from '../src/windows/searcher.js';
import { deduplicateRepositories } from '../src/merge/dedupe.js';
describe('Window Planner & Search Bisection', () => {
    it('plans initial window with search lag and overlap when checkpoint is null', () => {
        const planner = new WindowPlanner({
            searchLagMinutes: 3,
            overlapMinutes: 10,
            maxWindowMinutes: 15,
        });
        const now = new Date('2026-11-02T12:00:00Z');
        const { windows, targetEnd } = planner.planWindows(null, [], now);
        expect(targetEnd.toISOString()).toBe('2026-11-02T11:57:00.000Z');
        expect(windows.length).toBeGreaterThan(0);
        // Starts 25 min prior to targetEnd
        expect(windows[0].start.toISOString()).toBe('2026-11-02T11:32:00.000Z');
    });
    it('prioritizes pending failed windows', () => {
        const planner = new WindowPlanner();
        const pending = [
            { start: '2026-11-02T10:00:00Z', end: '2026-11-02T10:05:00Z', retries: 1 },
        ];
        const { windows } = planner.planWindows('2026-11-02T11:00:00Z', pending, new Date('2026-11-02T11:30:00Z'));
        expect(windows[0].isRetry).toBe(true);
        expect(windows[0].start.toISOString()).toBe('2026-11-02T10:00:00.000Z');
    });
    it('bisects window correctly in half', () => {
        const win = {
            start: new Date('2026-11-02T10:00:00.000Z'),
            end: new Date('2026-11-02T10:10:00.000Z'),
        };
        const split = WindowPlanner.bisectWindow(win);
        expect(split).not.toBeNull();
        if (split) {
            const [left, right] = split;
            expect(left.start.toISOString()).toBe('2026-11-02T10:00:00.000Z');
            expect(left.end.toISOString()).toBe('2026-11-02T10:05:00.000Z');
            expect(right.start.toISOString()).toBe('2026-11-02T10:05:00.000Z');
            expect(right.end.toISOString()).toBe('2026-11-02T10:10:00.000Z');
        }
    });
    it('refuses to bisect when window duration is <= 1 second', () => {
        const win = {
            start: new Date('2026-11-02T10:00:00.000Z'),
            end: new Date('2026-11-02T10:00:01.000Z'), // 1 second
        };
        const split = WindowPlanner.bisectWindow(win);
        expect(split).toBeNull();
    });
    it('executes recursive search bisection when total_count > 1000 and records 1s truncation', async () => {
        const mockClient = {
            shouldExitEarly: vi.fn().mockReturnValue(false),
            searchRepositories: vi.fn().mockImplementation((query) => {
                // If window is 10s or 5s, report > 1000 to force split
                if (query.includes('10:00:00') && query.includes('10:00:02')) {
                    return Promise.resolve({
                        total_count: 1500,
                        incomplete_results: false,
                        items: [],
                    });
                }
                // At 1-second window, report 1200 to test truncation logging
                if (query.includes('10:00:00') && query.includes('10:00:01')) {
                    return Promise.resolve({
                        total_count: 1200,
                        incomplete_results: false,
                        items: [
                            {
                                id: 111,
                                name: 'popular-repo',
                                full_name: 'test/popular-repo',
                                owner: { login: 'test', avatar_url: '', html_url: '' },
                                html_url: '',
                                description: '',
                                fork: false,
                                created_at: '2026-11-02T10:00:00.500Z',
                                updated_at: '2026-11-02T10:00:00.500Z',
                                stargazers_count: 50,
                                watchers_count: 50,
                                language: 'Go',
                                forks_count: 1,
                                open_issues_count: 0,
                                default_branch: 'main',
                            },
                        ],
                    });
                }
                return Promise.resolve({
                    total_count: 10,
                    incomplete_results: false,
                    items: [],
                });
            }),
        };
        const searcher = new WindowSearcher(mockClient);
        const win = {
            start: new Date('2026-11-02T10:00:00.000Z'),
            end: new Date('2026-11-02T10:00:02.000Z'), // 2 seconds, will split into two 1-second windows
        };
        const result = await searcher.executeWindows([win]);
        expect(result.truncatedWindows.length).toBeGreaterThanOrEqual(1);
        expect(result.truncatedWindows[0].count).toBe(1200);
        // Deduplicated items across paginated responses
        const deduped = deduplicateRepositories(result.repositories);
        expect(deduped.length).toBe(1);
        expect(deduped[0].id).toBe(111);
    });
});
//# sourceMappingURL=window-planner.test.js.map