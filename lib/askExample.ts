/**
 * Example answers for "Ask the team" while the live pipeline (M4) is being wired. Pure, so it can be
 * tested. Everything it returns is seeded example data and is labeled that way in the UI.
 *
 * Rules applied here (CLAUDE.md): live info is never guessed (availability, today's price,
 * specials, holds, tours go to Caller), scams are hidden, every result carries a source.
 */
import listingsSeed from '@/seed/listings.json';
import { matchPlaces } from '@/lib/services/places/mock';

export type AskMood = 'happy' | 'sad' | 'neutral';

export type AskResult = {
  title: string;
  detail: string;
  sourceUrl: string;
};

export type AskAnswer = {
  kind: 'listings' | 'places' | 'live' | 'none';
  mood: AskMood;
  /** What Concierge says, in first person. Shown in the speech bubble. */
  say: string;
  /** What the bots "read" while thinking (shown one at a time). */
  steps: string[];
  results: AskResult[];
  /** Number of scam listings hidden from the results. */
  hiddenScams: number;
};

const LIVE =
  /\b(available|availability|free on|open on|today'?s? (price|rent)|special|specials|hold|tour|vacan)/i;
const HOUSING =
  /\b(bed|beds|bedroom|studio|apartment|apartments|apt|room|rent|lease|place to live|housing|\$\s?\d)/i;

type Listing = (typeof listingsSeed.listings)[number];

const WALK_TO = 'Scianna Hall';

function walkMin(l: Listing) {
  return (l.commute as Record<string, { walkMin?: number }>).scianna?.walkMin;
}

function priceCap(q: string): number | null {
  const m = q.match(/(?:under|below|less than|max|<)\s*\$?\s?(\d{3,4})/i) ?? q.match(/\$\s?(\d{3,4})/);
  return m ? Number(m[1]) : null;
}

function unitWanted(q: string): string | null {
  if (/\bstudio\b/i.test(q)) return 'Studio';
  if (/\b(1|one)[\s-]?(bed|br|bedroom)/i.test(q)) return '1 bed';
  if (/\broom\b/i.test(q)) return 'Room in 2 bed';
  return null;
}

function listingLine(l: Listing) {
  const walk = walkMin(l);
  return `${l.unitType}${walk ? `, ${walk} min walk to ${WALK_TO}` : ''} · rent via call`;
}

export function answerExample(query: string): AskAnswer {
  const q = query.trim();

  if (LIVE.test(q)) {
    return {
      kind: 'live',
      mood: 'neutral',
      say: "That needs a live answer from the office, so I won't guess. I can add it to your wishlist and have Caller ask.",
      steps: ['Reading your question…', 'Availability changes daily…'],
      results: [],
      hiddenScams: 0,
    };
  }

  if (HOUSING.test(q)) {
    const all = listingsSeed.listings;
    const scams = all.filter((l) => l.scamFlags.length > 0);
    const cap = priceCap(q);
    const unit = unitWanted(q);
    const fits = all
      .filter((l) => l.scamFlags.length === 0)
      .filter((l) => (cap ? l.rent <= cap : true))
      .filter((l) => (unit ? l.unitType === unit : true))
      .sort((a, b) => a.rent - b.rent);
    const steps = [
      `Reading ${all.length} listings near USM…`,
      'Checking for scams…',
      'Comparing walk times and move-in dates…',
    ];
    const label = `${unit ?? 'place'}${cap ? ` near your budget` : ''}`;
    if (!fits.length) {
      return {
        kind: 'none',
        mood: 'sad',
        say: `Sorry, I couldn't find a ${label} in what we have so far. Scout will keep looking and I'll tell you the moment one shows up.`,
        steps,
        results: [],
        hiddenScams: scams.length,
      };
    }
    const [best, next] = fits;
    return {
      kind: 'listings',
      mood: 'happy',
      say:
        `Good match for ${label}: ${best!.title} — ${listingLine(best!)}.` +
        (next ? ` Next up: ${next.title} (${next.unitType}).` : '') +
        ` Caller will confirm rent on the phone.` +
        (scams.length ? ` I hid ${scams.length} scam listing.` : ''),
      steps,
      results: fits.slice(0, 4).map((l) => ({
        title: `${l.title} · ${l.unitType}`,
        detail: `${listingLine(l)} · ${l.noSSNNote ?? 'SSN policy: ask the office'}`,
        sourceUrl: l.sourceUrl,
      })),
      hiddenScams: scams.length,
    };
  }

  const places = matchPlaces(q).sort((a, b) => a.distanceMi - b.distanceMi);
  if (places.length) {
    const top = places[0]!;
    const drive = top.travel.driveMin ? `, ${top.travel.driveMin} min drive` : '';
    return {
      kind: 'places',
      mood: 'happy',
      say: `Closest is ${top.title}, ${top.distanceMi} mi from campus${drive}.${places.length > 1 ? ` I found ${places.length} places in all.` : ''}`,
      steps: ['Reading the map around USM…', 'Checking hours and travel times…'],
      results: places.slice(0, 4).map((p) => ({
        title: p.title,
        detail: `${p.distanceMi} mi · ${p.hours} · ${p.fact}`,
        sourceUrl: p.sourceUrl,
      })),
      hiddenScams: 0,
    };
  }

  return {
    kind: 'none',
    mood: 'sad',
    say: "Sorry, I don't have that one yet. Scout is on it, and I'll come back with an answer and sources.",
    steps: ['Reading your question…', 'Searching what we know…'],
    results: [],
    hiddenScams: 0,
  };
}
