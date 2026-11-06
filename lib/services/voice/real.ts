import type { VoiceService } from './index';
import { envOrNull } from '../mode';

/**
 * ElevenLabs Agents + Twilio outbound call. Implemented in M11 after checking the current
 * ElevenLabs API docs. Returns null (→ mock) until configured.
 */
export function createRealVoice(): VoiceService | null {
  const key = envOrNull('ELEVENLABS_API_KEY');
  const agentId = envOrNull('ELEVENLABS_AGENT_ID');
  const phoneNumberId = envOrNull('ELEVENLABS_PHONE_NUMBER_ID');
  if (!key || !agentId || !phoneNumberId) return null;
  return {
    async placeCall() {
      throw new Error('Real voice not implemented yet (M11)');
    },
  };
}
