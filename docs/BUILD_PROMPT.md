# how.zingg: full build prompt for Claude Code (v2)

Put `CLAUDE.md` and `DESIGN.md` in the repo root, the logos in `public/brand/`, save this file as `docs/BUILD_PROMPT.md`, then tell Claude Code: **"Read CLAUDE.md, DESIGN.md and docs/BUILD_PROMPT.md, then write docs/PLAN.md and wait for my go-ahead."**

This document is long on purpose. Every section is a requirement unless it is marked **Stretch**.

---

## 0. How you work on this project

You are the lead engineer for **how.zingg**, built for the VOXO Hatchathon 2026 at the University of Southern Mississippi (Student Focused track). The Expo demo and pitch are **Monday, November 9, 2026**. Today is **Friday, November 6**. There are about 3 working days.

1. **Read first, then plan.** Read `CLAUDE.md`, `DESIGN.md` and this file completely. Write `docs/PLAN.md` with: the milestones from section 19, a checklist of tasks per milestone, the packages you will install (with the versions you found in their docs), open questions, and risks. Stop and wait for approval.
2. **The golden path wins.** Section 18 is the demo. Nothing else ships until it passes end to end, three times in a row, in `DEMO_MODE=1`.
3. **Mocks before real services.** Every external service is behind an interface in `lib/services/<name>/` with `real.ts` and `mock.ts`. `DEMO_MODE=1` uses only mocks and seeded data. A real service that fails falls back to its mock and logs a warning.
4. **Never spend money or contact people without asking.** No real phone calls, emails, WhatsApp messages, or paid API loops without the human saying yes in the chat. Calls only ever go to numbers in `CALL_ALLOWLIST`.
5. **Check current docs.** Convex, the Convex Agent component, React Three Fiber, drei, Motion, ElevenLabs, Twilio, Google Places, Google Routes, Firecrawl and Postmark all change. Look up the current API before using it. Never guess method names, props or webhook shapes. If something in this prompt conflicts with the current docs, follow the docs and note it in `docs/PLAN.md`.
6. **Small, working commits.** Commit after each step that works. Run `npm run lint`, `npm run typecheck` and `npm run test` before each commit. The app runs at every commit.
7. **No invented facts.** Search results show their sources. Seeded data is labeled "Example" in the UI. Stats on the landing page come only from section 7.8.
8. **When unsure, ask.** One clear question beats a wrong day of work.

---

## 1. Product

**how.zingg** helps students rent **off-campus housing near their university before they arrive.**

