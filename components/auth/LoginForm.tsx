'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, Eye, EyeOff, Lock } from 'lucide-react';
import { useAuthActions } from '@convex-dev/auth/react';
import { ConvexError } from 'convex/values';
import { BotAvatar, type BotMood } from '@/components/ui/BotAvatar';
import { Button } from '@/components/ui/Button';
import { AGENT_COLOR } from '@/content/agents';

type Mode = 'signIn' | 'signUp';

const EASE = [0.2, 0.8, 0.2, 1] as const;

/** Same rules as convex/auth.ts (checked again on the server). */
const RULES = [
  { id: 'len', label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { id: 'mix', label: 'A letter and a number', test: (p: string) => /[a-z]/i.test(p) && /\d/.test(p) },
];

/** Only same-site paths, never "//evil.com". */
function safeNext(raw: string | null) {
  return raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/app';
}

function friendly(err: unknown, mode: Mode): string {
  if (err instanceof ConvexError && typeof err.data === 'string') return err.data;
  const msg = err instanceof Error ? err.message : String(err);
  if (/AUTH_GOOGLE|google/i.test(msg) && /missing|environment/i.test(msg)) {
    return "Sorry, Google sign-in isn't switched on yet. Use email for now.";
  }
  if (/InvalidSecret|InvalidAccountId|Invalid credentials/i.test(msg)) {
    return mode === 'signIn' ? "That email and password don't match." : 'Something went wrong. Try again.';
  }
  if (/already exists/i.test(msg)) return 'You already have an account. Sign in instead.';
  if (/TooManyFailedAttempts|rate/i.test(msg)) return 'Too many tries. Wait a minute and try again.';
  if (/Failed to fetch|network/i.test(msg)) return "We can't reach the server. Check your connection.";
  return mode === 'signIn' ? "That email and password don't match." : 'Something went wrong. Try again.';
}

export function LoginForm() {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const next = safeNext(useSearchParams().get('next'));
  const [mode, setMode] = useState<Mode>('signIn');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState<'password' | 'google' | null>(null);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const mood: BotMood = done ? 'happy' : busy ? 'thinking' : error ? 'sad' : 'idle';
  const signUp = mode === 'signUp';
  const passwordOk = RULES.every((r) => r.test(password));

  const onPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    if (signUp && !passwordOk) {
      setError('Your password needs at least 8 characters, with a letter and a number.');
      return;
    }
    const data = new FormData(e.currentTarget);
    data.set('flow', mode);
    setBusy('password');
    try {
      await signIn('password', data);
      setDone(true);
      router.replace(next);
    } catch (err) {
      setError(friendly(err, mode));
      setBusy(null);
    }
  };

  const onGoogle = async () => {
    setError('');
    setBusy('google');
    try {
      await signIn('google', { redirectTo: next });
    } catch (err) {
      setError(friendly(err, mode));
      setBusy(null);
    }
  };

  const greeting = done
    ? 'Welcome! Taking you to your team…'
    : error
      ? 'Sorry! Let’s try that again.'
      : signUp
        ? 'Nice to meet you! Let’s set you up.'
        : 'Welcome back! Your team kept the lights on.';

  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden bg-ink px-4 py-10">
      {/* Soft lit windows in the background */}
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.07]">
        <div className="absolute top-[12%] left-[8%] grid grid-cols-2 gap-2">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="size-10 rounded-[8px] bg-window" />
          ))}
        </div>
        <div className="absolute right-[10%] bottom-[14%] grid grid-cols-2 gap-2">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="size-14 rounded-[10px] bg-window" />
          ))}
        </div>
      </div>

      <div className="relative w-full max-w-[420px]">
        <Link href="/" aria-label="how.zingg home" className="mx-auto mb-6 block w-fit">
          <Image src="/brand/wordmark-dark.svg" alt="how.zingg" width={140} height={36} priority />
        </Link>

        <div className="rounded-[20px] border border-line bg-surface p-6 shadow-[var(--shadow-float)]">
          {/* Concierge greets you and reacts */}
          <div className="flex items-center gap-3">
            <BotAvatar color={AGENT_COLOR.concierge} mood={mood} size={64} label={`Concierge, ${mood}`} />
            <div className="relative flex-1 rounded-[16px] bg-raised px-3 py-2 text-[14px] leading-5 font-semibold">
              <span
                aria-hidden
                className="absolute top-1/2 -left-1.5 size-3 -translate-y-1/2 rotate-45 bg-raised"
              />
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={greeting}
                  className="relative block"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2, ease: EASE }}
                >
                  {greeting}
                </motion.span>
              </AnimatePresence>
            </div>
          </div>

          {/* Sign in / Create account */}
          <div
            role="tablist"
            aria-label="Account"
            className="mt-5 grid grid-cols-2 rounded-[12px] bg-raised p-1"
          >
            {(['signIn', 'signUp'] as Mode[]).map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                onClick={() => {
                  setMode(m);
                  setError('');
                }}
                className="relative min-h-10 rounded-[10px] text-[14px] font-bold text-text-2 aria-selected:text-ink"
              >
                {mode === m && (
                  <motion.span
                    layoutId="tab"
                    className="absolute inset-0 rounded-[10px] bg-chalk"
                    transition={{ duration: 0.25, ease: EASE }}
                  />
                )}
                <span className="relative">{m === 'signIn' ? 'Sign in' : 'Create account'}</span>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onGoogle}
            disabled={!!busy}
            className="mt-5 flex min-h-12 w-full items-center justify-center gap-3 rounded-[12px] bg-white px-4 text-[15px] font-bold text-[#1f1f1f] transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            <GoogleMark />
            {busy === 'google' ? 'Opening Google…' : 'Continue with Google'}
          </button>

          <div className="my-5 flex items-center gap-3 text-[12px] font-bold text-text-3" aria-hidden>
            <span className="h-px flex-1 bg-line" />
            or with email
            <span className="h-px flex-1 bg-line" />
          </div>

          <form onSubmit={onPassword} className="flex flex-col gap-3" noValidate>
            <AnimatePresence initial={false}>
              {signUp && (
                <motion.label
                  key="name"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25, ease: EASE }}
                  className="grid gap-1 overflow-hidden text-[13px] font-bold text-text-2"
                >
                  First name
                  <input
                    name="name"
                    autoComplete="given-name"
                    className="h-12 rounded-[12px] border border-line bg-raised px-3 text-[15px] font-semibold text-chalk outline-none focus:border-chalk"
                  />
                </motion.label>
              )}
            </AnimatePresence>
            <label className="grid gap-1 text-[13px] font-bold text-text-2">
              Email
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                inputMode="email"
                className="h-12 rounded-[12px] border border-line bg-raised px-3 text-[15px] font-semibold text-chalk outline-none focus:border-chalk"
              />
            </label>
            <label className="grid gap-1 text-[13px] font-bold text-text-2">
              Password
              <span className="relative">
                <input
                  name="password"
                  type={show ? 'text' : 'password'}
                  required
                  autoComplete={signUp ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 w-full rounded-[12px] border border-line bg-raised pr-12 pl-3 text-[15px] font-semibold text-chalk outline-none focus:border-chalk"
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  aria-label={show ? 'Hide password' : 'Show password'}
                  className="absolute top-0 right-0 grid size-12 place-items-center text-text-3 hover:text-chalk"
                >
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </span>
            </label>

            {signUp && (
              <ul className="flex flex-col gap-1 text-[13px] leading-[19px]" aria-label="Password rules">
                {RULES.map((r) => {
                  const ok = r.test(password);
                  return (
                    <li key={r.id} className={`flex items-center gap-2 ${ok ? 'text-good' : 'text-text-3'}`}>
                      <span
                        className={`grid size-4 place-items-center rounded-full transition-colors ${ok ? 'bg-window text-ink' : 'border border-line'}`}
                      >
                        {ok && <Check size={11} strokeWidth={3} />}
                      </span>
                      {r.label}
                    </li>
                  );
                })}
              </ul>
            )}

            <AnimatePresence>
              {error && (
                <motion.p
                  role="alert"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="rounded-[12px] bg-bad-bg px-3 py-2 text-[13px] leading-[19px] font-semibold text-bad"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            <Button type="submit" disabled={!!busy} className="mt-1 w-full">
              {busy === 'password'
                ? signUp
                  ? 'Creating your account…'
                  : 'Signing in…'
                : signUp
                  ? 'Create account'
                  : 'Sign in'}
            </Button>
          </form>

          <p className="mt-4 flex items-start gap-2 text-[12px] leading-4 text-text-3">
            <Lock size={14} className="mt-px shrink-0" aria-hidden />
            Passwords are salted and hashed; we never store or see them. We never ask for an SSN.
          </p>
        </div>

        <p className="mt-5 text-center text-[12px] leading-4 text-text-3">
          By continuing you agree to our{' '}
          <Link href="/terms" className="font-bold underline underline-offset-2 hover:text-chalk">
            Terms
          </Link>{' '}
          and{' '}
          <Link href="/privacy" className="font-bold underline underline-offset-2 hover:text-chalk">
            Privacy policy
          </Link>
          .
        </p>
      </div>
    </main>
  );
}

/** Google "G" for the sign-in button (as Google's branding guidelines require). */
function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}
