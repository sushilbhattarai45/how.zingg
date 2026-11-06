import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';
import { authTables } from '@convex-dev/auth/server';

export const agentId = v.union(
  v.literal('concierge'),
  v.literal('scout'),
  v.literal('caller'),
  v.literal('packet'),
  v.literal('closer'),
);

const commute = v.object({
  walkMin: v.number(),
  bikeMin: v.number(),
  transitMin: v.optional(v.number()),
  driveMin: v.number(),
});

export default defineSchema({
  // Auth tables (sessions, accounts, verification codes...) from Convex Auth.
  ...authTables,
  // One users table for auth and the student profile. Auth creates a user with only name/email/image,
  // so profile fields are optional and filled in during onboarding.
  users: defineTable({
    // Convex Auth fields
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    // Student profile
    whatsapp: v.optional(v.string()),
    homeCountry: v.optional(v.string()),
    timeZone: v.optional(v.string()),
    universityId: v.optional(v.id('universities')),
    campusBuildingId: v.optional(v.string()),
    arrivalDate: v.optional(v.string()), // ISO date (YYYY-MM-DD)
    budgetMin: v.optional(v.number()),
    budgetMax: v.optional(v.number()),
    hasSSN: v.optional(v.boolean()),
    hasCar: v.optional(v.boolean()),
    roommatePref: v.optional(v.union(v.literal('yes'), v.literal('maybe'), v.literal('no'))),
    onCouch: v.optional(v.boolean()),
    isDemo: v.optional(v.boolean()),
  })
    .index('email', ['email'])
    .index('phone', ['phone'])
    .index('by_university', ['universityId'])
    .index('by_isDemo', ['isDemo']),

  universities: defineTable({
    name: v.string(),
    shortName: v.string(),
    city: v.string(),
    state: v.string(),
    lat: v.number(),
    lng: v.number(),
    timeZone: v.string(),
    buildings: v.array(v.object({ id: v.string(), name: v.string(), lat: v.number(), lng: v.number() })),
    ready: v.boolean(), // has seeded offices/listings
  }).index('by_shortName', ['shortName']),

  offices: defineTable({
    universityId: v.id('universities'),
    name: v.string(),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    website: v.optional(v.string()),
    hours: v.array(v.object({ day: v.number(), open: v.string(), close: v.string() })), // day 0=Sun, "09:00"
    timeZone: v.string(),
    acceptsNoSSN: v.optional(v.boolean()),
    partner: v.boolean(),
    callAllowed: v.boolean(),
    isExample: v.boolean(),
  }).index('by_university', ['universityId']),

  listings: defineTable({
    officeId: v.id('offices'),
    universityId: v.id('universities'),
    slug: v.string(),
    title: v.string(),
    unitType: v.string(),
    rent: v.number(),
    deposit: v.optional(v.number()),
    fees: v.optional(v.number()),
    availableFrom: v.optional(v.string()),
    photos: v.array(v.string()),
    furnished: v.boolean(),
    roommateShare: v.boolean(),
    noSSN: v.union(v.literal('ok'), v.literal('guarantor'), v.literal('unknown')),
    noSSNNote: v.optional(v.string()),
    commute: v.record(v.string(), commute),
    scamFlags: v.array(v.string()),
    hidden: v.boolean(),
    sourceUrl: v.optional(v.string()),
    isExample: v.boolean(),
  })
    .index('by_office', ['officeId'])
    .index('by_university', ['universityId'])
    .index('by_slug', ['slug'])
    .index('by_hidden', ['hidden']),

  searches: defineTable({
    userId: v.id('users'),
    universityId: v.id('universities'),
    query: v.string(),
    intent: v.string(),
    status: v.union(v.literal('planning'), v.literal('running'), v.literal('done'), v.literal('failed')),
    plan: v.optional(v.string()),
    summary: v.optional(v.string()),
    citations: v.array(v.id('searchResults')),
    createdAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_university', ['universityId'])
    .index('by_status', ['status']),

  searchSteps: defineTable({
    searchId: v.id('searches'),
    agent: agentId,
    text: v.string(),
    status: v.union(v.literal('running'), v.literal('done'), v.literal('failed')),
    createdAt: v.number(),
  })
    .index('by_search', ['searchId'])
    .index('by_status', ['status']),

  searchResults: defineTable({
    searchId: v.id('searches'),
    group: v.string(),
    title: v.string(),
    address: v.optional(v.string()),
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
    distanceMi: v.optional(v.number()),
    travel: v.optional(
      v.object({
        walkMin: v.optional(v.number()),
        transitMin: v.optional(v.number()),
        driveMin: v.optional(v.number()),
      }),
    ),
    hours: v.optional(v.string()),
    fact: v.optional(v.string()),
    sourceUrl: v.string(),
    listingId: v.optional(v.id('listings')),
    isExample: v.boolean(),
    order: v.number(),
  })
    .index('by_search', ['searchId'])
    .index('by_listing', ['listingId']),

  wishlist: defineTable({
    userId: v.id('users'),
    listingId: v.id('listings'),
    status: v.union(
      v.literal('saved'),
      v.literal('checking'),
      v.literal('answered'),
      v.literal('offer'),
      v.literal('passed'),
    ),
    lastAnswer: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_listing', ['listingId'])
    .index('by_status', ['status'])
    .index('by_user_listing', ['userId', 'listingId']),

  tasks: defineTable({
    userId: v.id('users'),
    fromAgent: agentId,
    toAgent: agentId,
    kind: v.string(),
    payload: v.any(),
    status: v.union(v.literal('queued'), v.literal('working'), v.literal('done'), v.literal('failed')),
    result: v.optional(v.any()),
    error: v.optional(v.string()),
    attempts: v.number(),
    runAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_status', ['status'])
    .index('by_toAgent_status', ['toAgent', 'status']),

  calls: defineTable({
    userId: v.id('users'),
    officeId: v.id('offices'),
    listingId: v.optional(v.id('listings')),
    taskId: v.optional(v.id('tasks')),
    toNumber: v.optional(v.string()),
    status: v.union(
      v.literal('scheduled'),
      v.literal('ringing'),
      v.literal('live'),
      v.literal('done'),
      v.literal('failed'),
      v.literal('emailed'),
    ),
    scheduledFor: v.optional(v.number()),
    startedAt: v.optional(v.number()),
    endedAt: v.optional(v.number()),
    transcript: v.array(
      v.object({
        speaker: v.union(v.literal('caller'), v.literal('office')),
        text: v.string(),
        at: v.number(),
      }),
    ),
    answers: v.optional(
      v.object({
        available: v.optional(v.union(v.boolean(), v.literal('unknown'))),
        availableDate: v.optional(v.string()),
        rent: v.optional(v.number()),
        deposit: v.optional(v.number()),
        fees: v.optional(v.string()),
        noSSNOptions: v.optional(v.string()),
        specials: v.optional(v.string()),
        packetEmail: v.optional(v.string()),
        notes: v.optional(v.string()),
      }),
    ),
    externalId: v.optional(v.string()),
    recordingUrl: v.optional(v.string()),
    disclosureSaid: v.boolean(),
  })
    .index('by_user', ['userId'])
    .index('by_office', ['officeId'])
    .index('by_listing', ['listingId'])
    .index('by_status', ['status'])
    .index('by_externalId', ['externalId']),

  emails: defineTable({
    userId: v.id('users'),
    officeId: v.id('offices'),
    direction: v.union(v.literal('out'), v.literal('in')),
    subject: v.string(),
    body: v.string(),
    summary: v.optional(v.string()),
    draftReply: v.optional(v.string()),
    approved: v.boolean(),
    threadId: v.string(),
    createdAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_office', ['officeId'])
    .index('by_thread', ['threadId']),

  documents: defineTable({
    userId: v.id('users'),
    kind: v.union(
      v.literal('i20'),
      v.literal('ds2019'),
      v.literal('visa'),
      v.literal('funding'),
      v.literal('bank'),
      v.literal('passport'),
      v.literal('other'),
    ),
    fileId: v.optional(v.id('_storage')),
    fileName: v.optional(v.string()),
    extracted: v.optional(v.record(v.string(), v.string())),
    status: v.union(v.literal('uploaded'), v.literal('read'), v.literal('needs_review')),
  })
    .index('by_user', ['userId'])
    .index('by_status', ['status']),

  packets: defineTable({
    userId: v.id('users'),
    completeness: v.number(),
    pdfFileId: v.optional(v.id('_storage')),
    sharedWith: v.array(v.id('offices')),
  }).index('by_user', ['userId']),

  offers: defineTable({
    userId: v.id('users'),
    listingId: v.id('listings'),
    rent: v.number(),
    fees: v.optional(v.number()),
    deposit: v.optional(v.number()),
    terms: v.optional(v.string()),
    status: v.union(v.literal('open'), v.literal('accepted'), v.literal('declined'), v.literal('expired')),
    leverageNote: v.optional(v.string()),
  })
    .index('by_user', ['userId'])
    .index('by_listing', ['listingId'])
    .index('by_status', ['status']),

  roommateProfiles: defineTable({
    userId: v.optional(v.id('users')),
    name: v.string(),
    program: v.string(),
    budgetMin: v.number(),
    budgetMax: v.number(),
    moveIn: v.string(),
    tags: v.array(v.string()),
    visible: v.boolean(),
    isExample: v.boolean(),
  })
    .index('by_user', ['userId'])
    .index('by_visible', ['visible']),

  connections: defineTable({
    fromUserId: v.id('users'),
    toProfileId: v.id('roommateProfiles'),
    status: v.union(v.literal('sent'), v.literal('accepted'), v.literal('declined')),
    createdAt: v.number(),
  })
    .index('by_from', ['fromUserId'])
    .index('by_to', ['toProfileId'])
    .index('by_status', ['status']),

  events: defineTable({
    userId: v.id('users'),
    agent: v.optional(agentId),
    toAgent: v.optional(agentId),
    kind: v.string(),
    text: v.string(),
    refTable: v.optional(v.string()),
    refId: v.optional(v.string()),
    createdAt: v.number(),
  }).index('by_user', ['userId']),

  partnerLeads: defineTable({
    officeName: v.string(),
    contactName: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    message: v.optional(v.string()),
    createdAt: v.number(),
  }),
});