- **Who:** international students first (no SSN, no US credit history, 10+ hours of time difference, can't tour), then transfer students (often arrive in January when leases run August to July), then visiting scholars and faculty (need 1 to 12 month furnished stays).
- **What it does:** the student picks a university and asks anything. Five AI agents research apartments and the neighborhood, call and email leasing offices during US business hours, build a renter packet from the student's documents, negotiate, and keep looping until a lease is confirmed.
- **Business model:** apartment communities pay a placement fee per signed lease (below what human apartment locators charge); students use it free. Partner revenue from guarantor services, renters insurance, furniture and utilities. Later: a leasing office dashboard subscription and a visiting-scholar service for university departments.
- **Launch market:** University of Southern Mississippi (USM), Hattiesburg, MS, Central Time. Other universities can be picked; all seeded data is USM.
- **Brand:** always lowercase **how.zingg**, with the dot. Logo = a house in one rounded white line with a **lit green window**. Brand story: *while you sleep, the team keeps the light on and finds you a home.*

---

## 2. Rules that are never broken

Enforce these in code, in agent instructions, and in tests.

1. **AI disclosure.** The first sentence of every call: "Hi, I'm an AI assistant calling on behalf of a student." Calls are announced as recorded.
2. **Allowlisted calls only.** Real calls only to numbers in `CALL_ALLOWLIST`. Everyone else gets email or the office's web form.
3. **Never guess live information.** Availability, today's price, specials, holds, tour times → the availability rule (section 10.3).
4. **Fair housing.** Never filter, rank or describe apartments, neighborhoods or roommates by national origin, race, religion, sex, familial status or disability. Never call a neighborhood safe, unsafe, good or bad, and never describe who lives there. Give facts: distance, travel time, price, what is nearby, and links to official sources if the user asks about crime statistics. Roommate matching uses only lifestyle fields the user chose.
5. **No money handling.** how.zingg never collects rent, deposits or fees.
6. **Scam protection.** Flag and hide listings that ask for wire transfers, gift cards or crypto, money before a tour, or have rent far below market with reused photos.
7. **Privacy.** Documents are stored encrypted, shared only with offices the user approves, deleted on request. Never ask for or store an SSN.
8. **The user approves anything binding.** Signing, paying, submitting an application, sending an email the user hasn't seen: always a user tap.
9. **Not legal advice.** Lease and immigration answers are plain-language information plus "check with ISSS or a lawyer" for anything binding.
10. **Original visuals only.** The apartment, bots and world are original. Do not recreate any TV show, film or game set, character, or another brand's look.
11. **Example data is labeled.** Anything seeded shows an "Example" tag.

---

## 3. Tech stack

Use the latest stable versions. Confirm package names in their docs before installing.

| Layer | Choice | Notes |
| --- | --- | --- |
| Framework | **Next.js (App Router) + TypeScript (strict)** | One codebase: landing, student app, office dashboard |
| Styling | **Tailwind CSS** with CSS variables from `DESIGN.md` | Tokens in `app/globals.css`; Tailwind theme reads the variables |
| 3D | **three.js + React Three Fiber + drei** | One shared `World` used by landing and app |
| Animation | **Motion** (motion.dev) | Page and UI animation **and** scroll progress (`useScroll`). Do not add GSAP; one animation library only |
| Backend | **Convex** | Database, queries/mutations/actions, scheduler, file storage, realtime |
| Agents | **Convex Agent component** | Threads, tools, messages stored in Convex. Use whatever model provider interface it expects (check docs) with Anthropic models |
| LLM | **Claude** | Sonnet-class model for agent reasoning; Haiku-class model for extraction and summaries. Model IDs in env |
| Voice | **ElevenLabs Agents + Twilio** | Outbound calls; post-call webhook with transcript and data-collection fields |
| Web reading | **Firecrawl** | Crawl + structured extraction of leasing websites |
| Places | **Google Places API (New)** | Text search, nearby search, details (hours, phone, website, photos) |
| Routes | **Google Routes API** | Walk, bike, transit, drive times |
| Email | **Postmark** | Outbound + inbound webhook |
| WhatsApp | **Twilio WhatsApp** (sandbox for the demo) | **Stretch** |
| PDF | **@react-pdf/renderer** | Renter packet |
| Validation | **zod** | Every tool input/output and webhook payload |
| Tests | **Vitest**, **Playwright** | Unit + golden path e2e |
| Lint/format | ESLint + Prettier | |

---

## 4. Routes

| Route | What | Auth |
| --- | --- | --- |
| `/` | **Landing page** with the scroll story (section 7) | Public |
| `/app` | Student home: 3D apartment, search bar, agent strip (section 8.1) | Demo user in `DEMO_MODE`; otherwise sign in |
| `/app/ask/[searchId]` | Search results with live agent steps (section 9) | |
| `/app/swipe` | Swipe deck | |
| `/app/chat` | Chat with Concierge | |
| `/app/calls/[callId]` | Call view | |
| `/app/emails` | Email threads | |
| `/app/packet` | Renter packet | |
| `/app/next` | What to do next | |
| `/app/places` | Everything (all places) | |
| `/app/roommates` | Roommates | |
| `/office` | Leasing office dashboard (desktop) | Office demo login |
| `/api/webhooks/elevenlabs`, `/api/webhooks/twilio`, `/api/webhooks/postmark` | Webhooks (verify signatures) | |

The landing page's search carries into the app: submitting a search on `/` creates a real `searches` row (demo user in `DEMO_MODE`), and "Continue in the app" opens `/app/ask/[searchId]` with the same results.

---

## 5. Design system

`DESIGN.md` is the source of truth. Summary for quick reference:

- Dark-first. Background ink `#191719`, deepest `#111012`, surface `#222023`, raised `#2C2A2D`, line `#3A373B`, text `#FFFFFF` / `#B9B5BA` / `#8B878C`.
- Brand green (the lit window) `#6DBD13`; hover `#86D32E`; tint `#1F2E12`. Green is rare: primary button (with **ink text**, never white), offer ready, booked, step done, agent working.
- Light surfaces (office dashboard, documents): paper `#F6F4F0`, card `#FFFFFF`, green text `#3F7A08`.
- Agent colors: Concierge `#6DBD13`, Scout `#3DB8C9`, Caller `#FF8A4C`, Packet `#F2C230`, Closer `#F25C8A`.
- Type: Nunito (800 display, 700 headings/labels, 500–600 body), JetBrains Mono for times and prices in tables.
- Radii 12/16/20/999. Borders over shadows. Rounded-cap outline icons (Lucide). No emoji icons. One green primary button per screen. 44 px touch targets.
- Signature motion: **lights on** (four window squares light up one by one, 80 ms apart). Use only for launch, loading, offer arrived, booking confirmed.

---

## 6. The shared 3D world

One world, two cameras: the landing page tells a story with it; the app uses it as the home screen. Build it once in `components/world/`.

### 6.1 Layout of the world (units = meters, y up)

- **Ground:** 160 × 160 grass plane at y = −0.42, color `#5E7A4E` darkened for evening.
- **Street:** along x at z = 16.5, 5 m wide, asphalt `#3B393C`, dashed lane marks, sidewalk at z = 13.4.
- **The apartment** (cutaway, no ceiling): footprint x ∈ [−10, 10], z ∈ [−7, 7], floor at y = 0 on a 0.42 m concrete base. Back wall at z = −7.1 and left wall at x = −10.1 are full height (3.3 m). Inner walls are 1.5 m tall so every room is visible.
  - **Office** x ∈ [−10, −3], z ∈ [−7, 0]: desk against the back wall, laptop with a live call waveform screen, whiteboard "Calls today", bookshelf, plant, desk lamp.
  - **Bedroom** x ∈ [−10, −3], z ∈ [0, 7]: bed against the left wall, nightstand lamp, wardrobe, rug, arched window.
  - **Hall** x ∈ [−3, 1]: front door on the back wall at x = −1 with a status light above it, door mat, coat rack, Scout's map easel (map of the chosen university area) and a small laptop table.
  - **Kitchen + dining** x ∈ [1, 10], z ∈ [−7, −1]: brick back wall, counters, stove with steaming pot, fridge, printer, island with three stools, round dining table.
  - **Living room** x ∈ [1, 10], z ∈ [−1, 7]: orange sofa (**the couch**), rug, coffee table, armchair, floor lamp, big plant.
- **Path:** paved, 1.4 m wide, from the apartment's open front at (−1, 7.4) to (−1, 10.2) → (5, 11.2) → (11, 10.6) → (15.6, 9.4) → leasing office door (16.6, 8.2).
- **Leasing office:** small building centered at (17.5, 5.6), 5 × 4 m, pitched roof, door facing +z, front window, sign "Leasing Office", awning. Its window can glow green.
- **Props:** trees, bushes, two street lamps (warm emissive heads), a bench by the path.
- **Sky / time of day:** early evening. Background `#2A2630` with fog of the same color starting at 70 m. Hemisphere light (sky `#B9B2D6`, ground `#3A3226`, 0.55), warm key light (`#FFD9B0`, 0.9, from (14, 22, 12), soft shadows), and warm point lights in rooms. Not pure white, not black space.
- **Lit windows (brand motif):** the apartment's window panes and the leasing office window are emissive; they glow green `#6DBD13` when an agent is working in that room or an offer is ready.

### 6.2 Rendering

- Orthographic camera, isometric-style default: azimuth 45°, elevation ~38°. App: drag to orbit within azimuth [10°, 80°] and elevation [25°, 60°], scroll/pinch to zoom [0.8×, 3.5×]. Landing: camera is driven by scroll and scripted moves only (no orbit drag, to keep page scroll working).
- `renderer.toneMapping = ACESFilmic`, sRGB output, PCF soft shadows (desktop only), pixel ratio ≤ 2 (≤ 1.5 on mobile).
- All furniture is procedural: boxes, cylinders, spheres and extruded rounded boxes (`RoundedBox` from drei). Reuse geometries and materials; instance repeated items (trees, stools, books). Target < 150 draw calls, < 2 ms CPU per frame on a mid laptop.
- Canvas textures for: the call waveform screen, whiteboard, university map, "Leasing Office" sign, luggage tag ("KTM→PIB" in demo), documents.
- **Mobile:** no shadows, fewer trees, lower pixel ratio, simplified props behind a `quality` flag (`high` | `low`) chosen from device memory/cores and `prefers-reduced-motion`.

### 6.3 Bots

Five small, cute, original bots, built procedurally (no external models):

- **Parts:** chalk-white rounded head (0.88 × 0.64 × 0.72) with an ink face screen (0.66 × 0.40), two eyes (0.09 × 0.15) emissive in the agent color, an antenna with a glowing ball, ear bolts in the agent color, a rounded body in the agent color, two round hands, a soft round shadow disc. Height ~1.7 m in world units including antenna.
- **Name tag:** HTML overlay (drei `Html` or a projected div), chalk pill with ink text and a dot in the agent color. On the landing page the tag also shows a one-line role during the "meet the team" beat.
- **Animation clips (procedural, code-driven):**
  - `idle`: body bobs ±0.05 m at 0.35 Hz; blinks every 2.5–5.5 s (eyes scale y → 0.12 for 130 ms).
  - `walk`: bob uses |sin| at 1.4 Hz (amplitude 0.08), body roll ±0.06 rad, hands swing forward/back ±0.1 m, speed 1.4–1.9 m/s along a path; turn smoothly toward the next waypoint.
  - `wave`: right hand rises to head height, rotates ±25° around z at 3 Hz; slight body sway; eyes squint happily (scale y 0.6) every other wave. Waves are staggered 120 ms between bots.
  - `work_desk` (Caller): hands tap on the desk alternately at 7 Hz.
  - `phone` (Caller): handset at the head, ring waves (two orange tori expanding and fading) every 1.1 s.
  - `pin` (Scout): right hand raises to the map easel, a new pin pops in at the end of each visit.
  - `read` (Scout): hands at laptop height, head tilts.
  - `print` / `stamp` (Packet): paper slides out of the printer; stamp moves down/up at 3 Hz; paper stack grows by one sheet per cycle.
  - `carry` (Closer): carries the suitcase in front, from the door to the bedroom, sets it down.
  - `key` (Closer): holds a gold key that spins slowly while waiting at the door.
  - `chat` (Concierge): right hand gestures, body sways; head turns to whoever it's talking to.
  - `celebrate` (all): hop 0.25 m twice, arms up; used on "booking confirmed".
- **Routines (when no real task is driving them):** loops of stops `{position, wait, clip, faceToward}`; e.g. Caller: desk (4.5 s, `work_desk`) → pace four points with `phone`; Scout: easel (`pin`) ↔ laptop (`read`); Packet: printer (`print`) ↔ table (`stamp`); Closer: door pickup → bedroom drop (`carry`) → door (`key`); Concierge: visits each bot (`chat`), makes tea at the stove, chats at the couch, walks to the leasing office and back.
- **State-driven:** in the app, when a `tasks` row for an agent becomes `working`, that bot interrupts its routine, walks to its station and plays the task's clip until the task is `done`. Agent status words in the UI come from the same state.

### 6.4 Navigation

A small waypoint graph (`components/world/navGraph.ts`) with nodes for each station, room doorways, the apartment front, path points and the leasing office door. Bots move along shortest paths on this graph (precomputed with a tiny Dijkstra). Bots never walk through furniture or walls. Outside the apartment their y follows the ground height.

### 6.5 File toss

When agent A hands work to agent B, a small white paper (0.24 × 0.3, with a colored header stripe in A's color) flies from A's hand to B's hand along a quadratic Bézier arc whose top is 1.2 m above the higher bot, duration 650 ms, ease-out, with a slight spin. On arrival, B's antenna flashes green and B plays a 300 ms "catch" (hands forward). The same toss renders as a 2D chip animation in the search sheet and chat, between the two agents' avatars.

### 6.6 World API

```ts
// components/world/World.tsx
type WorldMode = 'landing' | 'app';
type BotId = 'concierge' | 'scout' | 'caller' | 'packet' | 'closer';
interface WorldHandle {
  setScene(scene: 'hero' | 'office-lineup' | 'walk-to-apartment' | 'apartment-working' | 'rooms-tour' | 'couch' | 'booked'): void;
  setScrollProgress(p: number): void;         // landing only, 0..1
  toss(from: BotId, to: BotId): Promise<void>;
  playClip(bot: BotId, clip: ClipName, opts?: { loop?: boolean }): void;
  walkTo(bot: BotId, node: NavNodeId): Promise<void>;
  lightWindow(target: 'office' | 'kitchen' | 'hall' | 'living' | 'bedroom' | 'leasing', on: boolean): void;
  focus(target: 'all' | 'leasing' | 'office' | 'kitchen' | 'living' | 'bedroom' | 'hall'): void; // camera glide
  onPick(cb: (hit: { kind: 'bot'; id: BotId } | { kind: 'leasing' } | { kind: 'couch' } | { kind: 'door' }) => void): () => void;
}
```

Expose it through a React context + ref so both the landing page and the app drive the same world.

---

## 7. Landing page (`/`)

The landing page is one long scroll story told with the 3D world. A full-screen canvas sits **sticky** behind HTML text panels that scroll over it. Scroll progress drives the camera and the bots. All text is real HTML (indexable, accessible); the canvas is decoration with HTML equivalents.

### 7.1 Structure

```
<LandingPage>
  <TopNav />                       fixed, transparent over hero, ink after 80px scroll
  <StoryScroller height="700vh">   Motion useScroll({ target }) → progress 0..1
    <StickyWorld />                position: sticky; top: 0; height: 100vh; z-index: 0
    <Beat id="hero"        range=[0.00, 0.12] />
    <Beat id="problem"     range=[0.12, 0.22] />
    <Beat id="team"        range=[0.22, 0.38] />   agents waving outside the leasing office
    <Beat id="ask"         range=[0.38, 0.50] />   click the office → search tool
    <Beat id="to-work"     range=[0.50, 0.64] />   agents walk to the apartment and start working
    <Beat id="rooms"       range=[0.64, 0.82] />   room-by-room tour: what each agent does
    <Beat id="couch"       range=[0.82, 0.90] />   roommates
    <Beat id="booked"      range=[0.90, 1.00] />   lights on, confetti, final CTA
  </StoryScroller>
  <ForOffices />                   normal sections (no 3D) for the business case
  <Facts />
  <FAQ />
  <FinalCTA />
  <Footer />
</LandingPage>
```

- Each `Beat` is an HTML panel (max width 440 px, `--surface` at 88% opacity, radius 20, padding 24) positioned left on desktop (right side shows the world), bottom sheet style on mobile (world fills the top 60%).
- `StickyWorld` receives `progress`. A beat is "active" when progress is inside its range; the world interpolates camera keyframes between beats.
- Use `useScroll` + `useTransform` from Motion for panel opacity/translate (fade in over the first 20% of its range, out over the last 20%).

### 7.2 Camera keyframes (landing)

Camera is orthographic; `target` is the look-at point; `zoom` multiplies the base fit. Interpolate with smoothstep between keyframes.

| Progress | Target (x, y, z) | Azimuth | Elevation | Zoom | What we see |
| --- | --- | --- | --- | --- | --- |
| 0.00 | (4, 0.9, 3) | 45° | 52° | 0.85 | Whole neighborhood at dusk, from high up |
| 0.12 | (2, 0.9, 2) | 40° | 44° | 1.0 | Apartment with dark windows; one by one they light up |
| 0.22 | (15, 0.6, 8) | 35° | 34° | 2.1 | Leasing office; five bots lined up in front |
| 0.38 | (16.5, 1.0, 8.5) | 30° | 30° | 2.6 | Close on the office door, glowing green |
| 0.50 | (8, 0.6, 9) | 40° | 38° | 1.5 | The path; bots walking toward the apartment |
| 0.64 | (−6.5, 0.9, −3.5) | 45° | 42° | 2.2 | Office: Caller on the phone |
| 0.70 | (−1, 0.9, 1) | 45° | 42° | 2.2 | Hall: Scout pinning the map |
| 0.76 | (4, 0.9, −4.5) | 45° | 42° | 2.2 | Kitchen: Packet printing/stamping |
| 0.82 | (6, 0.9, 2.5) | 45° | 40° | 2.1 | Living room: the couch |
| 0.90 | (−1, 0.9, −5) | 45° | 40° | 2.0 | Front door: Closer with the key |
| 1.00 | (4, 0.9, 3) | 45° | 46° | 1.0 | Whole apartment, every window lit green |

### 7.3 Beat by beat (copy is final unless marked)

**Beat 1: Hero (0.00–0.12)**
- Logo wordmark (from `public/brand/wordmark-dark.png`, later SVG) top-left in the nav.
- H1 (Nunito 800, 48/52 desktop, 34/38 mobile): **"Find a home near campus before you land."**
- Sub (18/26, `--text-2`): "how.zingg's AI team calls leasing offices, checks the neighborhood and handles the paperwork while you sleep. Built for international and transfer students."
- **University picker** inline (pill): "Which university?" preset to "University of Southern Mississippi". Typeable (section 8.2).
- Primary CTA (green, ink text): **"Meet your team"** → smooth-scrolls to progress 0.22. Secondary (outline): "See how it works" → scrolls to 0.64.
- Small trust line: "No SSN needed · Free for students · You approve every step".
- World: high dusk view; apartment windows light up one by one using the **lights on** motion (80 ms stagger).
- Scroll cue at bottom: a small rounded chevron that bobs (stops when reduced motion).

**Beat 2: The problem (0.12–0.22)**
- H2: **"Renting from abroad is built for someone already here."**
- Four short rows with outline icons:
  - "Offices close before you wake up."
  - "No SSN, no US credit, so applications stall."
  - "Fake listings target students who can't tour."
  - "You land with luggage and nowhere to go."
- World: camera begins gliding toward the leasing office.

**Beat 3: Meet your team (0.22–0.38)** — *the agents waving outside the leasing office*
- World: five bots stand in a gentle arc in front of the leasing office (positions: (14.6, 9.6), (15.6, 10.0), (16.6, 10.2), (17.6, 10.0), (18.6, 9.6)), all facing the camera. As the beat starts they turn to the camera and play `wave` with 120 ms stagger. Each name tag expands to show its role.
- HTML panel H2: **"Meet your team."** Body: "Five agents, one job: get you a confirmed lease."
- A list synced with the world (hovering or focusing a row makes that bot hop and glow):
  - **Concierge** · "Talks with you and runs the plan."
  - **Scout** · "Finds places and checks the neighborhood."
  - **Caller** · "Calls offices when they're open."
  - **Packet** · "Turns your documents into a renter packet."
  - **Closer** · "Gets the best deal and the keys."
- Bots keep waving (looped, every 3–4 s) until the user scrolls past or opens the search.

**Beat 4: Ask the team (0.38–0.50)** — *click the leasing office to open the search tool*
- World: camera moves close to the office door. The door and window glow green and pulse softly (1.6 s). A floating label above the door: **"Tap to ask the team"**. Concierge steps forward, gestures toward the door.
- HTML panel H2: **"Ask anything about living near campus."** Body: "Apartments, prices, Walmart, groceries, the bus, banks that don't need an SSN. Your team digs and comes back with answers and sources."
- Button (also the accessible equivalent of clicking the door): **"Ask the team"** (green).
- **Clicking the leasing office in 3D, its label, or the button opens the Search Sheet** (section 9) over the page. The page scroll is locked while the sheet is open (restore position on close).
- Example prompts as chips inside the sheet: "Cheapest 1 bed under $700 near USM", "Nearest Walmart from campus", "Indian or Nepali groceries near USM", "Banks that open an account without an SSN", "Is Oak Hollow's 1 bed free on Aug 14?"

**Beat 5: The team goes to work (0.50–0.64)** — *after search, agents walk to the apartment*
- Two ways to trigger, same result:
  1. **Search submitted:** the Search Sheet shows the plan and file toss (Concierge → Scout etc.), then **collapses into a compact floating card** (bottom-right desktop, bottom mobile) showing live steps. Behind it, the world plays a **timed** sequence: bots stop waving, turn, and walk in a line along the path to the apartment (Concierge leads, then Scout, Caller, Packet, Closer, 0.6 s apart), the camera follows them (scripted camera move ~6 s, then hands control back to scroll), they enter through the front and peel off to their stations. Windows of each room light green as its bot arrives and starts working.
  2. **User scrolls past without searching:** the same walk is **scrubbed by scroll progress** across 0.50–0.64 (positions along the path = f(progress)).
- HTML panel H2: **"Then they get to work."** Body: "Calls happen during US office hours. Closed offices get a scheduled call and an email right away. You get updates on your time."
- A small inline example: "Pine Row opens at 9:00 AM CT. Caller will call then (7:45 PM in Kathmandu)."

**Beat 6: Room by room (0.64–0.82)** — four sub-beats synced to camera keyframes:
- **Office · Caller** (0.64–0.70): "Caller phones offices, always says it's an AI, and writes down rent, deposit, move-in date and what they accept instead of an SSN." Mini card: a transcript snippet with the disclosure line highlighted.
- **Hall · Scout** (0.70–0.76): "Scout reads every listing, checks walk and bus times to your building, and hides scams that ask for wire transfers." Mini card: "9 places found · 1 scam hidden".
- **Kitchen · Packet** (0.76–0.82): "Packet reads your I-20, visa and funding letter and builds a renter packet offices accept instead of a credit check." Mini card: packet ring 3/4.
- **(Closer is shown in Beat 8.)**

**Beat 7: The couch (0.82–0.90)**
- World: living room; three people sit on the couch, looking around; Concierge chats with them.
- H2: **"Find a roommate, too."** Body: "Students who opt in sit on the couch. Match on budget, move-in date and habits, then say hi."
- Button (outline): "See who's on the couch" → opens a Roommates preview sheet (example people, labeled).

**Beat 8: Booked (0.90–1.00)**
- World: Closer at the front door with the key; the door light turns green; every window lights green in sequence (lights on); confetti from the door; all bots `celebrate`.
- H2: **"Land with keys, not a hotel bill."**
- Primary CTA: **"Start my search"** → `/app` (with the chosen university). Secondary: "For leasing offices" → `#offices`.

### 7.4 Sections after the scroll story (no 3D)

**For leasing offices** (`#offices`), on `--surface` cards:
- H2: "Fill units with verified international renters."
- Three cards:
  - "Pre-verified applicants" · "I-20, visa, funding letter and guarantor option in one packet, the same criteria for every applicant."
  - "Fewer missed leads" · "We answer applicants abroad at their hour and call you at yours."
  - "Pay per signed lease" · "No subscription to start. A placement fee only when a renter signs."
- CTA (outline): "Become a partner" → mailto form handled in-page (store in Convex `partnerLeads`; show the email address as text, don't rely on mailto).

**Facts** (only these numbers, each with its source link):

| Fact | Source |
| --- | --- |
| 1,177,766 international students in the US (2024/25) | IIE Open Doors 2025 |
| New international enrollment fell 17% in fall 2025 | IIE Open Doors 2025 / Fall Snapshot |
| 1,022 international students at USM | Open Doors 2025 Mississippi fact sheet |
| ~65,000 rental scam reports, ~$65M lost (Jan 2020–Jun 2025) | FTC Data Spotlight, Dec 2025 |
| 80% of surveyed international grad students reported prejudice in their housing search | University of Tennessee study via NLIHC |

Render as five stat tiles with the number (Nunito 800, 32 px), one line of context, and a "Source" link. Put the URLs in `content/facts.ts`:

```ts
export const FACTS = [
  { value: '1,177,766', label: 'international students in the US (2024/25)', source: 'IIE Open Doors 2025', url: 'https://www.iie.org/news/open-doors-2025-press-release/' },
  { value: '−17%', label: 'new international enrollment, fall 2025', source: 'IIE Open Doors 2025', url: 'https://www.iie.org/news/open-doors-2025-press-release/' },
  { value: '1,022', label: 'international students at USM', source: 'Open Doors 2025, Mississippi', url: 'https://opendoorsdata.org/wp-content/uploads/2025/11/OpenDoors_FactSheet_Mississippi_-2025.pdf' },
  { value: '$65M', label: 'lost to rental scams, Jan 2020 to Jun 2025', source: 'FTC Data Spotlight', url: 'https://ftc.gov/news-events/data-visualizations/data-spotlight/2025/12/rental-scams-hit-home-65-million-reported-losses' },
  { value: '80%', label: 'of surveyed international grad students faced prejudice while house hunting', source: 'NLIHC on a University of Tennessee study', url: 'https://nlihc.org/resource/study-finds-international-graduate-students-experiences-rental-housing-market-university' },
];
```

**FAQ** (accordion, `<details>`):
- "Do I need an SSN?" → "No. Offices see your renter packet (I-20 or DS-2019, visa, funding letter, optional guarantor) instead of a credit check."
- "Does the AI really call offices?" → "Yes, during their business hours, and it always says it's an AI assistant calling for you. Offices that prefer email get email."
- "Do you take my money?" → "Never. You pay rent and deposits directly to the verified leasing office."
- "Is it free?" → "Yes for students. Apartments pay us when a lease is signed."
- "Which universities?" → "We're starting with the University of Southern Mississippi. Pick your school and we'll tell you what's ready."
- "Who sees my documents?" → "Only offices you approve. You can delete them any time."

**Final CTA band:** mark logo, "The light's on. Let's find your home.", green button "Start my search".

**Footer:** wordmark, "Built at the VOXO Hatchathon 2026, The University of Southern Mississippi", links: For students, For leasing offices, Privacy, Fair housing statement (a page stating rule 4 in plain words), Contact (address shown as text).

### 7.5 Landing page states and fallbacks

- **First paint:** hero text and CTAs render as static HTML immediately (server components). The 3D canvas loads lazily after first paint (`dynamic(() => import('...'), { ssr: false })`) and fades in over 400 ms. Show a still poster image (`public/landing/poster-hero.jpg`, rendered once from the world and committed) until it's ready.
- **No WebGL:** show posters per beat (`poster-hero`, `poster-team`, `poster-office`, `poster-apartment`, `poster-booked`), swapped by scroll. All interactions still work through HTML buttons.
- **Reduced motion:** no scroll scrubbing; camera cuts (300 ms fade) between keyframes at beat boundaries; bots play idle only; lights-on becomes a single fade; the walk becomes a cut to bots at their stations.
- **Mobile (< 768 px):** canvas fills the top 58vh sticky; beat panels scroll below as cards; quality `low`; the office label is a big tappable target (≥ 56 px).
- **Keyboard:** everything reachable with Tab; "Ask the team" button and the 3D office label are both focusable; Esc closes sheets; focus returns to the trigger.

### 7.6 Performance budgets

- LCP < 2.5 s on a mid phone over 4G (hero is HTML text; poster image < 120 KB, AVIF/WebP).
- 3D bundle loaded after LCP; total JS for `/` < 350 KB gzip before the 3D chunk.
- 60 fps target on laptop, ≥ 40 fps on mid phones at quality `low`. Pause rendering when the canvas is off-screen (IntersectionObserver) and when the tab is hidden.
- CLS < 0.05: reserve space for the picker and CTAs.

### 7.7 SEO and meta

- `<title>`: "how.zingg · Off-campus housing before you land"
- Description: "An AI team that finds, calls and books off-campus housing near your university, built for international and transfer students. No SSN needed."
- Open Graph image: 1200×630, ink background, wordmark, line "Find a home near campus before you land."
- `lang="en"`, semantic headings (one H1), sitemap and robots.

### 7.8 Copy and claims rules for the landing page

- Only the stats in 7.4, with sources. No invented user counts, testimonials or logos of partners we don't have.
- Never claim a partnership with USM or any apartment. Example apartment names are fictional and labeled "Example" anywhere they appear.

---

## 8. The student app (`/app`)

### 8.1 Home

- **Header:** mark logo, the university picker pill, avatar.
- **World:** `World mode="app"`, default focus `all`, the apartment with bots running routines or real tasks; leasing office and path visible at the edge.
- **Room chips** under the header: Whole home · Office · Hall · Kitchen · Living room · Bedroom · Leasing office (camera glides).
- **Agent strip** (above the search bar): five 32 px bot faces with a status word each (Idle, Searching, On call, Scheduled, Reading, Waiting, Done). Tap → Bot card.
- **Search bar** (pinned near the bottom, the main input): "Ask anything about living near {university short name}…", mic button. Submitting opens the Search Sheet (section 9).
- **Status line:** latest event in one line + "Activity" (opens a drawer with counts and the full feed).
- **3D picks:** leasing office → Housing sheet; front door → Housing sheet on the Wishlist tab; couch or a person on it → Roommates; a bot → Bot card.

### 8.2 University picker

- Combobox with type-ahead over the `universities` table; if no match, query Google Places (type `university`) and allow adding it.
- Selecting sets: map center, campus buildings (for commute), the time zone, the seeded offices.
- Seed USM fully; seed Mississippi State and Ole Miss with name, location, time zone and three buildings each.
- Remember the choice per user.

### 8.3 Housing sheet (from the leasing office)

Tabs: **Find a place** · **My wishlist** · **Add my info**. Concierge avatar and speech bubble at the top.
- *Find a place:* listing cards (photo, rent/mo, unit, deposit, commute to the chosen building, "No SSN OK" or "Guarantor needed", status chip). Filters: budget, no SSN, walk ≤ 15 min, furnished, roommate share. Actions: Choose this one · Add to wishlist · Ask a question (opens the search sheet scoped to that listing).
- *My wishlist:* saved items with live status (Saved, Checking with Caller, Answered, Offer, Passed) and the latest answer.
- *Add my info:* Concierge asks one question at a time in a chat layout: arrival date; budget; SSN (Yes / Not yet); car (Yes / No); roommate (Yes / Maybe / No); campus building; move-in flexibility; upload I-20 or DS-2019. Answers save to the profile and feed every call and email.

### 8.4 Other screens

- **Swipe deck:** right = call now or schedule (closed office: schedule + email now; toast states both time zones); up = apply when confirmed; left = pass with reason chips that re-rank. Buttons for each action.
- **Chat:** thread with Concierge; offer cards (Approve / Pass / Ask a question); quick replies; attach; voice note. (**Stretch:** mirrored to WhatsApp.)
- **Call view:** caller → office, timer, "AI disclosure said" chip, live transcript, answers captured, Mute / Take over call / End; playback for past calls.
- **Emails:** threads; office reply with an AI summary; Closer's drafted reply needing approval.
- **Renter packet:** progress ring, documents with extracted fields, missing items with Take photo / Choose file, privacy note, Share with [office].
- **What to do next:** timeline to move-in; each step says who acts (You, Caller, Closer, Concierge); buttons only for steps the user must do.
- **Everything (places):** all places with status; filters; hidden scams in one collapsed row.
- **Roommates:** people who opted in; match % from lifestyle fields only; Say hi / Not for me; "Put me on the couch" switch.
- **Bot card:** agent name, role, now, next, last 3 actions, link to related screen.

### 8.5 Leasing office dashboard (`/office`)

Light surface (paper). Table of verified applicants: name, unit, move-in, packet completeness, status, actions (Approve, Request info). Detail drawer: packet PDF, call recordings and transcripts, email thread. "Calls and emails from how.zingg" log. Keep it basic but clean.

---

## 9. The search tool (Search Sheet)

Shared component `components/search/SearchSheet.tsx`, used on the landing page and in the app.

### 9.1 Layout

- Bottom sheet on mobile (88vh), centered panel on desktop (width 640, max height 80vh). Header: Concierge avatar + "Ask the team" + close.
- **Input** at the top: large text field with the university pill at its left ("USM ▾") and a submit button. Example chips below when empty.
- **Plan line** (after submit): Concierge's one-sentence plan.
- **Agent rail:** the five avatars in a row; the ones involved light up; a 2D file toss animates between them on each handoff.
- **Step stream:** rows that appear as Convex `searchSteps` stream in: avatar dot, sentence, spinner → check. Examples: "Scout · Searching places within 3 miles of USM…", "Scout · Found 7 grocery stores", "Scout · Checking walk and bus times from Scianna Hall…", "Scout · Reading 4 apartment websites…", "Scout · Hid 1 listing that asked for a wire transfer".
- **Results:** grouped cards (Apartments, Groceries, Stores, Banks, Transit, Other). Each card: name, distance, walk/bus/drive time, open now/hours, one key fact, **source link always visible**, actions (Add to wishlist, Ask about this).
- **Summary:** Concierge's 3–5 sentence answer pinned above the results once ready, with numbered citations [1] [2] linking to cards.
- **Follow-up input** at the bottom with 3 suggested follow-ups.
- On the landing page, after results: "Continue in the app" (green) → `/app/ask/[searchId]`, and a note "Saved for you as an example search".

### 9.2 Timing (so it feels like digging, not waiting)

- First step appears ≤ 300 ms after submit (Concierge's plan).
- Steps stream as real tool calls happen; in `DEMO_MODE`, mock tools emit steps with realistic delays (300–900 ms each, total 4–7 s).
- Never show a blank sheet; skeleton cards appear under the step stream from the first second.

### 9.3 Query types Concierge + Scout must handle

| Intent | Example | Tools |
| --- | --- | --- |
| Apartments | "Cheapest 1 bed under $700 near USM that accepts international students" | listings DB, Places text search, Firecrawl extract, Routes |
| Nearby essentials | "Nearest Walmart from Oak Hollow, can I walk?" | Places nearby + Routes (walk, transit) |
| Culture/food | "Indian or Nepali grocery stores near USM", "halal food" | Places text search |
| Delivery | "Does Amazon deliver here? Amazon locker near campus?" | Places search for Amazon lockers/hubs; general info with source links |
| Money | "Banks near campus that open an account without an SSN" | Places + bank website extracts; always "confirm with the bank" |
| Transit | "Bus from Pine Row to Scianna Hall" | Routes transit; city transit site link |
| Lease basics | "What is a security deposit in Mississippi?" | Concierge answer + official source link + "not legal advice" |
| **Live office info** | "Is Oak Hollow's 1 bed available Aug 14?" | **Availability rule** (section 10.3), no guessing |

### 9.4 Neighborhood answer rules

- Facts only: names, addresses, distances, times, hours, prices, source links.
- No adjectives about people or areas. Never "safe", "sketchy", "nice area", "good neighborhood". If asked "is it safe?", answer: "I can't rate neighborhoods, but here's the official crime data portal for Hattiesburg and the distance to campus police," with links.

---

## 10. Agents

### 10.1 The five

| Agent | Tools (zod-typed) | Never |
| --- | --- | --- |
| **Concierge** | `delegate`, `addToWishlist`, `getUserContext`, `summarizeResults`, `askUser`, `answerFromKnowledge` | Guess live info; make binding commitments |
| **Scout** | `placesTextSearch`, `placesNearby`, `placeDetails`, `routes`, `crawlSite`, `extractListing`, `scamCheck` | Characterize neighborhoods or people |
| **Caller** | `placeCall`, `scheduleCall`, `sendInquiryEmail`, `readCallResult` | Call outside the allowlist; skip the disclosure |
| **Packet** | `extractDocument`, `checklist`, `buildPacketPdf`, `suggestGuarantors` | Ask for or store an SSN |
| **Closer** | `compareOffers`, `draftReply`, `requestHold`, `followUp`, `markBooked` | Accept terms or send money |

### 10.2 Handoffs via `tasks`

`delegate(toAgent, kind, payload)` inserts `tasks { fromAgent, toAgent, kind, payload, status: 'queued', createdAt }` and an `events` row. A Convex scheduled action picks queued tasks, sets `working`, runs the agent, then `done` with `result` (or `failed` with `error`, retried once). The UI subscribes to `tasks` and `events` to animate tosses, bot states and the feed.

### 10.3 The availability rule (exact behavior)

Trigger: the question needs live office info (availability on a date, current price, specials, holds, tour slots, whether an application is approved).

Concierge replies in this shape (fill the brackets):

> "That needs a live answer from the office, so Caller would have to ask them. Want me to add **[Listing, unit]** to your wishlist and have Caller check? [The office is open now, so Caller can call right away. | The office opens at [9:00 AM CT], which is [7:45 PM] for you. Caller will call then and email them now.]"

Buttons: **Add to wishlist and ask Caller** · **Just add to wishlist** · **Not now**.

On "Add to wishlist and ask Caller":
1. `wishlist` row (status `checking`).
2. `tasks` row Concierge → Caller (`kind: 'check_availability'`).
3. File toss Concierge → Caller (3D + 2D).
4. Caller: office open and allowlisted → `placeCall` now; closed → `scheduleCall(runAt = next opening + 2 min)` and `sendInquiryEmail` now; not allowlisted → email only.
5. When the answer arrives, wishlist status → `answered` (or `offer`), Concierge posts the answer with the source (call transcript or email).

Write a Vitest test for the trigger classifier with at least 20 phrasings (10 should trigger, 10 should not).

### 10.4 Agent instructions (put in `convex/agents/<name>.ts`)

All agents get: rules from section 2, the user profile (arrival date, budget, SSN status, car, roommate preference, campus building, home time zone), the university and its time zone, today's date, and "If you don't know, say so and delegate."

- **Concierge:** "You are Concierge from how.zingg. You help a student find off-campus housing near {university} before they arrive. Be warm, brief and specific; use numbers and both time zones. Plan, then delegate: research to Scout, live office questions to Caller, documents to Packet, offers and follow-ups to Closer. Never guess live availability or prices; use the availability rule. Summaries are 3–5 sentences with citations to result cards and end with one useful next step."
- **Scout:** "You research apartments and the area around {university}. Every result has distance and travel time from the user's apartment or campus building, hours if relevant, and a source URL. Report facts only; never describe neighborhoods or who lives there. Flag listings matching scam patterns and explain why."
- **Caller:** "You call leasing offices for a student. Your first sentence is always: 'Hi, I'm an AI assistant calling on behalf of a student.' Mention the call is recorded. Ask: availability for {date}, rent, deposit and fees, what they accept instead of an SSN, current specials, whether we can send a renter packet, then the student's question. Never agree to anything binding or share payment details."
- **Packet:** "You read immigration and financial documents and extract only what a rental application needs (name, program, program dates, funding amount and source, visa type and validity). Never ask for or store an SSN. List missing items in plain words."
- **Closer:** "You get the student the best confirmed lease. Compare total monthly cost (rent + fees), deposit, commute, move-in fit and policy on international renters. Use competing offers as polite leverage. Draft replies for user approval; never send binding messages or money."

### 10.5 Call script (ElevenLabs agent config)

Dynamic variables: `student_first_name`, `unit`, `move_in_date`, `budget`, `documents`, `user_question`, `callback_email`.

1. "Hi, I'm an AI assistant calling on behalf of a student, {student_first_name}, who's moving to {university}. This call is recorded. Do you have a minute?"
2. "Is your {unit} available for move-in on {move_in_date}?"
3. "What's the monthly rent, and the deposit and fees?"
4. "They're an international student without an SSN. What do you accept instead, for example an I-20, funding letter, or a guarantor?"
5. "Any current specials?"
6. "Can we send you their renter packet? What email should we use?"
7. "{user_question}"
8. "Thank you so much. We'll follow up by email at {callback_email}."

Data collection fields (post-call webhook): `available` (bool/unknown), `available_date`, `rent`, `deposit`, `fees`, `no_ssn_options`, `specials`, `packet_email`, `notes`.

---

## 11. Data model (`convex/schema.ts`)

Validators on every field. Index every foreign key and every status. Times in UTC ms.

- `users`: name, email?, phone?, whatsapp?, homeCountry?, timeZone, universityId, campusBuildingId?, arrivalDate?, budgetMin?, budgetMax?, hasSSN, hasCar, roommatePref ('yes'|'maybe'|'no'), onCouch (bool), isDemo (bool)
- `universities`: name, shortName, city, state, lat, lng, timeZone, buildings: [{ id, name, lat, lng }]
- `offices`: name, phone?, email?, website?, hours: [{ day, open, close }], timeZone, acceptsNoSSN?, partner (bool), callAllowed (bool), isExample
- `listings`: officeId, title, unitType, rent, deposit?, fees?, availableFrom?, photos[], furnished, roommateShare, commute: { [buildingId]: { walkMin, bikeMin, transitMin?, driveMin } }, scamFlags[], hidden (bool), sourceUrl?, isExample
- `searches`: userId, universityId, query, intent, status ('planning'|'running'|'done'|'failed'), plan?, summary?, citations[], createdAt
- `searchSteps`: searchId, agent, text, status ('running'|'done'|'failed'), createdAt
- `searchResults`: searchId, group, title, address?, lat?, lng?, distanceMi?, travel?: { walkMin?, transitMin?, driveMin? }, hours?, fact?, sourceUrl, listingId?, isExample
- `wishlist`: userId, listingId, status ('saved'|'checking'|'answered'|'offer'|'passed'), lastAnswer?, updatedAt
- `tasks`: userId, fromAgent, toAgent, kind, payload, status ('queued'|'working'|'done'|'failed'), result?, error?, runAt?, createdAt, updatedAt
- `calls`: userId, officeId, listingId?, status ('scheduled'|'ringing'|'live'|'done'|'failed'|'emailed'), scheduledFor?, transcript: [{ speaker, text, at }], answers?: { available?, availableDate?, rent?, deposit?, fees?, noSSNOptions?, specials?, packetEmail?, notes? }, recordingUrl?, disclosureSaid (bool)
- `emails`: userId, officeId, direction ('out'|'in'), subject, body, summary?, draftReply?, approved (bool), threadId, createdAt
- `documents`: userId, kind ('i20'|'ds2019'|'visa'|'funding'|'bank'|'passport'|'other'), fileId, extracted?, status ('uploaded'|'read'|'needs_review')
- `packets`: userId, completeness (0–1), pdfFileId?, sharedWith: officeId[]
- `offers`: userId, listingId, rent, fees?, deposit?, terms?, status ('open'|'accepted'|'declined'|'expired'), leverageNote?
- `roommateProfiles`: userId, program, budgetMin, budgetMax, moveIn, tags[], visible (bool), isExample
- `connections`: fromUserId, toUserId, status ('sent'|'accepted'|'declined')
- `events`: userId, agent?, kind, text, refTable?, refId?, createdAt
- `partnerLeads`: officeName, contactName, email, phone?, message?, createdAt

---

## 12. Services (`lib/services/`)

Each folder: `index.ts` (interface + factory reading env/`DEMO_MODE`), `real.ts`, `mock.ts`.

- `llm`: `complete`, `structured<T>(schema)`, `vision`. Mock returns canned outputs keyed by prompt id.
- `voice`: `placeCall(params)`, `parseWebhook(req)`. Mock simulates ringing → live → transcript lines every 1.2 s → done with answers.
- `email`: `send`, `parseInbound`. Mock writes to `emails` and simulates a reply after 8 s.
- `places`: `textSearch`, `nearby`, `details`. Mock reads `seed/places.json`.
- `routes`: `travelTimes(origin, destinations, modes)`. Mock returns seeded minutes.
- `crawl`: `extractListing(url)`. Mock reads `seed/listings.json`.
- `whatsapp` (**Stretch**): `send`. Mock logs.

---

## 13. Seed data (`convex/seed.ts`, `seed/*.json`)

All `isExample: true`.

- **USM** (Hattiesburg, MS, America/Chicago). Buildings: Scianna Hall, Cook Library, Thad Cochran Center (use approximate campus coordinates from Google Maps when seeding real mode; in demo mode store fixed coordinates).
- **Listings (fictional names):**
  - Oak Hollow · 1 bed · $650 · $300 deposit · free Aug 14 · no SSN OK · office open now (in demo clock) · 9 min walk to Scianna Hall
  - Pine Row · 1 bed · $640 · $400 deposit · free Aug 1 · guarantor or 2 months deposit · closed until 9:00 AM · 12 min bike
  - Magnolia Court · studio · $720 · $500 · free Aug 10 · guarantor needed · 6 min walk
  - Willow Park · 1 bed · $590 · free Aug 5 · 14 min walk
  - Cedar Flats · room in 2 bed · $410 · free Aug 10 · roommate share
  - Birch Lane · 1 bed · $780 · 18 min bus
  - **Scam:** "Sunny 1 bed $350, wire deposit to hold" → `scamFlags: ['wire_transfer', 'below_market']`, `hidden: true`
- **Nearby places** for the example queries: Walmart, Target, Kroger, an Indian grocery, a Nepali/Asian grocery, an Amazon locker location, three banks, a pharmacy, a laundromat, the city bus info link. Real chain names are fine; distances and times are example values unless fetched live. Every one has a `sourceUrl` (Google Maps place URL or the store's site).
- **Roommates:** Aarav (MS Computer Science; $350–450; Aug 10; early riser, cooks, no smoking), Mariana (PhD Marine Science; $400–500; Aug 18; quiet, night owl, has a car), Tunde (transfer, Business; $300–400; Jan 6; tidy, gym), Priya (PhD Chemistry; $400–550; Aug 12; vegetarian, night owl), Sam (transfer, Nursing; $350–450; Jan 3; early shifts, has a car). Lifestyle tags only.
- **Demo user:** "Asha", incoming grad student, arriving Aug 14, budget $800, no SSN, no car, home time zone Asia/Kathmandu, campus building Scianna Hall. Documents: I-20, F-1 visa, funding letter uploaded; bank statement missing.
- **Demo clock:** in `DEMO_MODE`, "now" is fixed at 9:02 AM America/Chicago on a weekday (so Oak Hollow is open and Pine Row's call schedules for the next morning), unless `DEMO_NOW` is set.

---

## 14. Key flows (acceptance criteria)

1. **Landing → search → app.** On `/`, scroll to the team; bots wave. Click the leasing office; the sheet opens. Submit "Indian or Nepali groceries near USM, and the nearest Walmart". Within 300 ms the plan appears; a toss Concierge → Scout plays; steps stream; results appear with sources; summary appears. The sheet collapses to a live card; bots walk to the apartment in order; room windows light up as each bot starts. "Continue in the app" opens `/app/ask/[id]` with the same results.
2. **Availability rule.** Ask "Is Oak Hollow's 1 bed free Aug 14?" → exact reply shape and three buttons. "Add to wishlist and ask Caller" → wishlist `checking`, toss Concierge → Caller, Caller plays `phone`, call view shows the disclosure line first, answers fill, wishlist → `answered` with "$650, available Aug 14, accepts I-20 + funding letter".
3. **Closed office.** Swipe right on Pine Row → toast "Pine Row is closed. Call set for 9:00 AM CT (7:45 PM your time). Email sent now." `calls` row `scheduled`, `emails` row `out`.
4. **Packet.** Upload a bank statement → Packet `read` → completeness 1 → "Share with Oak Hollow" → `sharedWith` updated → office dashboard shows the applicant as verified.
5. **Booking.** Choose Oak Hollow → Closer requests a hold and fee waiver (mock reply: waived) → offer accepted after user approval → `markBooked` → door light green, lights-on, confetti, all bots `celebrate`, What to do next updates to move-in steps.
6. **Roommates.** Tap couch → list → Say hi to Aarav → `connections` row `sent`.
7. **Scam hidden.** The $350 listing never appears in results or the deck; "1 scam hidden" row shows with the reason.

---

## 15. Repo structure

```
app/
  page.tsx                         landing (server component shell)
  (landing)/components/            TopNav, StoryScroller, Beat, StickyWorld, ForOffices, Facts, FAQ, FinalCTA, Footer
  app/layout.tsx                   student app shell (tab bar on mobile)
  app/page.tsx                     Home
  app/ask/[searchId]/page.tsx
  app/swipe/page.tsx  app/chat/page.tsx  app/calls/[callId]/page.tsx  app/emails/page.tsx
  app/packet/page.tsx app/next/page.tsx  app/places/page.tsx  app/roommates/page.tsx
  office/page.tsx
  fair-housing/page.tsx  privacy/page.tsx
  api/webhooks/{elevenlabs,twilio,postmark}/route.ts
  globals.css                      tokens from DESIGN.md
components/
  world/      World.tsx, WorldContext.tsx, Ground.tsx, Street.tsx, Apartment/*.tsx, LeasingOffice.tsx,
              Bot.tsx, botClips.ts, routines.ts, navGraph.ts, FileToss.tsx, LitWindows.tsx, Confetti.tsx, cameraRig.ts, quality.ts
  search/     SearchSheet.tsx, StepStream.tsx, ResultCard.tsx, SummaryBlock.tsx, AgentRail.tsx, ExampleChips.tsx
  ui/         Button, Chip, Sheet, Card, UniversityPicker, AgentStrip, BotCard, HousingSheet, SwipeDeck, OfferCard, Toast, LightsOn
content/      facts.ts, faq.ts, copy.ts
convex/       schema.ts, agents/{concierge,scout,caller,packet,closer}.ts, tools/*.ts, tasks.ts, search.ts,
              calls.ts, emails.ts, packet.ts, offers.ts, roommates.ts, seed.ts, crons.ts, http.ts
lib/services/ llm, voice, email, places, routes, crawl, whatsapp
seed/         places.json, listings.json, transcripts.json, emails.json
public/brand/ wordmark-dark.png, mark-dark.png (SVGs later)
public/landing/ poster-*.jpg
tests/        unit/*.test.ts, e2e/golden-path.spec.ts, e2e/landing.spec.ts
docs/         BUILD_PROMPT.md, PLAN.md
```

---

## 16. Accessibility checklist

- One H1 per page; logical headings; landmarks (`header`, `main`, `nav`, `footer`).
- Canvas has `aria-hidden="true"`; every 3D affordance has an HTML button (office, couch, door, bots via the agent strip).
- Focus rings visible (2 px chalk, 2 px offset). Sheets trap focus, Esc closes, focus returns.
- Live regions: step stream (`aria-live="polite"`), toasts.
- Contrast per `DESIGN.md`; no info by color alone (status chips have text).
- Reduced motion honored everywhere (section 7.5).
- Works at 360 px width and 200% text zoom.

---

## 17. Testing

- **Unit (Vitest):** availability trigger classifier (20+ cases), scam check, time-zone formatting ("9:00 AM CT (7:45 PM your time)"), office-open logic across DST, roommate match excludes protected fields, nav graph shortest path, camera keyframe interpolation.
- **E2E (Playwright, `DEMO_MODE=1`):** `landing.spec.ts` (scroll to team, bots waving state exposed via `data-scene` attribute, click "Ask the team", submit, results with sources, sheet collapses, scene becomes `apartment-working`, Continue in the app) and `golden-path.spec.ts` (section 18).
- **Visual check:** Playwright screenshots of landing beats at 1440×900 and 390×844 saved to `tests/screens/` for review (not pixel-diffed).
- **Performance:** a Lighthouse run on `/` (mobile) in CI script; fail if LCP > 3 s or CLS > 0.1.

Expose world state for tests: `World` sets `data-scene`, `data-bot-<id>-state` attributes on its container.

---

## 18. The golden path (the Expo demo, < 3 minutes)

1. Open `/`. Hero: "Find a home near campus before you land." Windows light up.
2. Scroll: the problem; then the **five bots waving outside the leasing office**, each with its role.
3. Scroll: the office door glows. **Click the leasing office.** The search sheet opens.
4. Type "Indian or Nepali grocery stores near USM, and the nearest Walmart" → plan, toss to Scout, live steps, cards with sources, summary.
5. The sheet collapses; **the bots walk down the path into the apartment** and start working; windows turn green room by room.
6. Click "Continue in the app" → `/app` Home with the same search.
7. Ask "Is Oak Hollow's 1 bed free Aug 14?" → availability rule → "Add to wishlist and ask Caller" → toss → Caller's call (mock or allowlisted teammate phone) with the disclosure first → answers fill in.
8. Tap the leasing office → Housing sheet → Oak Hollow "Offer ready" → Choose this one.
9. Packet: upload the bank statement → 4/4 → share.
10. Booking confirmed: door green, lights on, confetti, bots celebrate.
11. Tap the couch → say hi to Aarav.
12. Open `/office` on a second screen: the verified applicant is there.

Rehearsal mode: `?demo=1` adds a tiny hidden control bar (press `.` to show) with Reset demo, Skip to beat, and Force call result, so a hiccup never kills the pitch.

---

## 19. Build order (cut from the bottom if late)

**Friday, Nov 6**
1. Scaffold Next.js, Tailwind tokens from `DESIGN.md`, Convex, schema, services with mocks, seed script, demo user and clock.
2. `World` v1: ground, street, path, apartment rooms, leasing office, lighting, quality flag, camera rig with `focus()`.
3. Bots v1: parts, `idle`, `walk`, `wave`, name tags, nav graph, routines.
4. Search pipeline on mocks: `searches`, `searchSteps`, `searchResults`, Concierge plan + Scout tools + summary; `SearchSheet` UI with step stream and cards.

**Saturday, Nov 7**
5. Landing page: StoryScroller with sticky world, beats 1–4 with copy, camera keyframes, waving lineup, clickable office → SearchSheet.
6. Beat 5: timed walk on search submit and scroll-scrubbed walk; lit windows; collapse sheet to live card; Continue in the app.
7. App Home: header, picker, room chips, agent strip, search bar, status + activity drawer, 3D picks.
8. Tasks + file toss (3D and 2D) + availability rule + wishlist + Caller mock call + call view.

**Sunday, Nov 8**
9. Landing beats 6–8, For offices, Facts with sources, FAQ, footer, posters, reduced-motion and no-WebGL fallbacks, meta/OG.
10. Housing sheet (3 tabs), swipe deck, packet upload + mock extraction, What to do next, booking celebration, roommates, `/office` dashboard.
11. Real ElevenLabs + Twilio call to the allowlisted phone (ask first), one real Postmark email to our own inbox (ask first).
12. Tests green, Lighthouse check, rehearsal mode, record a backup demo video, freeze by 9 PM.

**Stretch (only after the golden path passes 3× in a row):** WhatsApp mirror, live Firecrawl on 3 real sites, live Routes times, SVG logos, light-mode polish for the office dashboard, visiting-scholar furnished stays, more universities.

---

## 20. Environment

```
DEMO_MODE=1
DEMO_NOW=                       # optional ISO time; default 9:02 AM America/Chicago, a weekday
NEXT_PUBLIC_SITE_URL=http://localhost:3000
CONVEX_DEPLOYMENT=
NEXT_PUBLIC_CONVEX_URL=
ANTHROPIC_API_KEY=
AGENT_MODEL=                    # Sonnet-class model id
FAST_MODEL=                     # Haiku-class model id
ELEVENLABS_API_KEY=
ELEVENLABS_AGENT_ID=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=
TWILIO_WHATSAPP_FROM=
CALL_ALLOWLIST=                 # comma-separated E.164 numbers
GOOGLE_MAPS_API_KEY=
FIRECRAWL_API_KEY=
POSTMARK_SERVER_TOKEN=
POSTMARK_FROM=
POSTMARK_INBOUND_SECRET=
```

Create `.env.example` with these keys. Never commit real values. Webhooks verify signatures (Twilio, ElevenLabs, Postmark) and reject unsigned requests outside `DEMO_MODE`.

---

## 21. Definition of done

- `DEMO_MODE=1 npm run dev` → the full golden path works with zero external calls.
- `npm run e2e` passes `landing.spec.ts` and `golden-path.spec.ts` three times in a row.
- Landing: bots wave outside the leasing office; clicking the office (or "Ask the team") opens the search tool; after a search the bots walk into the apartment and start working; scrolling past without searching also moves them, scrubbed by scroll.
- Every call begins with the AI disclosure; no call can reach a number outside the allowlist (unit test).
- The availability rule never guesses (unit test with 20+ phrasings).
- No unlabeled example data; every search result shows a source.
- Lighthouse (mobile) on `/`: LCP < 2.5 s target (fail > 3 s), CLS < 0.1, accessibility ≥ 90.
- Works at 360 px wide, with reduced motion, and without WebGL.
- `README.md` covers setup, demo mode, rehearsal mode, the golden path and the rules in section 2.

Start now: read `CLAUDE.md`, `DESIGN.md` and this file, then write `docs/PLAN.md` and wait for my go-ahead.
