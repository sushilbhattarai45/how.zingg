/**
 * Office document upload via unique token link + LLM extract + student notify.
 */
import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';
import { ConvexError } from 'convex/values';
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from './_generated/server';
import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';

export const getTokenInfo = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const row = await ctx.db
      .query('docUploadTokens')
      .withIndex('by_token', (q) => q.eq('token', token))
      .first();
    if (!row) return { ok: false as const, reason: 'invalid' as const };
    if (row.expiresAt < Date.now()) return { ok: false as const, reason: 'expired' as const };
    return {
      ok: true as const,
      placeTitle: row.placeTitle,
      placeSlug: row.placeSlug,
      expiresAt: row.expiresAt,
      uploadCount: row.uploadCount ?? 0,
    };
  },
});

export const generateUploadUrl = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const row = await ctx.db
      .query('docUploadTokens')
      .withIndex('by_token', (q) => q.eq('token', token))
      .first();
    if (!row) throw new ConvexError('Invalid upload link.');
    if (row.expiresAt < Date.now()) throw new ConvexError('This upload link has expired.');
    return await ctx.storage.generateUploadUrl();
  },
});

export const receiveOfficeDocument = mutation({
  args: {
    token: v.string(),
    storageId: v.id('_storage'),
    fileName: v.string(),
    contentType: v.optional(v.string()),
  },
  handler: async (ctx, { token, storageId, fileName, contentType }) => {
    const row = await ctx.db
      .query('docUploadTokens')
      .withIndex('by_token', (q) => q.eq('token', token))
      .first();
    if (!row) throw new ConvexError('Invalid upload link.');
    if (row.expiresAt < Date.now()) throw new ConvexError('This upload link has expired.');

    const cleanName = fileName.trim().slice(0, 200) || 'document';
    const docId = await ctx.db.insert('documents', {
      userId: row.userId,
      kind: 'other',
      fileId: storageId,
      fileName: cleanName,
      status: 'uploaded',
      callId: row.callId,
      interestId: row.interestId,
      officeId: row.officeId,
      placeSlug: row.placeSlug,
      placeTitle: row.placeTitle,
      source: 'office_upload',
      contentType: contentType?.slice(0, 120),
      createdAt: Date.now(),
    });

    await ctx.db.patch(row._id, {
      usedAt: Date.now(),
      uploadCount: (row.uploadCount ?? 0) + 1,
    });

    await ctx.scheduler.runAfter(0, internal.documentsExtract.extractOfficeDocument, {
      documentId: docId,
    });
    return { documentId: docId };
  },
});

export const getDocument = internalQuery({
  args: { documentId: v.id('documents') },
  handler: async (ctx, { documentId }) => {
    return await ctx.db.get(documentId);
  },
});

export const getInterestBrief = internalQuery({
  args: { interestId: v.id('placeInterests') },
  handler: async (ctx, { interestId }) => {
    const row = await ctx.db.get(interestId);
    if (!row) return null;
    return {
      unitType: row.unitType,
      placeTitle: row.placeTitle,
      placeSlug: row.placeSlug,
    };
  },
});

/** Extracted office-doc facts for Gemini place chat. */
export const listDocContext = internalQuery({
  args: { userId: v.id('users'), placeSlug: v.string() },
  handler: async (ctx, { userId, placeSlug }) => {
    const docs = await ctx.db
      .query('documents')
      .withIndex('by_user_slug', (q) => q.eq('userId', userId).eq('placeSlug', placeSlug))
      .collect();
    return docs
      .filter((d) => d.source === 'office_upload')
      .map((d) => {
        const facts = Object.entries(d.extracted ?? {})
          .filter(([k]) => k !== 'summary' && k !== 'wantedUnit')
          .map(([, val]) => val)
          .filter(Boolean);
        return {
          fileName: d.fileName ?? 'document',
          summary: d.summary,
          facts: facts.slice(0, 12),
        };
      });
  },
});

