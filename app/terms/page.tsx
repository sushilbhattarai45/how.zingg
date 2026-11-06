import Link from 'next/link';
import { Callout, DocPage, Mail, Ul, type DocSection } from '@/components/legal/DocPage';

export const metadata = {
  title: 'Terms of use · how.zingg',
  description: 'The rules for using how.zingg, in plain English.',
};

const L = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <Link href={href} className="font-bold text-window-text underline underline-offset-2">
    {children}
  </Link>
);

const sections: DocSection[] = [
  {
    id: 'summary',
    title: 'The short version',
    body: (
      <Callout>
        <Ul>
          <li>how.zingg is free for students. We are not your landlord, broker or lawyer.</li>
          <li>
            Our AI agents act for you only within what you ask, and nothing binding happens without your tap.
          </li>
          <li>
            We never handle rent or deposits. You pay the leasing office directly, after you&apos;ve checked
            it.
          </li>
          <li>
            We work hard to be accurate and to hide scams, but we can&apos;t guarantee a unit, a price or an
            office.
          </li>
          <li>Be honest in your documents and kind to the people our agents talk to.</li>
        </Ul>
      </Callout>
    ),
  },
  {
    id: 'agreement',
    title: 'Agreeing to these terms',
    body: (
      <p>
        These terms are an agreement between you and how.zingg, a student project built at The University of
        Southern Mississippi. By creating an account or using how.zingg, you agree to them and to our{' '}
        <L href="/privacy">privacy policy</L>. If you don&apos;t agree, please don&apos;t use the service.
      </p>
    ),
  },
  {
    id: 'eligibility',
    title: 'Who can use how.zingg',
    body: (
      <p>
        You must be at least 18 and able to sign a lease, or use how.zingg together with a parent or guardian
        who is. You are responsible for your account and for keeping your sign-in safe.
      </p>
    ),
  },
  {
    id: 'what',
    title: 'What we do, and what we don’t',
    body: (
      <>
        <p>
          We search public listings and places, contact leasing offices for you, prepare a renter packet from
          documents you give us, compare offers and track your lease until it&apos;s confirmed.
        </p>
        <p>We are not:</p>
        <Ul>
          <li>a landlord, property manager or real estate broker, and we don&apos;t own or list any unit;</li>
          <li>
            a lawyer or immigration advisor, so nothing we say is legal, immigration or financial advice;
          </li>
          <li>part of, or endorsed by, any university.</li>
        </Ul>
        <p>
          Your lease is a contract between you and the landlord. Read it before you sign; we&apos;ll point out
          key terms but you decide.
        </p>
      </>
    ),
  },
  {
    id: 'authority',
    title: 'Letting our agents act for you',
    body: (
      <>
        <p>When you ask the team for something, you authorize our agents to:</p>
        <Ul>
          <li>
            call and email leasing offices about it, saying they are an AI assistant working for a student;
          </li>
          <li>share your first name, school, move-in date and budget with offices to ask about units;</li>
          <li>read the documents you upload to build your packet and checklist.</li>
        </Ul>
        <p>
          We will <strong>always ask first</strong> before anything binding or sensitive: sharing your
          documents with an office, submitting an application, accepting an offer, signing or paying. You can
          stop any task at any time.
        </p>
      </>
    ),
  },
  {
    id: 'accuracy',
    title: 'Accuracy and live information',
    body: (
      <>
        <p>
          Prices, availability, specials and holds change daily. We never guess them: Caller asks the office,
          and we show you where every answer came from. Data marked <strong>Example</strong> is sample data,
          not a real offer.
        </p>
        <p>
          AI can make mistakes. Please check important details with the office and in your lease. We are not
          responsible for an office&apos;s own statements, decisions or changes.
        </p>
      </>
    ),
  },
  {
    id: 'money',
    title: 'Money and fees',
    body: (
      <Ul>
        <li>how.zingg is free for students.</li>
        <li>
          We never collect rent, deposits, application fees or any other payment. Pay only the leasing office,
          using the method on your lease.
        </li>
        <li>
          Leasing offices may pay us a fee when a lease is signed (free during our pilot). This never changes
          which places we show you or how we rank them.
        </li>
      </Ul>
    ),
  },
  {
    id: 'scams',
    title: 'Scams',
    body: (
      <p>
        We hide listings that ask for wire transfers, gift cards or crypto, ask for money before a tour, or
        look copied or far below market. No filter is perfect: never send money to anyone who contacts you
        outside a verified office, and tell us at <Mail /> if something looks wrong.
      </p>
    ),
  },
  {
    id: 'yours',
    title: 'Your responsibilities',
    body: (
      <>
        <p>You agree to:</p>
        <Ul>
          <li>upload only real documents that belong to you (or that you have permission to share);</li>
          <li>give true information to us and to offices;</li>
          <li>not use how.zingg to harass anyone, discriminate, spam offices or scrape the service;</li>
          <li>not try to break, overload or get around the security of how.zingg.</li>
        </Ul>
        <p>We may pause or close accounts that break these rules, and we&apos;ll tell you why.</p>
      </>
    ),
  },
  {
    id: 'roommates',
    title: 'Roommates',
    body: (
      <p>
        Roommate matching is opt-in and only uses the lifestyle details you choose to share. Meeting and
        living with a roommate is between you and them. Be careful, meet in public first, and report anyone
        who makes you uncomfortable.
      </p>
    ),
  },
  {
    id: 'content',
    title: 'Your content and ours',
    body: (
      <p>
        You own your documents and messages. You give us permission to store and process them only to provide
        how.zingg to you. how.zingg&apos;s name, logo, 3D world, bots and software belong to the how.zingg
        team; please don&apos;t copy them.
      </p>
    ),
  },
  {
    id: 'ending',
    title: 'Ending',
    body: (
      <p>
        You can stop using how.zingg and delete your account at any time from settings or by emailing <Mail />
        . Deletion follows our <L href="/privacy#retention">retention rules</L>.
      </p>
    ),
  },
  {
    id: 'liability',
    title: 'Disclaimers and limits',
    body: (
      <>
        <p>
          how.zingg is a pilot provided &ldquo;as is&rdquo;. We don&apos;t promise it will always be
          available, error-free or that you will find a unit.
        </p>
        <p>
          To the extent the law allows, we aren&apos;t liable for indirect or consequential losses, or for
          what landlords, offices or other users do. Because the service is free for students, our total
          liability to you is limited to $100. Nothing here limits rights you have that the law says
          can&apos;t be limited.
        </p>
      </>
    ),
  },
  {
    id: 'law',
    title: 'Law and disputes',
    body: (
      <p>
        These terms are governed by the laws of the State of Mississippi, USA. If something goes wrong, email
        us first and we&apos;ll try to fix it within 30 days. If we can&apos;t, disputes go to the state or
        federal courts in Forrest County, Mississippi, unless your local consumer law gives you the right to
        bring a claim where you live.
      </p>
    ),
  },
  {
    id: 'changes',
    title: 'Changes and contact',
    body: (
      <p>
        If we change these terms in a way that matters, we&apos;ll tell you by email and in the app at least
        14 days before they apply. Questions: <Mail />.
      </p>
    ),
  },
];

export default function Terms() {
  return (
    <DocPage
      eyebrow="Terms"
      title="Terms of use"
      intro={<p>The rules for using how.zingg, written so you can actually read them.</p>}
      sections={sections}
      draft
    />
  );
}
