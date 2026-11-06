# how.zingg build plan

Written Fri Nov 6, 2026. Expo is Mon Nov 9. Source docs: `CLAUDE.md`, `DESIGN.md`, `docs/BUILD_PROMPT.md`.

**Rule zero:** the golden path (BUILD_PROMPT §18) must pass 3× in a row in `DEMO_MODE=1` before anything off-path ships. Each milestone ends in a working commit (`lint`, `typecheck`, `test` green). Commits carry no AI attribution.

---

## Packages (latest versions checked on npm today)

| Package | Version | Note |
| --- | --- | --- |
| next | 16.4.5 | App Router, Turbopack. `next lint` is gone, so ESLint runs directly |
| react / react-dom | 19.3.1 | |
| typescript | **6.0.3** (pinned) | TS 7.0.2 is latest, but typescript-eslint 8.72 needs `<6.1` |
| tailwindcss / @tailwindcss/postcss | 4.3.4 | v4 CSS-first: tokens as CSS vars in `globals.css`, mapped with `@theme` |
| three | 0.187.0 | plus `@types/three` |
| @react-three/fiber | 9.8.2 | |
| @react-three/drei | 10.7.9 | |
| motion | 14.9.1 | The only animation library: `useScroll`, `useTransform`, `AnimatePresence` |
| convex | 1.49.0 | |
| @convex-dev/agent | 0.7.9 | peers: `ai ^7`, `convex-helpers`, `@ai-sdk/provider` |
| convex-helpers | 0.1.134 | |
| ai | 7.0.163 | |
| @ai-sdk/anthropic | 4.0.97 | Models: `claude-sonnet-5-5` (AGENT_MODEL), `claude-haiku-5-5` (FAST_MODEL) |
| zod | 4.6.7 | |
| @react-pdf/renderer | 4.9.0 | |
| lucide-react | 1.70.0 | Icons |
| @elevenlabs/elevenlabs-js | 2.76.0 | Real voice only, behind `lib/services/voice/real.ts` |
| twilio | 6.3.0 | Real voice/WhatsApp only |
| postmark | 5.1.0 | Real email only |
| @mendable/firecrawl-js | 4.52.0 | Real crawl only |
| vitest | 5.1.0 | |
| @playwright/test | 1.65.0 | |
| eslint 10.14 + typescript-eslint 8.72 + prettier 3.9 | | |

I'll re-check each library's current docs before writing code against it (Convex Agent, R3F/drei, Motion, ElevenLabs post-call webhook, Places New, Routes). Anything that differs from the build prompt gets logged under "Doc deviations" below.

---

## Milestones and tasks

### M1 · Scaffold (Fri)
- [x] Next.js + TS strict + Tailwind v4, Nunito + JetBrains Mono via `next/font/google`
- [x] `app/globals.css` with every token from DESIGN.md §3–4, mapped with `@theme`
- [x] ESLint, Prettier, Vitest, Playwright configs; scripts `dev`, `lint`, `typecheck`, `test`, `e2e`, `seed`
- [x] Convex init; `convex/schema.ts` with all 19 tables from §11, validators, and an index on every FK and status field
- [x] `lib/services/{llm,voice,email,places,routes,crawl,whatsapp}` with `index.ts` / `mock.ts` / `real.ts`; the factory forces mocks under `DEMO_MODE`, and a failing real call falls back to the mock with a warning
- [x] `lib/clock.ts` demo clock (9:02 AM CT on a weekday, or `DEMO_NOW`); `lib/time.ts` formatter for "9:00 AM CT (7:45 PM your time)" and the office-open logic
- [x] `seed/*.json` + `convex/seed.ts`: USM (plus MSU and Ole Miss light), 7 listings (1 scam), offices, nearby places, 5 roommates, demo user Asha, 3 of 4 docs
- [x] `.env.example`, `.gitignore` (all `.env*` except the example)
- [x] Unit tests: time formatting, office-open across DST, scam check

