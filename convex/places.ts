/**
 * Swipe yes → save interest. Calls / schedules from My Places dial DEMO_CALL_TO only.
 */
import { getAuthUserId } from '@convex-dev/auth/server';
import { v, ConvexError } from 'convex/values';
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  query,
} from './_generated/server';
import { api, internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import {
  assertCanDial,
  CallGuardrailError,
  clampCallbackMinutes,
  clampScheduleDelayMs,
  earliestDialAt,
  MAX_PENDING_PER_USER,
} from '../lib/callGuardrails';
import { summarizePriorCall } from '../lib/rules';

/** Who we dial for “calling the realty” in the demo — strictly DEMO_CALL_TO. */
function demoDialNumber(): string {
  const dedicated = process.env.DEMO_CALL_TO?.trim();
  if (dedicated) return dedicated;
  throw new ConvexError(
    'Set DEMO_CALL_TO to your phone (E.164). Place calls never dial the real realty office.',
  );
}

function questionsFor(interest: { unitType: string; placeTitle: string }): string[] {
  return [
    `What is the monthly rent for a ${interest.unitType} at ${interest.placeTitle}?`,
    `Are there any current move-in specials at ${interest.placeTitle}?`,
    `Do you accept applicants without a US Social Security number at ${interest.placeTitle}?`,
  ];
}

export const saveInterest = internalMutation({
  args: {
    userId: v.id('users'),
    placeSlug: v.string(),
    placeTitle: v.string(),
    addressQuery: v.string(),
    unitType: v.string(),
    rent: v.number(),
    callId: v.optional(v.id('calls')),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('placeInterests', {
      ...args,
      createdAt: Date.now(),
    });
  },
});

export const attachCall = internalMutation({
  args: { interestId: v.id('placeInterests'), callId: v.id('calls') },
  handler: async (ctx, { interestId, callId }) => {
    await ctx.db.patch(interestId, { callId, scheduledCallId: undefined });
  },
});

export const setScheduledCallId = internalMutation({
  args: { interestId: v.id('placeInterests'), callId: v.id('calls') },
  handler: async (ctx, { interestId, callId }) => {
    await ctx.db.patch(interestId, { scheduledCallId: callId });
  },
});

export const clearScheduledCallId = internalMutation({
  args: { interestId: v.id('placeInterests'), callId: v.optional(v.id('calls')) },
  handler: async (ctx, { interestId, callId }) => {
    const row = await ctx.db.get(interestId);
    if (!row) return;
    if (callId && row.scheduledCallId && row.scheduledCallId !== callId) return;
    await ctx.db.patch(interestId, { scheduledCallId: undefined });
  },
});

export const getInterest = internalQuery({
  args: { interestId: v.id('placeInterests') },
  handler: async (ctx, { interestId }) => ctx.db.get(interestId),
});

/** Cancel a pending scheduled call row (does not dial). */
export const markScheduleCanceled = internalMutation({
  args: { callId: v.id('calls') },
  handler: async (ctx, { callId }) => {
    const call = await ctx.db.get(callId);
    if (!call || call.status !== 'scheduled' || call.canceledAt) return;
    await ctx.db.patch(callId, {
      canceledAt: Date.now(),
      status: 'failed',
      endedAt: Date.now(),
      error: 'Canceled',
    });
  },
});

type LastCallSummary = {
  callId: Id<'calls'>;
  status: string;
  startedAt?: number;
  endedAt?: number;
  transcript: { speaker: 'caller' | 'office'; text: string; at: number }[];
  answers?: {
    available?: boolean | 'unknown';
    availableDate?: string;
    rent?: number;
    deposit?: number;
    fees?: string;
    noSSNOptions?: string;
    specials?: string;
    packetEmail?: string;
    notes?: string;
  };
  mode?: 'mock' | 'vapi';
  isExample?: boolean;
  recordingUrl: string | null;
  hasPlayableRecording: boolean;
  recordingStatus?: 'pending' | 'ready' | 'unavailable';
};

type ScheduledSummary = {
  callId: Id<'calls'>;
  scheduledFor: number;
  scheduleSource?: 'user' | 'receiver' | 'immediate';
  scheduleReason?: string;
};

/** Saved places for the signed-in (or demo) user — with last call + pending schedule. */
export const listMine = query({
  args: {},
  handler: async (ctx) => {
    let userId = await getAuthUserId(ctx);
    if (!userId) {
      const demo = await ctx.db
        .query('users')
        .withIndex('by_isDemo', (q) => q.eq('isDemo', true))
        .first();
      userId = demo?._id ?? null;
    }
    if (!userId) return [];

    const interests = await ctx.db
      .query('placeInterests')
      .withIndex('by_user', (q) => q.eq('userId', userId!))
      .order('desc')
      .collect();

    const enriched = await Promise.all(
      interests.map(async (row) => {
        let lastCall: LastCallSummary | null = null;
        if (row.callId) {
          const call = await ctx.db.get(row.callId);
          if (call && call.status !== 'scheduled') {
            const storedUrl = call.recordingStorageId
              ? await ctx.storage.getUrl(call.recordingStorageId)
              : null;
            lastCall = {
              callId: call._id,
              status: call.status,
              startedAt: call.startedAt,
              endedAt: call.endedAt,
              transcript: call.transcript,
              answers: call.answers,
              mode: call.mode,
              isExample: call.isExample,
              recordingUrl: storedUrl ?? call.recordingUrl ?? null,
              hasPlayableRecording: Boolean(storedUrl),
              recordingStatus: call.recordingStatus,
            };
          }
        }

        let scheduledCall: ScheduledSummary | null = null;
        if (row.scheduledCallId) {
          const sched = await ctx.db.get(row.scheduledCallId);
          if (
            sched &&
            sched.status === 'scheduled' &&
            !sched.canceledAt &&
            typeof sched.scheduledFor === 'number'
          ) {
            scheduledCall = {
              callId: sched._id,
              scheduledFor: sched.scheduledFor,
              scheduleSource: sched.scheduleSource,
              scheduleReason: sched.scheduleReason,
            };
          }
        }

        return { ...row, lastCall, scheduledCall };
      }),
    );

    // One card per place: prefer the row with the most recent call, else newest save.
    const bySlug = new Map<string, (typeof enriched)[number]>();
    for (const row of enriched) {
      const prev = bySlug.get(row.placeSlug);
      if (!prev) {
        bySlug.set(row.placeSlug, row);
        continue;
      }
      const prevAt = prev.lastCall?.endedAt ?? prev.lastCall?.startedAt ?? 0;
      const nextAt = row.lastCall?.endedAt ?? row.lastCall?.startedAt ?? 0;
      const prefer =
        nextAt > prevAt ||
        (!prev.lastCall && row.lastCall) ||
        (!prev.scheduledCall && row.scheduledCall);
      if (prefer) bySlug.set(row.placeSlug, row);
    }

    return Array.from(bySlug.values()).sort((a, b) => b.createdAt - a.createdAt);
  },
});

/**
 * Right-swipe: save only. Calling happens from My Places and always dials DEMO_CALL_TO.
 */
export const savePlace = action({
  args: {
    placeSlug: v.string(),
    placeTitle: v.string(),
    unitType: v.string(),
    rent: v.number(),
    addressQuery: v.string(),
  },
  handler: async (ctx, args): Promise<{ interestId: Id<'placeInterests'> }> => {
    let userId = await getAuthUserId(ctx);
    if (!userId) {
      userId = await ctx.runQuery(internal.calls.demoUserId, {});
    }
    if (!userId) {
      throw new ConvexError('Sign in (or run npm run seed) before saving a place.');
    }

    const interestId: Id<'placeInterests'> = await ctx.runMutation(internal.places.saveInterest, {
      userId,
      placeSlug: args.placeSlug,
      placeTitle: args.placeTitle,
      addressQuery: args.addressQuery,
      unitType: args.unitType,
      rent: args.rent,
    });
    return { interestId };
  },
});

type InterestRow = {
  _id: Id<'placeInterests'>;
  userId: Id<'users'>;
  placeTitle: string;
  unitType: string;
  callId?: Id<'calls'>;
  scheduledCallId?: Id<'calls'>;
};

/** Build recall memory from the place's last attached call (if any). */
async function recallContextForInterest(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ctx: any,
  interest: InterestRow,
): Promise<{ isRecall: boolean; callMemory?: string; placeTitle: string }> {
  const placeTitle = interest.placeTitle;
  if (!interest.callId) return { isRecall: false, placeTitle };
  const prior = await ctx.runQuery(internal.calls.internalGet, { callId: interest.callId });
  if (!prior || !Array.isArray(prior.transcript) || prior.transcript.length === 0) {
    return { isRecall: false, placeTitle };
  }
  // Only treat finished / failed prior calls as memory (not an in-progress dial).
  if (prior.status === 'ringing' || prior.status === 'live' || prior.status === 'scheduled') {
    return { isRecall: false, placeTitle };
  }
  return {
    isRecall: true,
    placeTitle,
    callMemory: summarizePriorCall({
      placeTitle,
      transcript: prior.transcript,
      answers: prior.answers,
    }),
  };
}

async function resolveOwnedInterest(
  // Action ctx — keep loose so we don't fight Convex generic ActionCtx variance.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ctx: any,
  interestId: Id<'placeInterests'>,
): Promise<{ interest: InterestRow; userId: Id<'users'> }> {
  const interest = (await ctx.runQuery(internal.places.getInterest, {
    interestId,
  })) as InterestRow | null;
  if (!interest) throw new ConvexError('Saved place not found.');

  let userId = (await getAuthUserId(ctx)) as Id<'users'> | null;
  if (!userId) {
    userId = (await ctx.runQuery(internal.calls.demoUserId, {})) as Id<'users'> | null;
  }
  if (!userId || interest.userId !== userId) {
    throw new ConvexError('You can only call about your own saved places.');
  }
  return { interest, userId };
}

/**
 * From My Places: start Caller about a saved place immediately.
 * Phone is never taken from the client — only DEMO_CALL_TO is dialed.
 */
export const callSaved = action({
  args: { interestId: v.id('placeInterests') },
  handler: async (
    ctx,
    { interestId },
  ): Promise<{ callId: Id<'calls'>; dialed: string }> => {
    const phone = demoDialNumber();
    const { interest } = await resolveOwnedInterest(ctx, interestId);

    // Replace any pending schedule for this place.
    if (interest.scheduledCallId) {
      await ctx.runMutation(internal.places.markScheduleCanceled, {
        callId: interest.scheduledCallId,
      });
      await ctx.runMutation(internal.places.clearScheduledCallId, {
        interestId,
        callId: interest.scheduledCallId,
      });
    }

    const recall = await recallContextForInterest(ctx, interest);

    const started = await ctx.runAction(api.calls.startCall, {
      phone,
      questions: questionsFor(interest),
      scheduleSource: 'immediate',
      interestId,
      isRecall: recall.isRecall,
      callMemory: recall.callMemory,
      placeTitle: recall.placeTitle,
      scheduleReason: recall.isRecall ? 'User recall from My Places' : undefined,
    });
    const callId: Id<'calls'> = started.callId;
    await ctx.runMutation(internal.places.attachCall, { interestId, callId });
    return { callId, dialed: phone };
  },
});

/**
 * Schedule a future dial for a saved place (user presets). Always DEMO_CALL_TO.
 */
export const scheduleCall = action({
  args: {
    interestId: v.id('placeInterests'),
    delayMinutes: v.number(),
    reason: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { interestId, delayMinutes, reason },
  ): Promise<{ callId: Id<'calls'>; scheduledFor: number; dialed: string }> => {
    const phone = demoDialNumber();
    const { interest, userId } = await resolveOwnedInterest(ctx, interestId);

    const delayMs = clampScheduleDelayMs(delayMinutes * 60_000);
    const now = Date.now();

    const stats = await ctx.runQuery(internal.calls.dialStats, {
      userId,
      toNumber: phone,
      now,
    });
    if (stats.pendingCount >= MAX_PENDING_PER_USER && !interest.scheduledCallId) {
      throw new ConvexError(
        `Too many pending scheduled calls (max ${MAX_PENDING_PER_USER}). Cancel one first.`,
      );
    }
    // Soft-check hour/day so we don't queue hopeless jobs (still re-checked at fire).
    try {
      assertCanDial({
        lastDialAt: null, // schedule itself is not an immediate dial
        dialsLastHour: stats.dialsLastHour,
        dialsToday: stats.dialsToday,
        pendingCount: interest.scheduledCallId ? stats.pendingCount - 1 : stats.pendingCount,
        now,
      });
    } catch (err) {
      if (err instanceof CallGuardrailError && !/within a minute/i.test(err.message)) {
        throw new ConvexError(err.message);
      }
    }

    // Cancel existing pending schedule for this place (replace, don't stack).
    if (interest.scheduledCallId) {
      await ctx.runMutation(internal.places.markScheduleCanceled, {
        callId: interest.scheduledCallId,
      });
    }

    let scheduledFor = now + delayMs;
    const earliest = earliestDialAt(stats.lastDialAt, now);
    if (scheduledFor < earliest) scheduledFor = earliest;

    const callId: Id<'calls'> = await ctx.runMutation(internal.calls.insertScheduledCall, {
      userId,
      toNumber: phone,
      questions: questionsFor(interest),
      scheduledFor,
      scheduleSource: 'user',
      scheduleReason: reason ?? `Scheduled by you in ${Math.round(delayMs / 60_000)} min`,
      interestId,
    });
    await ctx.runMutation(internal.places.setScheduledCallId, { interestId, callId });

    const wait = Math.max(0, scheduledFor - Date.now());
    await ctx.scheduler.runAfter(wait, internal.calls.executeScheduledDial, { callId });

    return { callId, scheduledFor, dialed: phone };
  },
});

export const cancelSchedule = action({
  args: { interestId: v.id('placeInterests') },
  handler: async (ctx, { interestId }): Promise<{ canceled: boolean }> => {
    const { interest } = await resolveOwnedInterest(ctx, interestId);
    if (!interest.scheduledCallId) return { canceled: false };
    await ctx.runMutation(internal.places.markScheduleCanceled, {
      callId: interest.scheduledCallId,
    });
    await ctx.runMutation(internal.places.clearScheduledCallId, {
      interestId,
      callId: interest.scheduledCallId,
    });
    return { canceled: true };
  },
});

/**
 * Receiver asked to be called back — auto-schedule (clamped 1–60 min).
 */
export const scheduleReceiverCallback = internalAction({
  args: {
    interestId: v.id('placeInterests'),
    delayMinutes: v.number(),
    fromCallId: v.id('calls'),
  },
  handler: async (ctx, { interestId, delayMinutes, fromCallId }) => {
    const interest = await ctx.runQuery(internal.places.getInterest, { interestId });
    if (!interest) return;

    let phone: string;
    try {
      phone = demoDialNumber();
    } catch {
      return;
    }

    const minutes = clampCallbackMinutes(delayMinutes);
    const delayMs = clampScheduleDelayMs(minutes * 60_000);
    const now = Date.now();
    const stats = await ctx.runQuery(internal.calls.dialStats, {
      userId: interest.userId,
      toNumber: phone,
      now,
    });

    if (stats.pendingCount >= MAX_PENDING_PER_USER && !interest.scheduledCallId) {
      return;
    }

    if (interest.scheduledCallId) {
      await ctx.runMutation(internal.places.markScheduleCanceled, {
        callId: interest.scheduledCallId,
      });
    }

    let scheduledFor = now + delayMs;
    const earliest = earliestDialAt(stats.lastDialAt, now);
    if (scheduledFor < earliest) scheduledFor = earliest;

    const callId: Id<'calls'> = await ctx.runMutation(internal.calls.insertScheduledCall, {
      userId: interest.userId,
      toNumber: phone,
      questions: questionsFor(interest),
      scheduledFor,
      scheduleSource: 'receiver',
      scheduleReason: `Receiver asked to call back in ${minutes} minutes (from call ${fromCallId})`,
      interestId,
    });
    await ctx.runMutation(internal.places.setScheduledCallId, { interestId, callId });
    const wait = Math.max(0, scheduledFor - Date.now());
    await ctx.scheduler.runAfter(wait, internal.calls.executeScheduledDial, { callId });
  },
});
