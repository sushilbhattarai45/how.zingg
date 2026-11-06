import type { PlacesService } from './index';
import { envOrNull } from '../mode';

/** Google Places API (New). Wired after checking current docs (stretch: live data). */
export function createRealPlaces(): PlacesService | null {
  if (!envOrNull('GOOGLE_MAPS_API_KEY') || envOrNull('LIVE_PLACES') !== '1') return null;
  return {
    async textSearch() {
      throw new Error('Real Places not implemented yet');
    },
  };
}
