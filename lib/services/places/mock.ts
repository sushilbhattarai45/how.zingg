import places from '../../../seed/places.json';
import type { Place, PlacesService } from './index';

type SeedPlace = (typeof places)[number];

const STOP = new Set([
  'the',
  'and',
  'near',
  'from',
  'to',
  'a',
  'an',
  'of',
  'in',
  'or',
  'me',
  'is',
  'usm',
  'campus',
  'nearest',
  'any',
  'can',
  'i',
  'there',
  'where',
]);

export function tokens(q: string): string[] {
  return q
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP.has(t))
    .map((t) => t.replace(/(ies)$/, 'y').replace(/s$/, ''));
}

export function matchPlaces(query: string): SeedPlace[] {
  const qt = tokens(query);
  return places.filter((p) => {
    const kws = p.keywords.flatMap((k) => tokens(k));
    return qt.some((t) => kws.includes(t));
  });
}

export const mockPlaces: PlacesService = {
  async textSearch({ query }) {
    return matchPlaces(query).map((p): Place => ({
      id: p.id,
      group: p.group as Place['group'],
      title: p.title,
      distanceMi: p.distanceMi,
      travel: p.travel,
      hours: p.hours,
      fact: p.fact,
      sourceUrl: p.sourceUrl,
      isExample: true,
    }));
  },
};
