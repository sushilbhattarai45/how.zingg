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
  mutation,
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

function questionsFor(
  interest: { unitType: string; placeTitle: string },
  extra: string[] = [],
): string[] {
  const base = [
    `What is the monthly rent for a ${interest.unitType} at ${interest.placeTitle}?`,
    `Are there any current move-in specials at ${interest.placeTitle}?`,
    `Do you accept applicants without a US Social Security number at ${interest.placeTitle}?`,
  ];
  const extras = extra.map((q) => q.trim()).filter(Boolean);
  // User-asked questions first so Caller leads with them.
  const merged = [...extras];
  for (const q of base) {
    if (!merged.some((e) => e.toLowerCase() === q.toLowerCase())) merged.push(q);
  }
  return merged;
}

/** Prefer signed-in user; else the browser guestKey user — never the shared demo user. */
export const findUserByGuestKey = internalQuery({
  args: { guestKey: v.string() },
  handler: async (ctx, { guestKey }) => {
    if (!guestKey.trim()) return null;
    return await ctx.db
      .query('users')
      .withIndex('by_guestKey', (q) => q.eq('guestKey', guestKey))
      .first();
  },
});

export const createGuestUser = internalMutation({
  args: { guestKey: v.string() },
  handler: async (ctx, { guestKey }) => {
    const existing = await ctx.db
      .query('users')
      .withIndex('by_guestKey', (q) => q.eq('guestKey', guestKey))
      .first();
    if (existing) return existing._id;
    return await ctx.db.insert('users', {
      guestKey,
      name: 'Guest',
      isAnonymous: true,
    });
  },
});

async function resolveQueryUserId(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ctx: any,
  guestKey?: string,
): Promise<Id<'users'> | null> {
  const authId = (await getAuthUserId(ctx)) as Id<'users'> | null;
  if (authId) return authId;
  if (guestKey?.trim()) {
    const guest = await ctx.db
      .query('users')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .withIndex('by_guestKey', (q: any) => q.eq('guestKey', guestKey))
      .first();
    return guest?._id ?? null;
  }
  return null;
}

async function resolveActionUserId(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ctx: any,
  guestKey?: string,
): Promise<Id<'users'>> {
  const authId = (await getAuthUserId(ctx)) as Id<'users'> | null;
  if (authId) return authId;
  if (!guestKey?.trim()) {
    throw new ConvexError('Sign in or refresh the page to continue.');
  }
  const existing = await ctx.runQuery(internal.places.findUserByGuestKey, { guestKey });
  if (existing) return existing._id as Id<'users'>;
  return (await ctx.runMutation(internal.places.createGuestUser, { guestKey })) as Id<'users'>;
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
  error?: string;
};

type ScheduledSummary = {
  callId: Id<'calls'>;
  scheduledFor: number;
  scheduleSource?: 'user' | 'receiver' | 'immediate';
  scheduleReason?: string;
};

