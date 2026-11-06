import { withFallback, envOrNull } from '../mode';

export type OutboundEmail = { to: string; subject: string; body: string; threadId: string };

export interface EmailService {
  send(email: OutboundEmail): Promise<{ messageId: string; mode: 'real' | 'mock' }>;
}

/** The mock never sends. Convex writes the `emails` row and simulates the office reply. */
export const mockEmail: EmailService = {
  async send({ threadId }) {
    return { messageId: `mock-${threadId}-${Math.random().toString(36).slice(2, 8)}`, mode: 'mock' };
  },
};

/** Postmark. Wired in M11 after checking current docs, and only to our own inbox (ask first). */
function createRealEmail(): EmailService | null {
  if (!envOrNull('POSTMARK_SERVER_TOKEN') || !envOrNull('POSTMARK_FROM')) return null;
  return null;
}

export function getEmail(): EmailService {
  return withFallback('email', createRealEmail(), mockEmail);
}
