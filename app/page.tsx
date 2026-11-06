import Image from 'next/image';

// Placeholder until the landing scroll story (M5). Keeps the app runnable at every commit.
export default function Page() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col items-start justify-center gap-6 px-4">
      <Image src="/brand/wordmark-dark.svg" alt="how.zingg" width={220} height={57} priority />
      <h1 className="text-[34px] leading-[38px] font-extrabold sm:text-5xl sm:leading-[52px]">
        Find a home near campus before you land.
      </h1>
      <p className="text-lg leading-[26px] text-text-2">
        how.zingg&apos;s AI team calls leasing offices, checks the neighborhood and handles the paperwork
        while you sleep. Built for international and transfer students.
      </p>
    </main>
  );
}
