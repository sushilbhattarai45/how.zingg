import seed from '../../../seed/listings.json';
import { withFallback, envOrNull } from '../mode';

export type ExtractedListing = {
  title: string;
  unitType: string;
  rent: number;
  deposit?: number;
  availableFrom?: string;
  description?: string;
  sourceUrl: string;
};

export interface CrawlService {
  extractListing(url: string): Promise<ExtractedListing | null>;
}

export const mockCrawl: CrawlService = {
  async extractListing(url) {
    const l = seed.listings.find((x) => x.sourceUrl === url);
    if (!l) return null;
    return {
      title: l.title,
      unitType: l.unitType,
      rent: l.rent,
      deposit: 'deposit' in l ? l.deposit : undefined,
      availableFrom: l.availableFrom,
      description: 'description' in l ? (l.description as string) : undefined,
      sourceUrl: url,
    };
  },
};

function createRealCrawl(): CrawlService | null {
  if (!envOrNull('FIRECRAWL_API_KEY') || envOrNull('LIVE_CRAWL') !== '1') return null;
  return null; // Firecrawl: stretch
}

export function getCrawl(): CrawlService {
  return withFallback('crawl', createRealCrawl(), mockCrawl);
}
