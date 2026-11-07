/**
 * Student packet: upload / replace / delete docs + 5-day private office view link.
 */
import { getAuthUserId } from '@convex-dev/auth/server';
import { v, ConvexError } from 'convex/values';
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from './_generated/server';
import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { PACKET_VIEW_TTL_MS } from '../lib/studentPacket';
import { getNotifyEmail } from '../lib/services/email';
import {
  realtyNotifyTo,
  realtyPacketShareBody,
  realtyPacketShareSubject,
  siteBaseUrl,
} from '../lib/notifyEmail';

const kindValidator = v.union(
  v.literal('i20'),
  v.literal('ds2019'),
  v.literal('visa'),
  v.literal('funding'),
  v.literal('bank'),
  v.literal('passport'),
  v.literal('other'),
);

function randomToken(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function resolveUserId(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ctx: any,
  guestKey?: string,
): Promise<Id<'users'> | null> {
  const authId = (await getAuthUserId(ctx)) as Id<'users'> | null;
  if (authId) return authId;
  if (guestKey?.trim()) {
    const guest = await ctx.db
      .query('users')
      .withIndex('by_guestKey', (q: { eq: (f: string, v: string) => unknown }) =>
        q.eq('guestKey', guestKey),
      )
      .first();
    return guest?._id ?? null;
  }
  return null;
}

async function requireUserId(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ctx: any,
  guestKey?: string,
): Promise<Id<'users'>> {
  const authId = (await getAuthUserId(ctx)) as Id<'users'> | null;
  if (authId) return authId;
  if (!guestKey?.trim()) throw new ConvexError('Refresh the page to continue.');
  const existing = await ctx.db
    .query('users')
    .withIndex('by_guestKey', (q: { eq: (f: string, v: string) => unknown }) =>
      q.eq('guestKey', guestKey),
    )
    .first();
  if (existing) return existing._id;
  return await ctx.db.insert('users', {
    guestKey,
    name: 'Guest',
    isAnonymous: true,
  });
}

/** Save landing-page trip details onto the guest/auth user. */
export const syncTripProfile = mutation({
  args: {
    guestKey: v.optional(v.string()),
    name: v.optional(v.string()),
    whatsapp: v.optional(v.string()),
    homeCountry: v.optional(v.string()),
    arrivalDate: v.optional(v.string()),
    hasSSN: v.optional(v.union(v.boolean(), v.null())),
    budgetMax: v.optional(v.union(v.number(), v.null())),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx, args.guestKey);
    const patch: Record<string, unknown> = {};
    if (args.name?.trim()) patch.name = args.name.trim().slice(0, 80);
    if (args.whatsapp?.trim()) patch.whatsapp = args.whatsapp.trim().slice(0, 40);
    if (args.homeCountry?.trim()) patch.homeCountry = args.homeCountry.trim().slice(0, 80);
    if (args.arrivalDate?.trim()) patch.arrivalDate = args.arrivalDate.trim().slice(0, 32);
    if (args.hasSSN === true || args.hasSSN === false) patch.hasSSN = args.hasSSN;
    if (typeof args.budgetMax === 'number' && Number.isFinite(args.budgetMax)) {
      patch.budgetMax = Math.round(args.budgetMax);
    }
    if (Object.keys(patch).length) await ctx.db.patch(userId, patch);
    return { userId };
  },
});

export const getMyProfile = query({
  args: { guestKey: v.optional(v.string()) },
  handler: async (ctx, { guestKey }) => {
    const userId = await resolveUserId(ctx, guestKey);
    if (!userId) return null;
    const u = await ctx.db.get(userId);
    if (!u) return null;
    return {
      name: u.name ?? null,
      whatsapp: u.whatsapp ?? null,
      homeCountry: u.homeCountry ?? null,
      arrivalDate: u.arrivalDate ?? null,
      hasSSN: u.hasSSN ?? null,
      budgetMax: u.budgetMax ?? null,
    };
  },
});

export const generateStudentUploadUrl = mutation({
  args: { guestKey: v.optional(v.string()) },
  handler: async (ctx, { guestKey }) => {
    await requireUserId(ctx, guestKey);
    return await ctx.storage.generateUploadUrl();
  },
});

