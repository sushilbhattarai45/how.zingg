# how.zingg design principles

The single source of truth for how how.zingg looks, moves and sounds. If code and this file disagree, this file wins. If this file is silent, follow the spirit of section 1.

---

## 1. The idea: a lit window

Our mark is a simple house drawn in one rounded white line, with a **green window**. A lit window means someone is home, the light is on, and a place is waiting for you.

That is the whole product: while a student is asleep 8,000 miles away, our agents keep the lights on and find them a home.

Everything in the design comes back to three things from the logo:

1. **Rounded line.** Thick strokes, round ends, soft corners. Friendly, never sharp.
2. **Dark night, white line.** The app lives on a dark, warm-black background like the logo.
3. **One green light.** Green is rare and meaningful. It marks what is *lit*: active, ready, good news, the next step. If everything is green, nothing is.

---

## 2. Name and logo

### Name

- Always written **how.zingg**: all lowercase, with the dot, double g.
- Never "How.Zingg", "HowZingg", "howzingg" or "How Zingg".
- In a sentence: "how.zingg found 9 places near USM." The dot stays.
- At the start of a sentence, rephrase rather than capitalize.

### Logo files

| File | Use |
| --- | --- |
| `public/brand/wordmark-dark.png` | Wordmark on dark backgrounds: headers, splash, pitch slides |
| `public/brand/mark-dark.png` | House mark alone: app icon, favicon, loading, avatar for the app |

To make next (vector): `wordmark.svg` and `mark.svg` with strokes as paths, plus a **light version** for light backgrounds: ink `#191719` line, same green window.

### The wordmark

- "how.zin" is set in a rounded geometric sans. The two g's are houses whose walls drop into the g's tail.
- Never redraw, stretch, outline, add shadows or gradients, or change the window color.
- Never place on busy photos. Use a solid ink or paper background.

### Clear space and size

- **Clear space:** at least the height of one house (the g with its roof) on every side of the wordmark; at least half the mark's width around the mark.
- **Minimum size:** wordmark 96 px wide on screen; mark 20 px. Below 20 px, drop the chimney and use a 2×2 square window.

### App icon

House mark centered on ink `#191719`, mark at about 62% of the icon width. The window is the only color.

---

## 3. Color

Dark-first, like the logo. Light mode exists for documents, the leasing office dashboard and print.

### Core palette

| Token | Hex | Use |
| --- | --- | --- |
| `--ink` | `#191719` | Default app background (from the logo) |
| `--night` | `#111012` | Deepest layer: behind sheets, 3D sky edge |
| `--surface` | `#222023` | Cards, bars, sheets |
| `--raised` | `#2C2A2D` | Hover, pressed, inputs |
| `--line` | `#3A373B` | Borders, dividers |
| `--chalk` | `#FFFFFF` | Logo line, primary text on dark |
| `--text-2` | `#B9B5BA` | Secondary text on dark |
| `--text-3` | `#8B878C` | Hints, timestamps (5:1 on ink, 4.6:1 on surface) |
| `--window` | `#6DBD13` | **Brand green** (from the logo window) |
| `--window-hi` | `#86D32E` | Hover on green |
| `--window-dim` | `#1F2E12` | Green tint background for success chips |

### Light mode (documents, office dashboard)

| Token | Hex |
| --- | --- |
| `--paper` | `#F6F4F0` (never pure white for page backgrounds) |
| `--card` | `#FFFFFF` |
| `--ink-text` | `#191719` |
| `--text-2-light` | `#5E5A5F` |
| `--line-light` | `#E3DFD9` |
| `--window-text` | `#3F7A08` (green for text on light; `#6DBD13` fails contrast as text on white) |

### Status (not brand)

| Meaning | Text on dark | Background tint |
| --- | --- | --- |
| Good / done | `#86D32E` | `#1F2E12` |
| Waiting / scheduled | `#F2C46B` | `#3A3020` |
| Problem / scam | `#FF7A7A` | `#3A1E20` |
| Neutral | `#B9B5BA` | `#2C2A2D` |

