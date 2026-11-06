import { internalMutation, mutation } from './_generated/server';
import type { MutationCtx } from './_generated/server';
import universities from '../seed/universities.json';
import listingsSeed from '../seed/listings.json';
import roommates from '../seed/roommates.json';
import { scamCheck, shouldHide } from '../lib/scam';

const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

/** "mon-fri 08:00-17:00" → [{day:1,open:'08:00',close:'17:00'}, …] */
export function parseHours(spec: string): { day: number; open: string; close: string }[] {
  if (!spec.trim()) return [];
  const [range, times] = spec.trim().split(/\s+/);
  const [from, to] = (range ?? '').split('-');
  const [open, close] = (times ?? '').split('-');
  const a = DAYS.indexOf(from ?? '');
  const b = DAYS.indexOf(to ?? from ?? '');
  const out = [];
  for (let d = a; d <= b; d++) out.push({ day: d, open: open!, close: close! });
  return out;
}

const TABLES = [
  'events',
  'connections',
  'roommateProfiles',
  'offers',
  'packets',
  'documents',
  'emails',
  'calls',
  'tasks',
  'wishlist',
  'searchResults',
  'searchSteps',
  'searches',
  'listings',
  'offices',
  'users',
  'universities',
] as const;

async function wipe(ctx: MutationCtx) {
  for (const t of TABLES) {
    const rows = await ctx.db.query(t).collect();
    for (const r of rows) await ctx.db.delete(r._id);
  }
}

async function seedAll(ctx: MutationCtx) {
  await wipe(ctx);

  const uniIds: Record<string, Awaited<ReturnType<typeof ctx.db.insert<'universities'>>>> = {};
  for (const u of universities) uniIds[u.shortName] = await ctx.db.insert('universities', u);
  const usm = uniIds.USM!;

  const officeIds: Record<string, Awaited<ReturnType<typeof ctx.db.insert<'offices'>>>> = {};
  for (const o of listingsSeed.offices) {
    officeIds[o.key] = await ctx.db.insert('offices', {
      universityId: usm,
      name: o.name,
      phone: 'phone' in o ? o.phone : undefined,
      email: o.email,
      website: 'website' in o ? o.website : undefined,
      hours: parseHours(o.hours),
      timeZone: 'America/Chicago',
      acceptsNoSSN: 'acceptsNoSSN' in o ? o.acceptsNoSSN : undefined,
      partner: o.partner,
      callAllowed: o.callAllowed,
      isExample: true,
    });
  }

  const legit = listingsSeed.listings.filter((l) => l.scamFlags.length === 0);
  const market = legit.map((l) => l.rent).sort((a, b) => a - b)[Math.floor(legit.length / 2)] ?? 650;

  for (const l of listingsSeed.listings) {
    const text = 'description' in l ? (l.description as string) : '';
    const flags = [...new Set([...l.scamFlags, ...scamCheck({ rent: l.rent, text, marketRent: market })])];
    await ctx.db.insert('listings', {
      officeId: officeIds[l.office]!,
      universityId: usm,
      slug: l.slug,
      title: l.title,
      unitType: l.unitType,
      rent: l.rent,
      deposit: 'deposit' in l ? l.deposit : undefined,
      fees: 'fees' in l ? l.fees : undefined,
      availableFrom: l.availableFrom,
      photos: [],
      furnished: l.furnished,
      roommateShare: l.roommateShare,
      noSSN: l.noSSN as 'ok' | 'guarantor' | 'unknown',
      noSSNNote: 'noSSNNote' in l ? l.noSSNNote : undefined,
      commute: l.commute,
      scamFlags: flags,
      hidden: shouldHide(flags as Parameters<typeof shouldHide>[0]),
      sourceUrl: l.sourceUrl,
      isExample: true,
    });
  }

  const asha = await ctx.db.insert('users', {
    name: 'Asha',
    email: 'asha@example.com',
    homeCountry: 'Nepal',
    timeZone: 'Asia/Kathmandu',
    universityId: usm,
    campusBuildingId: 'scianna',
    arrivalDate: '2027-08-14',
    budgetMin: 400,
    budgetMax: 800,
    hasSSN: false,
    hasCar: false,
    roommatePref: 'maybe',
    onCouch: false,
    isDemo: true,
  });

  const docs: { kind: 'i20' | 'visa' | 'funding'; fileName: string; extracted: Record<string, string> }[] = [
    {
      kind: 'i20',
      fileName: 'I-20.pdf',
      extracted: { program: 'MS Computer Science', programEnds: 'May 2029' },
    },
    { kind: 'visa', fileName: 'F-1 visa.jpg', extracted: { visaType: 'F-1', validity: 'Valid' } },
    { kind: 'funding', fileName: 'Funding letter.pdf', extracted: { funding: 'Assistantship, $1,800/mo' } },
  ];
  for (const d of docs) await ctx.db.insert('documents', { userId: asha, ...d, status: 'read' });
  await ctx.db.insert('packets', { userId: asha, completeness: 0.75, sharedWith: [] });

  for (const r of roommates) {
    await ctx.db.insert('roommateProfiles', { ...r, visible: true, isExample: true });
  }

  return { userId: asha, universities: Object.keys(uniIds).length, listings: listingsSeed.listings.length };
}

/** `npm run seed` → `convex run seed:run` */
export const run = internalMutation({ args: {}, handler: (ctx) => seedAll(ctx) });

/** Rehearsal "Reset demo": only allowed in DEMO_MODE. */
export const resetDemo = mutation({
  args: {},
  handler: async (ctx) => {
    if (process.env.DEMO_MODE !== '1') throw new Error('Reset is only available in DEMO_MODE');
    return seedAll(ctx);
  },
});