export const receiveStudentDocument = mutation({
  args: {
    guestKey: v.optional(v.string()),
    storageId: v.id('_storage'),
    fileName: v.string(),
    contentType: v.optional(v.string()),
    kind: kindValidator,
    /** When set, replaces an existing doc of this id (must belong to user). */
    replaceDocumentId: v.optional(v.id('documents')),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx, args.guestKey);
    const cleanName = args.fileName.trim().slice(0, 200) || 'document';

    if (args.replaceDocumentId) {
      const old = await ctx.db.get(args.replaceDocumentId);
      if (!old || old.userId !== userId || old.source !== 'student') {
        throw new ConvexError('Document not found.');
      }
      if (old.fileId) {
        try {
          await ctx.storage.delete(old.fileId);
        } catch {
          /* ignore */
        }
      }
      await ctx.db.delete(old._id);
    }

    const documentId = await ctx.db.insert('documents', {
      userId,
      kind: args.kind,
      fileId: args.storageId,
      fileName: cleanName,
      status: 'uploaded',
      source: 'student',
      contentType: args.contentType?.slice(0, 120),
      createdAt: Date.now(),
      summary: `${args.kind} uploaded by student`,
    });
    return { documentId };
  },
});

export const deleteStudentDocument = mutation({
  args: {
    guestKey: v.optional(v.string()),
    documentId: v.id('documents'),
  },
  handler: async (ctx, { guestKey, documentId }) => {
    const userId = await requireUserId(ctx, guestKey);
    const doc = await ctx.db.get(documentId);
    if (!doc || doc.userId !== userId || doc.source !== 'student') {
      throw new ConvexError('Document not found.');
    }
    if (doc.fileId) {
      try {
        await ctx.storage.delete(doc.fileId);
      } catch {
        /* ignore */
      }
    }
    await ctx.db.delete(documentId);
    return { ok: true as const };
  },
});

export const listStudentDocuments = query({
  args: { guestKey: v.optional(v.string()) },
  handler: async (ctx, { guestKey }) => {
    const userId = await resolveUserId(ctx, guestKey);
    if (!userId) return [];
    const docs = await ctx.db
      .query('documents')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect();
    const student = docs
      .filter((d) => d.source === 'student' && d.fileId)
      .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
    const out = [];
    for (const d of student) {
      const url = d.fileId ? await ctx.storage.getUrl(d.fileId) : null;
      out.push({
        documentId: d._id,
        kind: d.kind,
        fileName: d.fileName ?? 'document',
        contentType: d.contentType,
        createdAt: d.createdAt ?? d._creationTime,
        url,
      });
    }
    return out;
  },
});

export const createPacketViewToken = internalMutation({
  args: {
    userId: v.id('users'),
    placeSlug: v.optional(v.string()),
    placeTitle: v.optional(v.string()),
    officeId: v.optional(v.id('offices')),
  },
  handler: async (ctx, args) => {
    const token = randomToken();
    const now = Date.now();
    const id = await ctx.db.insert('packetViewTokens', {
      token,
      userId: args.userId,
      placeSlug: args.placeSlug,
      placeTitle: args.placeTitle,
      officeId: args.officeId,
      createdAt: now,
      expiresAt: now + PACKET_VIEW_TTL_MS,
      viewCount: 0,
    });
    return { token, id, expiresAt: now + PACKET_VIEW_TTL_MS };
  },
});

export const getPacketViewInfo = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const row = await ctx.db
      .query('packetViewTokens')
      .withIndex('by_token', (q) => q.eq('token', token))
      .first();
    if (!row) return { ok: false as const, reason: 'invalid' as const };
    if (row.expiresAt < Date.now()) return { ok: false as const, reason: 'expired' as const };

    const user = await ctx.db.get(row.userId);
    const docs = await ctx.db
      .query('documents')
      .withIndex('by_user', (q) => q.eq('userId', row.userId))
      .collect();
    const studentDocs = [];
    for (const d of docs.filter((x) => x.source === 'student' && x.fileId)) {
      const url = d.fileId ? await ctx.storage.getUrl(d.fileId) : null;
      if (!url) continue;
      studentDocs.push({
        documentId: d._id,
        kind: d.kind,
        fileName: d.fileName ?? 'document',
        contentType: d.contentType,
        url,
        createdAt: d.createdAt ?? d._creationTime,
      });
    }

    return {
      ok: true as const,
      expiresAt: row.expiresAt,
      placeTitle: row.placeTitle ?? null,
      placeSlug: row.placeSlug ?? null,
      student: {
        name: user?.name ?? 'Student',
        homeCountry: user?.homeCountry ?? null,
        arrivalDate: user?.arrivalDate ?? null,
        hasSSN: user?.hasSSN ?? null,
        budgetMax: user?.budgetMax ?? null,
        whatsapp: user?.whatsapp ?? null,
      },
      documents: studentDocs,
    };
  },
});

