/**
 * Demo-only roommate lounge data. Lifestyle fields only (fair housing).
 * Labeled Example in the UI — not live matching.
 */

export type RoommatePerson = {
  id: string;
  name: string;
  program: string;
  budgetMin: number;
  budgetMax: number;
  moveIn: string;
  tags: string[];
  lookingFor: string;
  /** Co-lease / find filters */
  university: string;
  zip: string;
  city: string;
  kind: 'roommate' | 'colease';
  placeHint?: string;
  online?: boolean;
  unread?: number;
};

export type RoommateMsg = {
  id: string;
  from: 'them' | 'you';
  text: string;
  at: number;
};

/** Fixed demo clock so messages feel recent. */
const T0 = Date.UTC(2026, 10, 7, 20, 0, 0); // Nov 7, 2026 ~2pm CT-ish

export const ROOMMATE_PEOPLE: RoommatePerson[] = [
  {
    id: 'mariana',
    name: 'Mariana',
    program: 'PhD Marine Science',
    budgetMin: 400,
    budgetMax: 500,
    moveIn: '2027-08-18',
    tags: ['Quiet', 'Night owl', 'Has a car'],
    lookingFor: '1 roommate · 2-bed near Scianna Hall',
    university: 'USM',
    zip: '39401',
    city: 'Hattiesburg',
    kind: 'colease',
    placeHint: 'Magnolia Court',
    online: true,
    unread: 2,
  },
  {
    id: 'aarav',
    name: 'Aarav',
    program: 'MS Computer Science',
    budgetMin: 350,
    budgetMax: 450,
    moveIn: '2027-08-10',
    tags: ['Early riser', 'Cooks', 'No smoking'],
    lookingFor: 'Split a 2-bed · walk or bike to campus',
    university: 'USM',
    zip: '39406',
    city: 'Hattiesburg',
    kind: 'roommate',
    placeHint: 'Oak Hollow',
    online: true,
  },
  {
    id: 'priya',
    name: 'Priya',
    program: 'PhD Chemistry',
    budgetMin: 400,
    budgetMax: 550,
    moveIn: '2027-08-12',
    tags: ['Vegetarian', 'Night owl'],
    lookingFor: 'Quiet place for lab nights',
    university: 'USM',
    zip: '39401',
    city: 'Hattiesburg',
    kind: 'roommate',
  },
  {
    id: 'tunde',
    name: 'Tunde',
    program: 'Transfer, Business',
    budgetMin: 300,
    budgetMax: 400,
    moveIn: '2028-01-06',
    tags: ['Tidy', 'Gym'],
    lookingFor: 'Spring move-in · budget-friendly',
    university: 'USM',
    zip: '39402',
    city: 'Hattiesburg',
    kind: 'roommate',
  },
  {
    id: 'sam',
    name: 'Sam',
    program: 'Transfer, Nursing',
    budgetMin: 350,
    budgetMax: 450,
    moveIn: '2028-01-03',
    tags: ['Early shifts', 'Has a car'],
    lookingFor: 'Someone ok with early alarms',
    university: 'USM',
    zip: '39406',
    city: 'Hattiesburg',
    kind: 'colease',
    placeHint: 'Willow Park',
    unread: 1,
  },
  {
    id: 'jordan',
    name: 'Jordan',
    program: 'MS Biology',
    budgetMin: 375,
    budgetMax: 480,
    moveIn: '2027-08-15',
    tags: ['Tidy', 'Cooks'],
    lookingFor: 'Co-lease a 2-bed within 15 min of campus',
    university: 'USM',
    zip: '39401',
    city: 'Hattiesburg',
    kind: 'colease',
    placeHint: 'Campus View Lofts',
  },
  {
    id: 'mei',
    name: 'Mei',
    program: 'MBA',
    budgetMin: 420,
    budgetMax: 520,
    moveIn: '2027-08-01',
    tags: ['Quiet', 'No smoking'],
    lookingFor: 'Find a roommate for Hardy Street corridor',
    university: 'USM',
    zip: '39402',
    city: 'Hattiesburg',
    kind: 'roommate',
    placeHint: 'Hardy Street Studios',
    online: true,
  },
];

/** People who already have an open chat in the demo. */
export const DEMO_CONNECTED_IDS = ['mariana', 'aarav'] as const;

