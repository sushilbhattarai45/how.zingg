import Image from 'next/image';
import Link from 'next/link';
import { Footer } from '@/components/landing/StaticSections';
import { buttonClass } from '@/components/ui/Button';

export type DocSection = { id: string; title: string; body: React.ReactNode };

export const CONTACT_EMAIL = 'Rajeev.Shrestha@usm.edu';
export const LAST_UPDATED = 'November 6, 2026';

/**
 * Long-form page (offices, FAQ, privacy, terms): paper background for reading, a sticky table of
 * contents on wide screens, numbered sections with anchors.
 */
export function DocPage({
  eyebrow,
  title,
  intro,
  sections,
  draft,
  numbered = true,
  children,
}: {
  eyebrow: string;
  title: string;
  intro: React.ReactNode;
  sections: DocSection[];
  /** Shows the "pending legal review" note (privacy, terms). */
  draft?: boolean;
  numbered?: boolean;
  /** Extra content after the sections (forms, CTAs). */
  children?: React.ReactNode;
}) {
  return (
    <>
      <DocNav />
      <div className="theme-light bg-paper">
        <main className="mx-auto max-w-6xl px-4 pt-28 pb-20">
          <header className="max-w-[65ch]">
            <p className="label-caps text-text-3">{eyebrow}</p>
            <h1 className="mt-2 text-[34px] leading-[40px] font-extrabold md:text-[44px] md:leading-[50px]">
              {title}
            </h1>
            <div className="mt-4 text-[17px] leading-[26px] text-text-2">{intro}</div>
            <p className="mt-4 text-[13px] leading-[19px] text-text-3">Last updated {LAST_UPDATED}</p>
            {draft && (
              <p className="mt-4 rounded-[12px] border border-line bg-raised p-3 text-[13px] leading-[19px] text-text-2">
                <strong className="text-chalk">Plain-English draft.</strong> how.zingg is a student project in
                its pilot. This page explains exactly how we work today and is written to be read, not to hide
                things. It will be reviewed by a lawyer before a public launch; if anything changes we&apos;ll
                tell you before it applies to you.
              </p>
            )}
          </header>

          <div className="mt-10 grid gap-10 lg:grid-cols-[220px_1fr]">
            <nav aria-label="On this page" className="hidden lg:block">
              <div className="sticky top-24">
                <p className="label-caps text-text-3">On this page</p>
                <ol className="mt-3 flex flex-col gap-1 border-l border-line text-[13px] leading-[19px] font-bold">
                  {sections.map((s, i) => (
                    <li key={s.id}>
                      <a
                        href={`#${s.id}`}
                        className="-ml-px block border-l-2 border-transparent py-1 pl-3 text-text-2 hover:border-window hover:text-chalk"
                      >
                        {numbered ? `${i + 1}. ` : ''}
                        {s.title}
                      </a>
                    </li>
                  ))}
                </ol>
              </div>
            </nav>

            <div className="flex max-w-[70ch] flex-col gap-10">
              {sections.map((s, i) => (
                <section key={s.id} id={s.id} className="scroll-mt-24" aria-labelledby={`${s.id}-h`}>
                  <h2 id={`${s.id}-h`} className="text-[22px] leading-7 font-extrabold">
                    {numbered && <span className="mr-2 text-text-3">{i + 1}.</span>}
                    {s.title}
                  </h2>
                  <div className="doc-body mt-3 flex flex-col gap-3 text-[15px] leading-[24px] text-text-2">
                    {s.body}
                  </div>
                </section>
              ))}
              {children}
            </div>
          </div>
        </main>
      </div>
      <div className="bg-ink">
        <Footer />
      </div>
    </>
  );
}

function DocNav() {
  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-line bg-ink/95">
      <nav className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4" aria-label="Main">
        <Link href="/" aria-label="how.zingg home" className="shrink-0">
          <Image src="/brand/wordmark-dark.svg" alt="how.zingg" width={124} height={32} priority />
        </Link>
        <div className="ml-auto hidden items-center gap-6 text-[14px] font-bold text-text-2 md:flex">
          <Link href="/#how" className="hover:text-chalk">
            How it works
          </Link>
          <Link href="/offices" className="hover:text-chalk">
            For leasing offices
          </Link>
          <Link href="/faq" className="hover:text-chalk">
            FAQ
          </Link>
        </div>
        <Link href="/app" className={buttonClass('secondary', 'ml-auto min-h-10 md:ml-0')}>
          Start my search
        </Link>
      </nav>
    </header>
  );
}

/** Small helpers so page content stays readable. */
export function Ul({ children }: { children: React.ReactNode }) {
  return <ul className="flex list-disc flex-col gap-2 pl-5 marker:text-text-3">{children}</ul>;
}

export function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[16px] border border-line bg-card p-4 text-chalk">
      <div className="flex flex-col gap-2 text-[15px] leading-[24px]">{children}</div>
    </div>
  );
}

export function Mail() {
  return (
    <a href={`mailto:${CONTACT_EMAIL}`} className="font-bold text-window-text underline underline-offset-2">
      {CONTACT_EMAIL}
    </a>
  );
}
