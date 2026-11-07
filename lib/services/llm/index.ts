import type { z } from 'zod';
import { withFallback } from '../mode';
import { mockLlm } from './mock';
import { createRealLlm } from './real';
import { createGeminiLlm } from './gemini';

export type LlmTier = 'agent' | 'fast';

export interface LlmService {
  /** Plain completion. `promptId` keys the mock's canned output. */
  complete(args: { promptId: string; system?: string; prompt: string; tier?: LlmTier }): Promise<string>;
  /** Structured output validated by a zod schema. */
  structured<T>(args: {
    promptId: string;
    system?: string;
    prompt: string;
    schema: z.ZodType<T>;
    tier?: LlmTier;
  }): Promise<T>;
}

/**
 * Prefer Gemini whenever GEMINI_API_KEY is set — even under DEMO_MODE —
 * so chat/doc scrape work while voice can stay mocked.
 */
export function getLlm(): LlmService {
  const gemini = createGeminiLlm();
  if (gemini) return gemini;
  return withFallback('llm', createRealLlm(), mockLlm);
}
