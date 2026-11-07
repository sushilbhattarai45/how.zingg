/**
 * Build student/realty notification subjects + bodies from call facts.
 * Pure helpers — safe for unit tests and Convex actions.
 */
import { envOrNull } from './services/mode';

export type NotifyCallInput = {
  placeTitle: string;
  status: 'done' | 'failed' | 'emailed' | string;
  missed?: boolean;
  facts: string[];
  uploadUrl?: string;
};

export function studentCallSubject(input: NotifyCallInput): string {
  if (input.missed || input.status === 'failed') {
    return `Missed: no answer from ${input.placeTitle}`;
  }
  return `how.zingg: ${input.placeTitle} — rent & answers from the office`;
}

export function studentCallBody(input: NotifyCallInput): string {
  if (input.missed || input.status === 'failed') {
    return [
      `Caller couldn't reach ${input.placeTitle}.`,
      '',
      'Nobody picked up (or the line failed). Open your list in how.zingg to retry or schedule a callback.',
      '',
      '— how.zingg',
    ].join('\n');
  }

  const bullets =
    input.facts.length > 0
      ? input.facts.map((f) => `• ${f}`).join('\n')
      : '• Call finished — open the app for the full transcript (keypoints still thin).';

  return [
    `Caller just talked to ${input.placeTitle}. Here's what we got:`,
    '',
    bullets,
    '',
    'Open your list in how.zingg for the full transcript.',
    '',
    '— how.zingg',
  ].join('\n');
}

export function realtyDocRequestSubject(placeTitle: string): string {
  return `how.zingg: please upload docs for ${placeTitle}`;
}

export function realtyDocRequestBody(args: {
  placeTitle: string;
  studentLabel: string;
  uploadUrl: string;
}): string {
  return [
    `Hi — an AI assistant from how.zingg just called about housing for ${args.studentLabel} at ${args.placeTitle}.`,
    '',
    'If you have a floor plan, application packet, or fee sheet to share, upload it here (unique link for this student):',
    '',
    args.uploadUrl,
    '',
    'The link expires in 7 days. Thanks!',
    '',
    '— how.zingg Caller',
  ].join('\n');
}

export function studentDocReceivedSubject(placeTitle: string): string {
  return `how.zingg: new document received from ${placeTitle}`;
}

export function studentDocReceivedBody(args: {
  placeTitle: string;
  fileName: string;
  summary: string;
  keypoints?: string[];
}): string {
  const bullets =
    args.keypoints && args.keypoints.length > 0
      ? args.keypoints.map((k) => `• ${k}`).join('\n')
      : `• ${args.summary}`;

  return [
    `New document received from ${args.placeTitle}.`,
    '',
    `File: ${args.fileName}`,
    '',
    'What Packet pulled out:',
    bullets,
    '',
    'Open your how.zingg chat for this place to view the file.',
    '',
    '— how.zingg',
  ].join('\n');
}

export function studentNotifyTo(): string {
  return envOrNull('STUDENT_NOTIFY_EMAIL') ?? 'sushilbhattarai2004@gmail.com';
}

export function realtyNotifyTo(): string {
  return envOrNull('REALTY_NOTIFY_EMAIL') ?? 'sushilbhattarai0054@gmail.com';
}

export function siteBaseUrl(): string {
  return envOrNull('NEXT_PUBLIC_SITE_URL') ?? 'http://localhost:3000';
}

export function realtyPacketShareSubject(placeTitle?: string): string {
  return placeTitle
    ? `how.zingg: student packet for ${placeTitle}`
    : 'how.zingg: student application packet';
}

export function realtyPacketShareBody(args: {
  studentLabel: string;
  placeTitle?: string;
  viewUrl: string;
  docCount: number;
  expiresLabel: string;
}): string {
  const about = args.placeTitle
    ? `interested in ${args.placeTitle}`
    : 'looking for housing near campus';
  return [
    `Hi — ${args.studentLabel} (${about}) shared their application documents via how.zingg.`,
    '',
    `Private link (${args.docCount} file${args.docCount === 1 ? '' : 's'}) — expires ${args.expiresLabel}:`,
    '',
    args.viewUrl,
    '',
    'This link is unique to this student. Do not forward it broadly.',
    '',
    '— how.zingg Packet',
  ].join('\n');
}
