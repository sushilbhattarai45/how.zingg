'use node';

/**
 * Node action: read an office-uploaded file with Gemini (context-aware), email the student.
 */
import { v } from 'convex/values';
import { internalAction } from './_generated/server';
import { internal } from './_generated/api';
import { getNotifyEmail } from '../lib/services/email';
import { getLlm } from '../lib/services/llm';
import { geminiApiKey, geminiReadDocument } from '../lib/services/llm/gemini';
import {
  studentDocReceivedBody,
  studentDocReceivedSubject,
  studentNotifyTo,
} from '../lib/notifyEmail';

const MAX_BYTES = 8 * 1024 * 1024;

function parseExtractResponse(text: string): { summary: string; keypoints: string[] } {
  const summaryMatch = text.match(/SUMMARY:\s*(.+)/i);
  const summary = (summaryMatch?.[1] ?? text.split('\n').find((l) => l.trim()) ?? 'Document received.')
    .trim()
    .slice(0, 280);
  const keypoints: string[] = [];
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*[-•]\s*(.+)/);
    if (m?.[1]) keypoints.push(m[1].trim().slice(0, 160));
  }
  return { summary, keypoints };
}

export const extractOfficeDocument = internalAction({
  args: { documentId: v.id('documents') },
  handler: async (ctx, { documentId }) => {
    const doc = await ctx.runQuery(internal.documents.getDocument, { documentId });
    if (!doc || !doc.fileId) return;

    const blob = await ctx.storage.get(doc.fileId);
    if (!blob) {
      await ctx.runMutation(internal.documents.patchDocument, {
        documentId,
        status: 'needs_review',
        summary: 'File missing from storage.',
      });
      return;
    }

    const buf = new Uint8Array(await blob.arrayBuffer());
    if (buf.byteLength > MAX_BYTES) {
      await ctx.runMutation(internal.documents.patchDocument, {
        documentId,
        status: 'needs_review',
        summary: 'File too large to read automatically.',
      });
      return;
    }

    let wantedUnit = 'the unit the student is interested in';
    let placeTitle = doc.placeTitle ?? 'the office';
    if (doc.interestId) {
      const interest = await ctx.runQuery(internal.documents.getInterestBrief, {
        interestId: doc.interestId,
      });
      if (interest) {
        wantedUnit = interest.unitType;
        placeTitle = interest.placeTitle;
      }
    }

    const contentType = doc.contentType ?? blob.type ?? 'application/octet-stream';
    let rawText = '';
    if (contentType.startsWith('text/') || /\.(txt|md|csv)$/i.test(doc.fileName ?? '')) {
      rawText = new TextDecoder().decode(buf).slice(0, 40_000);
    }

    const system = [
      'You are Packet for how.zingg. Extract housing facts for an international student.',
      `They care about: ${wantedUnit} at ${placeTitle}.`,
      'ONLY extract facts that apply to that unit type (or building-wide rules like no-SSN / parking that apply to everyone).',
      'If the document has other floor plans (e.g. 4 bed when they want 2 bed), SKIP those details — do not list their rent or square footage.',
      'Never invent dollar amounts that are not in the document. Be concise.',
      'Reply with:\nSUMMARY: one sentence focused on their unit\nthen up to 6 lines starting with "- " of relevant facts only.',
    ].join(' ');

    const prompt = rawText
      ? `Filename: ${doc.fileName ?? 'document'}\nWanted unit: ${wantedUnit}\n\nDocument text:\n${rawText}`
      : `Filename: ${doc.fileName ?? 'document'}\nWanted unit: ${wantedUnit}\nMIME: ${contentType}\nSize: ${buf.byteLength} bytes\nRead the attached file. Focus only on ${wantedUnit}. Describe layout, baths, sq ft, rent/fees if shown.`;

    let summary = '';
    const extracted: Record<string, string> = {};
    let keypoints: string[] = [];

    try {
      let text: string;
      if (geminiApiKey()) {
        text = await geminiReadDocument({
          system,
          prompt,
          bytes: rawText ? undefined : buf,
          mediaType: contentType,
          fileName: doc.fileName,
          tier: 'agent',
        });
        // If we had raw text, still send it via complete path above by including in prompt only.
        if (rawText && (!text || text.length < 20)) {
          text = await getLlm().complete({
            promptId: 'office-doc-extract',
            system,
            prompt,
            tier: 'fast',
          });
        }
      } else {
        text = await getLlm().complete({
          promptId: 'office-doc-extract',
          system,
          prompt: rawText
            ? prompt
            : `${prompt}\n\n(No Gemini key — cannot OCR PDF. Summarize filename only and ask student to re-upload after setting GEMINI_API_KEY.)`,
          tier: 'fast',
        });
      }

      const parsed = parseExtractResponse(text);
      summary = parsed.summary;
      keypoints = parsed.keypoints;
      keypoints.forEach((fact, i) => {
        extracted[`fact${i + 1}`] = fact;
      });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      console.warn('[documentsExtract.extractOfficeDocument]', detail);
      summary = `Could not read ${doc.fileName ?? 'the document'} yet (${detail.slice(0, 120)}). Ask “explain the document” to retry, or re-upload.`;
    }

    if (!summary) {
      summary = `Received ${doc.fileName ?? 'a document'} — facts for ${wantedUnit}.`;
    }
    extracted.summary = summary;
    extracted.wantedUnit = wantedUnit;

    await ctx.runMutation(internal.documents.patchDocument, {
      documentId,
      status: keypoints.length ? 'read' : 'needs_review',
      summary,
      extracted,
    });

    const placeSlug = doc.placeSlug ?? 'place';
    const fileName = doc.fileName ?? 'document';
    const bullets =
      keypoints.length > 0
        ? keypoints.slice(0, 6).map((k) => `• ${k}`)
        : [`• ${summary}`];
    const noteText = [
      `I read ${fileName} for your ${wantedUnit}:`,
      ...bullets,
      '• Tap the document card to open the file.',
    ].join('\n');

    await ctx.runMutation(internal.documents.appendDocThreadMessage, {
      userId: doc.userId,
      placeSlug,
      message: {
        id: `note-doc-${documentId}`,
        from: 'packet',
        text: noteText,
        at: Date.now(),
      },
    });

    const subject = studentDocReceivedSubject(placeTitle);
    const body = studentDocReceivedBody({
      placeTitle,
      fileName,
      summary,
      keypoints: keypoints.slice(0, 6),
    });
    try {
      await getNotifyEmail().send({
        to: studentNotifyTo(),
        subject,
        body,
        text: body,
        threadId: `doc-${documentId}`,
        campaign: 'how.zingg-doc-received',
      });
    } catch (err) {
      console.warn('[documentsExtract] student email failed', err);
    }

    await ctx.runMutation(internal.notify.insertEmailRow, {
      userId: doc.userId,
      officeId: doc.officeId,
      subject,
      body,
      threadId: `doc-${documentId}`,
      kind: 'student_doc_received',
      summary,
      placeSlug,
      placeTitle,
      reason: `new document received (${fileName})`,
    });
  },
});
