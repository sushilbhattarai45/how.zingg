'use client';

import { use, useMemo } from 'react';
import Link from 'next/link';
import { useQuery } from 'convex/react';
import { ArrowLeft, ExternalLink, FileText } from 'lucide-react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { getGuestKey } from '@/lib/guestKey';

/** In-app viewer for an office-uploaded document (PDF / image / text). */
export default function DocumentViewPage({
  params,
}: {
  params: Promise<{ documentId: string }>;
}) {
  const { documentId } = use(params);
  const guestKey = useMemo(() => getGuestKey(), []);
  const doc = useQuery(api.documents.getViewable, {
    documentId: documentId as Id<'documents'>,
    guestKey: guestKey || undefined,
  });

  const isPdf =
    !!doc?.contentType?.includes('pdf') || /\.pdf$/i.test(doc?.fileName ?? '');
  const isImage =
    !!doc?.contentType?.startsWith('image/') ||
    /\.(png|jpe?g|webp|gif)$/i.test(doc?.fileName ?? '');

  return (
    <main className="flex min-h-dvh flex-col bg-night text-chalk">
      <header className="flex items-center gap-3 border-b border-line bg-ink/80 px-4 py-3 backdrop-blur">
        <Link
          href="/app"
          className="grid size-9 place-items-center rounded-full bg-raised text-text-2 hover:text-chalk"
          aria-label="Back to app"
        >
          <ArrowLeft size={18} />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-bold">{doc?.fileName ?? 'Document'}</p>
          <p className="truncate text-[12px] text-text-3">
            {doc?.placeTitle ? `From ${doc.placeTitle}` : 'Office upload'}
            {doc?.summary ? ` · ${doc.summary}` : ''}
          </p>
        </div>
        {doc?.url && (
          <a
            href={doc.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full bg-raised px-3 py-1.5 text-[12px] font-bold text-text-2 hover:text-chalk"
          >
            Open <ExternalLink size={12} aria-hidden />
          </a>
        )}
      </header>

      <div className="flex flex-1 flex-col">
        {doc === undefined && (
          <p className="m-auto text-[15px] text-text-2">Loading document…</p>
        )}
        {doc === null && (
          <p className="m-auto max-w-sm px-4 text-center text-[15px] text-text-2">
            This document isn&apos;t available. It may belong to another session, or the link
            expired.
          </p>
        )}
        {doc && !doc.url && (
          <p className="m-auto text-[15px] text-text-2">File URL unavailable.</p>
        )}
        {doc?.url && isPdf && (
          <iframe
            title={doc.fileName}
            src={doc.url}
            className="h-[calc(100dvh-64px)] w-full border-0 bg-paper"
          />
        )}
        {doc?.url && isImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={doc.url}
            alt={doc.fileName}
            className="mx-auto max-h-[calc(100dvh-64px)] w-auto max-w-full object-contain p-4"
          />
        )}
        {doc?.url && !isPdf && !isImage && (
          <div className="m-auto flex max-w-md flex-col items-center gap-4 px-4 py-16 text-center">
            <span className="grid size-14 place-items-center rounded-2xl bg-raised text-packet">
              <FileText size={28} aria-hidden />
            </span>
            <p className="text-[16px] font-bold">{doc.fileName}</p>
            <p className="text-[14px] text-text-2">
              Preview isn&apos;t available for this file type. Open it in a new tab instead.
            </p>
            <a
              href={doc.url}
              target="_blank"
              rel="noreferrer"
              className="rounded-full bg-window px-5 py-2.5 text-[14px] font-bold text-ink"
            >
              Open file
            </a>
          </div>
        )}
      </div>
    </main>
  );
}
