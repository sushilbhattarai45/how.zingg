export const FAQ = [
  {
    q: 'Do I need an SSN?',
    a: 'No. Offices see your renter packet (I-20 or DS-2019, visa, funding letter, optional guarantor) instead of a credit check.',
  },
  {
    q: 'Does the AI really call offices?',
    a: "Yes, during their business hours, and it always says it's an AI assistant calling for you. Offices that prefer email get email.",
  },
  {
    q: 'Do you take my money?',
    a: 'Never. You pay rent and deposits directly to the verified leasing office.',
  },
  { q: 'Is it free?', a: 'Yes for students. Apartments pay us when a lease is signed.' },
  {
    q: 'Which universities?',
    a: "We're starting with the University of Southern Mississippi. Pick your school and we'll tell you what's ready.",
  },
  { q: 'Who sees my documents?', a: 'Only offices you approve. You can delete them any time.' },
];

/** Full FAQ for /faq, grouped by topic. */
export const FAQ_GROUPS: { id: string; title: string; items: { q: string; a: string }[] }[] = [
  {
    id: 'basics',
    title: 'Getting started',
    items: [
      {
        q: 'What is how.zingg?',
        a: 'Five AI agents that find off-campus housing near your university, call and email leasing offices, build your renter packet and keep going until your lease is confirmed. It is built for international and transfer students who are still abroad.',
      },
      {
        q: 'Is it free?',
        a: 'Yes, for students. Leasing offices pay a fee when a lease is signed (free during our pilot).',
      },
      {
        q: 'Which universities?',
        a: 'We are starting with the University of Southern Mississippi in Hattiesburg. Pick your school and we will tell you what is ready.',
      },
      {
        q: 'Do I need to be in the US?',
        a: 'No. That is the point. We work while you sleep and send updates in your time zone, with office times shown in both zones.',
      },
    ],
  },
  {
    id: 'ssn',
    title: 'No SSN, no US credit',
    items: [
      {
        q: 'Do I need an SSN?',
        a: 'No, and we will never ask for one. Offices see your renter packet (I-20 or DS-2019, visa, funding letter, optional guarantor) instead of a credit check.',
      },
      {
        q: 'What if an office insists on a credit check?',
        a: 'Caller asks up front what each office accepts instead: a guarantor, an extra deposit or proof of funds. You see the answer before you decide.',
      },
      {
        q: 'What goes in a renter packet?',
        a: 'Your I-20 or DS-2019, visa or admission letter, passport photo page, funding or scholarship letter, a recent bank statement and optional guarantor details. Packet tells you what is missing.',
      },
    ],
  },
  {
    id: 'calls',
    title: 'Calls and the AI team',
    items: [
      {
        q: 'Does the AI really call offices?',
        a: 'Yes, during their business hours. Every call starts with "Hi, I\'m an AI assistant calling on behalf of a student" and says it is recorded. Offices that prefer email get email.',
      },
      {
        q: 'What if the office is closed?',
        a: 'Caller schedules the call for when they open (shown in their time and yours) and sends an email right away.',
      },
      {
        q: 'Can the agents sign or pay for me?',
        a: 'No. Anything binding, like sharing documents, applying, signing or paying, waits for your approval.',
      },
      {
        q: 'Will it guess prices or availability?',
        a: 'Never. Live information comes from the office. If we do not have it, Caller asks and we show you the source.',
      },
    ],
  },
  {
    id: 'documents',
    title: 'Documents and privacy',
    items: [
      {
        q: 'Who sees my documents?',
        a: 'Only offices you approve, one at a time. You can delete them any time.',
      },
      {
        q: 'Where are they stored?',
        a: 'Encrypted in our database provider (Convex) in the United States. Office access links expire and are logged.',
      },
      {
        q: 'Do you train AI on my documents?',
        a: 'No. Our AI providers process them only to answer your request, under contracts that forbid training on them.',
      },
    ],
  },
  {
    id: 'money',
    title: 'Money and scams',
    items: [
      {
        q: 'Do you take my money?',
        a: 'Never. You pay rent and deposits directly to the verified leasing office.',
      },
      {
        q: 'How do you spot scams?',
        a: 'We hide listings that ask for wire transfers, gift cards or crypto, want money before a tour, or have rent far below nearby listings with copied photos.',
      },
      {
        q: 'Do offices that pay you get ranked higher?',
        a: 'No. Fees never change what we show you or the order. We rank by your budget, move-in date and travel time.',
      },
    ],
  },
  {
    id: 'roommates',
    title: 'Roommates',
    items: [
      {
        q: 'How does roommate matching work?',
        a: 'Opt-in. You share a first name, budget, move-in date and habits you choose. We never match on nationality, religion, race, sex, family status or disability.',
      },
    ],
  },
  {
    id: 'offices',
    title: 'For leasing offices',
    items: [
      {
        q: 'What does it cost?',
        a: 'Nothing during the pilot. After it, a flat fee per signed lease, announced at least 30 days ahead. No setup or monthly fees.',
      },
      {
        q: 'Can we stop the AI calls?',
        a: 'Yes. Tell the caller or email us and we switch your office to email only.',
      },
    ],
  },
];
