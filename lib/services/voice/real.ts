import type { VoiceService } from './index';
import { createVapiVoice } from './vapi';

/**
 * Real outbound voice: Vapi (phone + STT + LLM + TTS).
 * Returns null when VAPI_API_KEY / VAPI_PHONE_NUMBER_ID are missing → mock fallback.
 */
export function createRealVoice(): VoiceService | null {
  return createVapiVoice();
}
