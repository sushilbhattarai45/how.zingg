/**
 * Caller: start / sync / end phone calls (Vapi real, or seeded mock playback).
 * No webhooks — the call page polls syncCall every few seconds while live.
 */
import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';
import { ConvexError } from 'convex/values';
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from './_generated/server';
import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { assertCallable, isE164 } from '../lib/services/voice/allowlist';
import { createVapiVoice, downloadMonoRecording } from '../lib/services/voice/vapi';
import { mockVoice } from '../lib/services/voice/mock';
import { isDemoMode } from '../lib/clock';
import { envOrNull } from '../lib/services/mode';
import {
  assertCanDial,
  CallGuardrailError,
  earliestDialAt,
  resolveCallbackMinutes,
} from '../lib/callGuardrails';
import {
  callerSystemPrompt,
  dialOpening,
  recallOpening,
  summarizePriorCall,
  DEMO_STUDENT_NAME,
  DEFAULT_CALL_QUESTIONS,
  startsWithDisclosure,
} from '../lib/rules';
import { collectCallFacts } from '../lib/callFacts';
import transcripts from '../seed/transcripts.json';

const LINE_MS = 1200;
const MAX_DURATION_SECONDS = 360;

type TranscriptLine = { speaker: 'caller' | 'office'; text: string; at: number };

function useMockVoice(): boolean {
  if (isDemoMode()) return true;
  return createVapiVoice() === null;
}

/** True when the callee never picked up / line was busy (not a tech error). */
export function isMissedCallReason(reason: string | undefined): boolean {
  if (!reason) return false;
  const r = reason.toLowerCase();
  return (
    /\bno[-_ ]?answer\b/.test(r) ||
    /\bbusy\b/.test(r) ||
    /\bcustomer[-_ ]did[-_ ]not[-_ ]answer\b/.test(r) ||
    /\bdid not answer\b/.test(r) ||
    /\bmissed\b/.test(r) ||
    /\bvoicemail[-_ ]reached\b/.test(r) ||
    /\bsilence[-_ ]timed[-_ ]out\b/.test(r) ||
    /\btwilio[-_ ]failed[-_ ]to[-_ ]connect[-_ ]call\b/.test(r)
  );
}

function mapVapiStatus(
  status: string,
  endedReason?: string,
): 'ringing' | 'live' | 'done' | 'failed' {
  if (isMissedCallReason(status) || isMissedCallReason(endedReason)) return 'failed';
  switch (status) {
    case 'queued':
    case 'scheduled':
    case 'ringing':
      return 'ringing';
    case 'in-progress':
    case 'forwarding':
      return 'live';
    case 'ended':
      // Ended without a conversation often means they never picked up.
      if (isMissedCallReason(endedReason)) return 'failed';
      return 'done';
    default:
      return status === 'busy' || status === 'no-answer' || status === 'failed' ? 'failed' : 'live';
  }
}

function messageText(m: { message?: string; content?: string }): string {
  if (typeof m.message === 'string' && m.message.trim()) return m.message.trim();
  if (typeof m.content === 'string' && m.content.trim()) return m.content.trim();
  return '';
}

function isJunkCallLine(text: string, role: string): boolean {
  const t = text.trim().toLowerCase();
  if (!t) return true;
  // Never store system / prompt scaffolding as dialogue.
  if (role === 'system' || role === 'tool') return true;
  if (/^you are the how\.?zingg/i.test(t)) return true;
  if (/\bai phone assistant\b/.test(t) && t.length > 80) return true;
  return false;
}

function mapMessages(
  messages: { role?: string; message?: string; content?: string; time?: number; secondsFromStart?: number }[],
  startedAt: number,
): TranscriptLine[] {
  const out: TranscriptLine[] = [];
  for (const m of messages) {
    const text = messageText(m);
    const role = (m.role ?? '').toLowerCase();
    if (!text || isJunkCallLine(text, role)) continue;
    const speaker: 'caller' | 'office' =
      role === 'user' || role === 'customer' ? 'office' : 'caller';
    const at =
      typeof m.time === 'number'
        ? m.time
        : typeof m.secondsFromStart === 'number'
          ? startedAt + m.secondsFromStart * 1000
          : startedAt + out.length * LINE_MS;
    out.push({ speaker, text, at });
  }
  return out;
}

function parseAnswers(data: Record<string, unknown> | undefined) {
  if (!data) return undefined;
  const rentRaw = data.rent;
  let rent: number | undefined;
  if (typeof rentRaw === 'number') rent = rentRaw;
  else if (typeof rentRaw === 'string') {
    const n = Number(rentRaw.replace(/[^0-9.]/g, ''));
    if (Number.isFinite(n) && n > 0) rent = n;
  }
  const specials = typeof data.specials === 'string' ? data.specials.trim() : undefined;
  const noSSNOptions =
    typeof data.noSSNOptions === 'string' ? data.noSSNOptions.trim() : undefined;
  const availableDate =
    typeof data.availableDate === 'string' ? data.availableDate.trim() : undefined;
  const fees = typeof data.fees === 'string' ? data.fees.trim() : undefined;
  const notes = typeof data.notes === 'string' ? data.notes.trim() : undefined;
  if (
    rent === undefined &&
    !specials &&
    !noSSNOptions &&
    !availableDate &&
    !fees &&
    !notes
  ) {
    return undefined;
  }
  return { rent, specials, noSSNOptions, availableDate, fees, notes };
}

