'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { buttonClass } from '@/components/ui/Button';

export function TopNav() {
  const [solid, setSolid] = useState(false);
  useEffect(() => {
    const on = () => setSolid(window.scrollY > 80);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 transition-colors duration-250 ${solid ? 'border-b border-line bg-ink/95 backdrop-blur' : 'bg-transparent'}`}
    >
      <nav className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4" aria-label="Main">
        <Link href="/" aria-label="how.zingg home" className="shrink-0">
          <Image src="/brand/wordmark-dark.svg" alt="how.zingg" width={124} height={32} priority />
        </Link>
        <div className="ml-auto hidden items-center gap-6 text-[14px] font-bold text-text-2 md:flex">
          <a href="#how" className="hover:text-chalk">
            How it works
          </a>
          <a href="#offices" className="hover:text-chalk">
            For leasing offices
          </a>
          <a href="#faq" className="hover:text-chalk">
            FAQ
          </a>
        </div>
        <Link href="/app" className={buttonClass('secondary', 'ml-auto min-h-10 md:ml-0')}>
          Start my search
        </Link>
      </nav>
    </header>
  );
}
