import Link from 'next/link';
import { Callout, DocPage, Mail, Ul, type DocSection } from '@/components/legal/DocPage';

export const metadata = {
  title: 'Privacy policy · how.zingg',
  description: 'What how.zingg collects, why, who sees it, how long we keep it, and how to delete it.',
};

const sections: DocSection[] = [
  {
    id: 'summary',
    title: 'The short version',
    body: (
      <Callout>
        <Ul>
          <li>
            <strong>We never ask for your SSN</strong> and never take rent, deposits or card payments.
          </li>
          <li>
            Your documents are <strong>encrypted</strong> and shared{' '}
            <strong>only with leasing offices you approve</strong>, one office at a time.
          </li>
          <li>
            You can <strong>see, download and delete</strong> everything we hold about you, any time, from
            your shelf or by emailing us.
          </li>
          <li>
            We <strong>don&apos;t sell</strong> your data, don&apos;t use ad trackers, and don&apos;t use your
            documents to train AI models.
          </li>
          <li>
            Calls made for you always start with &ldquo;Hi, I&apos;m an AI assistant calling on behalf of a
            student&rdquo; and say they&apos;re recorded.
          </li>
        </Ul>
      </Callout>
    ),
  },
  {
    id: 'who',
    title: 'Who we are',
    body: (
      <>
        <p>
          how.zingg (&ldquo;we&rdquo;, &ldquo;us&rdquo;) is a student project built at the VOXO Hatchathon
          2026 at The University of Southern Mississippi. We help students find and lease off-campus housing
          before they arrive. We are not a university office, a landlord or a real estate broker.
        </p>
        <p>
          For anything in this policy, contact <Mail />. We answer within 5 business days, usually much
          sooner.
        </p>
      </>
    ),
  },
  {
    id: 'collect',
    title: 'What we collect',
    body: (
      <>
        <p>
          <strong className="text-chalk">What you give us</strong>
        </p>
        <Ul>
          <li>
            Account: name, email, phone or WhatsApp number, time zone, university, move-in date, budget.
          </li>
          <li>Your questions to the team and your choices (wishlist, swipes, offers you pick).</li>
          <li>
            Documents you upload for your renter packet, such as an I-20 or DS-2019, visa, passport photo
            page, funding or scholarship letter, bank statement and guarantor details.
          </li>
          <li>An optional roommate profile: first name, budget, move-in date and lifestyle tags you pick.</li>
        </Ul>
        <p>
          <strong className="text-chalk">What our agents create while working for you</strong>
        </p>
        <Ul>
          <li>
            Call recordings, transcripts and the answers they capture (rent, fees, move-in dates, policies).
          </li>
          <li>Emails sent to and received from leasing offices on your behalf.</li>
          <li>Search results with their sources, and a log of every step each agent took.</li>
        </Ul>
        <p>
          <strong className="text-chalk">What we collect automatically</strong>
        </p>
        <Ul>
          <li>Basic technical data needed to run the site: device type, browser, IP address, error logs.</li>
          <li>
            Essential cookies only, to keep you signed in. No advertising or cross-site tracking cookies.
          </li>
        </Ul>
        <p>
          <strong className="text-chalk">What we never collect</strong>: Social Security numbers, credit or
          debit card numbers, bank logins or passwords to other services.
        </p>
      </>
    ),
  },
  {
    id: 'use',
    title: 'How we use it',
    body: (
      <Ul>
        <li>
          To search for places, call and email leasing offices, and build your renter packet when you ask us
          to.
        </li>
        <li>
          To read your documents with AI so we can name them, check what is missing and fill in your
          checklist.
        </li>
        <li>To send you updates in your time zone by email or WhatsApp.</li>
        <li>To spot scams and keep them away from you.</li>
        <li>To keep the service secure, fix bugs and meet legal obligations.</li>
      </Ul>
    ),
  },
  {
    id: 'ai',
    title: 'AI, calls and recordings',
    body: (
      <>
        <p>
          Five AI agents (Concierge, Scout, Caller, Packet and Closer) work for you. They can be wrong.
          Anything binding, like submitting an application, signing or paying,{' '}
          <strong>always waits for your approval</strong>.
        </p>
        <p>
          Caller only phones offices during their business hours. Every call starts with the AI disclosure and
          a recording notice; an office can ask to switch to email at any time and we honor it. Recordings and
          transcripts are kept so you can check what was said.
        </p>
        <p>
          We use AI providers to run the agents (see section 6). They process your data only to give us the
          answer, under contracts that do not let them use it to train their models.
        </p>
      </>
    ),
  },
  {
    id: 'sharing',
    title: 'Who we share it with',
    body: (
      <>
        <p>
          <strong className="text-chalk">Leasing offices you approve.</strong> Before your packet goes
          anywhere you see exactly which office gets which documents, and you tap to approve. Offices you
          didn&apos;t approve get nothing but your first name and question when we ask about a unit.
        </p>
        <p>
          <strong className="text-chalk">Service providers</strong> who run parts of how.zingg for us, only as
          needed:
        </p>
        <Ul>
          <li>Convex: database and encrypted file storage (United States).</li>
          <li>Anthropic (Claude): the AI that powers the agents and reads documents.</li>
          <li>ElevenLabs and Twilio: AI voice calls and WhatsApp messages.</li>
          <li>Postmark: email to offices and to you.</li>
          <li>Google Maps Platform and Firecrawl: places, travel times and public listing pages.</li>
        </Ul>
        <p>
          <strong className="text-chalk">Legal reasons.</strong> If the law requires it, or to protect someone
          from harm or fraud. If that happens we tell you unless we are legally not allowed to.
        </p>
        <p>We never sell or rent your personal data, and we never share it for advertising.</p>
      </>
    ),
  },
  {
    id: 'security',
    title: 'How we protect it',
    body: (
      <Ul>
        <li>Documents are encrypted before they are stored, and encrypted in transit (HTTPS) everywhere.</li>
        <li>
          An office&apos;s access to your packet is a link that expires and is logged; you can revoke it.
        </li>
        <li>
          Only the agent doing a task can open the document it needs; team access is limited and logged.
        </li>
        <li>
          No system is perfectly secure. If a breach affects your data we will tell you and the authorities as
          the law requires, quickly and plainly.
        </li>
      </Ul>
    ),
  },
  {
    id: 'retention',
    title: 'How long we keep it',
    body: (
      <Ul>
        <li>
          Documents: until you delete them, or 90 days after your lease is confirmed, whichever comes first.
        </li>
        <li>
          Call recordings and transcripts: 90 days, then deleted. Short notes of the answers stay with your
          search.
        </li>
        <li>
          Account and search history: until you delete your account, or after 12 months with no activity.
        </li>
        <li>Deleted items leave backups within 30 days.</li>
      </Ul>
    ),
  },
  {
    id: 'rights',
    title: 'Your choices and rights',
    body: (
      <>
        <p>Wherever you live, you can:</p>
        <Ul>
          <li>See and download what we hold about you.</li>
          <li>Correct anything that is wrong.</li>
          <li>Delete a document, your roommate profile or your whole account.</li>
          <li>Withdraw an approval you gave an office, or stop calls and messages for your search.</li>
          <li>Object to any use of your data, or ask us to restrict it.</li>
        </Ul>
        <p>
          Most of this is one tap in the app. For the rest, email <Mail />. We will not treat you differently
          for using these rights. If you are in the EU, UK, India or elsewhere with data protection laws, you
          may also complain to your local regulator.
        </p>
      </>
    ),
  },
  {
    id: 'international',
    title: 'International students and transfers',
    body: (
      <p>
        how.zingg is run from the United States and our providers store data in the United States. When you
        use how.zingg from another country, your data is transferred to the US and protected as described
        here.
      </p>
    ),
  },
  {
    id: 'age',
    title: 'Age',
    body: (
      <p>
        how.zingg is for people 18 and older, because leases are contracts. If you are younger, please ask a
        parent or guardian to use it with you. If we learn we hold data from someone under 13, we delete it.
      </p>
    ),
  },
  {
    id: 'fair-housing',
    title: 'Fair housing',
    body: (
      <p>
        We never use national origin, race, color, religion, sex, familial status or disability to filter,
        rank or describe places or roommates. See our{' '}
        <Link href="/fair-housing" className="font-bold text-window-text underline underline-offset-2">
          fair housing statement
        </Link>
        .
      </p>
    ),
  },
  {
    id: 'changes',
    title: 'Changes and contact',
    body: (
      <p>
        If we change this policy in a way that matters, we&apos;ll email you and show a notice in the app at
        least 14 days before it applies. Questions or requests: <Mail />.
      </p>
    ),
  },
];

export default function Privacy() {
  return (
    <DocPage
      eyebrow="Privacy"
      title="Privacy policy"
      intro={
        <p>
          You&apos;re trusting us with your passport, visa and bank documents from thousands of miles away.
          Here is exactly what we collect, why, who sees it, and how to delete it.
        </p>
      }
      sections={sections}
      draft
    />
  );
}
