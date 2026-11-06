'use client';

import { Clock, IdCard, ShieldAlert, Luggage, ChevronDown } from 'lucide-react';
import { Button, ButtonLink } from '@/components/ui/Button';
import { AgentDot } from '@/components/ui/AgentDot';
import { UniversityPicker } from '@/components/ui/UniversityPicker';
import { AGENTS, AGENT_COLOR } from '@/content/agents';

const H2 = 'text-[28px] leading-8 font-extrabold';
const BODY = 'mt-2 text-[15px] leading-[22px] text-text-2';

export function HeroBeat({ onMeet, onHow }: { onMeet: () => void; onHow: () => void }) {
  return (
    <div>
      <p className="mb-3 inline-flex rounded-full bg-window-dim px-3 py-1 text-[12px] leading-4 font-bold text-good">
        For international + transfer students
      </p>
      <h1 className="text-[34px] leading-[38px] font-extrabold md:text-[48px] md:leading-[52px]">
        Find a home near campus before you land.
      </h1>
      <p className="mt-3 text-[18px] leading-[26px] text-text-2">
        how.zingg&apos;s AI team calls leasing offices, checks the neighborhood and handles the paperwork
        while you sleep. Built for international and transfer students.
      </p>
      <div className="mt-5">
        <UniversityPicker />
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <Button onClick={onMeet}>Meet your team</Button>
        <Button variant="secondary" onClick={onHow}>
          See how it works
        </Button>
      </div>
      <p className="mt-4 text-[13px] leading-[19px] text-text-3">
        No SSN needed · Free for students · You approve every step
      </p>
      <ChevronDown aria-hidden className="mx-auto mt-4 animate-bounce text-text-3 md:hidden" size={22} />
    </div>
  );
}

const PROBLEMS = [
  { icon: Clock, text: 'Offices close before you wake up.' },
  { icon: IdCard, text: 'No SSN, no US credit, so applications stall.' },
  { icon: ShieldAlert, text: "Fake listings target students who can't tour." },
  { icon: Luggage, text: 'You land with luggage and nowhere to go.' },
];

