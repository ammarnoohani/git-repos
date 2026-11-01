import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { StorageManager } from '../src/storage/manager.js';
import { DigestManager } from '../src/notify/digest.js';
import { TelegramNotifier } from '../src/notify/telegram.js';

describe('Scheduled Digest Logic', () => {
  const testDataDir = path.resolve('./data-digest-test');

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

  it('correctly calculates isDigestDue based on elapsed time', () => {
    const storage = new StorageManager({ dataDir: testDataDir });
    const digest = new DigestManager(storage);

    const now = new Date('2026-11-02T12:00:00Z');

    // Never run before -> true
    expect(digest.isDigestDue('hourly', undefined, now)).toBe(true);

    // 30 min ago -> hourly false, daily false
    const thirtyMinAgo = '2026-11-02T11:30:00Z';
    expect(digest.isDigestDue('hourly', thirtyMinAgo, now)).toBe(false);

    // 2 hours ago -> hourly true, 6hourly false
    const twoHoursAgo = '2026-11-02T10:00:00Z';
    expect(digest.isDigestDue('hourly', twoHoursAgo, now)).toBe(true);
    expect(digest.isDigestDue('6hourly', twoHoursAgo, now)).toBe(false);

    // 25 hours ago -> daily true
    const dayAgo = '2026-11-01T11:00:00Z';
    expect(digest.isDigestDue('daily', dayAgo, now)).toBe(true);
  });

  it('sends digest when due and saves timestamp in state/notified.json', async () => {
    const storage = new StorageManager({ dataDir: testDataDir });
    // Ingest a shard with repos
    const todayStr = new Date().toISOString().substring(0, 10);
    storage.saveShard(todayStr, [
      {
        id: 999,
        name: 'digest-star',
        fullName: 'org/digest-star',
        description: 'Star of the digest',
        owner: { login: 'org', avatarUrl: '', htmlUrl: '' },
        htmlUrl: 'https://github.com/org/digest-star',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        language: 'TypeScript',
        stars: 120,
        forks: 10,
        watchers: 120,
        openIssues: 0,
        defaultBranch: 'main',
        visibility: 'public',
        topics: ['cool'],
        license: null,
        archived: false,
        fork: false,
        discoveredAt: new Date().toISOString(),
        lastSyncedAt: new Date().toISOString(),
        score: 600,
      },
    ]);
    storage.pruneAndSyncManifest(1);

    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );

    const telegram = new TelegramNotifier({
      botToken: 'bot123',
      chatId: 'chat456',
      fetchFn: mockFetch,
    });

    const digestMgr = new DigestManager(storage, telegram);
    const result = await digestMgr.runDigest('hourly');

    expect(result.sent).toBe(true);
    expect(result.repoCount).toBe(1);

    const notifiedState = storage.loadNotified();
    expect(notifiedState.channels.telegram?.lastDigestAt?.['hourly']).toBeDefined();
  });
});