export const ROOMMATE_THREADS: Record<string, RoommateMsg[]> = {
  mariana: [
    {
      id: 'm1',
      from: 'them',
      text: 'Hey! Scout showed we both liked Magnolia Court. Still looking for a roommate?',
      at: T0 - 1000 * 60 * 55,
    },
    {
      id: 'm2',
      from: 'you',
      text: 'Yes — studio felt tight. Open to a 2-bed if rent stays under ~$500 each.',
      at: T0 - 1000 * 60 * 48,
    },
    {
      id: 'm3',
      from: 'them',
      text: 'Same budget. I’m usually up late in the lab — quiet hours after midnight work for me. You?',
      at: T0 - 1000 * 60 * 40,
    },
    {
      id: 'm4',
      from: 'you',
      text: 'I’m fine with that. Do you cook much, or mostly meal prep?',
      at: T0 - 1000 * 60 * 32,
    },
    {
      id: 'm5',
      from: 'them',
      text: 'I cook 2–3 nights a week. Happy to share a clean kitchen schedule. Want to ask Packet to share floor plans for the 2-beds?',
      at: T0 - 1000 * 60 * 8,
    },
    {
      id: 'm6',
      from: 'them',
      text: 'Also I have a car if we need Costco runs — no pressure either way.',
      at: T0 - 1000 * 60 * 6,
    },
  ],
  aarav: [
    {
      id: 'a1',
      from: 'them',
      text: 'Hi — early riser here. Looking for someone who’d split Oak Hollow or similar.',
      at: T0 - 1000 * 60 * 60 * 5,
    },
    {
      id: 'a2',
      from: 'you',
      text: 'Hey Aarav. I’m flexible on wake-ups. What’s your max for half the rent?',
      at: T0 - 1000 * 60 * 60 * 4.5,
    },
    {
      id: 'a3',
      from: 'them',
      text: 'Around $400–450. I cook a lot (no smoking in the unit). Happy to rotate groceries.',
      at: T0 - 1000 * 60 * 60 * 4,
    },
    {
      id: 'a4',
      from: 'you',
      text: 'That works. I’ll have Caller ask Magnolia about 2-bed pricing and ping you.',
      at: T0 - 1000 * 60 * 60 * 3.2,
    },
  ],
  priya: [
    {
      id: 'p1',
      from: 'them',
      text: 'Looking for a quiet roommate — late lab nights, vegetarian kitchen ok?',
      at: T0 - 1000 * 60 * 60 * 26,
    },
    {
      id: 'p2',
      from: 'you',
      text: 'Quiet is perfect. Vegetarian kitchen is fine with me.',
      at: T0 - 1000 * 60 * 60 * 25,
    },
    {
      id: 'p3',
      from: 'them',
      text: 'Great. Move-in mid-August. Want to compare fee sheets once Packet has them?',
      at: T0 - 1000 * 60 * 60 * 24,
    },
  ],
  tunde: [
    {
      id: 't1',
      from: 'them',
      text: 'Transfer for spring — need something tidy, gym nearby is a plus.',
      at: T0 - 1000 * 60 * 60 * 50,
    },
    {
      id: 't2',
      from: 'you',
      text: 'January move-in noted. Budget under $400 each?',
      at: T0 - 1000 * 60 * 60 * 49,
    },
    {
      id: 't3',
      from: 'them',
      text: 'Yes. I’ll stay in Roommate Space while Scout keeps watching listings.',
      at: T0 - 1000 * 60 * 60 * 48,
    },
  ],
  sam: [
    {
      id: 's1',
      from: 'them',
      text: 'Nursing — early clinicals. Looking for someone who’s ok with 5am alarms + shared car rides to campus sometimes.',
      at: T0 - 1000 * 60 * 90,
    },
    {
      id: 's2',
      from: 'you',
      text: 'I can do early. Let’s sync once we shortlist a 2-bed.',
      at: T0 - 1000 * 60 * 70,
    },
    {
      id: 's3',
      from: 'them',
      text: 'Perfect. I’ll send my lifestyle tags when you open Roommate Space again.',
      at: T0 - 1000 * 60 * 15,
    },
  ],
  jordan: [
    {
      id: 'j1',
      from: 'them',
      text: 'Saw your co-lease search — I’m looking at Campus View Lofts too.',
      at: T0 - 1000 * 60 * 20,
    },
  ],
  mei: [
    {
      id: 'me1',
      from: 'them',
      text: 'Hi! Matching on Hardy Street — quiet + no smoking here.',
      at: T0 - 1000 * 60 * 12,
    },
  ],
};

export function monthDay(iso: string) {
  return new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export type RoommateSearchFilters = {
  query: string;
  kind: 'all' | 'roommate' | 'colease';
};

/** Demo search: zip, university short name, city, or place hint. */
export function searchRoommateRequests(
  filters: RoommateSearchFilters,
  people: RoommatePerson[] = ROOMMATE_PEOPLE,
): RoommatePerson[] {
  const q = filters.query.trim().toLowerCase();
  return people.filter((p) => {
    if (filters.kind !== 'all' && p.kind !== filters.kind) return false;
    if (!q) return true;
    const hay = [
      p.zip,
      p.university,
      p.city,
      p.name,
      p.program,
      p.lookingFor,
      p.placeHint ?? '',
      p.tags.join(' '),
    ]
      .join(' ')
      .toLowerCase();
    return hay.includes(q) || q.split(/\s+/).every((part) => hay.includes(part));
  });
}
