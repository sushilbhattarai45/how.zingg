'use client';

import { useRef, useState } from 'react';
import { useAction, useMutation, useQuery } from 'convex/react';
import { FileUp, Loader2, Mail, Trash2, Upload, X } from 'lucide-react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { getGuestKey } from '@/lib/guestKey';
import { STUDENT_DOC_KINDS, kindLabel, type StudentDocKind } from '@/lib/studentPacket';

type Props = {
  open: boolean;
  onClose: () => void;
  placeSlug?: string;
  placeTitle?: string;
  onShared?: (message: string) => void;
};

/**
 * Student packet manager: upload / replace / delete docs, then email a 5-day
 * private view link to the leasing office.
 */
export function StudentPacketPanel({ open, onClose, placeSlug, placeTitle, onShared }: Props) {
  const guestKey = typeof window !== 'undefined' ? getGuestKey() : undefined;
  const docs = useQuery(api.packet.listStudentDocuments, guestKey ? { guestKey } : 'skip');
  const profile = useQuery(api.packet.getMyProfile, guestKey ? { guestKey } : 'skip');
  const generateUrl = useMutation(api.packet.generateStudentUploadUrl);
  const receive = useMutation(api.packet.receiveStudentDocument);
  const remove = useMutation(api.packet.deleteStudentDocument);
  const share = useAction(api.packet.sharePacketWithOffice);

  const fileRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<StudentDocKind>('passport');
  const [replaceId, setReplaceId] = useState<Id<'documents'> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  if (!open) return null;

  async function onPickFile(file: File | null) {
    if (!file || busy) return;
    setError(null);
    setOkMsg(null);
    if (file.size > 8 * 1024 * 1024) {
      setError('Max file size is 8 MB.');
      return;
    }
    setBusy(true);
    try {
      const uploadUrl = await generateUrl({ guestKey: getGuestKey() });
      const res = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      });
      if (!res.ok) throw new Error('Upload failed');
      const { storageId } = (await res.json()) as { storageId: Id<'_storage'> };
      await receive({
        guestKey: getGuestKey(),
        storageId,
        fileName: file.name,
        contentType: file.type || undefined,
        kind,
        replaceDocumentId: replaceId ?? undefined,
      });
      setReplaceId(null);
      setOkMsg(replaceId ? 'Document replaced.' : 'Document added.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function onDelete(documentId: Id<'documents'>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await remove({ guestKey: getGuestKey(), documentId });
      setOkMsg('Document removed.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete.');
    } finally {
      setBusy(false);
    }
  }

  async function onShare() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setOkMsg(null);
    try {
      const res = await share({
        guestKey: getGuestKey(),
        placeSlug,
        placeTitle,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const when = new Date(res.expiresAt).toLocaleDateString();
      const msg = `Private packet link emailed to the leasing office — expires ${when}.`;
      setOkMsg(msg);
      onShared?.(msg);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Share failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-ink/70 backdrop-blur-sm"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-[81] flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-[24px] border border-line bg-surface shadow-2xl sm:rounded-[24px]">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <p className="text-[12px] font-bold tracking-wide text-window uppercase">Your packet</p>
            <h2 className="text-[20px] font-extrabold">
              {placeTitle ? `Docs for ${placeTitle}` : 'Application documents'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-10 place-items-center rounded-full border border-line hover:bg-raised"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {(profile?.name || profile?.homeCountry || profile?.arrivalDate) && (
            <div className="rounded-2xl border border-line/80 bg-raised/40 px-4 py-3 text-[13px] leading-5 text-text-2">
              <p className="font-bold text-chalk">{profile.name ?? 'Student'}</p>
              <p>
                {[
                  profile.homeCountry && `From ${profile.homeCountry}`,
                  profile.arrivalDate && `Move-in ${profile.arrivalDate}`,
                  profile.hasSSN === false && 'No SSN',
                  profile.hasSSN === true && 'Has SSN',
                  profile.budgetMax != null && `Budget ≤ $${profile.budgetMax}`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              <p className="mt-1 text-[12px] text-text-3">Update details on the home page anytime.</p>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-[12px] font-bold text-text-2">Uploaded files</p>
            {docs === undefined && (
              <p className="flex items-center gap-2 text-[13px] text-text-3">
                <Loader2 className="size-4 animate-spin" /> Loading…
              </p>
            )}
            {docs && docs.length === 0 && (
              <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-[13px] text-text-3">
                No documents yet — add passport, I-20, visa, or funding letter.
              </p>
            )}
            <ul className="space-y-2">
              {docs?.map((d) => (
                <li
                  key={d.documentId}
                  className="flex items-center gap-3 rounded-xl border border-line bg-raised/30 px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-bold">{d.fileName}</p>
                    <p className="text-[11px] text-text-3">{kindLabel(d.kind)}</p>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    className="rounded-full border border-line px-2.5 py-1 text-[11px] font-bold hover:border-window"
                    onClick={() => {
                      setKind(d.kind as StudentDocKind);
                      setReplaceId(d.documentId);
                      fileRef.current?.click();
                    }}
                  >
                    Replace
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    className="grid size-9 place-items-center rounded-full border border-line text-bad hover:bg-bad-bg"
                    aria-label="Delete"
                    onClick={() => void onDelete(d.documentId)}
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-2 rounded-2xl border border-line/80 bg-ink/30 p-4">
            <p className="text-[12px] font-bold text-text-2">
              {replaceId ? 'Replace with new file' : 'Add a document'}
            </p>
            <label className="grid gap-1">
              <span className="text-[11px] font-bold text-text-3">Type</span>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as StudentDocKind)}
                className="h-11 rounded-full border border-line bg-raised px-4 text-[14px] font-semibold"
              >
                {STUDENT_DOC_KINDS.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.label}
                  </option>
                ))}
              </select>
            </label>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,image/*,.png,.jpg,.jpeg,.webp"
              className="hidden"
              onChange={(e) => void onPickFile(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (!replaceId) setReplaceId(null);
                fileRef.current?.click();
              }}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-window/50 bg-window-dim text-[14px] font-bold text-good hover:bg-window/20 disabled:opacity-60"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload size={16} />}
              {replaceId ? 'Choose replacement file' : 'Choose file'}
            </button>
            {replaceId && (
              <button
                type="button"
                className="w-full text-center text-[12px] font-bold text-text-3 underline"
                onClick={() => setReplaceId(null)}
              >
                Cancel replace
              </button>
            )}
          </div>

          {error && <p className="text-[13px] font-semibold text-bad">{error}</p>}
          {okMsg && <p className="text-[13px] font-semibold text-good">{okMsg}</p>}
        </div>

        <div className="space-y-2 border-t border-line px-5 py-4">
          <button
            type="button"
            disabled={busy || !docs?.length}
            onClick={() => void onShare()}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-window text-[15px] font-extrabold text-ink disabled:opacity-50"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Mail size={16} />}
            Email private link to leasing office
          </button>
          <p className="text-center text-[11px] leading-4 text-text-3">
            <FileUp className="mr-1 inline size-3" aria-hidden />
            Unique link · expires in 5 days · office can view your docs only
          </p>
        </div>
      </div>
    </div>
  );
}
