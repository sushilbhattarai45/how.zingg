import { withFallback, envOrNull } from '../mode';

export type OutboundEmail = {
  to: string;
  subject: string;
  body: string;
  threadId: string;
  html?: string;
  text?: string;
  campaign?: string;
};

export interface EmailService {
  send(email: OutboundEmail): Promise<{ messageId: string; mode: 'real' | 'mock' }>;
}

const EHULAK_BASE = 'https://api.ehulak.tech';

/** The mock never sends. Convex still writes the `emails` row for UI. */
export const mockEmail: EmailService = {
  async send({ threadId }) {
    return { messageId: `mock-${threadId}-${Math.random().toString(36).slice(2, 8)}`, mode: 'mock' };
  },
};

/** Ehulak HTTP API — https://ehulak.tech/docs */
export function createEhulakEmail(apiKey: string): EmailService {
  return {
    async send(email) {
      const text = email.text ?? email.body;
      const html = email.html ?? `<pre style="font-family:system-ui,sans-serif;white-space:pre-wrap">${escapeHtml(email.body)}</pre>`;
      const res = await fetch(`${EHULAK_BASE}/email/processEmail`, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: email.to,
          subject: email.subject,
          body: email.body,
          html,
          text,
          campaign: email.campaign ?? 'how.zingg',
        }),
      });
      if (!res.ok) {
        const errBody = await res.text().catch(() => '');
        throw new Error(`Ehulak ${res.status}: ${errBody || res.statusText}`);
      }
      await res.json().catch(() => ({}));
      return {
        messageId: `ehulak-${email.threadId}-${Date.now().toString(36)}`,
        mode: 'real' as const,
      };
    },
  };
}

function createRealEmail(): EmailService | null {
  const key = envOrNull('EHULAK_API_KEY');
  if (!key) return null;
  return createEhulakEmail(key);
}

/**
 * Notify path: send via Ehulak whenever the key is set (even if DEMO_MODE),
 * so hatchathon call mocks can still email the demo inboxes.
 */
export function getNotifyEmail(): EmailService {
  return createRealEmail() ?? mockEmail;
}

/** General email service — mock under DEMO_MODE or when key missing. */
export function getEmail(): EmailService {
  return withFallback('email', createRealEmail(), mockEmail);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