/** Latest office upload for a place (for live Gemini re-read in chat). */
export const latestOfficeFile = internalQuery({
  args: { userId: v.id('users'), placeSlug: v.string() },
  handler: async (ctx, { userId, placeSlug }) => {
    const docs = await ctx.db
      .query('documents')
      .withIndex('by_user_slug', (q) => q.eq('userId', userId).eq('placeSlug', placeSlug))
      .collect();
    const office = docs
      .filter((d) => d.source === 'office_upload' && d.fileId)
      .sort((a, b) => (b.createdAt ?? b._creationTime) - (a.createdAt ?? a._creationTime));
    const d = office[0];
    if (!d?.fileId) return null;
    return {
      documentId: d._id,
      fileId: d.fileId,
      fileName: d.fileName ?? 'document',
      contentType: d.contentType,
    };
  },
});

/** Re-run Gemini extract on an existing office document (after key was set). */
export const reextract = action({
  args: { documentId: v.id('documents'), guestKey: v.optional(v.string()) },
  handler: async (ctx, { documentId, guestKey }) => {
    const doc = await ctx.runQuery(internal.documents.getDocument, { documentId });
    if (!doc) throw new ConvexError('Document not found');
    if (guestKey?.trim()) {
      const guest = await ctx.runQuery(internal.places.findUserByGuestKey, { guestKey });
      if (!guest || guest._id !== doc.userId) throw new ConvexError('Not your document');
    }
    await ctx.scheduler.runAfter(0, internal.documentsExtract.extractOfficeDocument, {
      documentId,
    });
    return { ok: true as const };
  },
});

/** Public (auth/guest) view metadata + signed storage URL for the in-app viewer. */
export const getViewable = query({
  args: { documentId: v.id('documents'), guestKey: v.optional(v.string()) },
  handler: async (ctx, { documentId, guestKey }) => {
    const doc = await ctx.db.get(documentId);
    if (!doc || doc.source !== 'office_upload') return null;

    let userId = await getAuthUserId(ctx);
    if (!userId && guestKey?.trim()) {
      const guest = await ctx.db
        .query('users')
        .withIndex('by_guestKey', (q) => q.eq('guestKey', guestKey))
        .first();
      userId = guest?._id ?? null;
    }
    if (!userId || doc.userId !== userId) return null;

    const url = doc.fileId ? await ctx.storage.getUrl(doc.fileId) : null;
    return {
      documentId: doc._id,
      fileName: doc.fileName ?? 'document',
      contentType: doc.contentType,
      summary: doc.summary,
      placeTitle: doc.placeTitle,
      url,
    };
  },
});

export const patchDocument = internalMutation({
  args: {
    documentId: v.id('documents'),
    status: v.optional(
      v.union(v.literal('uploaded'), v.literal('read'), v.literal('needs_review')),
    ),
    summary: v.optional(v.string()),
    extracted: v.optional(v.record(v.string(), v.string())),
  },
  handler: async (ctx, { documentId, ...rest }) => {
    const patch: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(rest)) {
      if (val !== undefined) patch[k] = val;
    }
    if (Object.keys(patch).length) await ctx.db.patch(documentId, patch);
  },
});

export const appendDocThreadMessage = internalMutation({
  args: {
    userId: v.id('users'),
    placeSlug: v.string(),
    message: v.object({
      id: v.string(),
      from: v.string(),
      text: v.string(),
      at: v.number(),
    }),
  },
  handler: async (ctx, { userId, placeSlug, message }) => {
    const existing = await ctx.db
      .query('placeThreads')
      .withIndex('by_user_slug', (q) => q.eq('userId', userId).eq('placeSlug', placeSlug))
      .first();
    if (existing) {
      const idx = existing.messages.findIndex((m) => m.id === message.id);
      let messages = existing.messages;
      if (idx >= 0) {
        const prev = existing.messages[idx]!;
        if ((message.text?.length ?? 0) <= (prev.text?.length ?? 0)) return;
        messages = existing.messages.map((m, i) => (i === idx ? message : m));
      } else {
        messages = [...existing.messages, message];
      }
      await ctx.db.patch(existing._id, {
        messages,
        status: 'Document received',
        updatedAt: Date.now(),
      });
      return;
    }
    await ctx.db.insert('placeThreads', {
      userId,
      placeSlug,
      messages: [message],
      step: 0,
      status: 'Document received',
      updatedAt: Date.now(),
    });
  },
});

