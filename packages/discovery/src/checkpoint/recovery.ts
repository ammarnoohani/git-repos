import { Checkpoint, PendingWindow, TruncatedWindow } from '@github-discovery/shared';
import { StorageManager } from '../storage/manager.js';

export class CheckpointManager {
  private storage: StorageManager;

  constructor(storage: StorageManager) {
    this.storage = storage;
  }

  public getCheckpoint(): Checkpoint {
    return this.storage.loadCheckpoint();
  }

  public startRun(): Checkpoint {
    const cp = this.storage.loadCheckpoint();
    cp.status = 'running';
    this.storage.saveCheckpoint(cp);
    return cp;
  }

  /**
   * Finalizes the checkpoint after a discovery run:
   * - Advances lastCompletedWindowEnd ONLY for windows successfully written to shards.
   * - Retains or updates pendingWindows for failed/incomplete windows.
   * - Appends truncatedWindows to checkpoint history (trimmed to last 100).
   */
  public finalizeRun(params: {
    success: boolean;
    targetEnd?: string;
    completedWindows: Array<{ start: string; end: string }>;
    failedWindows: Array<{ start: string; end: string; retries: number; error?: string }>;
    truncatedWindows: Array<{ start: string; end: string; count: number; recordedAt: string }>;
    secondaryCursor?: number | null;
  }): Checkpoint {
    const cp = this.storage.loadCheckpoint();
    const nowIso = new Date().toISOString();

    if (params.secondaryCursor !== undefined && params.secondaryCursor !== null) {
      cp.secondaryCursor = params.secondaryCursor;
    }

    // 1. Process pending windows:
    // Remove completed windows from pending
    const completedSet = new Set(params.completedWindows.map((w) => `${w.start}_${w.end}`));
    const existingPending = (cp.pendingWindows || []).filter(
      (p) => !completedSet.has(`${p.start}_${p.end}`)
    );

    // Add newly failed windows
    const newPending: PendingWindow[] = [...existingPending];
    for (const failed of params.failedWindows) {
      const idx = newPending.findIndex((p) => p.start === failed.start && p.end === failed.end);
      if (idx >= 0) {
        newPending[idx].retries += 1;
        newPending[idx].error = failed.error;
      } else {
        newPending.push({
          start: failed.start,
          end: failed.end,
          retries: failed.retries || 1,
          error: failed.error,
        });
      }
    }
    cp.pendingWindows = newPending;

    // 2. Advance lastCompletedWindowEnd
    // Only advance if there were completed windows and no unhandled blockage
    if (params.completedWindows.length > 0) {
      // Find the furthest contiguous completed end
      const sortedCompleted = [...params.completedWindows].sort((a, b) =>
        a.end.localeCompare(b.end)
      );

      // If there are failures that occurred before targetEnd, only advance up to the earliest failure
      if (params.failedWindows.length > 0) {
        const earliestFailStart = params.failedWindows.map((f) => f.start).sort()[0];
        const validCompleted = sortedCompleted.filter((c) => c.end <= earliestFailStart);
        if (validCompleted.length > 0) {
          const maxEnd = validCompleted[validCompleted.length - 1].end;
          if (!cp.lastCompletedWindowEnd || maxEnd > cp.lastCompletedWindowEnd) {
            cp.lastCompletedWindowEnd = maxEnd;
          }
        }
      } else {
        // No failures: advance to furthest completed window end or targetEnd
        const maxCompletedEnd = sortedCompleted[sortedCompleted.length - 1].end;
        if (!cp.lastCompletedWindowEnd || maxCompletedEnd > cp.lastCompletedWindowEnd) {
          cp.lastCompletedWindowEnd = maxCompletedEnd;
        }
      }
    }

    // 3. Record truncated windows (keep last 50)
    const allTruncated: TruncatedWindow[] = [
      ...(cp.truncatedWindows || []),
      ...params.truncatedWindows,
    ];
    cp.truncatedWindows = allTruncated.slice(-50);

    // 4. Update status and run timestamp
    if (params.success) {
      cp.status = 'completed';
      cp.lastSuccessfulRun = nowIso;
    } else {
      cp.status = 'failed';
      if (params.completedWindows.length > 0) {
        cp.lastSuccessfulRun = nowIso;
      }
    }

    this.storage.saveCheckpoint(cp);
    return cp;
  }
}

