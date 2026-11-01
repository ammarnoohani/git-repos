export interface TimeWindow {
  start: Date;
  end: Date;
  retries?: number;
  isRetry?: boolean;
}

export interface WindowPlannerOptions {
  searchLagMinutes?: number;
  overlapMinutes?: number;
  maxWindowMinutes?: number;
}

export class WindowPlanner {
  private searchLagMinutes: number;
  private overlapMinutes: number;
  private maxWindowMinutes: number;

  constructor(options: WindowPlannerOptions = {}) {
    this.searchLagMinutes = options.searchLagMinutes ?? (parseInt(process.env.SEARCH_LAG_MINUTES || '3', 10));
    this.overlapMinutes = options.overlapMinutes ?? (parseInt(process.env.OVERLAP_MINUTES || '10', 10));
    this.maxWindowMinutes = options.maxWindowMinutes ?? 15; // default 15 min chunk
  }

  /**
   * Plans windows for a discovery cycle.
   * Considers:
   * 1. Pending failed windows to retry.
   * 2. Checkpoint lastCompletedWindowEnd with overlap.
   * 3. Bounds up to `now - searchLagMinutes`.
   */
  public planWindows(
    lastCompletedWindowEnd: string | null,
    pendingWindows: Array<{ start: string; end: string; retries: number }> = [],
    now: Date = new Date()
  ): { windows: TimeWindow[]; targetEnd: Date } {
    const planned: TimeWindow[] = [];

    // 1. Prioritize pending failed windows
    for (const pending of pendingWindows) {
      planned.push({
        start: new Date(pending.start),
        end: new Date(pending.end),
        retries: pending.retries,
        isRetry: true,
      });
    }

    // Upper bound is now minus search indexing lag
    const targetEnd = new Date(now.getTime() - this.searchLagMinutes * 60 * 1000);

    let scanStart: Date;

    if (lastCompletedWindowEnd) {
      const lastEnd = new Date(lastCompletedWindowEnd);
      // Rewind by overlapMinutes to catch late-indexed repos
      scanStart = new Date(lastEnd.getTime() - this.overlapMinutes * 60 * 1000);
    } else {
      // First run: scan the last (maxWindowMinutes + overlapMinutes) up to targetEnd
      const initialSpanMs = (this.maxWindowMinutes + this.overlapMinutes) * 60 * 1000;
      scanStart = new Date(targetEnd.getTime() - initialSpanMs);
    }

    // If scanStart is after targetEnd (e.g. clock drift or very fast consecutive runs), adjust
    if (scanStart >= targetEnd) {
      return { windows: planned, targetEnd };
    }

    // Split large timespans into chunks of maxWindowMinutes
    const chunkMs = this.maxWindowMinutes * 60 * 1000;
    let currStart = scanStart;

    while (currStart < targetEnd) {
      const currEnd = new Date(Math.min(currStart.getTime() + chunkMs, targetEnd.getTime()));
      planned.push({
        start: currStart,
        end: currEnd,
        isRetry: false,
      });
      currStart = currEnd;
    }

    return { windows: planned, targetEnd };
  }

  /**
   * Splits a window in half when total_count > 1000.
   * Returns [leftHalf, rightHalf] or null if window duration <= 1 second.
   */
  public static bisectWindow(window: TimeWindow): [TimeWindow, TimeWindow] | null {
    const durationMs = window.end.getTime() - window.start.getTime();
    if (durationMs <= 1000) {
      // Cannot split further (reached 1 second threshold)
      return null;
    }

    const midMs = window.start.getTime() + Math.floor(durationMs / 2);
    const midDate = new Date(midMs);

    const left: TimeWindow = {
      start: window.start,
      end: midDate,
      retries: window.retries,
      isRetry: window.isRetry,
    };

    const right: TimeWindow = {
      start: midDate,
      end: window.end,
      retries: window.retries,
      isRetry: window.isRetry,
    };

    return [left, right];
  }
}
