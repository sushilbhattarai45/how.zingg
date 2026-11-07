import { generateText, generateObject } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import type { LlmService } from './index';
import { envOrNull } from '../mode';
import { createGeminiLlm } from './gemini';

/** Prefer Gemini when configured; otherwise Anthropic. */
export function createRealLlm(): LlmService | null {
  const gemini = createGeminiLlm();
  if (gemini) return gemini;

  const apiKey = envOrNull('ANTHROPIC_API_KEY');
  if (!apiKey) return null;
  const anthropic = createAnthropic({ apiKey });
  const model = (tier: 'agent' | 'fast' = 'agent') =>
    anthropic(
      tier === 'fast'
        ? (envOrNull('FAST_MODEL') ?? 'claude-haiku-5-5')
        : (envOrNull('AGENT_MODEL') ?? 'claude-sonnet-5-5'),
    );
  return {
    async complete({ system, prompt, tier }) {
      const { text } = await generateText({ model: model(tier), system, prompt });
      return text;
    },
    async structured({ system, prompt, schema, tier }) {
      const { object } = await generateObject({ model: model(tier), system, prompt, schema });
      return object;
    },
  };
}