### M2 · World v1 (Fri)
- [ ] `components/world/`: Ground, Street, path, Apartment rooms (procedural, RoundedBox), LeasingOffice, props (instanced trees/stools), lighting, fog
- [ ] Ortho camera rig with keyframe interpolation (smoothstep) and `focus()`; app orbit limits
- [ ] `quality.ts` (high/low), pixel-ratio caps, pause when off-screen or the tab is hidden
- [ ] `LitWindows` with emissive panes driven by `lightWindow()`
- [ ] `WorldContext` + `WorldHandle` ref; `data-scene` attributes for tests
- [ ] Unit test: camera keyframe interpolation

### M3 · Bots v1 (Fri)
- [ ] `Bot.tsx` parts per §6.3, agent colors, HTML name tags
- [ ] `botClips.ts`: idle (blink), walk, wave first; other clips as stubs that fall back to idle
- [ ] `navGraph.ts` + Dijkstra; `walkTo()`; `routines.ts`
- [ ] `data-bot-<id>-state` attributes
- [ ] Unit test: nav graph shortest path

### M4 · Search pipeline on mocks (Fri → Sat AM)
- [ ] `convex/search.ts`: create search → plan step within 300 ms → scheduled action runs Scout tools → steps stream → results → summary with citations
- [ ] Intent router covering the §9.3 table, plus the availability-rule classifier
- [ ] Convex Agent setup for Concierge and Scout (real LLM path); DEMO_MODE uses scripted mock steps with 300–900 ms delays
- [ ] `components/search/`: SearchSheet, StepStream (aria-live), ResultCard (source always visible, Example tag), SummaryBlock, AgentRail with 2D toss, ExampleChips, skeletons
- [ ] Unit test: availability classifier with 20+ phrasings

### M5 · Landing beats 1–4 (Sat)
- [ ] StoryScroller (700vh) + StickyWorld + Beat panels with Motion fades
- [ ] Hero (server-rendered HTML, lazy canvas, poster), Problem, Team (waving lineup, synced list), Ask (glowing door, clickable office → SearchSheet, scroll lock)

### M6 · Beat 5: the team goes to work (Sat)
- [ ] Timed walk on submit (scripted camera, ~6 s) and scroll-scrubbed walk across 0.50–0.64
- [ ] Rooms light up as each bot arrives; the sheet collapses to a live card; "Continue in the app" → `/app/ask/[id]`

### M7 · App home (Sat)
- [ ] `/app` layout and Home: header, UniversityPicker, room chips, AgentStrip, search bar, status line + activity drawer, 3D picks with HTML button equivalents
- [ ] `/app/ask/[searchId]`

