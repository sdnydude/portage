import { env } from './env.js';
import { createLogger } from './logger.js';

const logger = createLogger('email');

const RESEND_API = 'https://api.resend.com/emails';

function inviteHtml(appUrl: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;background:#F5F2ED;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#2D2A26;">
    <div style="max-width:520px;margin:0 auto;padding:40px 24px;">
      <h1 style="font-size:22px;margin:0 0 16px;">You're in the Portage beta 🎉</h1>
      <p style="font-size:15px;line-height:1.6;margin:0 0 24px;">
        You've been invited to test Portage — AI-powered inventory and
        multi-marketplace selling. Sign in with the Google account tied to this
        email and you're in.
      </p>
      <a href="${appUrl}"
         style="display:inline-block;background:#F77E2D;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 28px;border-radius:9999px;">
        Open Portage
      </a>
      <p style="font-size:13px;color:#8A857D;line-height:1.6;margin:28px 0 0;">
        As a beta tester you have unlimited scans and AI listings. Spot a bug or
        something confusing? Tap the <strong>Beta</strong> button on any screen
        to send it straight to us.
      </p>
    </div>
  </body>
</html>`;
}

/**
 * Send a beta-invite email via Resend. Throws on misconfiguration or a Resend
 * error — callers treat sending as best-effort and must not fail their own
 * operation when this rejects.
 */
export async function sendBetaInvite(email: string): Promise<void> {
  const apiKey = env().RESEND_API_KEY;
  const from = env().RESEND_FROM;
  const appUrl = env().APP_URL;
  if (!apiKey || !from || !appUrl) {
    throw new Error('RESEND_API_KEY, RESEND_FROM and APP_URL must be configured to send invites');
  }

  const response = await fetch(RESEND_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: "You're invited to the Portage beta",
      html: inviteHtml(appUrl),
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Resend send failed (${response.status}): ${detail.slice(0, 200)}`);
  }

  logger.info({ email }, 'Beta invite email sent');
}
