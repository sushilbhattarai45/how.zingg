/**
 * Vapi outbound phone calls (create / get / end).
 * Docs: https://docs.vapi.ai/api-reference/calls/create
 *       https://docs.vapi.ai/api-reference/calls/get
 *       https://docs.vapi.ai/calls/call-listen
 *       https://docs.vapi.ai/calls/call-features
 */
import { envOrNull } from '../mode';
import type { OutboundCallParams, OutboundCallResult, RemoteCallSnapshot, VoiceService } from './index';

const VAPI_BASE = 'https://api.vapi.ai';

type VapiMessage = {
  role?: string;
  message?: string;
  content?: string;
  time?: number;
  secondsFromStart?: number;
};

type VapiRecording = {
  url?: string;
  monoUrl?: string;
  stereoUrl?: string;
  mono?: { combinedUrl?: string; url?: string };
  stereo?: { combinedUrl?: string; url?: string };
};

type VapiCall = {
  id: string;
  status?: string;
  messages?: VapiMessage[];
  monitor?: { listenUrl?: string; controlUrl?: string };
  artifact?: {
    messages?: VapiMessage[];
    recordingUrl?: string;
    stereoRecordingUrl?: string;
    recording?: string | VapiRecording;
    transcript?: string;
  };
  recordingUrl?: string;
  analysis?: {
    summary?: string;
    structuredData?: Record<string, unknown>;
  };
};

/** Pull any public-ish recording hint from the call object (often not playable in browsers). */
export function extractRecordingHint(call: VapiCall): string | undefined {
  const a = call.artifact;
  if (!a) return call.recordingUrl;
  if (typeof a.recordingUrl === 'string' && a.recordingUrl) return a.recordingUrl;
  if (typeof a.stereoRecordingUrl === 'string' && a.stereoRecordingUrl) return a.stereoRecordingUrl;
  if (typeof a.recording === 'string' && a.recording) return a.recording;
  if (a.recording && typeof a.recording === 'object') {
    const r = a.recording;
    return (
      r.url ??
      r.monoUrl ??
      r.stereoUrl ??
      r.mono?.combinedUrl ??
      r.mono?.url ??
      r.stereo?.combinedUrl ??
      r.stereo?.url
    );
  }
  return call.recordingUrl;
}

/**
 * Download the mono recording via Vapi's authenticated artifact endpoint.
 * Docs: GET /call/{id}/mono-recording → 302 to a short-lived signed URL.
 * Returns null if the recording is not ready yet (404).
 */
export async function downloadMonoRecording(
  apiKey: string,
  vapiCallId: string,
): Promise<{ blob: Blob; contentType: string } | null> {
  const res = await fetch(`${VAPI_BASE}/call/${vapiCallId}/mono-recording`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    redirect: 'follow',
  });
  if (res.status === 404 || res.status === 409 || res.status === 425) return null;
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Vapi mono-recording failed (${res.status}): ${body.slice(0, 300)}`);
  }
  const contentType = res.headers.get('content-type') ?? 'audio/wav';
  const blob = await res.blob();
  if (!blob.size) return null;
  return { blob, contentType };
}

function authHeaders(apiKey: string): HeadersInit {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
}

async function vapiFetch<T>(apiKey: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${VAPI_BASE}${path}`, {
    ...init,
    headers: { ...authHeaders(apiKey), ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Vapi ${init?.method ?? 'GET'} ${path} failed (${res.status}): ${body.slice(0, 400)}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Build the transient assistant used for every how.zingg Caller dial. */
export function buildCallerAssistant(params: OutboundCallParams) {
  return {
    name: 'how.zingg Caller',
    firstMessage: params.firstMessage,
    firstMessageMode: 'assistant-speaks-first' as const,
    maxDurationSeconds: params.maxDurationSeconds ?? 180,
    // Agent can hang up itself when done / refused / voicemail.
    endCallFunctionEnabled: true,
    endCallMessage: 'Thank you for your time. Goodbye.',
    endCallPhrases: [
      'goodbye',
      'good bye',
      'have a good day',
      'have a nice day',
      "that's all i needed",
      'thank you for your time',
    ],
    silenceTimeoutSeconds: 25,
    model: {
      provider: 'openai' as const,
      model: 'gpt-4o-mini',
      messages: [{ role: 'system' as const, content: params.systemPrompt }],
    },
    voice: {
      provider: 'vapi' as const,
      voiceId: 'Elliot',
    },
    monitorPlan: {
      listenEnabled: true,
      controlEnabled: true,
    },
    artifactPlan: {
      recordingEnabled: true,
    },
    analysisPlan: {
      structuredDataPlan: {
        enabled: true,
        schema: {
          type: 'object',
          properties: {
            rent: {
              type: 'string',
              description: 'Monthly rent for a 1 bedroom if they stated it; otherwise omit',
            },
            specials: {
              type: 'string',
              description: 'Current move-in specials if they stated any; otherwise omit',
            },
            noSSNOptions: {
              type: 'string',
              description:
                'Whether they accept applicants without a US SSN, and what they accept instead',
            },
            callbackMinutes: {
              type: 'number',
              description:
                'If the person asked to be called back later, minutes from now (1-60). Omit if they did not.',
            },
          },
        },
      },
    },
  };
}

export function createVapiVoice(): VoiceService | null {
  const apiKey = envOrNull('VAPI_API_KEY');
  const phoneNumberId = envOrNull('VAPI_PHONE_NUMBER_ID');
  if (!apiKey || !phoneNumberId) return null;

  return {
    async placeCall(params: OutboundCallParams): Promise<OutboundCallResult> {
      const call = await vapiFetch<VapiCall>(apiKey, '/call', {
        method: 'POST',
        body: JSON.stringify({
          phoneNumberId,
          customer: { number: params.to },
          assistant: buildCallerAssistant(params),
        }),
      });
      return {
        externalId: call.id,
        mode: 'real',
        listenUrl: call.monitor?.listenUrl,
        controlUrl: call.monitor?.controlUrl,
      };
    },

    async getCall(externalId: string): Promise<RemoteCallSnapshot> {
      const call = await vapiFetch<VapiCall>(apiKey, `/call/${externalId}`);
      const messages = call.artifact?.messages ?? call.messages ?? [];
      return {
        status: call.status ?? 'unknown',
        messages,
        recordingUrl: extractRecordingHint(call),
        structuredData: call.analysis?.structuredData,
        listenUrl: call.monitor?.listenUrl,
        controlUrl: call.monitor?.controlUrl,
      };
    },

    async endCall(controlUrl: string): Promise<void> {
      const res = await fetch(controlUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'end-call' }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        // Call may already have ended — treat "Not Active" as success.
        if (/not active/i.test(body)) return;
        throw new Error(`Vapi end-call failed (${res.status}): ${body.slice(0, 300)}`);
      }
    },
  };
}
