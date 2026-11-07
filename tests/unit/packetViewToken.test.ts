import { describe, expect, it } from 'vitest';
import { PACKET_VIEW_TTL_MS } from '@/lib/studentPacket';
import { realtyPacketShareBody, realtyPacketShareSubject } from '@/lib/notifyEmail';

describe('packet view token', () => {
  it('expires after 5 days', () => {
    expect(PACKET_VIEW_TTL_MS).toBe(5 * 24 * 60 * 60 * 1000);
  });

  it('builds realty share email copy', () => {
    expect(realtyPacketShareSubject('Magnolia Court')).toMatch(/Magnolia Court/);
    const body = realtyPacketShareBody({
      studentLabel: 'Sushil',
      placeTitle: 'Magnolia Court',
      viewUrl: 'https://example.com/office/packet/abc',
      docCount: 2,
      expiresLabel: 'Nov 12, 2026',
    });
    expect(body).toMatch(/expires Nov 12/);
    expect(body).toMatch(/\/office\/packet\/abc/);
    expect(body).toMatch(/2 files/);
  });
});
