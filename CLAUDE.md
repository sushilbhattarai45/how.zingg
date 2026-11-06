# CLAUDE.md: how.zingg

Read this first in every session. Then read `DESIGN.md` before touching any UI.

## What we're building

**how.zingg** helps students rent **off-campus housing near their university before they arrive**: international students first (no SSN, no US credit, 10+ hour time difference), then transfer students, then visiting scholars. The student picks a university, asks anything, and five AI agents research, call and email leasing offices, build a renter packet, and keep going until a lease is confirmed. Apartments pay a fee per signed lease; students use it free.

- Launch market: **University of Southern Mississippi (USM), Hattiesburg, MS**.
- Deadline: **VOXO Hatchathon Expo, Monday Nov 9, 2026**. The golden path (below) beats every other feature.
- Full spec: `docs/BUILD_PROMPT.md`. Design rules: `DESIGN.md`.
- Name is always lowercase **how.zingg** with the dot.

## Commands

```bash
npm install
npx convex dev          # Convex backend (keep running)
npm run dev             # Next.js on http://localhost:3000
DEMO_MODE=1 npm run dev # everything on mocks + seeded USM data
npm run seed            # reseed demo data (convex/seed.ts)
npm run test            # Vitest (tools, utils)
npm run e2e             # Playwright golden path (runs in DEMO_MODE)
npm run lint && npm run typecheck
```

Run `lint`, `typecheck` and `test` before every commit.

## Stack

Next.js (App Router) + TypeScript + Tailwind · React Three Fiber + drei (3D apartment) · Motion · Convex (DB, functions, scheduler, file storage) · Convex Agent component · Claude (Sonnet for agents, Haiku for extraction) · ElevenLabs Agents + Twilio (calls) · Firecrawl · Google Places (New) + Routes · Postmark · Twilio WhatsApp · zod · Vitest · Playwright.

Library APIs change: check current docs before using Convex Agent, R3F, ElevenLabs, Twilio, Google Places or Firecrawl. Don't guess method names.

## Layout

```
app/app/              student screens (home, ask, swipe, chat, calls, emails, packet, next, places, roommates)
app/office/           leasing office dashboard (B2B)
app/api/webhooks/     elevenlabs, twilio, postmark
components/world/     3D world: World, Apartment/*, Bot, LeasingOffice, FileToss, Street, navGraph
components/ui/        SearchBar, UniversityPicker, AgentStrip, BotCard, HousingSheet, SwipeDeck, StepStream, ResultCard, OfferCard
convex/               schema.ts, agents/*, tools/*, tasks.ts, search.ts, calls.ts, emails.ts, packet.ts, seed.ts, crons.ts
lib/services/         llm, voice, email, whatsapp, places, routes, crawl → each has index.ts, real.ts, mock.ts
public/brand/         wordmark-dark.png, mark-dark.png
docs/                 BUILD_PROMPT.md, PLAN.md
```

## The five agents (no more)

| Agent | Color | Job |
| --- | --- | --- |
| Concierge | `#6DBD13` | Orchestrator; talks to the user; delegates; summarizes; runs the loop to booking |
| Scout | `#3DB8C9` | Listings + neighborhood research (Walmart, groceries, Amazon, banks, transit); scam flags |
| Caller | `#FF8A4C` | Calls offices now if open, else schedules for opening time; email fallback |
| Packet | `#F2C230` | Reads I-20/visa/funding/bank docs; checklist; renter packet PDF |
| Closer | `#F25C8A` | Compares offers, negotiates, follows up, tracks lease to signature |

- Agents hand work to each other **only through the `tasks` table** (`queued → working → done/failed`). Each handoff writes an `events` row; the UI plays the file-toss animation from that.
- Plain functions (ranking, taste learning, scheduling, memory) are not agents.

## Rules that are never broken

1. **AI disclosure** is the first sentence of every call: "Hi, I'm an AI assistant calling on behalf of a student."
2. **Real calls only to `CALL_ALLOWLIST` numbers.** Everyone else: email or web form. Never place a real call, email or text without asking the human first.
3. **Live info is never guessed.** Availability, today's price, specials, holds, tours → Concierge says Caller must ask the office and offers: "Add to wishlist and ask Caller" / "Just add to wishlist" / "Not now".
4. **Fair housing.** Never filter, rank or describe places or roommates by national origin, race, religion, sex, family status or disability. Never call a neighborhood safe/unsafe/good/bad or describe who lives there. Facts and sources only.
5. **No money handling.** We never take rent, deposits or fees.
6. **Scams hidden:** wire transfers, gift cards, crypto, pay-before-tour, below-market rent with copied photos.
7. **Privacy:** documents encrypted, shared only with offices the user approves, deletable. Never ask for an SSN.
8. **User approves anything binding** (sign, pay, submit).
9. **Example data is labeled "Example"** in the UI. Search results always show sources.
10. **Original visuals only.** No copies of TV/film sets, characters or other brands.

## Conventions

- **Mocks first.** Every external service sits behind `lib/services/<name>`; `DEMO_MODE=1` forces mocks. A failing real service falls back to its mock and logs a warning.
- **zod everywhere** for tool inputs/outputs and webhook payloads.
- **Convex:** validators on every table; index every foreign key and status; long work in actions, writes in mutations; schedule with `ctx.scheduler.runAt`.
- **Time zones:** store UTC. Show office times in the office's zone **and** the user's zone: "9:00 AM CT (7:45 PM your time)".
- **UI:** follow `DESIGN.md` exactly: dark-first ink `#191719`, one green primary button per screen (ink text on green), Nunito, rounded everything, no emoji icons, 44 px touch targets.
- **3D:** reuse geometries/materials; cap pixel ratio at 2; every clickable 3D object also has a normal button; respect reduced motion.
- **Copy:** short, specific, numbers over adjectives. how.zingg always lowercase.
- **Commits:** small, imperative ("Add availability rule to Concierge"). App stays runnable at every commit. Never commit `.env*` files with keys.

## Golden path (the Expo demo, must always pass `npm run e2e`)

1. Home loads: USM selected, 3D apartment, five bots working.
2. Ask "Indian or Nepali grocery stores near USM, and the nearest Walmart" → file toss to Scout, live steps, result cards with sources, Concierge summary.
3. Ask "Is Oak Hollow's 1 bed available Aug 14?" → availability rule → **Add to wishlist and ask Caller** → file toss to Caller → Caller on the phone.
4. Call view: disclosure, live transcript, answers fill in (mock or allowlisted teammate phone).
5. Tap leasing office → Housing sheet → Oak Hollow "Offer ready" → Choose this one.
6. Packet 3/4 → upload bank statement → complete.
7. Booking confirmed: door light green, lights-on animation, confetti.
8. Tap couch → Roommates → Say hi to Aarav.
9. Office dashboard shows the verified applicant.

## When unsure

- Product question → `docs/BUILD_PROMPT.md`. Visual question → `DESIGN.md`.
- Still unclear → ask the human. Don't invent features off the golden path before it passes.

## Git

- **No AI attribution, ever.** No `Co-Authored-By: Claude` trailers in commits, no "Generated with Claude Code" in PRs, issues or comments. Commits are authored by the team only.
