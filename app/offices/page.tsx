import { BadgeCheck, CalendarClock, FileCheck2, PhoneCall, ShieldCheck } from 'lucide-react';
import { Callout, DocPage, Mail, Ul, type DocSection } from '@/components/legal/DocPage';
import { PartnerForm } from '@/components/landing/ForOffices';

export const metadata = {
  title: 'For leasing offices · how.zingg',
  description: 'Verified international renters, calls at your hours, free during the pilot.',
};

const STEPS = [
  {
    icon: PhoneCall,
    title: 'A student asks about you',
    text: 'Caller phones during your business hours, says up front it is an AI assistant for a student, and asks the questions you hear every week.',
  },
  {
    icon: CalendarClock,
    title: 'Closed? We wait',
    text: 'After hours we email and schedule the call for your opening time. No 3 AM calls, ever.',
  },
  {
    icon: FileCheck2,
    title: 'You get a verified packet',
    text: 'When the student approves, you receive one packet with their I-20 or DS-2019, visa, funding letter and guarantor option.',
  },
  {
    icon: BadgeCheck,
    title: 'Offer and lease',
    text: 'Closer compares offers with the student, asks about holds and specials, and tracks your lease to signature.',
  },
];

const sections: DocSection[] = [
  {
    id: 'why',
    title: 'Why offices work with us',
    body: (
      <>
        <p>
          Every fall, international and transfer students try to rent from 8,000 miles away. They email at 3
          AM your time, have no SSN or US credit history, and can&apos;t tour. Many of those leads go cold,
          and some students fall for scams instead.
        </p>
        <p>how.zingg turns those leads into applicants you can actually say yes to:</p>
        <Ul>
          <li>Pre-verified documents in one packet, built to the same criteria for every applicant.</li>
          <li>Questions answered once, at your hours, instead of ten emails across time zones.</li>
          <li>
            Students who already know your rent, fees, move-in date and what you accept instead of an SSN.
          </li>
        </Ul>
      </>
    ),
  },
  {
    id: 'how',
    title: 'How it works',
    body: (
      <ol className="grid gap-3 sm:grid-cols-2">
        {STEPS.map(({ icon: Icon, title, text }, i) => (
          <li key={title} className="rounded-[16px] border border-line bg-card p-4">
            <span className="flex items-center gap-2 font-bold text-chalk">
              <Icon size={20} strokeWidth={2} aria-hidden className="text-text-2" />
              {i + 1}. {title}
            </span>
            <span className="mt-1 block text-[14px] leading-[21px]">{text}</span>
          </li>
        ))}
      </ol>
    ),
  },
  {
    id: 'packet',
    title: 'What’s in a verified packet',
    body: (
      <>
        <Ul>
          <li>I-20 (F-1) or DS-2019 (J-1), with program dates.</li>
          <li>Visa or admission letter, and passport photo page.</li>
          <li>Funding: scholarship, sponsor or bank letter covering the lease term.</li>
          <li>A recent bank statement.</li>
          <li>
            Guarantor details if the student has one, or the alternative you accept (for example extra
            deposit).
          </li>
          <li>Move-in date, lease length, budget and contact details in the student&apos;s time zone.</li>
        </Ul>
        <p>
          You receive it through a secure link that expires and is logged. Every applicant&apos;s packet is
          built the same way, so you can apply your criteria consistently.
        </p>
      </>
    ),
  },
  {
    id: 'pricing',
    title: 'Pricing',
    body: (
      <Callout>
        <p className="text-[18px] leading-6 font-extrabold">Free during the pilot.</p>
        <p className="text-text-2">
          USM-area offices that join now pay nothing for the pilot semester. After the pilot, a flat fee per
          signed lease. No setup fee, no monthly fee, no contract. We&apos;ll announce the fee at least 30
          days before it applies and you can leave any time.
        </p>
        <p className="text-text-2">
          Fees never affect how we rank or show places to students. Students always use how.zingg free.
        </p>
      </Callout>
    ),
  },
  {
    id: 'calls',
    title: 'How our AI calls you',
    body: (
      <Ul>
        <li>
          The first sentence is always: &ldquo;Hi, I&apos;m an AI assistant calling on behalf of a
          student.&rdquo;
        </li>
        <li>It says the call is recorded, and keeps calls short and to a list of questions.</li>
        <li>Calls only happen during your posted business hours, in your time zone.</li>
        <li>
          Prefer email? Say so on any call or email <Mail /> and we switch your office to email only, right
          away.
        </li>
        <li>It never pays, signs, or agrees to anything binding. The student does that directly with you.</li>
      </Ul>
    ),
  },
  {
    id: 'dashboard',
    title: 'Your dashboard',
    body: (
      <p>
        Partner offices get a simple dashboard: verified applicants waiting for you, their move-in dates, what
        each one asked, and packets ready to review. You can mark units, reply to questions and download a
        packet once the student has approved it.
      </p>
    ),
  },
  {
    id: 'compliance',
    title: 'Fair housing and data',
    body: (
      <>
        <p>
          <ShieldCheck size={18} className="mr-1 inline align-[-3px] text-text-2" aria-hidden />
          We never filter, rank or describe applicants or places by national origin, race, color, religion,
          sex, familial status or disability, and we never describe neighborhoods as safe or unsafe.
        </p>
        <p>
          Packets you receive may be used only to evaluate that student&apos;s application, kept as the law
          requires, and then deleted. Please don&apos;t forward them outside your leasing team.
        </p>
        <p>We never collect rent, deposits or fees from students. Payments go to you directly.</p>
      </>
    ),
  },
  {
    id: 'join',
    title: 'Become a partner',
    body: (
      <p>
        Tell us about your community and we&apos;ll reach out within one business day. Or email <Mail />.
      </p>
    ),
  },
];

export default function OfficesPage() {
  return (
    <DocPage
      eyebrow="For leasing offices"
      title="Fill units with verified international renters."
      intro={
        <p>
          how.zingg sends you students who are ready to rent: documents checked, questions answered, calling
          at your hours, not theirs.
        </p>
      }
      sections={sections}
      numbered={false}
    >
      <div className="-mt-6">
        <PartnerForm />
      </div>
    </DocPage>
  );
}
