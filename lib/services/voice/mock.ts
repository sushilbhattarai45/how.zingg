import type { VoiceService } from './index';

/** The mock never dials. Convex (convex/calls.ts) plays the seeded transcript line by line. */
export const mockVoice: VoiceService = {
  async placeCall({ callId }) {
    return { externalId: `mock-${callId}`, mode: 'mock' };
  },
};
