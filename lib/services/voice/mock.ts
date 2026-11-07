import type { OutboundCallParams, OutboundCallResult, RemoteCallSnapshot, VoiceService } from './index';

/** The mock never dials. Convex (convex/calls.ts) plays the seeded transcript line by line. */
export const mockVoice: VoiceService = {
  async placeCall({ callId }: OutboundCallParams): Promise<OutboundCallResult> {
    return { externalId: `mock-${callId}`, mode: 'mock' };
  },
  async getCall(): Promise<RemoteCallSnapshot> {
    return { status: 'ended', messages: [] };
  },
  async endCall(): Promise<void> {
    /* no-op */
  },
};
