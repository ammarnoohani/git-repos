import { Repository } from '@github-discovery/shared';
import { GitHubClient } from '../github/client.js';
import { WindowPlanner, TimeWindow } from './planner.js';
import { mapGitHubSearchItemToRepository } from '../github/mapper.js';

export interface SearchDiscoveryResult {
  repositories: Repository[];
  processedWindows: Array<{ start: string; end: string }>;
  truncatedWindows: Array<{ start: string; end: string; count: number; recordedAt: string }>;
  failedWindows: Array<{ start: string; end: string; retries: number; error?: string }>;
  stoppedEarly: boolean;
  stopReason?: string;
}

export class WindowSearcher {
  private client: GitHubClient;
  private queryFilters: string;

  constructor(client: GitHubClient, queryFilters?: string) {
    this.client = client;
    this.queryFilters = queryFilters || process.env.DISCOVERY_QUERY_FILTERS || 'fork:false';
  }

  public async executeWindows(windows: TimeWindow[]): Promise<SearchDiscoveryResult> {
    const result: SearchDiscoveryResult = {
      repositories: [],
      processedWindows: [],
      truncatedWindows: [],
      failedWindows: [],
      stoppedEarly: false,
    };

    for (const win of windows) {
      if (this.client.shouldExitEarly()) {
        result.stoppedEarly = true;
        result.stopReason = 'Client budget or rate limit reached';
        // Add remaining windows to failed/pending
        result.failedWindows.push({
          start: win.start.toISOString(),
          end: win.end.toISOString(),
          retries: (win.retries || 0) + 1,
          error: 'Skipped due to early stop',
        });
        continue;
      }

      try {
        await this.processWindow(win, result);
        result.processedWindows.push({
          start: win.start.toISOString(),
          end: win.end.toISOString(),
        });
      } catch (err: unknown) {
        const errorMsg = (err as Error).message || String(err);
        result.failedWindows.push({
          start: win.start.toISOString(),
          end: win.end.toISOString(),
          retries: (win.retries || 0) + 1,
          error: errorMsg,
        });

        if (this.client.shouldExitEarly() || errorMsg.includes('Early exit')) {
          result.stoppedEarly = true;
          result.stopReason = errorMsg;
          break;
        }
      }
    }

    return result;
  }

  private async processWindow(win: TimeWindow, result: SearchDiscoveryResult): Promise<void> {
    const startIso = win.start.toISOString();
    const endIso = win.end.toISOString();
    const query = `created:${startIso}..${endIso} ${this.queryFilters}`.trim();

    // 1. Initial page call
    const firstPage = await this.client.searchRepositories(query, {
      page: 1,
      perPage: 100,
      sort: 'stars',
      order: 'desc',
    });

    const totalCount = firstPage.total_count;

    // 2. Check for 1000 limit split
    if (totalCount > 1000) {
      const split = WindowPlanner.bisectWindow(win);
      if (split) {
        const [left, right] = split;
        await this.processWindow(left, result);
        if (!this.client.shouldExitEarly()) {
          await this.processWindow(right, result);
        }
        return;
      }

      // Reached 1-second limit and still > 1000: mark truncated!
      result.truncatedWindows.push({
        start: startIso,
        end: endIso,
        count: totalCount,
        recordedAt: new Date().toISOString(),
      });
    }

    // Process first page items
    for (const item of firstPage.items) {
      result.repositories.push(mapGitHubSearchItemToRepository(item, 'search'));
    }

    // Paginate remaining items (up to page 10, i.e., 1000 max)
    const totalPages = Math.min(10, Math.ceil(totalCount / 100));

    for (let page = 2; page <= totalPages; page++) {
      if (this.client.shouldExitEarly()) {
        break;
      }

      const nextPage = await this.client.searchRepositories(query, {
        page,
        perPage: 100,
        sort: 'stars',
        order: 'desc',
      });

      for (const item of nextPage.items) {
        result.repositories.push(mapGitHubSearchItemToRepository(item, 'search'));
      }
    }
  }
}