/** Documents for the signed-in / guest user, grouped by placeSlug. */
export const listMineByPlace = query({
  args: { guestKey: v.optional(v.string()) },
  handler: async (ctx, { guestKey }) => {
    let userId = await getAuthUserId(ctx);
    if (!userId && guestKey?.trim()) {
      const guest = await ctx.db
        .query('users')
        .withIndex('by_guestKey', (q) => q.eq('guestKey', guestKey))
        .first();
      userId = guest?._id ?? null;
    }
    if (!userId) return {} as Record<string, DocListItem[]>;

    const docs = await ctx.db
      .query('documents')
      .withIndex('by_user', (q) => q.eq('userId', userId!))
      .collect();

    const bySlug: Record<string, DocListItem[]> = {};
    for (const d of docs) {
      if (d.source !== 'office_upload') continue;
      const slug = d.placeSlug;
      if (!slug) continue;
      const url = d.fileId ? await ctx.storage.getUrl(d.fileId) : null;
      (bySlug[slug] ??= []).push({
        documentId: d._id,
        placeSlug: slug,
        placeTitle: d.placeTitle ?? slug,
        fileName: d.fileName ?? 'document',
        summary: d.summary,
        status: d.status,
        createdAt: d.createdAt ?? d._creationTime,
        callId: d.callId,
        url,
        contentType: d.contentType,
      });
    }
    for (const slug of Object.keys(bySlug)) {
      bySlug[slug]!.sort((a, b) => a.createdAt - b.createdAt);
    }
    return bySlug;
  },
});

/** Outbound emails tied to a place (office doc requests, etc.) for chat log rows. */
export const listEmailsByPlace = query({
  args: { guestKey: v.optional(v.string()) },
  handler: async (ctx, { guestKey }) => {
    let userId = await getAuthUserId(ctx);
    if (!userId && guestKey?.trim()) {
      const guest = await ctx.db
        .query('users')
        .withIndex('by_guestKey', (q) => q.eq('guestKey', guestKey))
        .first();
      userId = guest?._id ?? null;
    }
    if (!userId) return {} as Record<string, EmailListItem[]>;

    const rows = await ctx.db
      .query('emails')
      .withIndex('by_user', (q) => q.eq('userId', userId!))
      .collect();

    const bySlug: Record<string, EmailListItem[]> = {};
    for (const e of rows) {
      if (!e.placeSlug) continue;
      if (e.kind !== 'realty_doc_request') continue;
      (bySlug[e.placeSlug] ??= []).push({
        emailId: e._id,
        placeSlug: e.placeSlug,
        placeTitle: e.placeTitle ?? e.placeSlug,
        kind: e.kind ?? 'out',
        toLabel: 'the leasing office',
        reason: e.reason ?? 'follow-up after the call',
        createdAt: e.createdAt,
      });
    }
    for (const slug of Object.keys(bySlug)) {
      bySlug[slug]!.sort((a, b) => a.createdAt - b.createdAt);
    }
    return bySlug;
  },
});

type DocListItem = {
  documentId: Id<'documents'>;
  placeSlug: string;
  placeTitle: string;
  fileName: string;
  summary?: string;
  status: string;
  createdAt: number;
  callId?: Id<'calls'>;
  url?: string | null;
  contentType?: string;
};

type EmailListItem = {
  emailId: Id<'emails'>;
  placeSlug: string;
  placeTitle: string;
  kind: string;
  toLabel: string;
  reason: string;
  createdAt: number;
};
