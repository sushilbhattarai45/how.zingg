'use node';

/**
 * Gemini place chat — bullet answers from place card + docs.
 * When unknown, returns callOffer so the UI can ask yes/no before scheduling.
 */
import { v } from 'convex/values';
import { action } from './_generated/server';
import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { getLlm } from '../lib/services/llm';
import { geminiApiKey, geminiReadDocument } from '../lib/services/llm/gemini';
import { formatGuideReply } from '../lib/chatFormat';

const WANTS_DOC_EXPLAIN =
  /\b(explain|what('?s| is| does)|summariz|tell me about|what'?s in|describe|floor\s*plan|document|pdf|packet|fee sheet)\b/i;

const CAMPUS = 'University of Southern Mississippi (USM), Hattiesburg — Scianna Hall is the campus walk target';

export const replyAboutPlace = action({
  args: {
    guestKey: v.optional(v.string()),
    placeSlug: v.string(),
    placeTitle: v.string(),
    unitType: v.string(),
    officeName: v.optional(v.string()),
    address: v.optional(v.string()),
    walkMin: v.optional(v.number()),
    pitch: v.optional(v.string()),
    noSSN: v.optional(v.string()),
    availableFrom: v.optional(v.string()),
    message: v.string(),
    recent: v.optional(
      v.array(
        v.object({
          from: v.string(),
          text: v.string(),
        }),
      ),
    ),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ reply: string; from: 'concierge' | 'packet'; callOffer: string | null }> => {
    const message = args.message.trim().slice(0, 2000);
    if (!message) {
      return {
        reply: '• Send a question about this place — rent, fees, floor plan, or campus distance.',
        from: 'concierge',
        callOffer: null,
      };
    }

    let userId: Id<'users'> | null = null;
    if (args.guestKey?.trim()) {
      const guest = await ctx.runQuery(internal.places.findUserByGuestKey, {
        guestKey: args.guestKey,
      });
      userId = guest?._id ?? null;
    }

    const docs =
      userId != null
        ? await ctx.runQuery(internal.documents.listDocContext, {
            userId,
            placeSlug: args.placeSlug,
          })
        : [];

    const callNotes =
      userId != null
        ? await ctx.runQuery(internal.calls.listCallContext, {
            userId,
            placeSlug: args.placeSlug,
          })
        : [];

    const recent = (args.recent ?? [])
      .slice(-8)
      .map((m) => `${m.from}: ${m.text}`)
      .join('\n');

    const docBlock =
      docs.length > 0
        ? docs
            .map(
              (d, i) =>
                `Doc ${i + 1}: ${d.fileName}\nSummary: ${d.summary ?? '(processing)'}\nFacts:\n${
                  d.facts.length ? d.facts.map((f) => `- ${f}`).join('\n') : '- (none extracted yet)'
                }`,
            )
            .join('\n\n')
        : '(No office documents uploaded yet.)';

    const callBlock =
      callNotes.length > 0
        ? callNotes
            .map((c, i) => {
              const facts =
                c.facts.length > 0
                  ? c.facts.map((f) => `- ${f}`).join('\n')
                  : '- (no facts extracted)';
              return `Call ${i + 1} (${c.status}):\n${facts}`;
            })
            .join('\n\n')
        : '(No call notes yet.)';

    const placeBlock = [
      `Name: ${args.placeTitle}`,
      `Unit wanted: ${args.unitType}`,
      `Address: ${args.address ?? 'unknown'}`,
      args.walkMin != null
        ? `Walk to Scianna Hall (USM campus): about ${args.walkMin} minutes`
        : 'Walk time to campus: not listed',
      `Campus: ${CAMPUS}`,
      `Office: ${args.officeName ?? 'leasing office'}`,
      args.noSSN ? `Listing no-SSN note: ${args.noSSN}` : null,
      args.availableFrom ? `Listed available from: ${args.availableFrom}` : null,
      args.pitch ? `Scout pitch: ${args.pitch}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    const system = [
      'You are Guide for how.zingg (housing assistant for international students near USM).',
      'Reply ONLY with short bullet lines. No paragraphs. Max 5 bullets.',
      'Each bullet starts with "- ".',
      'Use PLACE FACTS first for campus/USM/walk/address questions — do not say unknown if walk time or address is listed.',
      `Student wants: ${args.unitType} at ${args.placeTitle}. Ignore other bedroom counts in docs unless asked.`,
      'Be a little curious: if a fact is useful, mention one related tip in a bullet.',
      'Never invent rent or fees. Prefer CALL NOTES + document facts when present.',
      'If you truly lack the answer after place facts + call notes + docs, end with exactly one line:',
      'CALL_OFFER: <one short question for the leasing office>',
      'Otherwise end with: CALL_OFFER: none',
      'Never write the long “best answer without calling” filler.',
    ].join(' ');

    const prompt = [
      'PLACE FACTS (trusted listing data):',
      placeBlock,
      '',
      'CALL NOTES (from phone calls — trusted):',
      callBlock,
      '',
      'OFFICE DOCUMENTS:',
      docBlock,
      '',
      recent ? `RECENT CHAT:\n${recent}\n` : '',
      `STUDENT: ${message}`,
    ].join('\n');

    const weakFacts = docs.every((d) => d.facts.length === 0);
    if (userId && geminiApiKey() && WANTS_DOC_EXPLAIN.test(message)) {
      const latest = await ctx.runQuery(internal.documents.latestOfficeFile, {
        userId,
        placeSlug: args.placeSlug,
      });
      if (latest?.fileId && (weakFacts || /exactly|detail|layout|floor/i.test(message))) {
        try {
          const blob = await ctx.storage.get(latest.fileId);
          if (blob) {
            const bytes = new Uint8Array(await blob.arrayBuffer());
            const text = await geminiReadDocument({
              system: [
                'You are Packet for how.zingg.',
                `Student wants ${args.unitType} at ${args.placeTitle}.`,
                'Reply with at most 5 short "- " bullets about what is in the file for THAT unit only.',
                'Skip other bedroom counts. End with CALL_OFFER: none unless a critical fee/layout fact is missing — then one CALL_OFFER question.',
              ].join(' '),
              prompt: `Student question: ${message}\nFilename: ${latest.fileName}\nPlace: ${placeBlock}`,
              bytes,
              mediaType: latest.contentType ?? 'application/pdf',
              fileName: latest.fileName,
              tier: 'agent',
            });
            const formatted = formatGuideReply(text);
            if (formatted.text) {
              return { reply: formatted.text, from: 'packet', callOffer: formatted.callOffer };
            }
          }
        } catch (err) {
          console.warn('[chat.replyAboutPlace] live doc read failed', err);
        }
      }
    }

    try {
      const text = await getLlm().complete({
        promptId: 'place-chat',
        system,
        prompt,
        tier: 'fast',
      });
      const formatted = formatGuideReply(text);
      return {
        reply: formatted.text,
        from: docs.length ? 'packet' : 'concierge',
        callOffer: formatted.callOffer,
      };
    } catch (err) {
      console.warn('[chat.replyAboutPlace]', err);
      return {
        reply: `• I couldn't reach Gemini just now.\n• Want me to call ${args.officeName ?? 'the office'} about your question? (yes / no)`,
        from: 'concierge',
        callOffer: message.slice(0, 160),
      };
    }
  },
});
