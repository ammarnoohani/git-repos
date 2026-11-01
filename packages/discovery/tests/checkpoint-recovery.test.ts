import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { StorageManager } from '../src/storage/manager.js';
import { CheckpointManager } from '../src/checkpoint/recovery.js';

describe('Checkpoint Management & Recovery', () => {
  const testDataDir = path.resolve('./data-checkpoint-test');

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

  it('records starting status and advances only contiguous completed windows', () => {
    const storage = new StorageManager({ dataDir: testDataDir });
    const manager = new CheckpointManager(storage);

    manager.startRun();
    let cp = manager.getCheckpoint();
    expect(cp.status).toBe('running');

    // Simulate completion with 2 successful windows
    manager.finalizeRun({
      success: true,
      completedWindows: [
        { start: '2026-11-02T10:00:00Z', end: '2026-11-02T10:15:00Z' },
        { start: '2026-11-02T10:15:00Z', end: '2026-11-02T10:30:00Z' },
      ],
      failedWindows: [],
      truncatedWindows: [],
      secondaryCursor: 99999,
    });

    cp = manager.getCheckpoint();
    expect(cp.status).toBe('completed');
    expect(cp.lastCompletedWindowEnd).toBe('2026-11-02T10:30:00Z');
    expect(cp.secondaryCursor).toBe(99999);
    expect(cp.pendingWindows.length).toBe(0);
  });

  it('never advances past a failed window and queues it into pendingWindows', () => {
    const storage = new StorageManager({ dataDir: testDataDir });
    const manager = new CheckpointManager(storage);

    manager.startRun();

    // Window 1 succeeded, Window 2 failed
    manager.finalizeRun({
      success: false,
      completedWindows: [
        { start: '2026-11-02T10:00:00Z', end: '2026-11-02T10:15:00Z' },
      ],
      failedWindows: [
        { start: '2026-11-02T10:15:00Z', end: '2026-11-02T10:30:00Z', retries: 1, error: 'Rate limit' },
      ],
      truncatedWindows: [],
    });

    const cp = manager.getCheckpoint();
    expect(cp.status).toBe('failed');
    // Advances only up to window 1 end (2026-11-02T10:15:00Z)
    expect(cp.lastCompletedWindowEnd).toBe('2026-11-02T10:15:00Z');
    expect(cp.pendingWindows.length).toBe(1);
    expect(cp.pendingWindows[0].start).toBe('2026-11-02T10:15:00Z');
  });

  it('recovers after a simulated crash', () => {
    const storage = new StorageManager({ dataDir: testDataDir });
    const manager = new CheckpointManager(storage);

    // Run starts, but crashes before finalize
    manager.startRun();

    // Next run reloads checkpoint
    const reloadedManager = new CheckpointManager(storage);
    const cp = reloadedManager.getCheckpoint();
    expect(cp.status).toBe('running');

    // Resumes and succeeds
    reloadedManager.finalizeRun({
      success: true,
      completedWindows: [
        { start: '2026-11-02T10:00:00Z', end: '2026-11-02T10:15:00Z' },
      ],
      failedWindows: [],
      truncatedWindows: [],
    });

    expect(reloadedManager.getCheckpoint().status).toBe('completed');
  });
});

