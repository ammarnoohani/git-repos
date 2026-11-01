import {
  Repository,
  RunStats,
  DEFAULT_QUERY_FILTERS,
} from '@github-discovery/shared';
import { GitHubClient } from './github/client.js';
import { StorageManager } from './storage/manager.js';
import { CheckpointManager } from './checkpoint/recovery.js';
import { WindowPlanner } from './windows/planner.js';
import { WindowSearcher } from './windows/searcher.js';
import { PublicReposScanner } from './github/secondary.js';
import { NotificationDispatcher } from './notify/dispatcher.js';
import { calculateDiscoveryHealth } from './health/calculator.js';
import { deduplicateRepositories } from './merge/dedupe.js';

export interface DiscoveryEngineOptions {
  storage?: StorageManager;
  client?: GitHubClient;
  queryFilters?: string;
  enablePublicReposScan?: boolean;
}

export class DiscoveryEngine {
  private storage: StorageManager;
  private client: GitHubClient;
  private checkpointManager: CheckpointManager;
  private windowPlanner: WindowPlanner;
  private queryFilters: string;
  private enablePublicReposScan: boolean;

  constructor(options: DiscoveryEngineOptions = {}) {
    this.storage = options.storage || new StorageManager();
    this.client = options.client || new GitHubClient();
    this.checkpointManager = new CheckpointManager(this.storage);
    this.windowPlanner = new WindowPlanner();
    this.queryFilters = options.queryFilters || process.env.DISCOVERY_QUERY_FILTERS || DEFAULT_QUERY_FILTERS;
    this.enablePublicReposScan = options.enablePublicReposScan ?? (process.env.ENABLE_PUBLIC_REPOS_SCAN === 'true');
  }

  public async runDiscoveryCycle(options: { forceFullScan?: boolean } = {}): Promise<RunStats> {
    const runId = `run_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const startTime = Date.now();
    const nowIso = new Date().toISOString();

    console.log(JSON.stringify({
      level: 'info',
      event: 'run_started',
      runId,
      timestamp: nowIso,
      forceFullScan: options.forceFullScan,
    }));

    // Start checkpoint
    this.checkpointManager.startRun();
    const checkpoint = this.checkpointManager.getCheckpoint();

    let lastCompletedWindowEnd = checkpoint.lastCompletedWindowEnd;
    if (options.forceFullScan) {
      lastCompletedWindowEnd = null; // force initial fallback window
    }

    const { windows, targetEnd } = this.windowPlanner.planWindows(
      lastCompletedWindowEnd,
      checkpoint.pendingWindows || []
    );

    console.log(JSON.stringify({
      level: 'info',
      event: 'windows_planned',
      runId,
      windowCount: windows.length,
      targetEnd: targetEnd.toISOString(),
    }));

    let discoveredRepos: Repository[] = [];
    const searcher = new WindowSearcher(this.client, this.queryFilters);
    const searchResult = await searcher.executeWindows(windows);
    discoveredRepos.push(...searchResult.repositories);

    let secondaryCursor = checkpoint.secondaryCursor;
    let method: RunStats['method'] = 'search';

    // Optional Secondary Scan
    if (this.enablePublicReposScan && !this.client.shouldExitEarly()) {
      method = 'hybrid';
      const fallbackBaseline = discoveredRepos.length > 0 ? Math.max(...discoveredRepos.map((r) => r.id)) : undefined;
      const scanner = new PublicReposScanner(this.client);
      const secondaryResult = await scanner.scan(secondaryCursor ?? null, fallbackBaseline);
      discoveredRepos.push(...secondaryResult.repositories);
      if (secondaryResult.newCursor) {
        secondaryCursor = secondaryResult.newCursor;
      }
    }

    // Deduplicate collected batch
    const uniqueBatch = deduplicateRepositories(discoveredRepos);

    // Save batch to storage shards (and retention pruning)
    const { newDiscoveredCount, updatedCount } = this.storage.ingestRepositories(uniqueBatch);

    const isSuccess = searchResult.failedWindows.length === 0;

    // Finalize Checkpoint
    const updatedCheckpoint = this.checkpointManager.finalizeRun({
      success: isSuccess,
      targetEnd: targetEnd.toISOString(),
      completedWindows: searchResult.processedWindows,
      failedWindows: searchResult.failedWindows,
      truncatedWindows: searchResult.truncatedWindows,
      secondaryCursor,
    });

    // Update manifest health
    const currentManifest = this.storage.loadManifest();
    const rateLimit = this.client.getRateLimitInfo();
    const durationSeconds = Math.round((Date.now() - startTime) / 1000);

    const health = calculateDiscoveryHealth(
      currentManifest,
      updatedCheckpoint,
      rateLimit,
      durationSeconds
    );
    currentManifest.health = health;
    this.storage.saveManifest(currentManifest);

    // Immediate Notifications (strictly isolated)
    let notifiedCount = 0;
    try {
      const dispatcher = new NotificationDispatcher(this.storage);
      // Notify only on freshly discovered repositories in this batch
      const newlyDiscoveredRepos = uniqueBatch.slice(0, newDiscoveredCount);
      const notifRes = await dispatcher.dispatchImmediate(newlyDiscoveredRepos.length > 0 ? newlyDiscoveredRepos : uniqueBatch);
      notifiedCount = notifRes.notifiedCount;
    } catch (notifErr: unknown) {
      console.log(JSON.stringify({
        level: 'warn',
        event: 'notification_error_isolated',
        runId,
        error: (notifErr as Error).message || String(notifErr),
      }));
    }

    // Record Run Statistics
    const runStats: RunStats = {
      runId,
      timestamp: nowIso,
      durationSeconds,
      method,
      discoveredCount: uniqueBatch.length,
      newCount: newDiscoveredCount,
      updatedCount,
      windowsProcessed: searchResult.processedWindows.length,
      windowsTruncated: searchResult.truncatedWindows.length,
      windowsFailed: searchResult.failedWindows.length,
      rateLimitRemaining: rateLimit?.remaining ?? null,
      notifiedCount,
      success: isSuccess,
      error: searchResult.failedWindows.length > 0 ? `${searchResult.failedWindows.length} windows failed` : undefined,
    };

    this.storage.appendRun(runStats);

    console.log(JSON.stringify({
      level: 'info',
      event: 'run_completed',
      runStats,
    }));

    return runStats;
  }
}
