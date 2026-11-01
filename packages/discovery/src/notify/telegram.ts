import { Repository } from '@github-discovery/shared';

export interface TelegramOptions {
  botToken?: string;
  chatId?: string;
  fetchFn?: typeof fetch;
}

export class TelegramNotifier {
  private botToken?: string;
  private chatId?: string;
  private fetchFn: typeof fetch;

  constructor(options: TelegramOptions = {}) {
    this.botToken = options.botToken || process.env.TELEGRAM_BOT_TOKEN;
    this.chatId = options.chatId || process.env.TELEGRAM_CHAT_ID;
    this.fetchFn = options.fetchFn || globalThis.fetch;
  }

  public isConfigured(): boolean {
    return Boolean(this.botToken && this.chatId);
  }

  public async sendMessage(text: string): Promise<boolean> {
    if (!this.isConfigured()) return false;

    const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
    const payload = {
      chat_id: this.chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    };

    try {
      const res = await this.fetchFn(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        return true;
      }

      if (res.status === 429) {
        const body = (await res.json()) as { parameters?: { retry_after?: number } };
        const waitSec = body?.parameters?.retry_after || 2;
        await new Promise((r) => setTimeout(r, waitSec * 1000));
        // Retry once after waiting
        const retryRes = await this.fetchFn(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        return retryRes.ok;
      }

      return false;
    } catch {
      return false;
    }
  }

  public formatRepositoryMessage(repo: Repository): string {
    const stars = repo.stars ? `⭐ ${repo.stars}` : '';
    const forks = repo.forks ? `🍴 ${repo.forks}` : '';
    const lang = repo.language ? `🏷️ ${escapeHtml(repo.language)}` : '';
    const desc = repo.description ? escapeHtml(repo.description) : '<i>No description provided</i>';
    const metrics = [stars, forks, lang].filter(Boolean).join(' | ');

    return `🚀 <b><a href="${repo.htmlUrl}">${escapeHtml(repo.fullName)}</a></b>
${desc}

${metrics ? `${metrics}\n` : ''}👤 Owner: ${escapeHtml(repo.owner.login)}
📅 Created: ${repo.createdAt.substring(0, 10)}`;
  }

  public async sendTestNotification(): Promise<boolean> {
    const message = `🧪 <b>GitHub Discovery Test Notification</b>\n\nYour Telegram integration is configured correctly and ready to receive updates!`;
    return this.sendMessage(message);
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