### Rules for green

- **Primary buttons** are green with **ink text** (`#191719` on `#6DBD13` = 7.6:1). Never white text on green (fails contrast).
- One primary green button per screen.
- Green also means: offer ready, booked, step done, agent working right now (the lit window).
- Never use green for decoration, large backgrounds or gradients.

### Contrast (WCAG AA)

- Chalk on ink: 17.8:1. `--text-2` on ink: 8.8:1. `--text-3` on ink: 5:1. Green on ink: 7.6:1. White on green: 2.35:1 (never use).
- Agent colors on ink: Scout 7.6:1, Caller 7.6:1, Packet 10.6:1, Closer 5.7:1.
- `--window-text` `#3F7A08` on white: 5.3:1; on paper: 4.8:1.

---

## 4. Agent colors

Each agent has one color, used only for its bot body, its eyes, and small dots or rings next to its name. Never for buttons or backgrounds.

| Agent | Color | Why |
| --- | --- | --- |
| **Concierge** | `#6DBD13` (brand green) | The voice of how.zingg; it keeps the light on |
| **Scout** | `#3DB8C9` (teal) | Looking, mapping |
| **Caller** | `#FF8A4C` (orange) | Warm, on the phone |
| **Packet** | `#F2C230` (yellow) | Paper and stamps |
| **Closer** | `#F25C8A` (pink) | Deals, keys, the finish |

All five pass 4.5:1 as dots and labels on `--ink`. On light backgrounds, put agent names in ink text next to a colored dot.

---

## 5. Type

The logo is a rounded geometric sans, so the type is too.

| Role | Font | Weights | Size / line height |
| --- | --- | --- | --- |
| Display (screen titles, numbers) | **Nunito** | 800 | 28/32, 22/28 |
| Headings | **Nunito** | 700 | 18/24, 16/22 |
| Body | **Nunito** | 500, 600 | 15/22, 13/19 |
| Labels, buttons | **Nunito** | 700 | 14/20, 12/16 (uppercase labels +0.06em tracking) |
| Data (times, prices in tables) | **JetBrains Mono** | 500 | 12/16, tabular numbers |

- Load from Google Fonts. Fallback: `ui-rounded, system-ui, sans-serif`.
- Sentence case everywhere. The only lowercase-always word is **how.zingg**.
- Prices and times use `font-variant-numeric: tabular-nums`.
- Max line length 65 characters for reading text.

---

## 6. Shape, line and space

- **Corner radius:** 12 px (inputs, chips), 16 px (cards), 20 px (sheets), 999 px (pills, tags). Nothing has a sharp corner.
- **Strokes:** icons and illustrations use round caps and round joins, like the logo. Stroke width about 1/12 of the icon size (2 px at 24 px).
- **Icons:** one outline set with round caps (Lucide works). Never emoji as icons.
- **Spacing:** 4 px base grid. Common steps: 4, 8, 12, 16, 24, 32. Screen side padding 16 px.
- **Borders over shadows.** 1 px `--line` borders. Shadows only on floating things (sheets, the search bar): `0 8px 24px rgba(0,0,0,.35)`.
- **Touch targets:** at least 44×44 px.

---

## 7. Components

| Component | Spec |
| --- | --- |
| **Primary button** | Green `#6DBD13`, ink text, 44–48 px tall, radius 12, Nunito 700. Pressed: `--window-hi`. Disabled: `--raised` with `--text-3` text |
| **Secondary button** | Transparent, 1 px `--line` border, chalk text |
| **Search bar** (the main input) | Pinned near the bottom, `--surface`, radius 16, 52 px tall, placeholder "Ask anything about living near USM…", mic button on the right. Floating shadow |
| **University picker** | Pill in the header showing the university name; tap opens a typeable list |
| **Agent strip** | Five 32 px bot faces in a row above the search bar; under each, one word of status. A working bot's antenna is lit (green dot) |
| **Card** | `--surface`, 1 px `--line`, radius 16, padding 12–16 |
| **Chip / status pill** | Radius 999, 12 px bold, tinted background from the status table |
| **Sheet** | Bottom sheet on mobile, centered on desktop, `--surface`, radius 20 top, grab handle, title row with the agent avatar who's talking |
| **Bot tag (3D)** | Chalk pill, ink text, colored dot for the agent |
| **Step stream** (agents digging) | Each step a row: agent dot, short sentence, live spinner or check. New rows slide in from below |
| **Result card** | Title, distance + travel time, hours, source link (always visible), optional thumbnail |

