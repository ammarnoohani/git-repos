import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { StorageManager } from '../src/storage/manager.js';
import { TelegramNotifier } from '../src/notify/telegram.js';
import { EmailNotifier } from '../src/notify/email.js';
import { NotificationDispatcher } from '../src/notify/dispatcher.js';
import { Repository } from '@github-discovery/shared';

describe('Notifications Subsystem', () => {
  const testDataDir = path.resolve('./data-notify-test');

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

  const createDummyRepo = (id: number, stars: number, score: number): Repository => ({
    id,
    name: `repo-${id}`,
    fullName: `owner/repo-${id}`,
    description: `Awesome project ${id}`,
    owner: { login: 'owner', avatarUrl: '', htmlUrl: '' },
    htmlUrl: `https://github.com/owner/repo-${id}`,
    createdAt: '2026-11-01T10:00:00Z',
    updatedAt: '2026-11-01T10:00:00Z',
    language: 'Rust',
    stars,
    forks: 0,
    watchers: stars,
    openIssues: 0,
    defaultBranch: 'main',
    visibility: 'public',
    topics: ['rust'],
    license: { key: 'mit', name: 'MIT', spdxId: 'MIT' },
    archived: false,
    fork: false,
    discoveredAt: new Date().toISOString(),
    lastSyncedAt: new Date().toISOString(),
    score,
  });

  it('handles Telegram 429 with retry_after', async () => {
    let callCount = 0;
    const mockFetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve(
          new Response(JSON.stringify({ ok: false, parameters: { retry_after: 0.1 } }), {
            status: 429,
          })
        );
      }
      return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    });

    const telegram = new TelegramNotifier({
      botToken: 'fake-token',
      chatId: 'fake-chat',
      fetchFn: mockFetch,
    });

    const success = await telegram.sendMessage('Test message');
    expect(callCount).toBe(2);
    expect(success).toBe(true);
  });

  it('dispatches immediate notifications for top N and appends summary line', async () => {
    const storage = new StorageManager({ dataDir: testDataDir });
    const sentMessages: string[] = [];

    const mockFetch = vi.fn().mockImplementation((_url, init) => {
      const body = JSON.parse(init.body as string);
      sentMessages.push(body.text);
      return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    });

    const telegram = new TelegramNotifier({
      botToken: 'bot123',
      chatId: 'chat456',
      fetchFn: mockFetch,
    });

    const dispatcher = new NotificationDispatcher(storage, telegram, undefined, {
      maxPerRun: 2, // cap at 2 repos
    });

    const r1 = createDummyRepo(1, 100, 500);
    const r2 = createDummyRepo(2, 50, 250);
    const r3 = createDummyRepo(3, 10, 50);

    const res = await dispatcher.dispatchImmediate([r1, r2, r3]);
    expect(res.notifiedCount).toBe(2);

    // Should have sent 2 individual messages + 1 summary message (+1 more discovered...)
    expect(sentMessages.length).toBe(3);
    expect(sentMessages[0]).toContain('repo-1');
    expect(sentMessages[1]).toContain('repo-2');
    expect(sentMessages[2]).toContain('+1 more repositories discovered');

    // Verify deduplication: second dispatch with the already notified repos should send 0 messages
    sentMessages.length = 0;
    const secondRes = await dispatcher.dispatchImmediate([r1, r2]);
    expect(secondRes.notifiedCount).toBe(0);
    expect(sentMessages.length).toBe(0);
  });

  it('isolates notification failure so discovery state is protected', async () => {
    const storage = new StorageManager({ dataDir: testDataDir });
    const failingTelegram = {
      isConfigured: () => true,
      sendMessage: () => Promise.reject(new Error('Network dead')),
      formatRepositoryMessage: () => 'msg',
    } as unknown as TelegramNotifier;

    const dispatcher = new NotificationDispatcher(storage, failingTelegram);
    const r1 = createDummyRepo(1, 10, 50);

    // Must not throw!
    await expect(dispatcher.dispatchImmediate([r1])).resolves.toEqual({ notifiedCount: 0 });
  });

  it('formats clean email digest html', () => {
    const email = new EmailNotifier({ apiKey: 're_123', toEmail: 'dev@example.com' });
    const r1 = createDummyRepo(1, 42, 200);
    const html = email.formatDigestHtml([r1], 'Test Digest');

    expect(html).toContain('Test Digest');
    expect(html).toContain('owner/repo-1');
    expect(html).toContain('⭐ 42');
  });
});