/** Detect Caller closing the conversation so we can hang up from our side too. */
function looksLikeAgentHangup(transcript: TranscriptLine[]): boolean {
  const lastCaller = [...transcript].reverse().find((l) => l.speaker === 'caller');
  if (!lastCaller) return false;
  const t = lastCaller.text.toLowerCase();
  // Only clear goodbyes — mid-call “thanks” must not force hang-up.
  return (
    /\b(goodbye|good bye|bye for now)\b/.test(t) ||
    /\b(have a (good|nice) (day|one)[,.]?\s*(goodbye|bye)?)\s*$/.test(t)
  );
}

export const get = query({
  args: { callId: v.id('calls') },
  handler: async (ctx, { callId }) => {
    const call = await ctx.db.get(callId);
    if (!call) return null;
    // Prefer the durable Convex copy — Vapi's artifact URLs are private and won't play in <audio>.
    const storedUrl = call.recordingStorageId
      ? await ctx.storage.getUrl(call.recordingStorageId)
      : null;
    return {
      ...call,
      recordingUrl: storedUrl ?? call.recordingUrl ?? null,
      hasPlayableRecording: Boolean(storedUrl),
    };
  },
});

export const internalGet = internalQuery({
  args: { callId: v.id('calls') },
  handler: async (ctx, { callId }) => ctx.db.get(callId),
});

/** Recent call notes for a place — fed into Guide chat context. */
export const listCallContext = internalQuery({
  args: { userId: v.id('users'), placeSlug: v.string() },
  handler: async (ctx, { userId, placeSlug }) => {
    const interests = await ctx.db
      .query('placeInterests')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect();
    const forPlace = interests.filter((i) => i.placeSlug === placeSlug);
    const interestIds = new Set(forPlace.map((i) => i._id));
    const calls = await ctx.db
      .query('calls')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect();
    const relevant = calls
      .filter(
        (c) =>
          (c.interestId && interestIds.has(c.interestId)) ||
          forPlace.some((i) => i.callId === c._id || i.scheduledCallId === c._id),
      )
      .filter((c) => c.status === 'done' || c.status === 'failed')
      .sort((a, b) => (b.endedAt ?? b.startedAt ?? 0) - (a.endedAt ?? a.startedAt ?? 0))
      .slice(0, 4);

    return relevant.map((c) => ({
      callId: c._id,
      status: c.status,
      facts: collectCallFacts({
        status: c.status,
        transcript: c.transcript ?? [],
        answers: c.answers,
        error: c.error,
        questions: c.questions,
      }),
      endedAt: c.endedAt,
    }));
  },
});

export const demoUserId = internalQuery({
  args: {},
  handler: async (ctx) => {
    const demo = await ctx.db
      .query('users')
      .withIndex('by_isDemo', (q) => q.eq('isDemo', true))
      .first();
    return demo?._id ?? null;
  },
});

/** Dial stats for abuse guardrails (same number + user caps). */
export const dialStats = internalQuery({
  args: {
    userId: v.id('users'),
    toNumber: v.string(),
    now: v.optional(v.number()),
  },
  handler: async (ctx, { userId, toNumber, now: nowArg }) => {
    const now = nowArg ?? Date.now();
    const hourAgo = now - 60 * 60_000;
    const dayAgo = now - 24 * 60 * 60_000;

    const toNumberCalls = await ctx.db
      .query('calls')
      .withIndex('by_toNumber', (q) => q.eq('toNumber', toNumber))
      .collect();

    const userCalls = await ctx.db
      .query('calls')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect();

    const isLiveDial = (c: (typeof toNumberCalls)[number]) =>
      !c.canceledAt &&
      (c.status === 'ringing' || c.status === 'live' || c.status === 'done' || c.status === 'failed') &&
      typeof c.startedAt === 'number';

    const numberDials = toNumberCalls.filter(isLiveDial);
    const lastDialAt =
      numberDials.reduce<number | null>((max, c) => {
        const t = c.startedAt!;
        return max == null || t > max ? t : max;
      }, null);

    const dialsLastHour = numberDials.filter((c) => c.startedAt! >= hourAgo).length;
    const dialsToday = userCalls.filter(
      (c) => isLiveDial(c) && c.startedAt! >= dayAgo,
    ).length;
    const pendingCount = userCalls.filter(
      (c) => c.status === 'scheduled' && !c.canceledAt,
    ).length;
    const inProgress = userCalls.filter(
      (c) => !c.canceledAt && (c.status === 'ringing' || c.status === 'live'),
    );

    return {
      lastDialAt,
      dialsLastHour,
      dialsToday,
      pendingCount,
      now,
      inProgressIds: inProgress.map((c) => c._id),
      inProgressCount: inProgress.length,
    };
  },
});

