import { withFallback, envOrNull } from '../mode';
import { isDemoMode } from '../../clock';
import { isAllowed, NotAllowlistedError } from './allowlist';
import { mockVoice } from './mock';
import { createRealVoice } from './real';

export type CallVariables = {
  student_first_name: string;
  university: string;
  unit: string;
  move_in_date: string;
  budget: string;
  documents: string;
  user_question: string;
  callback_email: string;
};

export type PlaceCallParams = { to: string; variables: CallVariables; callId: string };
export type PlaceCallResult = { externalId: string; mode: 'real' | 'mock' };

export interface VoiceService {
  placeCall(params: PlaceCallParams): Promise<PlaceCallResult>;
}

/**
 * Every real call goes through this guard: a number outside CALL_ALLOWLIST is refused before any
 * provider is touched. The guard sits outside the fallback, so a refusal never silently becomes a mock call.
 */
export function guardedVoice(inner: VoiceService, allowlist = envOrNull('CALL_ALLOWLIST')): VoiceService {
  return {
    async placeCall(params) {
      if (!isAllowed(params.to, allowlist)) throw new NotAllowlistedError(params.to);
      return inner.placeCall(params);
    },
  };
}

export function getVoice(): VoiceService {
  if (isDemoMode()) return mockVoice; // the mock never dials anyone
  return guardedVoice(withFallback('voice', createRealVoice(), mockVoice));
}

/** Whether Caller may phone this office (otherwise: email only). */
export function canCall(office: { phone?: string; callAllowed: boolean }): boolean {
  if (!office.callAllowed || !office.phone) return false;
  if (isDemoMode()) return true;
  return isAllowed(office.phone, envOrNull('CALL_ALLOWLIST'));
}
