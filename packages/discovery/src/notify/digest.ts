import { Repository } from '@github-discovery/shared';
import { StorageManager } from '../storage/manager.js';
import { TelegramNotifier } from './telegram.js';
import { EmailNotifier } from './email.js';

export type DigestFrequency = 'hourly' | '6hourly' | 'daily';

export class DigestManager {
  private storage: StorageManager;
  private telegram: TelegramNotifier;
  private email: EmailNotifier;

  constructor(
    storage: StorageManager,
    telegram?: TelegramNotifier,
    email?: EmailNotifier
  ) {
    this.storage = storage;
    this.telegram = telegram || new TelegramNotifier();
    this.email = email || new EmailNotifier();
  }

  /**
   * Checks if a digest of the specified frequency is currently due.
   */
  public isDigestDue(frequency: DigestFrequency, lastDigestIso?: string, now: Date = new Date()): boolean {
    if (!lastDigestIso) {
      return true;
    }

    const lastTime = new Date(lastDigestIso).getTime();
    const elapsedHours = (now.getTime() - lastTime) / (1000 * 60 * 60);

    switch (frequency) {
      case 'hourly':
        return elapsedHours >= 1;
      case '6hourly':
        return elapsedHours >= 6;
      case 'daily':
      default:
        return elapsedHours >= 24;
    }
  }

  /**
   * Runs the scheduled digest job if due.
   */
  public async runDigest(
    targetFrequency?: DigestFrequency,
    topN = 10
  ): Promise<{ sent: boolean; reason?: string; repoCount: number }> {
    const frequency = (targetFrequency || process.env.DIGEST_FREQUENCY || 'daily') as DigestFrequency;
    const notifiedState = this.storage.loadNotified();
    const now = new Date();
    const nowIso = now.toISOString();

    const lastDigestTelegram = notifiedState.channels.telegram?.lastDigestAt?.[frequency];
    const lastDigestEmail = notifiedState.channels.email?.lastDigestAt?.[frequency];

    const tgDue = this.telegram.isConfigured() && this.isDigestDue(frequency, lastDigestTelegram, now);
    const emDue = this.email.isConfigured() && this.isDigestDue(frequency, lastDigestEmail, now);

    if (!tgDue && !emDue) {
      return { sent: false, reason: 'Digest not due yet or no channels configured', repoCount: 0 };
    }

    // Load recent repositories from manifest and today/yesterday shards
    const manifest = this.storage.loadManifest();
    const candidateRepos: Repository[] = [];

    // Read top recent shards
    for (const shard of manifest.shards.slice(0, 2)) {
      const repos = this.storage.loadShard(shard.date);
      candidateRepos.push(...repos);
    }

    if (candidateRepos.length === 0) {
      return { sent: false, reason: 'No repositories discovered to include in digest', repoCount: 0 };
    }

    // Sort by score
    candidateRepos.sort((a, b) => (b.score || 0) - (a.score || 0) || b.stars - a.stars);
    const topRepos = candidateRepos.slice(0, topN);

    let sentAny = false;

    // Send Telegram Digest
    if (tgDue) {
      try {
        const title = `📰 <b>GitHub Discovery ${frequency.toUpperCase()} Digest</b>\nTop ${topRepos.length} trending new projects:`;
        const lines = topRepos.map((r, i) => `${i + 1}. <a href="${r.htmlUrl}"><b>${r.fullName}</b></a> (⭐ ${r.stars}${r.language ? `, ${r.language}` : ''})\n<i>${(r.description || 'No description').substring(0, 80)}</i>`);
        const message = `${title}\n\n${lines.join('\n\n')}`;
        const ok = await this.telegram.sendMessage(message);
        if (ok) {
          sentAny = true;
          if (!notifiedState.channels.telegram) notifiedState.channels.telegram = { notifiedIds: {}, lastDigestAt: {} };
          if (!notifiedState.channels.telegram.lastDigestAt) notifiedState.channels.telegram.lastDigestAt = {};
          notifiedState.channels.telegram.lastDigestAt[frequency] = nowIso;
        }
      } catch {
        // Isolate
      }
    }

    // Send Email Digest
    if (emDue) {
      try {
        const html = this.email.formatDigestHtml(topRepos, `GitHub Discovery: ${frequency.toUpperCase()} Digest`);
        const ok = await this.email.sendEmail(`GitHub Discovery ${frequency.toUpperCase()} Digest`, html);
        if (ok) {
          sentAny = true;
          if (!notifiedState.channels.email) notifiedState.channels.email = { notifiedIds: {}, lastDigestAt: {} };
          if (!notifiedState.channels.email.lastDigestAt) notifiedState.channels.email.lastDigestAt = {};
          notifiedState.channels.email.lastDigestAt[frequency] = nowIso;
        }
      } catch {
        // Isolate
      }
    }

    if (sentAny) {
      this.storage.saveNotified(notifiedState);
    }

    return { sent: sentAny, repoCount: topRepos.length };
  }
}
