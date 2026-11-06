/** Scam patterns (BUILD_PROMPT §2.6). Pure so Scout, the seed and tests share it. */

export type ScamFlag =
  'wire_transfer' | 'gift_card' | 'crypto' | 'pay_before_tour' | 'below_market' | 'reused_photos';

export const SCAM_REASONS: Record<ScamFlag, string> = {
  wire_transfer: 'asked for a wire transfer',
  gift_card: 'asked for gift cards',
  crypto: 'asked for crypto',
  pay_before_tour: 'asked for money before a tour',
  below_market: 'rent far below nearby listings',
  reused_photos: 'photos copied from another listing',
};

const PATTERNS: [ScamFlag, RegExp][] = [
  ['wire_transfer', /\b(wire|western union|moneygram|zelle (the )?deposit)\b/i],
  ['gift_card', /\bgift ?cards?\b/i],
  ['crypto', /\b(crypto|bitcoin|btc|usdt|ethereum)\b/i],
  [
    'pay_before_tour',
    /\b(no tours?|before (a |the )?(tour|viewing|showing)|owner is (overseas|abroad|out of (the )?country)|hold it today)\b/i,
  ],
];

export function scamCheck(input: {
  rent: number;
  text?: string;
  /** Median rent of comparable units nearby; below 60% of it is flagged. */
  marketRent?: number;
  photoHashesSeenElsewhere?: boolean;
}): ScamFlag[] {
  const flags = new Set<ScamFlag>();
  const text = input.text ?? '';
  for (const [flag, re] of PATTERNS) if (re.test(text)) flags.add(flag);
  if (input.marketRent && input.rent < input.marketRent * 0.6) flags.add('below_market');
  if (input.photoHashesSeenElsewhere) flags.add('reused_photos');
  return [...flags];
}

/** A listing is hidden when it asks for untraceable money, or is far below market AND has another flag. */
export function shouldHide(flags: ScamFlag[]): boolean {
  const money = flags.some(
    (f) => f === 'wire_transfer' || f === 'gift_card' || f === 'crypto' || f === 'pay_before_tour',
  );
  return money || flags.length >= 2;
}

export function scamReason(flags: ScamFlag[]): string {
  const first = flags[0];
  return first ? SCAM_REASONS[first] : '';
}
