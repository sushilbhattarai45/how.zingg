/**
 * The swipe deck: seeded example listings (scams never shown) and what the rest of the team does
 * the moment you say yes. Pure, so it's testable. Everything here is labeled "Example" in the UI.
 */
import listingsSeed from '@/seed/listings.json';
import { formatDual, zonedToUtc } from '@/lib/time';

export type SwipeCard = {
  slug: string;
  title: string;
  unitType: string;
  rent: number;
  deposit?: number;
  walkMin?: number;
  noSSN: string;
  officeName: string;
  officeKey: string;
  availableFrom: string;
  sourceUrl: string;
  /** What Scout says when presenting it. */
  pitch: string;
  /** 0..1 hue seed for the illustration. */
  hue: number;
};

export type TeamTask = {
  agent: 'caller' | 'packet' | 'closer';
  text: string;
  /** Something the student can do now (e.g. add a document). */
  action?: string;
};

const OFFICE_TZ = 'America/Chicago';

type Listing = (typeof listingsSeed.listings)[number];

function pitchFor(l: Listing, walk?: number): string {
  if (l.noSSN === 'ok') return 'They take an I-20 instead of an SSN!';
  if (walk && walk <= 10) return `Only ${walk} min walk to class!`;
  if (l.rent < 600) return `Just $${l.rent} a month!`;
  return 'Close to campus, and in your budget.';
}

export function buildDeck(): SwipeCard[] {
  const offices = new Map(listingsSeed.offices.map((o) => [o.key, o]));
  return listingsSeed.listings
    .filter((l) => l.scamFlags.length === 0)
    .map((l, i) => {
      const walk = (l.commute as Record<string, { walkMin?: number }>).scianna?.walkMin;
      const office = offices.get(l.office);
      return {
        slug: l.slug,
        title: l.title,
        unitType: l.unitType,
        rent: l.rent,
        deposit: l.deposit,
        walkMin: walk,
        noSSN: l.noSSNNote ?? 'No-SSN policy: Caller will ask',
        officeName: office?.name ?? `${l.title} Leasing`,
        officeKey: l.office,
        availableFrom: l.availableFrom,
        sourceUrl: l.sourceUrl,
        pitch: pitchFor(l, walk),
        hue: (i * 0.17) % 1,
      };
    })
    .sort((a, b) => (a.walkMin ?? 99) - (b.walkMin ?? 99));
}

/** How many listings Scout hid as scams (shown as a note, never as cards). */
export function hiddenScams(): number {
  return listingsSeed.listings.filter((l) => l.scamFlags.length > 0).length;
}

/**
 * What the team starts on right away when you say yes. Caller asks the office (never guesses live
 * info), Packet asks for what's missing, Closer looks for a better deal.
 */
export function tasksFor(card: SwipeCard, userTz: string, today = new Date()): TeamTask[] {
  const d = new Date(today);
  d.setDate(d.getDate() + 1);
  const nineAm = zonedToUtc(d.getFullYear(), d.getMonth() + 1, d.getDate(), 9, 0, OFFICE_TZ);
  return [
    {
      agent: 'caller',
      text: `Calling ${card.officeName} at ${formatDual(nineAm, OFFICE_TZ, userTz)} to ask if the ${card.unitType} is free from your move-in date.`,
    },
    {
      agent: 'packet',
      text: `${card.title} will want your renter packet. I still need a bank statement.`,
      action: 'Add documents',
    },
    {
      agent: 'closer',
      text: `Asking ${card.title} about move-in specials and waiving the application fee.`,
    },
  ];
}