/** Active ringing/live calls for a user (to hang up before a new outbound). */
export const listInProgressCalls = internalQuery({
  args: { userId: v.id('users'), excludeCallId: v.optional(v.id('calls')) },
  handler: async (ctx, { userId, excludeCallId }) => {
    const rows = await ctx.db
      .query('calls')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect();
    return rows.filter(
      (c) =>
        !c.canceledAt &&
        (c.status === 'ringing' || c.status === 'live') &&
        c._id !== excludeCallId,
    );
  },
});

/**
 * Hang up any still-open outbound calls for this user so Vapi/Telnyx can place a new one.
 * Without this, a second dial often shows "ringing" in our UI while the phone never rings
 * (carrier/Vapi only supports one active outbound from the imported number).
 */
export const hangUpInProgressCalls = internalAction({
  args: {
    userId: v.id('users'),
    excludeCallId: v.optional(v.id('calls')),
  },
  handler: async (ctx, { userId, excludeCallId }) => {
    const open = await ctx.runQuery(internal.calls.listInProgressCalls, {
      userId,
      excludeCallId,
    });
    if (!open.length) return { ended: 0 };

    const voice = createVapiVoice() ?? mockVoice;
    for (const call of open) {
      if (call.mode === 'vapi' && call.controlUrl) {
        try {
          await voice.endCall(call.controlUrl);
        } catch (err) {
          console.warn('[calls.hangUpInProgressCalls]', call._id, err);
        }
      }
      await ctx.runMutation(internal.calls.patchCall, {
        callId: call._id,
        status: 'done',
        endedAt: Date.now(),
        error: call.error ?? 'Ended to place a new call',
      });
    }
    return { ended: open.length };
  },
});

export const insertCall = internalMutation({
  args: {
    userId: v.id('users'),
    toNumber: v.string(),
    questions: v.array(v.string()),
    mode: v.union(v.literal('mock'), v.literal('vapi')),
    isExample: v.boolean(),
    firstLine: v.string(),
    externalId: v.optional(v.string()),
    listenUrl: v.optional(v.string()),
    controlUrl: v.optional(v.string()),
    scheduleSource: v.optional(
      v.union(v.literal('user'), v.literal('receiver'), v.literal('immediate')),
    ),
    interestId: v.optional(v.id('placeInterests')),
    scheduleReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const transcript: TranscriptLine[] = startsWithDisclosure(args.firstLine)
      ? [{ speaker: 'caller', text: args.firstLine, at: now }]
      : [];
    return await ctx.db.insert('calls', {
      userId: args.userId,
      toNumber: args.toNumber,
      questions: args.questions,
      mode: args.mode,
      isExample: args.isExample,
      status: 'ringing',
      startedAt: now,
      transcript,
      externalId: args.externalId,
      listenUrl: args.listenUrl,
      controlUrl: args.controlUrl,
      disclosureSaid: transcript.length > 0,
      scheduleSource: args.scheduleSource ?? 'immediate',
      interestId: args.interestId,
      scheduleReason: args.scheduleReason,
    });
  },
});

export const insertScheduledCall = internalMutation({
  args: {
    userId: v.id('users'),
    toNumber: v.string(),
    questions: v.array(v.string()),
    scheduledFor: v.number(),
    scheduleSource: v.union(v.literal('user'), v.literal('receiver')),
    scheduleReason: v.optional(v.string()),
    interestId: v.id('placeInterests'),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('calls', {
      userId: args.userId,
      toNumber: args.toNumber,
      questions: args.questions,
      status: 'scheduled',
      scheduledFor: args.scheduledFor,
      transcript: [],
      disclosureSaid: false,
      scheduleSource: args.scheduleSource,
      scheduleReason: args.scheduleReason,
      interestId: args.interestId,
    });
  },
});

