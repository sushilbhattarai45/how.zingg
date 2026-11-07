# how.zingg

Off-campus housing before you land. Next.js + Convex + a shared 3D world. Five AI agents research, call, and book near your university (launch market: USM).

## Run locally

```bash
npm install
npm run convex          # local Convex; writes NEXT_PUBLIC_CONVEX_URL into .env.local
npm run seed            # USM demo data (demo user Asha)
npm run dev             # http://localhost:3000
# or mock everything:
npm run dev:demo
```

Keep `npm run convex` running alongside Next.

## Caller (Vapi phone calls)

Caller can dial a real number with a Vapi voice agent, stream the transcript, and (when available) play live listen audio in the browser. Without Vapi keys — or with `DEMO_MODE=1` — the same UI plays the seeded Oak Hollow **Example** transcript.

### 1. Get Vapi credentials

1. Create an account at [vapi.ai](https://vapi.ai).
2. Dashboard → **API Keys** → copy the **private** key → `VAPI_API_KEY`.
3. Import a phone number (Twilio / Telnyx / Vonage). Free Vapi numbers cannot place outbound calls.
4. Copy that number’s id → `VAPI_PHONE_NUMBER_ID`.

### 2. Configure env (Convex + local)

Caller runs as **Convex actions**, so keys must be on the Convex deployment (not only in `.env.local`):

```bash
npx convex env set VAPI_API_KEY sk-...
npx convex env set VAPI_PHONE_NUMBER_ID ...
npx convex env set CALL_ALLOWLIST +1YOURNUMBER
# Turn off demo mocks for real dials:
npx convex env set DEMO_MODE 0
```

Also put the same values in `.env.local` (see `.env.example`) so Next and docs stay in sync. **Never** expose `VAPI_API_KEY` to the browser (`NEXT_PUBLIC_*`).

### 3. Test by calling yourself first

1. Add **your** E.164 number to `CALL_ALLOWLIST` (only allowlisted numbers can be dialed for real).
2. Open `/app` → tap the orange **phone** badge on Caller, or **Call a number** in the user menu.
3. Enter your number as `+1…`, edit the three questions if you want, **Start call**.
4. Answer your phone. The agent discloses it is an AI, then asks one question at a time (max 3 minutes).
5. On `/app/calls/[callId]`, watch the transcript. Tap **Listen live** for one-way audio (Vapi `monitor.listenUrl`). If live audio fails, use the recording player after the call ends.

### Safety

- E.164 only (`+16019132221`).
- Live dials must pass `CALL_ALLOWLIST`.
- First message always uses the AI disclosure from `lib/rules.ts`.
- `maxDurationSeconds: 180`.

## Gemini (chat + document scrape)

Guide answers place chat with **Gemini**, using office-uploaded docs and the saved unit type (so a 2-bed interest ignores 4-bed floor-plan noise). Caller only dials when you explicitly say e.g. `call and ask …`, `call them about …`, or `ask them …`.

```bash
npx convex env set GEMINI_API_KEY your-key
npx convex env set GEMINI_MODEL gemini-3.8-flash
```

Gemini chat/doc scrape runs even when `DEMO_MODE=1` (voice can stay mocked). Without a Gemini key, chat uses a local mock that only summarizes already-extracted facts.

## Email notify + office doc upload (Ehulak)

After Caller finishes a call, Convex emails:

1. **Student** (`STUDENT_NOTIFY_EMAIL`, default `sushilbhattarai2004@gmail.com`) — keypoints from the call.
2. **Realty** (`REALTY_NOTIFY_EMAIL`, default `sushilbhattarai0054@gmail.com`) — unique upload link `/office/upload/{token}`.

When the office uploads a file, Packet extracts keypoints, emails the student again, and shows a document log row in the place chat.

```bash
npx convex env set EHULAK_API_KEY your-key
npx convex env set STUDENT_NOTIFY_EMAIL sushilbhattarai2004@gmail.com
npx convex env set REALTY_NOTIFY_EMAIL sushilbhattarai0054@gmail.com
npx convex env set NEXT_PUBLIC_SITE_URL http://localhost:3000
```

Notify sends whenever `EHULAK_API_KEY` is set (even if `DEMO_MODE=1`). Without a key, emails are mocked but still written to the `emails` table.

## Scripts

| Script | What |
| --- | --- |
| `npm run dev` | Next.js |
| `npm run convex` | Local Convex (`CONVEX_AGENT_MODE=anonymous`) |
| `npm run seed` | Reseed demo data |
| `npm run test` | Vitest |
| `npm run lint` / `typecheck` | Checks |

## Docs

- `CLAUDE.md` — product rules and golden path  
- `DESIGN.md` — visual system  
- `docs/BUILD_PROMPT.md` / `docs/PLAN.md` — full spec and milestones  