### M8 · Tasks, toss, availability rule, Caller (Sat → Sun AM)
- [ ] `convex/tasks.ts`: delegate → queued → scheduled runner → working/done/failed (one retry); `events` feed
- [ ] 3D FileToss (Bézier, 650 ms) triggered from `events`
- [ ] Availability reply in the exact shape with its 3 buttons; wishlist states
- [ ] Mock call: ringing → live → transcript every 1.2 s → answers; disclosure line first, enforced in code
- [ ] Allowlist guard in `voice` (unit test proving a non-allowlisted number can't be dialed)
- [ ] `/app/calls/[callId]` view; closed-office path: schedule + email + two-time-zone toast

### M9 · Landing beats 6–8 + static sections (Sun)
- [ ] Rooms tour, Couch, Booked (confetti, celebrate); ForOffices + partnerLeads form; Facts from `content/facts.ts`; FAQ; final CTA; footer; `/fair-housing`, `/privacy`
- [ ] Posters, no-WebGL fallback, reduced motion (cuts/fades), mobile layout, meta/OG/sitemap/robots

### M10 · Remaining golden-path screens (Sun)
- [ ] HousingSheet (3 tabs), Oak Hollow "Offer ready" → Choose this one
- [ ] Packet: upload → mock extraction → 4/4 → Share with Oak Hollow
- [ ] Closer: hold + fee waiver (mock) → user approval → `markBooked` → booked celebration; What to do next
- [ ] Roommates: couch → list → Say hi → `connections` row; match only on lifestyle fields (unit test)
- [ ] `/office` dashboard (light surface) showing the verified applicant
- [ ] Rehearsal mode `?demo=1`: press `.` for Reset / Skip to beat / Force call result
- [ ] Lighter versions if time allows: swipe deck, chat, emails, places

### M11 · Real services (Sun, **only after you say yes**)
- [ ] One ElevenLabs + Twilio call to an allowlisted teammate phone
- [ ] One Postmark email to our own inbox
- [ ] Webhook routes with signature checks (reject unsigned outside DEMO_MODE)

### M12 · Harden + freeze (Sun, by 9 PM)
- [ ] `landing.spec.ts` + `golden-path.spec.ts` pass 3× in a row
- [ ] Screenshots at 1440×900 and 390×844; Lighthouse mobile check
- [ ] README; record a backup demo video (you)

**Cut order if late (bottom first):** M10 extras (swipe/chat/emails/places) → M11 real services → beat 6–7 polish → office dashboard detail drawer → reduced-motion polish beyond the basics.

---

## Decisions (answered Nov 6)

1. Logos: `public/brand/wordmark-dark.png`, `public/brand/mark-dark.png`. Design references in `docs/refs/`.
2. Convex: local dev now (`npx convex dev --local`), deployable to Convex cloud later with no code changes.
3. Folder names follow BUILD_PROMPT v2 (`app/app/`, `components/world/`); CLAUDE.md updated.
4. Git: commit straight to `main` on github.com/sushilbhattarai45/how.zingg. No branches, no PRs, no AI attribution.
5. Allowlist: `+16019132221`; test inbox `Rajeev.Shrestha@usm.edu`. Still ask before each real call or email.
6. LLM: mocks until an Anthropic key is provided. ElevenLabs voice calls are in scope (M11).

## Risks

| Risk | Mitigation |
| --- | --- |
| 3D world + landing scroll story is the biggest scope item | Procedural primitives only, build World once and share it, cut beats 6–7 polish first |
| Convex Agent 0.7 / AI SDK 7 API churn | Read current docs before use; DEMO_MODE doesn't depend on it (scripted mocks) |
| Scroll-driven R3F performance on mid phones | `quality=low`, no shadows, instancing, frameloop pause off-screen |
| Live demo hiccups (Wi-Fi, APIs) | DEMO_MODE with zero external calls, local Convex, rehearsal bar, backup video |
| TS 7 / tooling mismatch | Pin TS 6.0.3 |
| E2E flakiness from animations | Tests wait on `data-scene` / `data-bot-*` attributes, not timeouts; Playwright can force reduced motion where needed |

## Doc deviations

- Next 16 dropped `next lint`, so `npm run lint` runs `eslint .`.
- Tailwind v4 has no `tailwind.config.js` theme; tokens live in CSS via `@theme` (same intent as §3).
- Demo clock defaults to **Wed 2027-07-14 9:02 AM CDT**. The Pine Row toast says "7:45 PM your time", which only holds during US daylight time (Kathmandu is UTC+5:45), so the demo date has to be in summer. Arrival is Aug 14, 2027.
- Pine Row's office hours are Thu–Sat, so at the demo "now" it's closed and Caller schedules for Thu 9:00 AM CT.
- Oak Hollow's seeded phone is the allowlisted teammate number (+16019132221), so the real-call demo rings that phone.
- `connections.toProfileId` points at `roommateProfiles` (example people aren't users). A few helper fields were added: `listings.slug/noSSN/noSSNNote`, `universities.ready`, `searchResults.order`, `tasks.attempts`, `calls.externalId/toNumber`, `events.toAgent`.
- Routes, crawl, email and WhatsApp services keep the mock and the real stub in one `index.ts`; voice, LLM and places have separate files. Real Places/Routes/Firecrawl are behind `LIVE_*` flags (stretch).
- Convex local runs as an anonymous deployment (`CONVEX_AGENT_MODE=anonymous npx convex dev`). DEMO_MODE is also set in Convex (`npx convex env set DEMO_MODE 1`), because Convex functions read their own env.
- Next 16 writes an `AGENTS.md`; it's committed.
