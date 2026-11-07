/**
 * Swipe deck: hardcoded realty near USM (example data + local images). No scraping.
 * Scout "searches" from an address the student types; results are always this seeded set for now.
 */
import realty from '@/seed/realtyPlaces.json';
import { formatDual, zonedToUtc } from '@/lib/time';

export type SwipeCard = {
  slug: string;
  title: string;
  address: string;
  unitType: string;
  rent: number;
  deposit?: number;
  walkMin?: number;
  noSSN: string;
  officeName: string;
  availableFrom: string;
  sourceUrl: string;
  pitch: string;
  image: string;
  hue: number;
};

export type TeamTask = {
  agent: 'caller' | 'packet' | 'closer';
  text: string;
  action?: string;
};

const OFFICE_TZ = 'America/Chicago';

/** Build the deck for an address query. Hardcoded places for now (no live scrape). */
export function buildDeck(addressQuery = ''): SwipeCard[] {
  const q = addressQuery.trim().toLowerCase();
  // Light filter: if they typed a street name that matches a place, prefer those first.
  const scored = realty.places.map((p, i) => {
    const hay = `${p.title} ${p.address}`.toLowerCase();
    const hit = q && hay.includes(q.split(',')[0]!.trim()) ? 0 : 1;
    return { p, i, hit };
  });
  scored.sort((a, b) => a.hit - b.hit || (a.p.walkMin ?? 99) - (b.p.walkMin ?? 99));
  return scored.map(({ p, i }) => ({
    slug: p.slug,
    title: p.title,
    address: p.address,
    unitType: p.unitType,
    rent: p.rent,
    deposit: p.deposit,
    walkMin: p.walkMin,
    noSSN: p.noSSN,
    officeName: p.officeName,
    availableFrom: p.availableFrom,
    sourceUrl: p.sourceUrl,
    pitch: p.pitch,
    image: p.image,
    hue: (i * 0.17) % 1,
  }));
}

export function campusLabel(): string {
  return realty.campusLabel;
}

/** Look up a seeded place by slug (for My Places cards). */
export function placeBySlug(slug: string) {
  return realty.places.find((p) => p.slug === slug) ?? null;
}

/** Legacy helper used by tests — scams are not in the realty seed. */
export function hiddenScams(): number {
  return 0;
}

export function tasksFor(card: SwipeCard, userTz: string, today = new Date()): TeamTask[] {
  const d = new Date(today);
  d.setDate(d.getDate() + 1);
  const nineAm = zonedToUtc(d.getFullYear(), d.getMonth() + 1, d.getDate(), 9, 0, OFFICE_TZ);
  return [
    {
      agent: 'caller',
      text: `Ready to call about ${card.title} (${card.unitType}) from My Places — dials your DEMO_CALL_TO only. ${formatDual(nineAm, OFFICE_TZ, userTz)}.`,
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
