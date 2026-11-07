'use node';

/**
 * After a call ends: Gemini bullet notes → chat + patch answers, then emails.
 */
import { v } from 'convex/values';
import { internalAction } from './_generated/server';
import { internal } from './_generated/api';
import { collectCallFacts, formatCallNotesChat, isMissedCall } from '../lib/callFacts';
import {
  callSummaryPrompt,
  callSummarySystem,
  parseCallSummaryBullets,
} from '../lib/callSummarize';
import { getLlm } from '../lib/services/llm';

export const summarizeEndedCall = internalAction({
  args: { callId: v.id('calls') },
  handler: async (ctx, { callId }) => {
    // Refresh late Vapi transcript/answers, then summarize.
    let info = await ctx.runQuery(internal.notify.getCallNotifyContext, { callId });
    if (!info) return;

    if (info.status === 'done') {
      try {
        await ctx.runAction(internal.calls.refreshEndedCallArtifact, { callId });
      } catch (err) {
        console.warn('[callSummarize] refresh before summarize', err);
      }
      info = (await ctx.runQuery(internal.notify.getCallNotifyContext, { callId })) ?? info;
    }

    const row = {
      status: info.status,
      transcript: info.transcript ?? [],
      answers: info.answers,
      error: info.error,
      questions: info.questions ?? [],
    };
    const missed = isMissedCall(row) || info.status === 'failed';

    let facts = missed ? [] : collectCallFacts(row);
    let notesPatch: string | undefined;

    if (!missed && (info.transcript?.length ?? 0) > 0) {
      try {
        const system = callSummarySystem(info.placeTitle, info.questions ?? []);
        const prompt = callSummaryPrompt(info.transcript ?? []);
        const text = await getLlm().complete({
          promptId: 'call-summary',
          system,
          prompt,
          tier: 'fast',
        });
        const bullets = parseCallSummaryBullets(text);
        if (bullets.length > 0) {
          notesPatch = bullets.map((b) => `- ${b}`).join('\n');
          facts = collectCallFacts({
            ...row,
            answers: {
              ...(row.answers ?? {}),
              notes: [row.answers?.notes, notesPatch].filter(Boolean).join('\n'),
            },
          });
        }
      } catch (err) {
        console.warn('[callSummarize.summarizeEndedCall]', err);
      }
    }

    if (notesPatch) {
      await ctx.runMutation(internal.calls.patchCall, {
        callId,
        answers: {
          ...(info.answers ?? {}),
          notes: [info.answers?.notes, notesPatch].filter(Boolean).join('\n'),
        },
      });
    }

    const noteText = missed
      ? "Missed call — nobody picked up. I can try again or schedule a callback whenever you want."
      : formatCallNotesChat(facts);

    // Same id as hist-note rebuild so Workspace merge keeps one bubble.
    await ctx.runMutation(internal.notify.appendAgentNote, {
      userId: info.userId,
      placeSlug: info.placeSlug,
      status: missed ? 'Missed call' : 'Call summarized',
      message: {
        id: `hist-note-${callId}`,
        from: 'concierge',
        text: noteText,
        at: Date.now(),
      },
    });

    await ctx.runAction(internal.notify.notifyCallComplete, { callId });
  },
});