export const patchCall = internalMutation({
  args: {
    callId: v.id('calls'),
    status: v.optional(
      v.union(
        v.literal('scheduled'),
        v.literal('ringing'),
        v.literal('live'),
        v.literal('done'),
        v.literal('failed'),
        v.literal('emailed'),
      ),
    ),
    transcript: v.optional(
      v.array(
        v.object({
          speaker: v.union(v.literal('caller'), v.literal('office')),
          text: v.string(),
          at: v.number(),
        }),
      ),
    ),
    answers: v.optional(
      v.object({
        available: v.optional(v.union(v.boolean(), v.literal('unknown'))),
        availableDate: v.optional(v.string()),
        rent: v.optional(v.number()),
        deposit: v.optional(v.number()),
        fees: v.optional(v.string()),
        noSSNOptions: v.optional(v.string()),
        specials: v.optional(v.string()),
        packetEmail: v.optional(v.string()),
        notes: v.optional(v.string()),
      }),
    ),
    recordingUrl: v.optional(v.string()),
    recordingStorageId: v.optional(v.id('_storage')),
    recordingStatus: v.optional(
      v.union(v.literal('pending'), v.literal('ready'), v.literal('unavailable')),
    ),
    listenUrl: v.optional(v.string()),
    controlUrl: v.optional(v.string()),
    externalId: v.optional(v.string()),
    endedAt: v.optional(v.number()),
    error: v.optional(v.string()),
    disclosureSaid: v.optional(v.boolean()),
    canceledAt: v.optional(v.number()),
    scheduledFor: v.optional(v.number()),
    startedAt: v.optional(v.number()),
    callbackScheduled: v.optional(v.boolean()),
    guardrailRescheduled: v.optional(v.boolean()),
    scheduleSource: v.optional(
      v.union(v.literal('user'), v.literal('receiver'), v.literal('immediate')),
    ),
    scheduleReason: v.optional(v.string()),
    questions: v.optional(v.array(v.string())),
    mode: v.optional(v.union(v.literal('mock'), v.literal('vapi'))),
    isExample: v.optional(v.boolean()),
    appendLine: v.optional(
      v.object({
        speaker: v.union(v.literal('caller'), v.literal('office')),
        text: v.string(),
        at: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const call = await ctx.db.get(args.callId);
    if (!call) return;
    const { callId, appendLine, ...rest } = args;
    const patch: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(rest)) {
      if (val !== undefined) patch[k] = val;
    }
    if (appendLine) {
      patch.transcript = [...call.transcript, appendLine];
      if (appendLine.speaker === 'caller' && startsWithDisclosure(appendLine.text)) {
        patch.disclosureSaid = true;
      }
    }
    if (args.transcript) {
      const disclosure = args.transcript.some(
        (l) => l.speaker === 'caller' && startsWithDisclosure(l.text),
      );
      if (disclosure) patch.disclosureSaid = true;
    }
    await ctx.db.patch(callId, patch);
  },
});

/** Append one mock transcript line; schedule the next or finish. */
export const mockTick = internalMutation({
  args: { callId: v.id('calls'), lineIndex: v.number() },
  handler: async (ctx, { callId, lineIndex }) => {
    const call = await ctx.db.get(callId);
    if (!call || call.status === 'done' || call.status === 'failed') return;

    const script = transcripts['oak-hollow-1bd'];
    const lines = script.lines;
    if (lineIndex >= lines.length) {
      const a = script.answers;
      await ctx.db.patch(callId, {
        status: 'done',
        endedAt: Date.now(),
        answers: {
          available: a.available,
          availableDate: a.availableDate,
          rent: a.rent,
          deposit: a.deposit,
          fees: a.fees,
          noSSNOptions: a.noSSNOptions,
          specials: a.specials,
          packetEmail: a.packetEmail,
        },
      });
      // Auto-callback if the (example) transcript asked for one.
      if (call.interestId && !call.callbackScheduled) {
        const minutes = resolveCallbackMinutes(undefined, call.transcript);
        if (minutes != null) {
          await ctx.db.patch(callId, { callbackScheduled: true });
          await ctx.scheduler.runAfter(0, internal.places.scheduleReceiverCallback, {
            interestId: call.interestId,
            delayMinutes: minutes,
            fromCallId: callId,
          });
        }
      }
      await ctx.scheduler.runAfter(0, internal.callSummarize.summarizeEndedCall, { callId });
      return;
    }

    const line = lines[lineIndex]!;
    const at = Date.now();
    // Skip first line if we already seeded disclosure on insert.
    const skip =
      lineIndex === 0 &&
      call.transcript.length > 0 &&
      startsWithDisclosure(call.transcript[0]!.text) &&
      startsWithDisclosure(line.text);

    if (!skip) {
      await ctx.db.patch(callId, {
        status: lineIndex === 0 ? 'live' : call.status === 'ringing' ? 'live' : call.status,
        transcript: [
          ...call.transcript,
          { speaker: line.speaker as 'caller' | 'office', text: line.text, at },
        ],
        disclosureSaid:
          call.disclosureSaid ||
          (line.speaker === 'caller' && startsWithDisclosure(line.text)),
      });
    } else {
      await ctx.db.patch(callId, { status: 'live' });
    }

    await ctx.scheduler.runAfter(LINE_MS, internal.calls.mockTick, {
      callId,
      lineIndex: lineIndex + 1,
    });
  },
});

export const startCall = action({
  args: {
    phone: v.string(),
    questions: v.optional(v.array(v.string())),
    scheduleSource: v.optional(
      v.union(v.literal('user'), v.literal('receiver'), v.literal('immediate')),
    ),
    interestId: v.optional(v.id('placeInterests')),
    scheduleReason: v.optional(v.string()),
    /** Skip pending-count check (scheduled row already counted). */
    skipPendingCheck: v.optional(v.boolean()),
    /** Follow-up dial: different opener + prior call memory in the system prompt. */
    isRecall: v.optional(v.boolean()),
    callMemory: v.optional(v.string()),
    placeTitle: v.optional(v.string()),
  },
  handler: async (
    ctx,
    {
      phone,
      questions: rawQuestions,
      scheduleSource,
      interestId,
      scheduleReason,
      skipPendingCheck,
      isRecall,
      callMemory,
      placeTitle,
    },
  ): Promise<{ callId: Id<'calls'>; mode: 'mock' | 'vapi' }> => {
    const trimmed = phone.trim();
    if (!isE164(trimmed)) {
      throw new ConvexError(`Phone must be E.164 (e.g. +16019132221), got "${trimmed || '(empty)'}"`);
    }
    const mock = useMockVoice();
    // Mock never dials — any E.164 is fine. Live Vapi calls must pass CALL_ALLOWLIST.
    let to = trimmed;
    if (!mock) {
      try {
        to = assertCallable(trimmed, process.env.CALL_ALLOWLIST ?? '');
      } catch (err) {
        throw new ConvexError(err instanceof Error ? err.message : 'Cannot place call');
      }
    }

    // Own the call as the place's user (guest/auth) — never the shared demo user when an interest is set.
    let userId = await getAuthUserId(ctx);
    if (interestId) {
      const interest = await ctx.runQuery(internal.places.getInterest, { interestId });
      if (interest?.userId) userId = interest.userId;
    }
    if (!userId) {
      userId = await ctx.runQuery(internal.calls.demoUserId, {});
    }
    if (!userId) {
      throw new ConvexError('Sign in (or run npm run seed) before placing a call.');
    }

    // Free the outbound line — a second Vapi dial while one is live often never rings the phone.
    await ctx.runAction(internal.calls.hangUpInProgressCalls, { userId });

    const stats = await ctx.runQuery(internal.calls.dialStats, { userId, toNumber: to });
    try {
      assertCanDial({
        ...stats,
        pendingCount: skipPendingCheck ? 0 : stats.pendingCount,
      });
    } catch (err) {
      throw new ConvexError(err instanceof Error ? err.message : 'Call blocked by guardrails');
    }

    const questions =
      rawQuestions && rawQuestions.length > 0
        ? rawQuestions.map((q) => q.trim()).filter(Boolean)
        : [...DEFAULT_CALL_QUESTIONS];
    const recall = Boolean(isRecall && callMemory?.trim());
    const firstMessage = recall
      ? recallOpening(DEMO_STUDENT_NAME)
      : dialOpening(DEMO_STUDENT_NAME);
    const systemPrompt = callerSystemPrompt(questions, {
      isRecall: recall,
      memory: callMemory,
      placeTitle,
    });
    const source = scheduleSource ?? 'immediate';

    if (mock) {
      const placed = await mockVoice.placeCall({
        to,
        callId: 'pending',
        firstMessage,
        systemPrompt,
        maxDurationSeconds: MAX_DURATION_SECONDS,
      });
      const callId: Id<'calls'> = await ctx.runMutation(internal.calls.insertCall, {
        userId,
        toNumber: to,
        questions,
        mode: 'mock',
        isExample: true,
        firstLine: firstMessage,
        externalId: placed.externalId,
        scheduleSource: source,
        interestId,
        scheduleReason: recall
          ? scheduleReason
            ? `${scheduleReason} · recall`
            : 'Recall with prior-call memory'
          : scheduleReason,
      });
      // Rewrite externalId to include real callId, then start playback.
      await ctx.runMutation(internal.calls.patchCall, {
        callId,
        externalId: `mock-${callId}`,
      });
      await ctx.scheduler.runAfter(600, internal.calls.mockTick, { callId, lineIndex: 0 });
      return { callId, mode: 'mock' };
    }

    // Real path: allowlist already enforced above.
    const voice = createVapiVoice();
    if (!voice) throw new ConvexError('Vapi is not configured (VAPI_API_KEY / VAPI_PHONE_NUMBER_ID).');

    // Insert a placeholder row first so callId is stable for logging.
    const callId: Id<'calls'> = await ctx.runMutation(internal.calls.insertCall, {
      userId,
      toNumber: to,
      questions,
      mode: 'vapi',
      isExample: false,
      firstLine: firstMessage,
      scheduleSource: source,
      interestId,
      scheduleReason: recall
        ? scheduleReason
          ? `${scheduleReason} · recall`
          : 'Recall with prior-call memory'
        : scheduleReason,
    });

    try {
      const placed = await voice.placeCall({
        to,
        callId,
        firstMessage,
        systemPrompt,
        maxDurationSeconds: MAX_DURATION_SECONDS,
      });
      await ctx.runMutation(internal.calls.patchCall, {
        callId,
        externalId: placed.externalId,
        listenUrl: placed.listenUrl,
        controlUrl: placed.controlUrl,
        status: 'ringing',
      });
      return { callId, mode: 'vapi' };
    } catch (err) {
      await ctx.runMutation(internal.calls.patchCall, {
        callId,
        status: 'failed',
        endedAt: Date.now(),
        error: err instanceof Error ? err.message : 'Vapi placeCall failed',
      });
      throw new ConvexError(err instanceof Error ? err.message : 'Failed to start call');
    }
  },
});

/**
 * Promote a status=scheduled call into a live dial (same callId).
 * Used by the Convex scheduler when a user/receiver callback fires.
 */
export const executeScheduledDial = internalAction({
  args: { callId: v.id('calls') },
  handler: async (ctx, { callId }): Promise<{ ok: boolean; deferredMs?: number }> => {
    const call = await ctx.runQuery(internal.calls.internalGet, { callId });
    if (!call || call.canceledAt || call.status !== 'scheduled') {
      return { ok: false };
    }
    const to = call.toNumber?.trim();
    if (!to || !isE164(to)) {
      await ctx.runMutation(internal.calls.patchCall, {
        callId,
        status: 'failed',
        endedAt: Date.now(),
        error: 'Scheduled call missing a valid phone number',
      });
      return { ok: false };
    }

    // End any still-open outbound so this scheduled dial can actually ring the phone.
    await ctx.runAction(internal.calls.hangUpInProgressCalls, {
      userId: call.userId,
      excludeCallId: callId,
    });

    const stats = await ctx.runQuery(internal.calls.dialStats, {
      userId: call.userId,
      toNumber: to,
    });
    // Pending includes this row — don't count it against the pending cap at fire time.
    const pendingWithoutSelf = Math.max(0, stats.pendingCount - 1);
    try {
      assertCanDial({ ...stats, pendingCount: pendingWithoutSelf });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Call blocked by guardrails';
      const isGap = err instanceof CallGuardrailError && /within a minute/i.test(msg);
      if (isGap && !call.guardrailRescheduled) {
        const when = earliestDialAt(stats.lastDialAt, stats.now);
        const delay = Math.max(0, when - stats.now);
        await ctx.runMutation(internal.calls.patchCall, {
          callId,
          scheduledFor: when,
          guardrailRescheduled: true,
          scheduleReason: call.scheduleReason
            ? `${call.scheduleReason} (bumped for 1-minute gap)`
            : 'Bumped for 1-minute gap',
        });
        await ctx.scheduler.runAfter(delay, internal.calls.executeScheduledDial, { callId });
        return { ok: false, deferredMs: delay };
      }
      await ctx.runMutation(internal.calls.patchCall, {
        callId,
        status: 'failed',
        endedAt: Date.now(),
        error: msg,
      });
      if (call.interestId) {
        await ctx.runMutation(internal.places.clearScheduledCallId, {
          interestId: call.interestId,
          callId,
        });
      }
      return { ok: false };
    }

    const questions =
      call.questions && call.questions.length > 0 ? call.questions : [...DEFAULT_CALL_QUESTIONS];

    // Load prior call memory from the place's last finished call (if any).
    let recall = false;
    let memory: string | undefined;
    let placeTitle: string | undefined;
    if (call.interestId) {
      const interest = await ctx.runQuery(internal.places.getInterest, {
        interestId: call.interestId,
      });
      placeTitle = interest?.placeTitle;
      if (interest?.callId && interest.callId !== callId) {
        const prior = await ctx.runQuery(internal.calls.internalGet, {
          callId: interest.callId,
        });
        if (prior && prior.transcript.length > 0) {
          recall = true;
          memory = summarizePriorCall({
            placeTitle: interest.placeTitle,
            transcript: prior.transcript,
            answers: prior.answers,
          });
        }
      }
    }

    const firstMessage = recall
      ? recallOpening(DEMO_STUDENT_NAME)
      : dialOpening(DEMO_STUDENT_NAME);
    const systemPrompt = callerSystemPrompt(questions, {
      isRecall: recall,
      memory,
      placeTitle,
    });
    const mock = useMockVoice();
    const now = Date.now();

    if (mock) {
      await mockVoice.placeCall({
        to,
        callId,
        firstMessage,
        systemPrompt,
        maxDurationSeconds: MAX_DURATION_SECONDS,
      });
      await ctx.runMutation(internal.calls.patchCall, {
        callId,
        status: 'ringing',
        startedAt: now,
        mode: 'mock',
        isExample: true,
        externalId: `mock-${callId}`,
        transcript: [{ speaker: 'caller', text: firstMessage, at: now }],
        disclosureSaid: true,
        scheduleReason: recall
          ? call.scheduleReason
            ? `${call.scheduleReason} · recall`
            : 'Recall with prior-call memory'
          : call.scheduleReason,
      });
      await ctx.scheduler.runAfter(600, internal.calls.mockTick, { callId, lineIndex: 0 });
      if (call.interestId) {
        await ctx.runMutation(internal.places.attachCall, {
          interestId: call.interestId,
          callId,
        });
      }
      return { ok: true };
    }

    const voice = createVapiVoice();
    if (!voice) {
      await ctx.runMutation(internal.calls.patchCall, {
        callId,
        status: 'failed',
        endedAt: now,
        error: 'Vapi is not configured',
      });
      return { ok: false };
    }

    try {
      if (!mock) {
        assertCallable(to, process.env.CALL_ALLOWLIST ?? '');
      }
      const placed = await voice.placeCall({
        to,
        callId,
        firstMessage,
        systemPrompt,
        maxDurationSeconds: MAX_DURATION_SECONDS,
      });
      await ctx.runMutation(internal.calls.patchCall, {
        callId,
        status: 'ringing',
        startedAt: now,
        mode: 'vapi',
        isExample: false,
        externalId: placed.externalId,
        listenUrl: placed.listenUrl,
        controlUrl: placed.controlUrl,
        transcript: [{ speaker: 'caller', text: firstMessage, at: now }],
        disclosureSaid: true,
        scheduleReason: recall
          ? call.scheduleReason
            ? `${call.scheduleReason} · recall`
            : 'Recall with prior-call memory'
          : call.scheduleReason,
      });
      if (call.interestId) {
        await ctx.runMutation(internal.places.attachCall, {
          interestId: call.interestId,
          callId,
        });
        await ctx.runMutation(internal.places.clearScheduledCallId, {
          interestId: call.interestId,
          callId,
        });
      }
      return { ok: true };
    } catch (err) {
      await ctx.runMutation(internal.calls.patchCall, {
        callId,
        status: 'failed',
        endedAt: Date.now(),
        error: err instanceof Error ? err.message : 'Scheduled dial failed',
      });
      if (call.interestId) {
        await ctx.runMutation(internal.places.clearScheduledCallId, {
          interestId: call.interestId,
          callId,
        });
      }
      return { ok: false };
    }
  },
});

/** Download the Vapi mono recording into Convex storage so the browser can play it. */
export const fetchRecording = internalAction({
  args: { callId: v.id('calls'), attempt: v.optional(v.number()) },
  handler: async (ctx, { callId, attempt = 0 }) => {
    const call = await ctx.runQuery(internal.calls.internalGet, { callId });
    if (!call?.externalId || call.mode !== 'vapi') return;
    if (call.recordingStorageId || call.recordingStatus === 'ready') return;
    if (call.recordingStatus === 'unavailable' && attempt > 0) return;

    const apiKey = envOrNull('VAPI_API_KEY');
    if (!apiKey) {
      await ctx.runMutation(internal.calls.patchCall, {
        callId,
        recordingStatus: 'unavailable',
      });
      return;
    }

    try {
      const file = await downloadMonoRecording(apiKey, call.externalId);
      if (!file) {
        // Recording often lags the end of the call — retry a few times.
        if (attempt < 8) {
          await ctx.runMutation(internal.calls.patchCall, { callId, recordingStatus: 'pending' });
          await ctx.scheduler.runAfter(4000, internal.calls.fetchRecording, {
            callId,
            attempt: attempt + 1,
          });
        } else {
          await ctx.runMutation(internal.calls.patchCall, {
            callId,
            recordingStatus: 'unavailable',
          });
        }
        return;
      }

      const bytes = await file.blob.arrayBuffer();
      const storageId = await ctx.storage.store(
        new Blob([bytes], { type: file.contentType || 'audio/wav' }),
      );
      await ctx.runMutation(internal.calls.patchCall, {
        callId,
        recordingStorageId: storageId,
        recordingStatus: 'ready',
      });
    } catch (err) {
      console.warn('[calls.fetchRecording]', err);
      if (attempt < 8) {
        await ctx.scheduler.runAfter(5000, internal.calls.fetchRecording, {
          callId,
          attempt: attempt + 1,
        });
      } else {
        await ctx.runMutation(internal.calls.patchCall, {
          callId,
          recordingStatus: 'unavailable',
          error: err instanceof Error ? err.message : 'Could not fetch recording',
        });
      }
    }
  },
});

/** Pull final Vapi transcript/answers after the call is already marked done. */
export const refreshEndedCallArtifact = internalAction({
  args: { callId: v.id('calls') },
  handler: async (ctx, { callId }) => {
    const call = await ctx.runQuery(internal.calls.internalGet, { callId });
    if (!call?.externalId || call.externalId.startsWith('mock-')) return;
    if (call.mode === 'mock') return;
    const voice = createVapiVoice();
    if (!voice) return;
    try {
      const snap = await voice.getCall(call.externalId);
      const startedAt = call.startedAt ?? Date.now();
      const transcript = mapMessages(snap.messages, startedAt);
      const answers = parseAnswers(snap.structuredData);
      if (transcript.length || answers) {
        await ctx.runMutation(internal.calls.patchCall, {
          callId,
          transcript: transcript.length ? transcript : undefined,
          answers: {
            ...(call.answers ?? {}),
            ...(answers ?? {}),
          },
        });
      }
    } catch (err) {
      console.warn('[calls.refreshEndedCallArtifact]', err);
    }
  },
});

export const syncCall = action({
  args: { callId: v.id('calls') },
  handler: async (
    ctx,
    { callId },
  ): Promise<{ status: string; ended: boolean; recordingStatus?: string }> => {
    const call = await ctx.runQuery(internal.calls.internalGet, { callId });
    if (!call) throw new ConvexError('Call not found');
    if (call.mode === 'mock' || !call.externalId || call.externalId.startsWith('mock-')) {
      return { status: call.status, ended: call.status === 'done' || call.status === 'failed' };
    }

    const alreadyEnded = call.status === 'done' || call.status === 'failed';
    const voice = createVapiVoice();

    // After hang-up, still pull final transcript / structured answers (Vapi finalizes late).
    if (alreadyEnded) {
      const thinTranscript = (call.transcript?.length ?? 0) < 2;
      const thinAnswers = !call.answers?.notes && !call.answers?.rent && !call.answers?.specials;
      if (voice && call.externalId && !call.externalId.startsWith('mock-') && (thinTranscript || thinAnswers)) {
        try {
          const snap = await voice.getCall(call.externalId);
          const startedAt = call.startedAt ?? Date.now();
          const transcript = mapMessages(snap.messages, startedAt);
          const answers = parseAnswers(snap.structuredData);
          if (transcript.length > (call.transcript?.length ?? 0) || answers) {
            await ctx.runMutation(internal.calls.patchCall, {
              callId,
              transcript: transcript.length ? transcript : undefined,
              answers: {
                ...(call.answers ?? {}),
                ...(answers ?? {}),
              },
            });
          }
        } catch (err) {
          console.warn('[calls.syncCall] post-end transcript refresh', err);
        }
      }
      if (!call.recordingStorageId && call.recordingStatus !== 'unavailable') {
        await ctx.scheduler.runAfter(0, internal.calls.fetchRecording, { callId, attempt: 0 });
      }
      return {
        status: call.status,
        ended: true,
        recordingStatus: call.recordingStatus,
      };
    }

    if (!voice) return { status: call.status, ended: false };

    const snap = await voice.getCall(call.externalId);
    let status = mapVapiStatus(snap.status, snap.endedReason);
    const startedAt = call.startedAt ?? Date.now();
    const transcript = mapMessages(snap.messages, startedAt);
    const answers = parseAnswers(snap.structuredData);
    let ended = status === 'done' || status === 'failed';
    // Agent-side auto hang-up: if Caller said goodbye but the line is still open, end it.
    const controlUrl = snap.controlUrl ?? call.controlUrl;
    if (!ended && (status === 'live' || status === 'ringing') && looksLikeAgentHangup(transcript)) {
      if (controlUrl) {
        try {
          await voice.endCall(controlUrl);
        } catch (err) {
          console.warn('[calls.syncCall] agent hang-up', err);
        }
      }
      status = 'done';
      ended = true;
    }

    // No pickup: ended with empty/tiny transcript → treat as missed.
    const missed =
      ended &&
      (isMissedCallReason(snap.endedReason) ||
        isMissedCallReason(snap.status) ||
        (status === 'failed' && transcript.length === 0) ||
        (status === 'done' && transcript.length === 0 && !answers));
    if (missed) status = 'failed';

    const justEnded = ended && call.status !== 'done' && call.status !== 'failed';

    await ctx.runMutation(internal.calls.patchCall, {
      callId,
      status,
      transcript: transcript.length ? transcript : undefined,
      listenUrl: snap.listenUrl ?? call.listenUrl,
      controlUrl: controlUrl,
      recordingUrl: snap.recordingUrl,
      recordingStatus: ended && !call.recordingStorageId ? 'pending' : call.recordingStatus,
      answers: answers ?? call.answers,
      endedAt: ended ? (call.endedAt ?? Date.now()) : undefined,
      error: missed
        ? `missed:${snap.endedReason ?? snap.status ?? 'no-answer'}`
        : call.error,
      disclosureSaid: transcript.some((l) => l.speaker === 'caller' && startsWithDisclosure(l.text)),
    });

    if (ended && !call.recordingStorageId) {
      await ctx.scheduler.runAfter(1500, internal.calls.fetchRecording, { callId, attempt: 0 });
    }

    // Auto-schedule callback if the receiver asked to be called later.
    if (justEnded && call.interestId && !call.callbackScheduled) {
      const minutes = resolveCallbackMinutes(snap.structuredData, transcript);
      if (minutes != null) {
        await ctx.runMutation(internal.calls.patchCall, {
          callId,
          callbackScheduled: true,
        });
        await ctx.scheduler.runAfter(0, internal.places.scheduleReceiverCallback, {
          interestId: call.interestId,
          delayMinutes: minutes,
          fromCallId: callId,
        });
      }
    }

    if (justEnded) {
      // Gemini notes → chat bullets, then student/realty emails.
      await ctx.scheduler.runAfter(0, internal.callSummarize.summarizeEndedCall, { callId });
    }

    return { status, ended, recordingStatus: ended ? 'pending' : call.recordingStatus };
  },
});

export const endCall = action({
  args: { callId: v.id('calls') },
  handler: async (ctx, { callId }) => {
    const call = await ctx.runQuery(internal.calls.internalGet, { callId });
    if (!call) throw new ConvexError('Call not found');
    if (call.status === 'done' || call.status === 'failed') {
      if (call.mode === 'vapi' && !call.recordingStorageId) {
        await ctx.scheduler.runAfter(0, internal.calls.fetchRecording, { callId, attempt: 0 });
      }
      return;
    }

    if (call.mode === 'vapi' && call.controlUrl) {
      const voice = createVapiVoice() ?? mockVoice;
      try {
        await voice.endCall(call.controlUrl);
      } catch (err) {
        console.warn('[calls.endCall]', err);
      }
    }

    await ctx.runMutation(internal.calls.patchCall, {
      callId,
      status: 'done',
      endedAt: Date.now(),
      recordingStatus: call.mode === 'vapi' ? 'pending' : undefined,
    });

    if (call.mode === 'vapi') {
      await ctx.scheduler.runAfter(2000, internal.calls.fetchRecording, { callId, attempt: 0 });
    }

    // Delay so Vapi can finalize messages before Gemini notes.
    await ctx.scheduler.runAfter(2500, internal.callSummarize.summarizeEndedCall, { callId });
  },
});

/** Optional: force-fail a stuck call (unused by UI). */
export const markFailed = mutation({
  args: { callId: v.id('calls'), error: v.string() },
  handler: async (ctx, { callId, error }) => {
    await ctx.db.patch(callId, { status: 'failed', error, endedAt: Date.now() });
  },
});
