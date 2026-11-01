import { RateLimitInfo, GitHubSearchResponse, GitHubPublicRepoItem, GitHubSearchItem } from './types.js';

export interface GitHubClientOptions {
  token?: string;
  baseUrl?: string;
  maxRequestsPerRun?: number;
  runTimeBudgetSeconds?: number;
  minRemainingRateLimit?: number;
  maxRetries?: number;
  initialBackoffMs?: number;
  fetchFn?: typeof fetch;
}

export class GitHubClient {
  private token?: string;
  private baseUrl: string;
  private maxRequestsPerRun: number;
  private runTimeBudgetSeconds: number;
  private minRemainingRateLimit: number;
  private maxRetries: number;
  private initialBackoffMs: number;
  private fetchFn: typeof fetch;

  private requestCount = 0;
  private startTime: number;
  private rateLimitInfo: RateLimitInfo | null = null;

  constructor(options: GitHubClientOptions = {}) {
    this.token = options.token || process.env.GH_API_TOKEN || process.env.GITHUB_TOKEN;
    this.baseUrl = (options.baseUrl || 'https://api.github.com').replace(/\/$/, '');
    this.maxRequestsPerRun = options.maxRequestsPerRun ?? (parseInt(process.env.MAX_REQUESTS_PER_RUN || '50', 10));
    this.runTimeBudgetSeconds = options.runTimeBudgetSeconds ?? (parseInt(process.env.RUN_TIME_BUDGET_SECONDS || '480', 10));
    this.minRemainingRateLimit = options.minRemainingRateLimit ?? 2;
    this.maxRetries = options.maxRetries ?? 3;
    this.initialBackoffMs = options.initialBackoffMs ?? 1000;
    this.fetchFn = options.fetchFn || globalThis.fetch;
    this.startTime = Date.now();
  }

  public getRequestCount(): number {
    return this.requestCount;
  }

  public getRateLimitInfo(): RateLimitInfo | null {
    return this.rateLimitInfo ? { ...this.rateLimitInfo } : null;
  }

  public getElapsedTimeSeconds(): number {
    return (Date.now() - this.startTime) / 1000;
  }

  public shouldExitEarly(): boolean {
    const elapsed = this.getElapsedTimeSeconds();
    if (elapsed >= this.runTimeBudgetSeconds - 10) {
      return true;
    }
    if (this.requestCount >= this.maxRequestsPerRun) {
      return true;
    }
    if (this.rateLimitInfo && this.rateLimitInfo.remaining <= this.minRemainingRateLimit) {
      return true;
    }
    return false;
  }

  private extractRateLimits(headers: Headers): void {
    const limit = headers.get('x-ratelimit-limit');
    const remaining = headers.get('x-ratelimit-remaining');
    const reset = headers.get('x-ratelimit-reset');
    const used = headers.get('x-ratelimit-used');

    if (limit && remaining && reset) {
      this.rateLimitInfo = {
        limit: parseInt(limit, 10),
        remaining: parseInt(remaining, 10),
        reset: parseInt(reset, 10),
        used: used ? parseInt(used, 10) : 0,
      };
    }
  }

  public async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    if (this.shouldExitEarly()) {
      throw new Error(`Early exit triggered: rate-limit or budget exhausted (requests: ${this.requestCount}/${this.maxRequestsPerRun}, remaining: ${this.rateLimitInfo?.remaining})`);
    }

    const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'github-discovery-engine/1.0',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.headers as Record<string, string> || {}),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    let attempt = 0;

    while (attempt <= this.maxRetries) {
      attempt++;
      this.requestCount++;

      try {
        const response = await this.fetchFn(url, {
          ...options,
          headers,
        });

        this.extractRateLimits(response.headers);

        if (response.ok) {
          return (await response.json()) as T;
        }

        const status = response.status;
        const retryAfterHeader = response.headers.get('retry-after');
        let retryAfterMs = retryAfterHeader ? parseInt(retryAfterHeader, 10) * 1000 : 0;

        let errorBodyText = '';
        try {
          errorBodyText = await response.text();
        } catch {
          // ignore
        }

        const isSecondaryRateLimit = status === 403 && (
          errorBodyText.toLowerCase().includes('secondary rate limit') ||
          errorBodyText.toLowerCase().includes('rate limit exceeded')
        );

        const isRateLimitExceeded = status === 429 || isSecondaryRateLimit;
        const isServerError = status >= 500 && status < 600;

        if ((isRateLimitExceeded || isServerError) && attempt <= this.maxRetries) {
          if (!retryAfterMs) {
            // Exponential backoff with jitter
            const backoff = this.initialBackoffMs * Math.pow(2, attempt - 1);
            const jitter = Math.floor(Math.random() * (backoff * 0.3));
            retryAfterMs = backoff + jitter;
          }

          // If remaining time budget is insufficient for backoff wait, stop
          if (this.getElapsedTimeSeconds() + (retryAfterMs / 1000) > this.runTimeBudgetSeconds) {
            throw new Error(`Rate limit or server error (${status}), insufficient time budget to retry after ${retryAfterMs}ms: ${errorBodyText}`);
          }

          await new Promise((resolve) => setTimeout(resolve, retryAfterMs));
          continue;
        }

        throw new Error(`GitHub API HTTP ${status} on ${endpoint}: ${errorBodyText || response.statusText}`);
      } catch (err: unknown) {
        if (attempt <= this.maxRetries && (err instanceof TypeError || (err as Error).message?.includes('fetch failed'))) {
          // Network error, back off and retry
          const backoff = this.initialBackoffMs * Math.pow(2, attempt - 1);
          await new Promise((resolve) => setTimeout(resolve, backoff));
          continue;
        }
        throw err;
      }
    }

    throw new Error(`Failed request to ${endpoint} after ${this.maxRetries} retries`);
  }

  public async searchRepositories(
    query: string,
    options: { page?: number; perPage?: number; sort?: string; order?: 'asc' | 'desc' } = {}
  ): Promise<GitHubSearchResponse> {
    const params = new URLSearchParams();
    params.set('q', query);
    if (options.page) params.set('page', options.page.toString());
    if (options.perPage) params.set('per_page', options.perPage.toString());
    if (options.sort) params.set('sort', options.sort);
    if (options.order) params.set('order', options.order);

    return this.request<GitHubSearchResponse>(`/search/repositories?${params.toString()}`);
  }

  public async listPublicRepositories(options: { since?: number } = {}): Promise<GitHubPublicRepoItem[]> {
    const params = new URLSearchParams();
    if (options.since !== undefined) {
      params.set('since', options.since.toString());
    }
    return this.request<GitHubPublicRepoItem[]>(`/repositories?${params.toString()}`);
  }

  public async getRepository(owner: string, repo: string): Promise<GitHubSearchItem> {
    return this.request<GitHubSearchItem>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);
  }
}
