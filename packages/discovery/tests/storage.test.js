import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { StorageManager } from '../src/storage/manager.js';
describe('Storage Manager & Sharding', () => {
    const testDataDir = path.resolve('./data-storage-test');
    beforeEach(() => {
        if (fs.existsSync(testDataDir)) {
            fs.rmSync(testDataDir, { recursive: true, force: true });
        }
    });
    afterEach(() => {
        if (fs.existsSync(testDataDir)) {
            fs.rmSync(testDataDir, { recursive: true, force: true });
        }
    });
    const createDummyRepo = (id, createdAt, stars = 0, score = 0) => ({
        id,
        name: `repo-${id}`,
        fullName: `owner/repo-${id}`,
        description: `Description for ${id}`,
        owner: { login: 'owner', avatarUrl: '', htmlUrl: '' },
        htmlUrl: `https://github.com/owner/repo-${id}`,
        createdAt,
        updatedAt: createdAt,
        language: 'TypeScript',
        stars,
        forks: 0,
        watchers: stars,
        openIssues: 0,
        defaultBranch: 'main',
        visibility: 'public',
        topics: [],
        license: null,
        archived: false,
        fork: false,
        discoveredAt: new Date().toISOString(),
        lastSyncedAt: new Date().toISOString(),
        score,
    });
    it('performs atomic writes and validates files with Zod schemas', () => {
        const storage = new StorageManager({ dataDir: testDataDir });
        const repo = createDummyRepo(1, '2026-11-01T10:00:00Z', 10, 50);
        const res = storage.saveShard('2026-11-01', [repo]);
        expect(res.count).toBe(1);
        expect(res.bytes).toBeGreaterThan(0);
        const loaded = storage.loadShard('2026-11-01');
        expect(loaded.length).toBe(1);
        expect(loaded[0].id).toBe(1);
    });
    it('enforces max repos per shard cap, preserving top scored items', () => {
        const storage = new StorageManager({ dataDir: testDataDir, maxReposPerShard: 2 });
        const r1 = createDummyRepo(1, '2026-11-01T10:00:00Z', 5, 20);
        const r2 = createDummyRepo(2, '2026-11-01T10:00:00Z', 50, 200); // highest
        const r3 = createDummyRepo(3, '2026-11-01T10:00:00Z', 25, 100); // second highest
        const res = storage.saveShard('2026-11-01', [r1, r2, r3]);
        expect(res.count).toBe(2);
        expect(res.truncated).toBe(true);
        const loaded = storage.loadShard('2026-11-01');
        expect(loaded.map((r) => r.id)).toEqual([2, 3]);
    });
    it('prunes shards older than retentionDays without decreasing totalDiscovered counter', () => {
        const storage = new StorageManager({ dataDir: testDataDir, retentionDays: 7 });
        const now = new Date();
        const todayStr = now.toISOString().substring(0, 10);
        const oldDate = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
        const oldDayStr = oldDate.toISOString().substring(0, 10);
        // Ingest old repo
        storage.ingestRepositories([createDummyRepo(100, `${oldDayStr}T10:00:00Z`)]);
        // Ingest today repo
        storage.ingestRepositories([createDummyRepo(200, `${todayStr}T10:00:00Z`)]);
        let manifest = storage.loadManifest();
        expect(manifest.totalDiscovered).toBe(2);
        // Old shard file should have been pruned
        expect(fs.existsSync(storage.getShardPath(oldDayStr))).toBe(false);
        expect(fs.existsSync(storage.getShardPath(todayStr))).toBe(true);
        // Cumulative counter must stay at 2
        expect(manifest.totalDiscovered).toBe(2);
        expect(manifest.shards.length).toBe(1);
        expect(manifest.shards[0].date).toBe(todayStr);
    });
});
//# sourceMappingURL=storage.test.js.map