export const recordPacketView = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const row = await ctx.db
      .query('packetViewTokens')
      .withIndex('by_token', (q) => q.eq('token', token))
      .first();
    if (!row || row.expiresAt < Date.now()) return;
    await ctx.db.patch(row._id, {
      viewCount: (row.viewCount ?? 0) + 1,
      lastViewedAt: Date.now(),
    });
  },
});

export const insertPacketShareEmail = internalMutation({
  args: {
    userId: v.id('users'),
    subject: v.string(),
    body: v.string(),
    placeSlug: v.optional(v.string()),
    placeTitle: v.optional(v.string()),
    summary: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert('emails', {
      userId: args.userId,
      direction: 'out',
      subject: args.subject,
      body: args.body,
      summary: args.summary,
      approved: true,
      threadId: `packet-share-${Date.now()}`,
      createdAt: Date.now(),
      kind: 'realty_packet_share',
      placeSlug: args.placeSlug,
      placeTitle: args.placeTitle,
      reason: 'shared student packet with leasing office',
    });
  },
});

export const getShareContext = internalQuery({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    const u = await ctx.db.get(userId);
    const docs = await ctx.db
      .query('documents')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect();
    const count = docs.filter((d) => d.source === 'student' && d.fileId).length;
    return {
      name: u?.name ?? 'a how.zingg student',
      docCount: count,
    };
  },
});

/** Create a 5-day private link and email it to the leasing office. */
export const sharePacketWithOffice = action({
  args: {
    guestKey: v.optional(v.string()),
    placeSlug: v.optional(v.string()),
    placeTitle: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ ok: true; expiresAt: number; viewUrl: string } | { ok: false; error: string }> => {
    let userId: Id<'users'>;
    try {
      const authId = await getAuthUserId(ctx);
      if (authId) {
        userId = authId as Id<'users'>;
      } else if (args.guestKey?.trim()) {
        const guest = await ctx.runQuery(internal.places.findUserByGuestKey, {
          guestKey: args.guestKey,
        });
        if (guest) {
          userId = guest._id as Id<'users'>;
        } else {
          userId = (await ctx.runMutation(internal.places.createGuestUser, {
            guestKey: args.guestKey,
          })) as Id<'users'>;
        }
      } else {
        return { ok: false, error: 'Refresh the page to continue.' };
      }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Could not share.' };
    }

    const brief = await ctx.runQuery(internal.packet.getShareContext, { userId });
    if (brief.docCount === 0) {
      return { ok: false, error: 'Upload at least one document before sharing.' };
    }

    const { token, expiresAt } = await ctx.runMutation(internal.packet.createPacketViewToken, {
      userId,
      placeSlug: args.placeSlug,
      placeTitle: args.placeTitle,
    });

    const viewUrl = `${siteBaseUrl().replace(/\/$/, '')}/office/packet/${token}`;
    const expiresLabel = new Date(expiresAt).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const subject = realtyPacketShareSubject(args.placeTitle);
    const body = realtyPacketShareBody({
      studentLabel: brief.name,
      placeTitle: args.placeTitle,
      viewUrl,
      docCount: brief.docCount,
      expiresLabel,
    });

    try {
      await getNotifyEmail().send({
        to: realtyNotifyTo(),
        subject,
        body,
        text: body,
        threadId: `packet-${token}`,
        campaign: 'how.zingg-packet-share',
      });
    } catch (err) {
      console.warn('[packet.sharePacketWithOffice] email failed', err);
      return { ok: false, error: 'Email failed — try again in a moment.' };
    }

    await ctx.runMutation(internal.packet.insertPacketShareEmail, {
      userId,
      subject,
      body,
      placeSlug: args.placeSlug,
      placeTitle: args.placeTitle,
      summary: viewUrl,
    });

    if (args.placeSlug) {
      await ctx.runMutation(internal.notify.appendAgentNote, {
        userId,
        placeSlug: args.placeSlug,
        status: 'Packet shared',
        message: {
          id: `note-packet-share-${token.slice(0, 10)}`,
          from: 'packet',
          text: `I emailed the leasing office a private link to your packet (${brief.docCount} file${brief.docCount === 1 ? '' : 's'}). Link expires ${expiresLabel}.`,
          at: Date.now(),
        },
      });
    }

    return { ok: true, expiresAt, viewUrl };
  },
});
