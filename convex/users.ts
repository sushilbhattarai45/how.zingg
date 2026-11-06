import { getAuthUserId } from '@convex-dev/auth/server';
import { query } from './_generated/server';

/** The signed-in user (name, email, picture), or null when signed out. */
export const me = query({
  args: {},
  handler: async (ctx) => {
    const id = await getAuthUserId(ctx);
    if (!id) return null;
    const u = await ctx.db.get(id);
    if (!u) return null;
    return { name: u.name ?? null, email: u.email ?? null, image: u.image ?? null };
  },
});
