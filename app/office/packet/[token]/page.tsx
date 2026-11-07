'use client';

import { use, useEffect } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { Download, FileText, Loader2, ShieldCheck } from 'lucide-react';
import { api } from '@/convex/_generated/api';
import { kindLabel } from '@/lib/studentPacket';

/** Public (token-gated) read-only view of a student's application packet. */
export default function OfficePacketViewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const info = useQuery(api.packet.getPacketViewInfo, { token });
  const recordView = useMutation(api.packet.recordPacketView);

  useEffect(() => {
    if (info?.ok) void recordView({ token });
  }, [info?.ok, token, recordView]);

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#0e1410] text-chalk">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(109,189,19,0.22), transparent 55%), radial-gradient(ellipse 60% 40% at 100% 100%, rgba(61,184,201,0.08), transparent 50%)',
        }}
      />

      <div className="relative mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center px-5 py-14">
        <div className="mb-8">
          <p className="text-[12px] font-bold tracking-[0.14em] text-window uppercase">
            how.zingg · student packet
          </p>
          <h1 className="mt-3 text-[34px] leading-[1.1] font-extrabold tracking-tight">
            Application documents
          </h1>
          {info?.ok && (
            <p className="mt-3 text-[16px] leading-6 text-text-2">
              Shared for{' '}
              <span className="font-semibold text-chalk">{info.student.name}</span>
              {info.placeTitle ? (
                <>
                  {' '}
                  · interested in <span className="font-semibold text-chalk">{info.placeTitle}</span>
                </>
              ) : null}
              . Link expires {new Date(info.expiresAt).toLocaleDateString()}.
            </p>
          )}
        </div>

        {info === undefined && (
          <div className="flex items-center gap-3 rounded-2xl border border-line/80 bg-surface/80 px-4 py-5">
            <Loader2 className="size-5 animate-spin text-window" aria-hidden />
            <p className="text-[15px] text-text-2">Opening secure packet…</p>
          </div>
        )}

        {info && !info.ok && (
          <div className="rounded-2xl border border-bad/40 bg-bad-bg px-5 py-5">
            <p className="text-[16px] font-bold text-bad">
              {info.reason === 'expired' ? 'Link expired' : 'Invalid link'}
            </p>
            <p className="mt-2 text-[14px] leading-5 text-text-2">
              {info.reason === 'expired'
                ? 'Ask the student to send a fresh packet link from how.zingg (links last 5 days).'
                : 'This packet link is not valid. Check the email or request a new link.'}
            </p>
          </div>
        )}

        {info?.ok && (
          <div className="overflow-hidden rounded-[24px] border border-line/80 bg-surface/90 shadow-[0_24px_60px_rgba(0,0,0,0.45)] backdrop-blur">
            <div className="flex items-center gap-2 border-b border-line/70 bg-raised/40 px-5 py-3">
              <ShieldCheck size={16} className="text-window" aria-hidden />
              <p className="text-[12px] font-bold text-text-2">Private · view only · do not forward widely</p>
            </div>

            <div className="space-y-4 p-5">
              <div className="rounded-xl bg-raised/40 px-4 py-3 text-[13px] leading-5 text-text-2">
                <p className="font-bold text-chalk">{info.student.name}</p>
                <ul className="mt-1 space-y-0.5">
                  {info.student.homeCountry && <li>Home country: {info.student.homeCountry}</li>}
                  {info.student.arrivalDate && <li>Earliest move-in: {info.student.arrivalDate}</li>}
                  {info.student.hasSSN === false && <li>No US SSN (international student)</li>}
                  {info.student.hasSSN === true && <li>Has US SSN</li>}
                  {info.student.budgetMax != null && <li>Budget up to ${info.student.budgetMax}/mo</li>}
                  {info.student.whatsapp && <li>WhatsApp: {info.student.whatsapp}</li>}
                </ul>
              </div>

              {info.documents.length === 0 ? (
                <p className="py-6 text-center text-[14px] text-text-3">
                  No files in this packet yet.
                </p>
              ) : (
                <ul className="space-y-2">
                  {info.documents.map((d) => (
                    <li
                      key={d.documentId}
                      className="flex items-center gap-3 rounded-xl border border-line bg-raised/30 px-3 py-3"
                    >
                      <span className="grid size-10 place-items-center rounded-xl bg-ink text-window">
                        <FileText size={18} aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-bold">{d.fileName}</p>
                        <p className="text-[11px] text-text-3">{kindLabel(d.kind)}</p>
                      </div>
                      <a
                        href={d.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex min-h-9 items-center gap-1 rounded-full border border-window/40 bg-window-dim px-3 text-[12px] font-bold text-good"
                      >
                        <Download size={13} aria-hidden /> Open
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
