import type { LlmService } from './index';

/** Canned outputs keyed by prompt id. Unknown ids get a short honest fallback. */
const CANNED: Record<string, string> = {
  default: "I don't have a live model in demo mode, so here's a short example answer.",
};

export const mockLlm: LlmService = {
  async complete({ promptId }) {
    return CANNED[promptId] ?? CANNED.default!;
  },
  async structured({ promptId, schema }) {
    // Mocks for structured prompts live next to the code that calls them; parse an empty object as last resort.
    const parsed = schema.safeParse({});
    if (parsed.success) return parsed.data;
    throw new Error(`mockLlm has no structured output for "${promptId}"`);
  },
};
