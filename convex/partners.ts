import { mutation } from './_generated/server';
import { v } from 'convex/values';

export const submitLead = mutation({
  args: {
    officeName: v.string(),
    contactName: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const clean = (s: string, max: number) => s.trim().slice(0, max);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(args.email.trim())) throw new Error('Please enter a valid email.');
    if (!args.officeName.trim() || !args.contactName.trim())
      throw new Error('Office and contact name are required.');
    return ctx.db.insert('partnerLeads', {
      officeName: clean(args.officeName, 120),
      contactName: clean(args.contactName, 120),
      email: clean(args.email, 200),
      phone: args.phone ? clean(args.phone, 40) : undefined,
      message: args.message ? clean(args.message, 2000) : undefined,
      createdAt: Date.now(),
    });
  },
});
