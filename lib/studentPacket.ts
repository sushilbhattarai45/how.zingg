/** Student packet kinds + landing trip profile helpers (shared client/server). */

export const STUDENT_DOC_KINDS = [
  { id: 'passport', label: 'Passport' },
  { id: 'i20', label: 'I-20' },
  { id: 'ds2019', label: 'DS-2019' },
  { id: 'visa', label: 'Visa' },
  { id: 'funding', label: 'Funding / sponsor letter' },
  { id: 'bank', label: 'Bank statement' },
  { id: 'other', label: 'Other' },
] as const;

export type StudentDocKind = (typeof STUDENT_DOC_KINDS)[number]['id'];

export const TRIP_STORAGE_KEY = 'hz.trip';

export type TripProfile = {
  name?: string;
  whatsapp?: string;
  moveIn?: string;
  country?: string;
  hasSSN?: boolean | null;
  budgetMax?: number | null;
};

export function readTripProfile(): TripProfile {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(TRIP_STORAGE_KEY) ?? '{}') as TripProfile;
  } catch {
    return {};
  }
}

export function writeTripProfile(next: TripProfile): void {
  if (typeof window === 'undefined') return;
  try {
    const prev = readTripProfile();
    localStorage.setItem(TRIP_STORAGE_KEY, JSON.stringify({ ...prev, ...next }));
  } catch {
    /* ignore */
  }
}

export function kindLabel(kind: string): string {
  return STUDENT_DOC_KINDS.find((k) => k.id === kind)?.label ?? kind;
}

/** Packet view links expire after 5 days. */
export const PACKET_VIEW_TTL_MS = 5 * 24 * 60 * 60 * 1000;
