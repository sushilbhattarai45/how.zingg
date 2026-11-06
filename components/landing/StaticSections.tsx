import Image from 'next/image';
import Link from 'next/link';
import { FACTS } from '@/content/facts';
import { FAQ } from '@/content/faq';
import { ButtonLink } from '@/components/ui/Button';
import { PARTNER_EMAIL } from './ForOffices';

export function Facts() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16" aria-labelledby="facts-h">
      <p className="label-caps text-text-3">The numbers</p>
      <h2 id="facts-h" className="sr-only">
        The numbers
      </h2>
      <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {FACTS.map((f) => (
          <li key={f.label} className="flex flex-col rounded-[16px] border border-line bg-surface p-4">
            <span className="tabular text-[32px] leading-9 font-extrabold">{f.value}</span>
            <span className="mt-1 flex-1 text-[13px] leading-[19px] text-text-2">{f.label}</span>
            <a
              href={f.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 text-[12px] leading-4 font-bold text-text-3 underline-offset-2 hover:text-chalk hover:underline"
            >
              Source: {f.source}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Faq() {
  return (
    <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-4 py-16">
      <h2 className="text-[28px] leading-8 font-extrabold">FAQ</h2>
      <div className="mt-4 divide-y divide-line rounded-[16px] border border-line bg-surface">
        {FAQ.map((f) => (
          <details key={f.q} className="group px-4">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 font-bold">
              {f.q}
              <span aria-hidden className="text-text-3 transition-transform group-open:rotate-45">
                +
              </span>
            </summary>
            <p className="pb-4 text-text-2">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16">
      <div className="flex flex-col items-center gap-5 rounded-[20px] border border-line bg-surface px-6 py-10 text-center md:flex-row md:text-left">
        <Image src="/brand/mark-light.svg" alt="" width={64} height={58} />
        <p className="flex-1 text-[22px] leading-7 font-extrabold">
          The light&apos;s on. Let&apos;s find your home.
        </p>
        <ButtonLink href="/app">Start my search</ButtonLink>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 md:flex-row md:items-start">
        <div className="flex-1">
          <Image src="/brand/wordmark-dark.svg" alt="how.zingg" width={110} height={28} />
          <p className="mt-3 max-w-sm text-[13px] leading-[19px] text-text-3">
            Built at the VOXO Hatchathon 2026, The University of Southern Mississippi
          </p>
        </div>
        <nav
          aria-label="Footer"
          className="grid grid-cols-2 gap-x-8 gap-y-2 text-[14px] font-bold text-text-2"
        >
          <Link href="/app" className="hover:text-chalk">
            For students
          </Link>
          <Link href="/offices" className="hover:text-chalk">
            For leasing offices
          </Link>
          <Link href="/faq" className="hover:text-chalk">
            FAQ
          </Link>
          <Link href="/privacy" className="hover:text-chalk">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-chalk">
            Terms of use
          </Link>
          <Link href="/fair-housing" className="hover:text-chalk">
            Fair housing statement
          </Link>
          <span className="col-span-2 font-semibold text-text-3">Contact: {PARTNER_EMAIL}</span>
        </nav>
      </div>
    </footer>
  );
}
