import { withFallback } from '../mode';
import { mockPlaces } from './mock';
import { createRealPlaces } from './real';

export type Place = {
  id: string;
  group: 'Apartments' | 'Groceries' | 'Stores' | 'Banks' | 'Transit' | 'Other';
  title: string;
  address?: string;
  lat?: number;
  lng?: number;
  distanceMi?: number;
  travel?: { walkMin?: number; transitMin?: number; driveMin?: number };
  hours?: string;
  fact?: string;
  sourceUrl: string;
  isExample: boolean;
};

export interface PlacesService {
  textSearch(args: {
    query: string;
    near: { lat: number; lng: number };
    radiusMi?: number;
  }): Promise<Place[]>;
}

export function getPlaces(): PlacesService {
  return withFallback('places', createRealPlaces(), mockPlaces);
}
