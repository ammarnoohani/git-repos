import { Repository } from '@github-discovery/shared';

export interface EmailOptions {
  apiKey?: string;
  toEmail?: string;
  fromEmail?: string;
  fetchFn?: typeof fetch;
}

export class EmailNotifier {
  private apiKey?: string;
  private toEmail?: string;
  private fromEmail: string;
  private fetchFn: typeof fetch;

  constructor(options: EmailOptions = {}) {
    this.apiKey = options.apiKey || process.env.RESEND_API_KEY;
    this.toEmail = options.toEmail || process.env.NOTIFY_EMAIL;
    this.fromEmail = options.fromEmail || process.env.FROM_EMAIL || 'onboarding@resend.dev';
    this.fetchFn = options.fetchFn || globalThis.fetch;
  }

  public isConfigured(): boolean {
    return Boolean(this.apiKey && this.toEmail);
  }

  public async sendEmail(subject: string, html: string): Promise<boolean> {
    if (!this.isConfigured()) return false;

    try {
      const res = await this.fetchFn('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.fromEmail,
          to: [this.toEmail],
          subject,
          html,
        }),
      });

      return res.ok;
    } catch {
      return false;
    }
  }

  public formatDigestHtml(repos: Repository[], title = 'GitHub Discovery Digest'): string {
    const items = repos
      .map(
        (r) => `
        <div style="margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid #e5e7eb;">
          <h3 style="margin: 0 0 6px 0;">
            <a href="${r.htmlUrl}" style="color: #2563eb; text-decoration: none;">${escapeHtml(r.fullName)}</a>
          </h3>
          <p style="margin: 0 0 8px 0; color: #4b5563; font-size: 14px;">
            ${escapeHtml(r.description || 'No description provided')}
          </p>
          <div style="font-size: 12px; color: #6b7280;">
            ${r.language ? `<span>🏷️ ${escapeHtml(r.language)}</span> &bull; ` : ''}
            <span>⭐ ${r.stars}</span> &bull; 
            <span>🍴 ${r.forks}</span> &bull; 
            <span>Created: ${r.createdAt.substring(0, 10)}</span>
          </div>
        </div>
      `
      )
      .join('');

    return `
      <!DOCTYPE html>
      <html>
        <head><meta charset="utf-8"></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.5; color: #111827; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #111827; border-bottom: 2px solid #2563eb; padding-bottom: 8px;">${title}</h2>
          <p style="color: #4b5563; font-size: 14px;">Here are the top newly discovered open-source repositories from GitHub.</p>
          ${items}
          <p style="font-size: 12px; color: #9ca3af; margin-top: 30px;">
            Sent by GitHub Discovery Autonomous Worker.
          </p>
        </body>
      </html>
    `;
  }

  public async sendTestNotification(): Promise<boolean> {
    return this.sendEmail(
      'GitHub Discovery Test Notification',
      '<h2>GitHub Discovery Test</h2><p>Your email notification settings are configured and operational!</p>'
    );
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
