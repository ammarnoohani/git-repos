import { Repository, DEFAULT_NOTIFY_MAX_PER_RUN } from '@github-discovery/shared';
import { StorageManager } from '../storage/manager.js';
import { TelegramNotifier } from './telegram.js';
import { EmailNotifier } from './email.js';

export interface DispatcherOptions {
  maxPerRun?: number;
  minStars?: number;
  languages?: string[];
  keywords?: string[];
}

export class NotificationDispatcher {
  private storage: StorageManager;
  private telegram: TelegramNotifier;
  private email: EmailNotifier;
  private maxPerRun: number;
  private minStars: number;
  private languages: string[];
  private keywords: string[];

  constructor(
    storage: StorageManager,
    telegram?: TelegramNotifier,
    email?: EmailNotifier,
    options: DispatcherOptions = {}
  ) {
    this.storage = storage;
    this.telegram = telegram || new TelegramNotifier();
    this.email = email || new EmailNotifier();
    this.maxPerRun = options.maxPerRun ?? (parseInt(process.env.NOTIFY_MAX_PER_RUN || String(DEFAULT_NOTIFY_MAX_PER_RUN), 10));
    this.minStars = options.minStars ?? (parseInt(process.env.NOTIFY_MIN_STARS || '0', 10));

    const langsEnv = process.env.NOTIFY_LANGUAGES;
    this.languages = options.languages || (langsEnv ? langsEnv.split(',').map((s) => s.trim().toLowerCase()) : []);

    const kwEnv = process.env.NOTIFY_KEYWORDS;
    this.keywords = options.keywords || (kwEnv ? kwEnv.split(',').map((s) => s.trim().toLowerCase()) : []);
  }

  /**
   * Applies optional user-configured notification filters.
   */
  private passesFilters(repo: Repository): boolean {
    if (repo.stars < this.minStars) {
      return false;
    }

    if (this.languages.length > 0) {
      if (!repo.language || !this.languages.includes(repo.language.toLowerCase())) {
        return false;
      }
    }

    if (this.keywords.length > 0) {
      const textToSearch = `${repo.name} ${repo.description || ''} ${repo.topics.join(' ')}`.toLowerCase();
      const hasKeyword = this.keywords.some((kw) => textToSearch.includes(kw));
      if (!hasKeyword) {
        return false;
      }
    }

    return true;
  }

  /**
   * Dispatches immediate notifications for newly discovered repositories.
   * Completely isolated: never throws or disrupts discovery.
   */
  public async dispatchImmediate(repositories: Repository[]): Promise<{ notifiedCount: number }> {
    if (repositories.length === 0) {
      return { notifiedCount: 0 };
    }

    if (!this.telegram.isConfigured() && !this.email.isConfigured()) {
      return { notifiedCount: 0 };
    }

    let notifiedState = this.storage.loadNotified();
    const nowIso = new Date().toISOString();
    let totalNotified = 0;

    // Filter candidate repositories
    const candidates = repositories.filter((r) => this.passesFilters(r));

    // Sort by quality score descending
    candidates.sort((a, b) => (b.score || 0) - (a.score || 0) || b.stars - a.stars);

    // --- 1. Telegram Dispatch ---
    if (this.telegram.isConfigured()) {
      try {
        const tgNotified = notifiedState.channels.telegram?.notifiedIds || {};
        const unnotified = candidates.filter((r) => !tgNotified[String(r.id)]);

        const topN = unnotified.slice(0, this.maxPerRun);
        const remainderCount = unnotified.length - topN.length;

        for (const repo of topN) {
          const msg = this.telegram.formatRepositoryMessage(repo);
          const sent = await this.telegram.sendMessage(msg);
          if (sent) {
            tgNotified[String(repo.id)] = nowIso;
            totalNotified++;
          }
          // Delay to respect ~1 msg/sec limit
          await new Promise((r) => setTimeout(r, 1100));
        }

        if (remainderCount > 0 && topN.length > 0) {
          const summary = `<i>+${remainderCount} more repositories discovered in this cycle. Visit the site to explore all.</i>`;
          await this.telegram.sendMessage(summary);
        }

        if (!notifiedState.channels.telegram) {
          notifiedState.channels.telegram = { notifiedIds: {}, lastDigestAt: {} };
        }
        notifiedState.channels.telegram.notifiedIds = tgNotified;
      } catch {
        // Log & isolate
      }
    }

    // --- 2. Email Dispatch ---
    if (this.email.isConfigured()) {
      try {
        const emailNotified = notifiedState.channels.email?.notifiedIds || {};
        const unnotified = candidates.filter((r) => !emailNotified[String(r.id)]);

        const topN = unnotified.slice(0, this.maxPerRun);

        if (topN.length > 0) {
          const html = this.email.formatDigestHtml(topN, 'GitHub Discovery: New Projects Found');
          const sent = await this.email.sendEmail('GitHub Discovery: New Projects Found', html);
          if (sent) {
            for (const repo of topN) {
              emailNotified[String(repo.id)] = nowIso;
            }
          }
        }

        if (!notifiedState.channels.email) {
          notifiedState.channels.email = { notifiedIds: {}, lastDigestAt: {} };
        }
        notifiedState.channels.email.notifiedIds = emailNotified;
      } catch {
        // Log & isolate
      }
    }

    // Persist notified IDs
    this.storage.saveNotified(notifiedState);

    return { notifiedCount: totalNotified };
  }

  public async runTestNotification(): Promise<boolean> {
    let success = false;
    if (this.telegram.isConfigured()) {
      const tgRes = await this.telegram.sendTestNotification();
      if (tgRes) success = true;
    }
    if (this.email.isConfigured()) {
      const emRes = await this.email.sendTestNotification();
      if (emRes) success = true;
    }
    return success;
  }
}

