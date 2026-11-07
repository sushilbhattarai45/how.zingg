import { generateText, generateObject } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import type { LlmService, LlmTier } from './index';
import { envOrNull } from '../mode';

export function geminiApiKey(): string | null {
  return envOrNull('GEMINI_API_KEY') ?? envOrNull('GOOGLE_GENERATIVE_AI_API_KEY');
}

/**
 * Current Flash ids — gemini-2.0-flash / 2.5-flash return 404 for new API keys.
 * Override with GEMINI_MODEL / GEMINI_FAST_MODEL if needed.
 */
const DEFAULT_MODELS = ['gemini-3.8-flash', 'gemini-flash-latest'] as const;

function configuredModels(tier: LlmTier = 'agent'): string[] {
  const preferred =
    tier === 'fast'
      ? envOrNull('GEMINI_FAST_MODEL') ?? envOrNull('GEMINI_MODEL')
      : envOrNull('GEMINI_MODEL');
  const list = preferred ? [preferred, ...DEFAULT_MODELS] : [...DEFAULT_MODELS];
  return [...new Set(list)];
}

function geminiModelId(tier: LlmTier = 'agent'): string {
  return configuredModels(tier)[0]!;
}

export function createGeminiLlm(): LlmService | null {
  const apiKey = geminiApiKey();
  if (!apiKey) return null;
  const google = createGoogleGenerativeAI({ apiKey });
  const model = (tier: LlmTier = 'agent') => google(geminiModelId(tier));

  return {
    async complete({ system, prompt, tier }) {
      let lastErr: unknown;
      for (const id of configuredModels(tier)) {
        try {
          const { text } = await generateText({
            model: google(id),
            system,
            prompt,
          });
          return text;
        } catch (err) {
          lastErr = err;
          console.warn(`[gemini] complete failed on ${id}`, err);
        }
      }
      throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
    },
    async structured({ system, prompt, schema, tier }) {
      const { object } = await generateObject({
        model: model(tier),
        system,
        prompt,
        schema,
      });
      return object;
    },
  };
}

function resolveMediaType(fileName: string | undefined, mediaType: string): string {
  if (mediaType.startsWith('image/') || mediaType === 'application/pdf' || mediaType.startsWith('text/')) {
    return mediaType;
  }
  if (/\.pdf$/i.test(fileName ?? '') || mediaType.includes('pdf')) return 'application/pdf';
  if (/\.png$/i.test(fileName ?? '')) return 'image/png';
  if (/\.jpe?g$/i.test(fileName ?? '')) return 'image/jpeg';
  if (/\.webp$/i.test(fileName ?? '')) return 'image/webp';
  if (/\.(txt|md|csv)$/i.test(fileName ?? '')) return 'text/plain';
  return mediaType || 'application/octet-stream';
}

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}

/** Direct Generative Language API call (bypasses AI SDK quirks for PDF/image). */
async function googleGenerateContent(args: {
  apiKey: string;
  model: string;
  system: string;
  prompt: string;
  inline?: { mimeType: string; dataBase64: string };
}): Promise<string> {
  const parts: Array<Record<string, unknown>> = [{ text: args.prompt }];
  if (args.inline) {
    parts.push({
      inline_data: {
        mime_type: args.inline.mimeType,
        data: args.inline.dataBase64,
      },
    });
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(args.model)}:generateContent?key=${encodeURIComponent(args.apiKey)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: args.system }] },
      contents: [{ role: 'user', parts }],
    }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    error?: { message?: string };
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  if (!res.ok) {
    throw new Error(json.error?.message || `Gemini HTTP ${res.status}`);
  }
  const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('\n').trim();
  if (!text) throw new Error('Gemini returned an empty response');
  return text;
}

/**
 * Multimodal complete for office docs (PDF / image).
 * Uses Google REST with model fallbacks — AI Studio keys reject retired model ids.
 */
export async function geminiReadDocument(args: {
  system: string;
  prompt: string;
  bytes?: Uint8Array;
  mediaType?: string;
  fileName?: string;
  tier?: LlmTier;
}): Promise<string> {
  const apiKey = geminiApiKey();
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const mediaType = resolveMediaType(args.fileName, args.mediaType || 'application/octet-stream');
  const canAttach =
    !!args.bytes &&
    args.bytes.byteLength > 0 &&
    args.bytes.byteLength < 15 * 1024 * 1024 &&
    (mediaType.startsWith('image/') || mediaType === 'application/pdf' || mediaType === 'text/plain');

  const inline =
    canAttach && args.bytes
      ? { mimeType: mediaType, dataBase64: bytesToBase64(args.bytes) }
      : undefined;

  let lastErr: unknown;
  for (const model of configuredModels(args.tier ?? 'agent')) {
    try {
      return await googleGenerateContent({
        apiKey,
        model,
        system: args.system,
        prompt: args.prompt,
        inline,
      });
    } catch (err) {
      lastErr = err;
      console.warn(`[geminiReadDocument] ${model} failed:`, err);
    }
  }

  // Last resort: text-only via AI SDK (no file).
  try {
    const google = createGoogleGenerativeAI({ apiKey });
    const { text } = await generateText({
      model: google(geminiModelId(args.tier ?? 'agent')),
      system: args.system,
      prompt: `${args.prompt}\n\n(Note: binary file could not be attached; answer only from any text provided above.)`,
    });
    if (text?.trim()) return text;
  } catch (err) {
    lastErr = err;
  }

  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}
