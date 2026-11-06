import type { z } from 'zod';
import { withFallback } from '../mode';
import { mockLlm } from './mock';
import { createRealLlm } from './real';

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

export function getLlm(): LlmService {
  return withFallback('llm', createRealLlm(), mockLlm);
}
