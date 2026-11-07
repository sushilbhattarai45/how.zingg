'use client';

import { use, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { CheckCircle2, FileUp, Loader2, ShieldCheck, Trash2, X } from 'lucide-react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';

type QueuedFile = {
  id: string;
  file: File;
};

/**
 * Public page for a realty office: queue multiple docs, remove any, then submit.
 */
export default function OfficeUploadPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const info = useQuery(api.documents.getTokenInfo, { token });
  const generateUploadUrl = useMutation(api.documents.generateUploadUrl);
  const receive = useMutation(api.documents.receiveOfficeDocument);

  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneNames, setDoneNames] = useState<string[] | null>(null);
  const [dragOver, setDragOver] = useState(false);

  function addFiles(list: FileList | File[] | null) {
    if (!list) return;
    const incoming = Array.from(list).filter(Boolean);
    if (!incoming.length) return;
    setError(null);
    setQueue((prev) => {
      const next = [...prev];
      for (const file of incoming) {
        if (file.size > 8 * 1024 * 1024) {
          setError(`${file.name} is over 8 MB — skipped.`);
          continue;
        }
        if (next.some((q) => q.file.name === file.name && q.file.size === file.size)) continue;
        next.push({ id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 7)}`, file });
      }
      return next.slice(0, 12);
    });
  }

  function removeQueued(id: string) {
    setQueue((prev) => prev.filter((q) => q.id !== id));
  }

  async function submitAll() {
    if (!info?.ok || queue.length === 0 || busy) return;
    setError(null);
    setBusy(true);
    const uploaded: string[] = [];
    try {
      for (const item of queue) {
        const uploadUrl = await generateUploadUrl({ token });
        const res = await fetch(uploadUrl, {
          method: 'POST',
          headers: { 'Content-Type': item.file.type || 'application/octet-stream' },
          body: item.file,
        });
        if (!res.ok) throw new Error(`Upload failed for ${item.file.name}`);
        const { storageId } = (await res.json()) as { storageId: Id<'_storage'> };
        await receive({
          token,
          storageId,
          fileName: item.file.name,
          contentType: item.file.type || undefined,
        });
        uploaded.push(item.file.name);
      }
      setDoneNames(uploaded);
      setQueue([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setBusy(false);
    }
  }

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
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      <div className="relative mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center px-5 py-14">
        <div className="mb-8">
          <p className="text-[12px] font-bold tracking-[0.14em] text-window uppercase">
            how.zingg · for leasing offices
          </p>
          <h1 className="mt-3 text-[34px] leading-[1.1] font-extrabold tracking-tight">
            Send docs to the student
          </h1>
          {info?.ok && (
            <p className="mt-3 text-[16px] leading-6 text-text-2">
              Secure upload for{' '}
              <span className="font-semibold text-chalk">{info.placeTitle}</span>. Add one or more
              files, remove any you don’t want, then submit.
            </p>
          )}
        </div>

        {info === undefined && (
          <div className="flex items-center gap-3 rounded-2xl border border-line/80 bg-surface/80 px-4 py-5 backdrop-blur">
            <Loader2 className="size-5 animate-spin text-window" aria-hidden />
            <p className="text-[15px] text-text-2">Checking your secure link…</p>
          </div>
        )}

        {info && !info.ok && (
          <div className="rounded-2xl border border-bad/40 bg-bad-bg px-5 py-5">
            <p className="text-[16px] font-bold text-bad">
              {info.reason === 'expired' ? 'Link expired' : 'Invalid link'}
            </p>
            <p className="mt-2 text-[14px] leading-5 text-text-2">
              {info.reason === 'expired'
                ? 'Ask the student (or how.zingg Caller) for a new upload link after the next call.'
                : 'This upload link is not valid. Double-check the email, or request a fresh link.'}
            </p>
          </div>
        )}

        {info?.ok && (
          <div className="overflow-hidden rounded-[24px] border border-line/80 bg-surface/90 shadow-[0_24px_60px_rgba(0,0,0,0.45)] backdrop-blur">
            <div className="flex items-center gap-2 border-b border-line/70 bg-raised/40 px-5 py-3">
              <ShieldCheck size={16} className="text-window" aria-hidden />
              <p className="text-[12px] font-bold text-text-2">
                Unique link · expires {new Date(info.expiresAt).toLocaleDateString()}
                {info.uploadCount > 0 ? ` · ${info.uploadCount} already sent` : ''}
              </p>
            </div>

            <div className="p-5">
              {doneNames ? (
                <div className="flex flex-col items-center gap-3 py-8 text-center">
                  <span className="grid size-14 place-items-center rounded-full bg-window-dim text-good">
                    <CheckCircle2 size={28} aria-hidden />
                  </span>
                  <p className="text-[18px] font-extrabold">Sent — thanks!</p>
                  <ul className="w-full max-w-sm space-y-1 text-left text-[13px] text-text-2">
                    {doneNames.map((n) => (
                      <li key={n} className="truncate rounded-lg bg-raised/50 px-3 py-1.5">
                        {n}
                      </li>
                    ))}
                  </ul>
                  <p className="max-w-sm text-[14px] leading-5 text-text-2">
                    Packet is reading these now and will email the student.
                  </p>
                  <button
                    type="button"
                    className="mt-2 rounded-full border border-line bg-raised px-4 py-2 text-[13px] font-bold hover:border-window"
                    onClick={() => setDoneNames(null)}
                  >
                    Upload more
                  </button>
                </div>
              ) : (
                <>
                  <label
                    className={`flex cursor-pointer flex-col items-center gap-3 rounded-[18px] border-2 border-dashed px-6 py-10 transition ${
                      dragOver
                        ? 'border-window bg-window-dim/40'
                        : 'border-line bg-raised/30 hover:border-window/70 hover:bg-raised/50'
                    } ${busy ? 'pointer-events-none opacity-70' : ''}`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOver(true);
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOver(false);
                      addFiles(e.dataTransfer.files);
                    }}
                  >
                    <span className="grid size-14 place-items-center rounded-2xl bg-ink text-window">
                      <FileUp size={28} aria-hidden />
                    </span>
                    <span className="text-[16px] font-bold">Drop files here, or browse</span>
                    <span className="text-center text-[13px] leading-5 text-text-3">
                      PDF, image, or text · max 8 MB each · up to 12 files
                    </span>
                    <input
                      type="file"
                      multiple
                      className="sr-only"
                      accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.md,.csv,application/pdf,image/*,text/plain"
                      disabled={busy}
                      onChange={(e) => {
                        addFiles(e.target.files);
                        e.target.value = '';
                      }}
                    />
                  </label>

                  {queue.length > 0 && (
                    <ul className="mt-4 space-y-2">
                      {queue.map((q) => (
                        <li
                          key={q.id}
                          className="flex items-center gap-3 rounded-xl border border-line bg-raised/40 px-3 py-2.5"
                        >
                          <span className="min-w-0 flex-1 truncate text-[13px] font-bold">
                            {q.file.name}
                          </span>
                          <span className="shrink-0 text-[11px] text-text-3">
                            {(q.file.size / 1024).toFixed(0)} KB
                          </span>
                          <button
                            type="button"
                            aria-label={`Remove ${q.file.name}`}
                            disabled={busy}
                            onClick={() => removeQueued(q.id)}
                            className="grid size-8 shrink-0 place-items-center rounded-full text-text-3 hover:bg-bad-bg hover:text-bad"
                          >
                            <Trash2 size={15} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="mt-5 flex items-center gap-2">
                    {queue.length > 0 && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setQueue([])}
                        className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line px-4 text-[13px] font-bold text-text-2 hover:bg-raised"
                      >
                        <X size={14} aria-hidden /> Clear
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={busy || queue.length === 0}
                      onClick={() => void submitAll()}
                      className="ml-auto inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full bg-window px-5 text-[14px] font-extrabold text-ink disabled:opacity-40"
                    >
                      {busy ? (
                        <>
                          <Loader2 className="size-4 animate-spin" aria-hidden /> Sending…
                        </>
                      ) : (
                        <>Submit {queue.length || ''} file{queue.length === 1 ? '' : 's'}</>
                      )}
                    </button>
                  </div>
                </>
              )}

              {error && (
                <p className="mt-4 rounded-xl border border-bad/40 bg-bad-bg px-3 py-2.5 text-[13px] text-bad">
                  {error}
                </p>
              )}
            </div>
          </div>
        )}

        <p className="mt-8 text-center text-[12px] leading-5 text-text-3">
          Powered by how.zingg · AI housing assistant for students
        </p>
      </div>
    </main>
  );
}