/** Saved places for the signed-in (or this browser's guest) user — never the shared demo user. */
export const listMine = query({
  args: { guestKey: v.optional(v.string()) },
  handler: async (ctx, { guestKey }) => {
    const userId = await resolveQueryUserId(ctx, guestKey);
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
              error: call.error,
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

export type CallHistoryItem = {
  callId: Id<'calls'>;
  placeSlug: string;
  placeTitle: string;
  interestId?: Id<'placeInterests'>;
  status: string;
  startedAt?: number;
  endedAt?: number;
  scheduledFor?: number;
  scheduleSource?: 'user' | 'receiver' | 'immediate';
  scheduleReason?: string;
  transcript: { speaker: 'caller' | 'office'; text: string; at: number }[];
  answers?: LastCallSummary['answers'];
  mode?: 'mock' | 'vapi';
  isExample?: boolean;
  canceledAt?: number;
  /** e.g. missed:no-answer — used by the workspace chatbot. */
  error?: string;
};

/**
 * Full call history for the workspace conversation, keyed by placeSlug.
 * Multiple calls for the same place are returned newest-first (client sorts chronologically).
 */
export const listCallHistory = query({
  args: { guestKey: v.optional(v.string()) },
  handler: async (ctx, { guestKey }) => {
    const userId = await resolveQueryUserId(ctx, guestKey);
    if (!userId) return {} as Record<string, CallHistoryItem[]>;

    const interests = await ctx.db
      .query('placeInterests')
      .withIndex('by_user', (q) => q.eq('userId', userId!))
      .collect();
    const interestIds = new Set(interests.map((i) => i._id));
    const slugByInterest = new Map(interests.map((i) => [i._id, i.placeSlug] as const));
    const titleByInterest = new Map(interests.map((i) => [i._id, i.placeTitle] as const));
    const slugByCallId = new Map<string, string>();
    const titleByCallId = new Map<string, string>();
    for (const i of interests) {
      if (i.callId) {
        slugByCallId.set(i.callId, i.placeSlug);
        titleByCallId.set(i.callId, i.placeTitle);
      }
      if (i.scheduledCallId) {
        slugByCallId.set(i.scheduledCallId, i.placeSlug);
        titleByCallId.set(i.scheduledCallId, i.placeTitle);
      }
    }

    const byUserCalls = await ctx.db
      .query('calls')
      .withIndex('by_user', (q) => q.eq('userId', userId!))
      .collect();

    // Also pull calls linked on interests (covers older dials that were stored under the demo user).
    const seen = new Set(byUserCalls.map((c) => c._id));
    const linkedCalls = [];
    for (const i of interests) {
      for (const id of [i.callId, i.scheduledCallId]) {
        if (!id || seen.has(id)) continue;
        const call = await ctx.db.get(id);
        if (!call) continue;
        seen.add(call._id);
        linkedCalls.push(call);
      }
    }
    const calls = [...byUserCalls, ...linkedCalls];

    const bySlug: Record<string, CallHistoryItem[]> = {};
    for (const call of calls) {
      // Skip canceled schedules that never dialed.
      if (call.canceledAt && call.status === 'failed' && call.error === 'Canceled') continue;

      let placeSlug: string | undefined;
      let placeTitle: string | undefined;
      if (call.interestId && interestIds.has(call.interestId)) {
        placeSlug = slugByInterest.get(call.interestId);
        placeTitle = titleByInterest.get(call.interestId);
      }
      if (!placeSlug) {
        placeSlug = slugByCallId.get(call._id);
        placeTitle = titleByCallId.get(call._id);
      }
      if (!placeSlug) continue;

      const item: CallHistoryItem = {
        callId: call._id,
        placeSlug,
        placeTitle: placeTitle ?? placeSlug,
        interestId: call.interestId,
        status: call.status,
        startedAt: call.startedAt,
        endedAt: call.endedAt,
        scheduledFor: call.scheduledFor,
        scheduleSource: call.scheduleSource,
        scheduleReason: call.scheduleReason,
        transcript: call.transcript,
        answers: call.answers,
        mode: call.mode,
        isExample: call.isExample,
        canceledAt: call.canceledAt,
        error: call.error,
      };
      (bySlug[placeSlug] ??= []).push(item);
    }

    for (const slug of Object.keys(bySlug)) {
      bySlug[slug]!.sort((a, b) => {
        const at = (c: CallHistoryItem) => c.startedAt ?? c.scheduledFor ?? c.endedAt ?? 0;
        return at(a) - at(b);
      });
    }
    return bySlug;
  },
});

/**
 * Remove a place from My list (all interest rows for that slug). Cancels any pending schedule.
 */
export const removeFromList = action({
  args: { placeSlug: v.string(), guestKey: v.optional(v.string()) },
  handler: async (ctx, { placeSlug, guestKey }): Promise<{ removed: number }> => {
    const userId = await resolveActionUserId(ctx, guestKey);

    const interests = await ctx.runQuery(internal.places.listInterestsBySlug, {
      userId,
      placeSlug,
    });
    for (const row of interests) {
      if (row.scheduledCallId) {
        await ctx.runMutation(internal.places.markScheduleCanceled, {
          callId: row.scheduledCallId,
        });
      }
      await ctx.runMutation(internal.places.deleteInterest, { interestId: row._id });
    }
    await ctx.runMutation(internal.places.deleteThread, { userId, placeSlug });
    return { removed: interests.length };
  },
});

export const deleteThread = internalMutation({
  args: { userId: v.id('users'), placeSlug: v.string() },
  handler: async (ctx, { userId, placeSlug }) => {
    const row = await ctx.db
      .query('placeThreads')
      .withIndex('by_user_slug', (q) => q.eq('userId', userId).eq('placeSlug', placeSlug))
      .first();
    if (row) await ctx.db.delete(row._id);
  },
});

export const upsertThread = mutation({
  args: {
    guestKey: v.optional(v.string()),
    placeSlug: v.string(),
    messages: v.array(
      v.object({
        id: v.string(),
        from: v.string(),
        text: v.string(),
        action: v.optional(v.string()),
        at: v.number(),
      }),
    ),
    step: v.number(),
    status: v.string(),
    pendingAsk: v.optional(
      v.union(v.null(), v.object({ questions: v.array(v.string()) })),
    ),
  },
  handler: async (ctx, args) => {
    let userId = await resolveQueryUserId(ctx, args.guestKey);
    if (!userId) {
      if (!args.guestKey?.trim()) return null;
      const existing = await ctx.db
        .query('users')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .withIndex('by_guestKey', (q: any) => q.eq('guestKey', args.guestKey!))
        .first();
      userId =
        existing?._id ??
        (await ctx.db.insert('users', {
          guestKey: args.guestKey,
          name: 'Guest',
          isAnonymous: true,
        }));
    }
    return await writeThread(ctx, userId, args);
  },
});

async function writeThread(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ctx: any,
  userId: Id<'users'>,
  args: {
    placeSlug: string;
    messages: { id: string; from: string; text: string; action?: string; at: number }[];
    step: number;
    status: string;
    pendingAsk?: { questions: string[] } | null;
  },
) {
  const existing = await ctx.db
    .query('placeThreads')
    .withIndex('by_user_slug', (q: any) => q.eq('userId', userId).eq('placeSlug', args.placeSlug))
    .first();

  // Merge with any longer server thread, then drop content-duplicates (same from+text).
  {
    const byId = new Map<string, (typeof args.messages)[number]>();
    for (const m of existing?.messages ?? []) byId.set(m.id, m);
    for (const m of args.messages) byId.set(m.id, m);
    const byFp = new Map<string, (typeof args.messages)[number]>();
    const sorted = [...byId.values()].sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
    for (const m of sorted) {
      const fp = `${m.from}::${m.text.replace(/\s+/g, ' ').trim().toLowerCase()}`;
      const prev = byFp.get(fp);
      if (!prev) byFp.set(fp, m);
      else if (!prev.action && m.action) byFp.set(fp, { ...m, at: prev.at, id: prev.id });
    }
    args = {
      ...args,
      messages: [...byFp.values()].sort((a, b) => a.at - b.at || a.id.localeCompare(b.id)),
    };
  }
  const messages = args.messages;

  const payload = {
    messages,
    step: args.step,
    status: args.status,
    pendingAsk: args.pendingAsk === undefined ? existing?.pendingAsk : args.pendingAsk ?? undefined,
    updatedAt: Date.now(),
  };
  if (existing) {
    await ctx.db.patch(existing._id, payload);
    return existing._id;
  }
  return await ctx.db.insert('placeThreads', {
    userId,
    placeSlug: args.placeSlug,
    ...payload,
  });
}

export const listThreads = query({
  args: { guestKey: v.optional(v.string()) },
  handler: async (ctx, { guestKey }) => {
    const userId = await resolveQueryUserId(ctx, guestKey);
    if (!userId) {
      return {} as Record<
        string,
        {
          messages: { id: string; from: string; text: string; action?: string; at: number }[];
          step: number;
          status: string;
          pendingAsk?: { questions: string[] } | null;
          updatedAt: number;
        }
      >;
    }
    const rows = await ctx.db
      .query('placeThreads')
      .withIndex('by_user_slug', (q) => q.eq('userId', userId))
      .collect();
    const out: Record<
      string,
      {
        messages: { id: string; from: string; text: string; action?: string; at: number }[];
        step: number;
        status: string;
        pendingAsk?: { questions: string[] } | null;
        updatedAt: number;
      }
    > = {};
    for (const r of rows) {
      out[r.placeSlug] = {
        messages: r.messages,
        step: r.step,
        status: r.status,
        pendingAsk: r.pendingAsk ?? null,
        updatedAt: r.updatedAt,
      };
    }
    return out;
  },
});

export const listInterestsBySlug = internalQuery({
  args: { userId: v.id('users'), placeSlug: v.string() },
  handler: async (ctx, { userId, placeSlug }) => {
    const rows = await ctx.db
      .query('placeInterests')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect();
    return rows.filter((r) => r.placeSlug === placeSlug);
  },
});

export const deleteInterest = internalMutation({
  args: { interestId: v.id('placeInterests') },
  handler: async (ctx, { interestId }) => {
    await ctx.db.delete(interestId);
  },
});

/**
 * Right-swipe: save only. Calling happens from My Places and always dials DEMO_CALL_TO.
 */
export const findInterestBySlug = internalQuery({
  args: { userId: v.id('users'), placeSlug: v.string() },
  handler: async (ctx, { userId, placeSlug }) => {
    const rows = await ctx.db
      .query('placeInterests')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect();
    return rows.find((r) => r.placeSlug === placeSlug) ?? null;
  },
});

export const savePlace = action({
  args: {
    placeSlug: v.string(),
    placeTitle: v.string(),
    unitType: v.string(),
    rent: v.number(),
    addressQuery: v.string(),
    guestKey: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ interestId: Id<'placeInterests'>; alreadySaved: boolean }> => {
    const userId = await resolveActionUserId(ctx, args.guestKey);

    const existing = await ctx.runQuery(internal.places.findInterestBySlug, {
      userId,
      placeSlug: args.placeSlug,
    });
    if (existing) {
      return { interestId: existing._id, alreadySaved: true };
    }

    const interestId: Id<'placeInterests'> = await ctx.runMutation(internal.places.saveInterest, {
      userId,
      placeSlug: args.placeSlug,
      placeTitle: args.placeTitle,
      addressQuery: args.addressQuery,
      unitType: args.unitType,
      rent: args.rent,
    });
    return { interestId, alreadySaved: false };
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
  guestKey?: string,
): Promise<{ interest: InterestRow; userId: Id<'users'> }> {
  const interest = (await ctx.runQuery(internal.places.getInterest, {
    interestId,
  })) as InterestRow | null;
  if (!interest) throw new ConvexError('Saved place not found.');

  const userId = await resolveActionUserId(ctx, guestKey);
  if (interest.userId !== userId) {
    throw new ConvexError('You can only call about your own saved places.');
  }
  return { interest, userId };
}

/**
 * From My Places: start Caller about a saved place immediately.
 * Phone is never taken from the client — only DEMO_CALL_TO is dialed.
 */
export const callSaved = action({
  args: {
    interestId: v.id('placeInterests'),
    guestKey: v.optional(v.string()),
    /** Extra questions from chat (asked first on the call). */
    extraQuestions: v.optional(v.array(v.string())),
  },
  handler: async (
    ctx,
    { interestId, guestKey, extraQuestions },
  ): Promise<{ callId: Id<'calls'>; dialed: string }> => {
    const phone = demoDialNumber();
    const { interest } = await resolveOwnedInterest(ctx, interestId, guestKey);

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
      questions: questionsFor(interest, extraQuestions ?? []),
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
    guestKey: v.optional(v.string()),
    extraQuestions: v.optional(v.array(v.string())),
  },
  handler: async (
    ctx,
    { interestId, delayMinutes, reason, guestKey, extraQuestions },
  ): Promise<{ callId: Id<'calls'>; scheduledFor: number; dialed: string }> => {
    const phone = demoDialNumber();
    const { interest, userId } = await resolveOwnedInterest(ctx, interestId, guestKey);

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
      questions: questionsFor(interest, extraQuestions ?? []),
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
  args: { interestId: v.id('placeInterests'), guestKey: v.optional(v.string()) },
  handler: async (ctx, { interestId, guestKey }): Promise<{ canceled: boolean }> => {
    const { interest } = await resolveOwnedInterest(ctx, interestId, guestKey);
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
