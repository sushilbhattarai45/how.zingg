import Link from 'next/link';

export const metadata = { title: 'Privacy · how.zingg' };

export default function Privacy() {
  return (
    <main className="mx-auto max-w-[65ch] px-4 py-16">
      <Link href="/" className="text-[14px] font-bold text-text-2 hover:text-chalk">
        ← how.zingg
      </Link>
      <h1 className="mt-6 text-[28px] leading-8 font-extrabold">Privacy</h1>
      <ul className="mt-4 flex list-disc flex-col gap-3 pl-5 text-text-2">
        <li>We never ask for or store an SSN.</li>
        <li>Your documents are stored encrypted and shared only with leasing offices you approve.</li>
        <li>You can delete your documents at any time.</li>
        <li>We never collect rent, deposits or fees. You pay the verified leasing office directly.</li>
        <li>
          Calls made for you start by saying they come from an AI assistant, and are recorded with notice.
        </li>
      </ul>
    </main>
  );
}
