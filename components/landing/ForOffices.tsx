'use client';

import { useState } from 'react';
import { useMutation } from 'convex/react';
import { BadgeCheck, PhoneMissed, HandCoins } from 'lucide-react';
import { api } from '@/convex/_generated/api';
import { Button } from '@/components/ui/Button';

const CARDS = [
  {
    icon: BadgeCheck,
    title: 'Pre-verified applicants',
    text: 'I-20, visa, funding letter and guarantor option in one packet, the same criteria for every applicant.',
  },
  {
    icon: PhoneMissed,
    title: 'Fewer missed leads',
    text: 'We answer applicants abroad at their hour and call you at yours.',
  },
  {
    icon: HandCoins,
    title: 'Pay per signed lease',
    text: 'No subscription to start. A placement fee only when a renter signs.',
  },
];

export const PARTNER_EMAIL = 'partners@howzingg.example';

export function ForOffices() {
  const [open, setOpen] = useState(false);
  return (
    <section id="offices" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20">
      <p className="label-caps text-text-3">For leasing offices</p>
      <h2 className="mt-1 text-[28px] leading-8 font-extrabold">
        Fill units with verified international renters.
      </h2>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {CARDS.map(({ icon: Icon, title, text }) => (
          <div key={title} className="rounded-[16px] border border-line bg-surface p-4">
            <Icon size={24} strokeWidth={2} className="text-text-2" aria-hidden />
            <h3 className="mt-3 text-[16px] leading-[22px] font-bold">{title}</h3>
            <p className="mt-1 text-text-2">{text}</p>
          </div>
        ))}
      </div>
      {!open ? (
        <Button variant="secondary" className="mt-6" onClick={() => setOpen(true)}>
          Become a partner
        </Button>
      ) : (
        <PartnerForm />
      )}
    </section>
  );
}

function PartnerForm() {
  const submitLead = useMutationSafe();
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');
  return (
    <form
      className="mt-6 grid max-w-xl gap-3 rounded-[16px] border border-line bg-surface p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setState('sending');
        try {
          if (!submitLead) throw new Error(`Backend offline. Email us at ${PARTNER_EMAIL}.`);
          await submitLead({
            officeName: String(f.get('officeName') ?? ''),
            contactName: String(f.get('contactName') ?? ''),
            email: String(f.get('email') ?? ''),
            phone: String(f.get('phone') ?? '') || undefined,
            message: String(f.get('message') ?? '') || undefined,
          });
          setState('sent');
        } catch (err) {
          setError(
            err instanceof Error
              ? err.message.replace(/^.*Uncaught Error: /, '').split('\n')[0]!
              : 'Something went wrong.',
          );
          setState('error');
        }
      }}
    >
      {state === 'sent' ? (
        <p role="status" className="font-bold text-good">
          Thanks. We&apos;ll reach out within one business day.
        </p>
      ) : (
        <>
          {[
            ['officeName', 'Community or office name', 'text', true],
            ['contactName', 'Your name', 'text', true],
            ['email', 'Email', 'email', true],
            ['phone', 'Phone (optional)', 'tel', false],
          ].map(([name, label, type, req]) => (
            <label key={name as string} className="grid gap-1 text-[13px] font-bold text-text-2">
              {label as string}
              <input
                name={name as string}
                type={type as string}
                required={req as boolean}
                className="h-11 rounded-[12px] border border-line bg-raised px-3 text-[15px] font-semibold text-chalk"
              />
            </label>
          ))}
          <label className="grid gap-1 text-[13px] font-bold text-text-2">
            Anything we should know? (optional)
            <textarea
              name="message"
              rows={3}
              className="rounded-[12px] border border-line bg-raised px-3 py-2 text-[15px] font-semibold text-chalk"
            />
          </label>
          <Button type="submit" variant="secondary" disabled={state === 'sending'}>
            {state === 'sending' ? 'Sending…' : 'Send'}
          </Button>
          {state === 'error' && (
            <p role="alert" className="text-[13px] text-bad">
              {error}
            </p>
          )}
          <p className="text-[13px] text-text-3">Or email {PARTNER_EMAIL}</p>
        </>
      )}
    </form>
  );
}

/** useMutation throws without a ConvexProvider; the static site still renders without a backend. */
function useMutationSafe() {
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks -- provider presence is fixed for the app's lifetime
    return useMutation(api.partners.submitLead);
  } catch {
    return null;
  }
}
