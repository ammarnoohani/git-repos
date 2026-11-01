import { Repository } from '@github-discovery/shared';
import { GitHubClient } from './client.js';
import { GitHubPublicRepoItem } from './types.js';
import { mapEnrichedItemToRepository } from './mapper.js';

export interface SecondaryScanResult {
  repositories: Repository[];
  newCursor: number | null;
  itemsScanned: number;
  itemsEnriched: number;
}

export class PublicReposScanner {
  private client: GitHubClient;
  private enrichLimit: number;

  constructor(client: GitHubClient, enrichLimit?: number) {
    this.client = client;
    this.enrichLimit = enrichLimit ?? (parseInt(process.env.ENRICH_PER_RUN || '10', 10));
  }

  /**
   * Scans forward from cursor using GET /repositories?since={id}.
   * Only enriches up to enrichLimit repositories using GET /repos/{owner}/{repo}.
   */
  public async scan(
    currentCursor: number | null,
    fallbackBaselineId?: number
  ): Promise<SecondaryScanResult> {
    const result: SecondaryScanResult = {
      repositories: [],
      newCursor: currentCursor,
      itemsScanned: 0,
      itemsEnriched: 0,
    };

    let startCursor = currentCursor;

    // If cursor is unknown, use fallback baseline from primary search or probe
    if (!startCursor || startCursor <= 0) {
      if (fallbackBaselineId && fallbackBaselineId > 0) {
        startCursor = fallbackBaselineId;
      } else {
        // Probe via a quick search to discover a recent ID
        try {
          const probe = await this.client.searchRepositories('stars:>=0 fork:false', {
            page: 1,
            perPage: 1,
            sort: 'updated',
            order: 'desc',
          });
          if (probe.items.length > 0) {
            // Start cursor slightly before the probe item ID (e.g. - 1000)
            startCursor = Math.max(1, probe.items[0].id - 500);
          }
        } catch {
          // If probe fails, do not proceed with blind backfill
          return result;
        }
      }
    }

    if (!startCursor || this.client.shouldExitEarly()) {
      return result;
    }

    try {
      const publicItems: GitHubPublicRepoItem[] = await this.client.listPublicRepositories({
        since: startCursor,
      });

      result.itemsScanned = publicItems.length;

      if (publicItems.length === 0) {
        return result;
      }

      // Update cursor to highest ID seen in the batch
      const maxId = Math.max(...publicItems.map((item) => item.id));
      result.newCursor = maxId;

      // Filter out forks if default filter applies
      const candidates = publicItems.filter((item) => !item.fork);

      // Bounded enrichment: take at most enrichLimit candidates
      const toEnrich = candidates.slice(0, this.enrichLimit);

      for (const item of toEnrich) {
        if (this.client.shouldExitEarly()) {
          break;
        }

        try {
          const detail = await this.client.getRepository(item.owner.login, item.name);
          const repo = mapEnrichedItemToRepository(item, detail);
          result.repositories.push(repo);
          result.itemsEnriched++;
        } catch {
          // Skip individual failed enrichments without aborting scan
        }
      }
    } catch {
      // Return whatever was collected so far
    }

    return result;
  }
}