---

## 8. Motion

Calm and purposeful. Things move because something happened.

- **Signature: lights on.** The four window squares light up one by one (80 ms apart, scale 0.6 → 1, opacity 0 → 1). Use it for: app launch, loading, "booking confirmed", an offer arriving. Nowhere else, so it stays special.
- **File toss:** when one agent hands work to another, a small paper file arcs from sender to receiver (500–700 ms, ease-out), then the receiver's antenna lights green.
- **Durations:** 150 ms (press), 250 ms (chips, cards), 350 ms (sheets), 600 ms (file toss).
- **Easing:** `cubic-bezier(.2,.8,.2,1)` for entering, `ease-in` 150 ms for leaving.
- **Bots:** gentle idle bob, waddle when walking, blink every few seconds. Never jittery.
- **Reduced motion:** with `prefers-reduced-motion`, swap movement for fades and pause the 3D scene's ambient motion (a Pause button is always available).

---

## 9. The 3D apartment

The home screen world follows the logo: evening, warm, with lit windows.

- **Time of day:** early evening. Sky `#26232B` fading to `#3A3340` is fine as a 3D environment color, never as a UI gradient. Not pure black, not white, not outer space; there is ground, a street, trees.
- **The apartment:** original, warm, lived-in; cutaway with no ceiling and low inner walls so every room shows. Warm wood floor, brick kitchen wall, off-white and sage walls, an orange sofa, warm lamps. Do not recreate any TV or film set.
- **Lit windows = the brand.** Windows of the apartment and the leasing office glow **green** when an agent is working there or an offer is ready. The leasing office's window turns green when it has news for you.
- **Bots:** small and cute: chalk-white rounded head, ink face screen, two glowing eyes in the agent color, colored body, antenna light. Rounded everything, matching the logo's line.
- **Clickable:** leasing office (opens Housing), front door (wishlist), couch (roommates), every bot (bot card). Every 3D action also has a normal button for accessibility.

---

## 10. Voice and copy

- **Warm, short, specific.** "Caller is calling Oak Hollow now." Not "Your request is being processed."
- **Numbers over adjectives.** "$650 a month, 9 min walk to Scianna Hall."
- **Two time zones** whenever a time matters to someone abroad: "9:00 AM CT (7:45 PM your time)."
- **Agents speak in first person** with their names: "I'll ask Caller to check."
- **Honest about limits:** "That needs a live answer from the office" instead of guessing.
- **No jargon:** "renter packet", not "applicant dossier". "No SSN needed", not "alternative credit verification".
- **Never describe neighborhoods by who lives there, or as safe/unsafe.** Give distances, times, prices and sources.
- **Example data is labeled "Example".**

---

## 11. Accessibility

- AA contrast for all text (see section 3).
- Visible focus ring: 2 px `--chalk` outline, 2 px offset (on light: ink).
- Every interactive 3D object has an equivalent button or list item.
- Screen reader labels for bots: "Caller, on a call with Oak Hollow".
- Support text scaling to 200% without overlap; layouts work from 360 px wide.

---

## 12. Don'ts

- No purple/blue gradient heroes, glassmorphism stacks or neon glows.
- No pure white page background in the app (light mode uses `--paper`).
- No green text on white (use `--window-text`), no white text on green.
- No emoji as icons or section markers.
- No more than one primary (green) button per screen.
- No stock illustrations; illustrations use the rounded-line style of the mark.
- No copies of TV show sets, characters or other brands' visuals.

