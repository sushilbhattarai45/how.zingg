/**
 * Post-call Ehulak emails: student keypoints + realty doc-upload link.
 */
import { v } from 'convex/values';
import { internalAction, internalMutation, internalQuery } from './_generated/server';
import { internal } from './_generated/api';
import { getNotifyEmail } from '../lib/services/email';
import { collectCallFacts, isMissedCall } from '../lib/callFacts';
import {
  realtyDocRequestBody,
  realtyDocRequestSubject,
  realtyNotifyTo,
  siteBaseUrl,
  studentCallBody,
  studentCallSubject,
  studentNotifyTo,
} from '../lib/notifyEmail';

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function randomToken(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export const getCallNotifyContext = internalQuery({
  args: { callId: v.id('calls') },
  handler: async (ctx, { callId }) => {
    const call = await ctx.db.get(callId);
    if (!call) return null;

    let placeSlug = 'place';
    let placeTitle = 'the office';
    let interestId = call.interestId;
    if (interestId) {
      const interest = await ctx.db.get(interestId);
      if (interest) {
        placeSlug = interest.placeSlug;
        placeTitle = interest.placeTitle;
      }
    }

    return {
      callId,
      userId: call.userId,
      officeId: call.officeId,
      interestId,
      placeSlug,
      placeTitle,
      status: call.status,
      error: call.error,
      transcript: call.transcript,
      answers: call.answers,
      questions: call.questions ?? [],
      notifyEmailSentAt: call.notifyEmailSentAt,
      docRequestEmailSentAt: call.docRequestEmailSentAt,
    };
  },
});

export const markNotifySent = internalMutation({
  args: {
    callId: v.id('calls'),
    notifyEmailSentAt: v.optional(v.number()),
    docRequestEmailSentAt: v.optional(v.number()),
  },
  handler: async (ctx, { callId, notifyEmailSentAt, docRequestEmailSentAt }) => {
    const patch: Record<string, number> = {};
    if (notifyEmailSentAt !== undefined) patch.notifyEmailSentAt = notifyEmailSentAt;
    if (docRequestEmailSentAt !== undefined) patch.docRequestEmailSentAt = docRequestEmailSentAt;
    if (Object.keys(patch).length) await ctx.db.patch(callId, patch);
  },
});

export const insertEmailRow = internalMutation({
  args: {
    userId: v.id('users'),
    officeId: v.optional(v.id('offices')),
    subject: v.string(),
    body: v.string(),
    threadId: v.string(),
    kind: v.string(),
    summary: v.optional(v.string()),
    placeSlug: v.optional(v.string()),
    placeTitle: v.optional(v.string()),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('emails', {
      userId: args.userId,
      officeId: args.officeId,
      direction: 'out',
      subject: args.subject,
      body: args.body,
      summary: args.summary,
      approved: true,
      threadId: args.threadId,
      createdAt: Date.now(),
      kind: args.kind,
      placeSlug: args.placeSlug,
      placeTitle: args.placeTitle,
      reason: args.reason,
    });
  },
});

/** Packet note in the place chat when we email the office. */
export const appendAgentNote = internalMutation({
  args: {
    userId: v.id('users'),
    placeSlug: v.string(),
    message: v.object({
      id: v.string(),
      from: v.string(),
      text: v.string(),
      at: v.number(),
    }),
    status: v.optional(v.string()),
  },
  handler: async (ctx, { userId, placeSlug, message, status }) => {
    const existing = await ctx.db
      .query('placeThreads')
      .withIndex('by_user_slug', (q) => q.eq('userId', userId).eq('placeSlug', placeSlug))
      .first();
    if (existing) {
      const idx = existing.messages.findIndex((m) => m.id === message.id);
      let messages = existing.messages;
      if (idx >= 0) {
        const prev = existing.messages[idx]!;
        // Prefer richer call/doc notes when the same bubble is rewritten.
        if ((message.text?.length ?? 0) <= (prev.text?.length ?? 0)) {
          if (status) {
            await ctx.db.patch(existing._id, { status, updatedAt: Date.now() });
          }
          return;
        }
        messages = existing.messages.map((m, i) => (i === idx ? message : m));
      } else {
        messages = [...existing.messages, message];
      }
      await ctx.db.patch(existing._id, {
        messages,
        ...(status ? { status } : {}),
        updatedAt: Date.now(),
      });
      return;
    }
    await ctx.db.insert('placeThreads', {
      userId,
      placeSlug,
      messages: [message],
      step: 0,
      status: status ?? 'Working',
      updatedAt: Date.now(),
    });
  },
});

export const createDocUploadToken = internalMutation({
  args: {
    userId: v.id('users'),
    callId: v.id('calls'),
    interestId: v.optional(v.id('placeInterests')),
    officeId: v.optional(v.id('offices')),
    placeSlug: v.string(),
    placeTitle: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('docUploadTokens')
      .withIndex('by_call', (q) => q.eq('callId', args.callId))
      .first();
    if (existing && existing.expiresAt > Date.now()) {
      return { token: existing.token, id: existing._id };
    }

    const token = randomToken();
    const now = Date.now();
    const id = await ctx.db.insert('docUploadTokens', {
      token,
      userId: args.userId,
      callId: args.callId,
      interestId: args.interestId,
      officeId: args.officeId,
      placeSlug: args.placeSlug,
      placeTitle: args.placeTitle,
      createdAt: now,
      expiresAt: now + TOKEN_TTL_MS,
      uploadCount: 0,
    });
    return { token, id };
  },
});

/**
 * Fired once when a call first becomes done/failed.
 * Sends student keypoints email; on answered calls also emails realty a unique upload link.
 */
export const notifyCallComplete = internalAction({
  args: { callId: v.id('calls') },
  handler: async (ctx, { callId }) => {
    const info = await ctx.runQuery(internal.notify.getCallNotifyContext, { callId });
    if (!info) return;

    const row = {
      status: info.status,
      transcript: info.transcript,
      answers: info.answers,
      error: info.error,
    };
    const missed = isMissedCall(row);
    const facts = missed || info.status === 'failed' ? [] : collectCallFacts(row);
    const email = getNotifyEmail();
    const now = Date.now();

    if (!info.notifyEmailSentAt) {
      const subject = studentCallSubject({
        placeTitle: info.placeTitle,
        status: info.status,
        missed,
        facts,
      });
      const body = studentCallBody({
        placeTitle: info.placeTitle,
        status: info.status,
        missed,
        facts,
      });
      const to = studentNotifyTo();
      try {
        await email.send({
          to,
          subject,
          body,
          text: body,
          threadId: `call-${callId}`,
          campaign: 'how.zingg-call-notify',
        });
      } catch (err) {
        console.warn('[notify.notifyCallComplete] student email failed', err);
      }
      await ctx.runMutation(internal.notify.insertEmailRow, {
        userId: info.userId,
        officeId: info.officeId,
        subject,
        body,
        threadId: `call-${callId}`,
        kind: 'student_notify',
        summary: facts.slice(0, 3).join(' · ') || (missed ? 'Missed call' : 'Call complete'),
        placeSlug: info.placeSlug,
        placeTitle: info.placeTitle,
        reason: missed ? 'Missed-call update to you' : 'Call keypoints emailed to you',
      });
      await ctx.runMutation(internal.notify.markNotifySent, {
        callId,
        notifyEmailSentAt: now,
      });
    }

    // Realty upload link only when someone actually talked (answered).
    if (!missed && info.status === 'done' && !info.docRequestEmailSentAt) {
      const { token } = await ctx.runMutation(internal.notify.createDocUploadToken, {
        userId: info.userId,
        callId,
        interestId: info.interestId,
        officeId: info.officeId,
        placeSlug: info.placeSlug,
        placeTitle: info.placeTitle,
      });
      const uploadUrl = `${siteBaseUrl().replace(/\/$/, '')}/office/upload/${token}`;
      const subject = realtyDocRequestSubject(info.placeTitle);
      const body = realtyDocRequestBody({
        placeTitle: info.placeTitle,
        studentLabel: 'a how.zingg student',
        uploadUrl,
      });
      const reason = 'asked them to upload a floor plan, packet, or fee sheet';
      try {
        await email.send({
          to: realtyNotifyTo(),
          subject,
          body,
          text: body,
          threadId: `doc-req-${callId}`,
          campaign: 'how.zingg-doc-request',
        });
      } catch (err) {
        console.warn('[notify.notifyCallComplete] realty email failed', err);
      }
      await ctx.runMutation(internal.notify.insertEmailRow, {
        userId: info.userId,
        officeId: info.officeId,
        subject,
        body,
        threadId: `doc-req-${callId}`,
        kind: 'realty_doc_request',
        summary: uploadUrl,
        placeSlug: info.placeSlug,
        placeTitle: info.placeTitle,
        reason,
      });
      await ctx.runMutation(internal.notify.appendAgentNote, {
        userId: info.userId,
        placeSlug: info.placeSlug,
        status: 'Waiting on office docs',
        message: {
          id: `note-email-office-${callId}`,
          from: 'packet',
          text: `I emailed the leasing office for ${info.placeTitle} — ${reason}. I'll drop anything they send into this chat.`,
          at: Date.now(),
        },
      });
      await ctx.runMutation(internal.notify.markNotifySent, {
        callId,
        docRequestEmailSentAt: Date.now(),
      });
    }
  },
});

/** Schedule notify from mutations that cannot import the action cyclically. */
export const scheduleNotifyCallComplete = internalMutation({
  args: { callId: v.id('calls') },
  handler: async (ctx, { callId }) => {
    const call = await ctx.db.get(callId);
    if (!call) return;
    if (call.notifyEmailSentAt && (call.docRequestEmailSentAt || call.status === 'failed')) return;
    await ctx.scheduler.runAfter(0, internal.notify.notifyCallComplete, { callId });
  },
});
