import Link from 'next/link';

export const metadata = { title: 'Fair housing · how.zingg' };

export default function FairHousing() {
  return (
    <main className="mx-auto max-w-[65ch] px-4 py-16">
      <Link href="/" className="text-[14px] font-bold text-text-2 hover:text-chalk">
        ← how.zingg
      </Link>
      <h1 className="mt-6 text-[28px] leading-8 font-extrabold">Fair housing statement</h1>
      <div className="mt-4 flex flex-col gap-4 text-text-2">
        <p>
          how.zingg never filters, ranks or describes apartments, neighborhoods or roommates by national
          origin, race, color, religion, sex, familial status or disability.
        </p>
        <p>
          We never call a neighborhood safe, unsafe, good or bad, and we never describe who lives somewhere.
          We give facts: distance, travel time, price, what is nearby, and links to official sources if you
          ask about crime statistics.
        </p>
        <p>
          Roommate matching uses only the lifestyle fields you choose to share, like budget, move-in date and
          habits.
        </p>
        <p>
          Every applicant packet we send to an office follows the same criteria. If you think something we
          showed you breaks these rules, tell us and we&apos;ll fix it.
        </p>
      </div>
    </main>
  );
}