export function ProblemBeat() {
  return (
    <div>
      <p className="label-caps text-text-3">The problem</p>
      <h2 className={`${H2} mt-1`}>Renting from abroad is built for someone already here.</h2>
      <ul className="mt-4 flex flex-col gap-3">
        {PROBLEMS.map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-center gap-3 rounded-[12px] bg-raised px-3 py-3">
            <Icon size={20} strokeWidth={2} className="shrink-0 text-text-2" aria-hidden />
            <span className="font-semibold">{text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TeamBeat() {
  return (
    <div>
      <p className="label-caps text-text-3">Meet your team</p>
      <h2 className={`${H2} mt-1`}>Meet your team.</h2>
      <p className={BODY}>Five agents, one job: get you a confirmed lease.</p>
      <ul className="mt-4 flex flex-col gap-2">
        {AGENTS.map((a) => (
          <li
            key={a.id}
            tabIndex={0}
            className="flex items-start gap-3 rounded-[12px] px-2 py-2 hover:bg-raised focus:bg-raised"
          >
            <span className="mt-1.5">
              <AgentDot color={a.color} size={12} />
            </span>
            <span>
              <span className="font-bold">{a.name}</span>
              <span className="block text-[13px] leading-[19px] text-text-2">{a.role}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[13px] leading-[19px] text-text-3">
        They&apos;re waiting outside the leasing office.
      </p>
    </div>
  );
}

export function AskBeat({ onAsk }: { onAsk: () => void }) {
  return (
    <div>
      <p className="label-caps text-text-3">Ask the team</p>
      <h2 className={`${H2} mt-1`}>Ask anything about living near campus.</h2>
      <p className={BODY}>
        Apartments, prices, Walmart, groceries, the bus, banks that don&apos;t need an SSN. Your team digs and
        comes back with answers and sources.
      </p>
      <Button className="mt-5" onClick={onAsk}>
        Ask the team
      </Button>
      <p className="mt-3 text-[13px] leading-[19px] text-text-3">Or tap the glowing leasing office.</p>
    </div>
  );
}

export function ToWorkBeat() {
  return (
    <div>
      <p className="label-caps text-text-3">While you sleep</p>
      <h2 className={`${H2} mt-1`}>Then they get to work.</h2>
      <p className={BODY}>
        Calls happen during US office hours. Closed offices get a scheduled call and an email right away. You
        get updates on your time.
      </p>
      <div className="mt-4 flex items-start gap-3 rounded-[12px] bg-raised p-3">
        <AgentDot color={AGENT_COLOR.caller} size={10} />
        <p className="-mt-1 text-[13px] leading-[19px]">
          Pine Row opens at <span className="tabular font-bold">9:00 AM CT</span>. Caller will call then (
          <span className="tabular">7:45 PM</span> in Kathmandu). <span className="text-text-3">Example</span>
        </p>
      </div>
    </div>
  );
}

const ROOMS = {
  office: {
    label: 'Office · Caller',
    color: AGENT_COLOR.caller,
    text: "Caller phones offices, always says it's an AI, and writes down rent, deposit, move-in date and what they accept instead of an SSN.",
  },
  hall: {
    label: 'Hall · Scout',
    color: AGENT_COLOR.scout,
    text: 'Scout reads every listing, checks walk and bus times to your building, and hides scams that ask for wire transfers.',
  },
  kitchen: {
    label: 'Kitchen · Packet',
    color: AGENT_COLOR.packet,
    text: 'Packet reads your I-20, visa and funding letter and builds a renter packet offices accept instead of a credit check.',
  },
} as const;

export function RoomBeat({ room }: { room: keyof typeof ROOMS }) {
  const r = ROOMS[room];
  return (
    <div>
      <p className="label-caps text-text-3">Every agent has a job in the house</p>
      <h2 className="mt-2 flex items-center gap-2 text-[22px] leading-7 font-extrabold">
        <AgentDot color={r.color} size={12} /> {r.label}
      </h2>
      <p className={BODY}>{r.text}</p>
      <div className="mt-4 rounded-[12px] bg-raised p-3 text-[13px] leading-[19px]">
        {room === 'office' && (
          <p>
            <span className="rounded bg-window-dim px-1 font-bold text-good">
              &ldquo;Hi, I&apos;m an AI assistant calling on behalf of a student.&rdquo;
            </span>{' '}
            <span className="text-text-2">This call is recorded.</span>
          </p>
        )}
        {room === 'hall' && (
          <p className="font-bold">
            9 places found · <span className="text-bad">1 scam hidden</span>{' '}
            <span className="font-medium text-text-3">Example</span>
          </p>
        )}
        {room === 'kitchen' && <PacketRing done={3} total={4} />}
      </div>
    </div>
  );
}

function PacketRing({ done, total }: { done: number; total: number }) {
  const r = 18;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex items-center gap-3">
      <svg width="48" height="48" viewBox="0 0 48 48" aria-hidden>
        <circle cx="24" cy="24" r={r} fill="none" stroke="var(--line)" strokeWidth="5" />
        <circle
          cx="24"
          cy="24"
          r={r}
          fill="none"
          stroke="var(--window)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={`${(c * done) / total} ${c}`}
          transform="rotate(-90 24 24)"
        />
      </svg>
      <p>
        <span className="font-bold">
          Renter packet {done}/{total}
        </span>
        <span className="block text-text-2">Bank statement missing · Example</span>
      </p>
    </div>
  );
}

export function CouchBeat({ onOpen }: { onOpen: () => void }) {
  return (
    <div>
      <p className="label-caps text-text-3">Roommates</p>
      <h2 className={`${H2} mt-1`}>Find a roommate, too.</h2>
      <p className={BODY}>
        Students who opt in sit on the couch. Match on budget, move-in date and habits, then say hi.
      </p>
      <Button variant="secondary" className="mt-5" onClick={onOpen}>
        See who&apos;s on the couch
      </Button>
    </div>
  );
}

export function BookedBeat() {
  return (
    <div>
      <h2 className={H2}>Land with keys, not a hotel bill.</h2>
      <p className={BODY}>
        Booking confirmed, door light green, every window lit. That&apos;s the whole job.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <ButtonLink href="/app">Start my search</ButtonLink>
        <ButtonLink href="#offices" variant="secondary">
          For leasing offices
        </ButtonLink>
      </div>
    </div>
  );
}
