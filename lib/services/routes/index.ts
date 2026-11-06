import { withFallback, envOrNull } from '../mode';

export type TravelMode = 'walk' | 'bike' | 'transit' | 'drive';
export type LatLng = { lat: number; lng: number };

export interface RoutesService {
  travelTimes(args: {
    origin: LatLng;
    destinations: (LatLng & { id: string; seeded?: Partial<Record<TravelMode, number>> })[];
    modes: TravelMode[];
  }): Promise<Record<string, Partial<Record<TravelMode, number>>>>;
}

/** Mock: returns seeded minutes, or a straight-line estimate when none are seeded. */
export const mockRoutes: RoutesService = {
  async travelTimes({ origin, destinations, modes }) {
    const out: Record<string, Partial<Record<TravelMode, number>>> = {};
    const speedMph: Record<TravelMode, number> = { walk: 3, bike: 10, transit: 12, drive: 25 };
    for (const d of destinations) {
      const mi = haversineMi(origin, d) * 1.3; // street factor
      out[d.id] = Object.fromEntries(
        modes.map((m) => [m, d.seeded?.[m] ?? Math.max(1, Math.round((mi / speedMph[m]) * 60))]),
      );
    }
    return out;
  },
};

export function haversineMi(a: LatLng, b: LatLng): number {
  const R = 3958.8;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function createRealRoutes(): RoutesService | null {
  if (!envOrNull('GOOGLE_MAPS_API_KEY') || envOrNull('LIVE_ROUTES') !== '1') return null;
  return null; // Google Routes API: stretch
}

export function getRoutes(): RoutesService {
  return withFallback('routes', createRealRoutes(), mockRoutes);
}
