import { describe, expect, it } from 'vitest';
import { formatDual, isOpen, nextOpening, describeHours, zonedToUtc } from '@/lib/time';

const CT = 'America/Chicago';
const KTM = 'Asia/Kathmandu';
const weekdays = [1, 2, 3, 4, 5].map((day) => ({ day, open: '09:00', close: '17:00' }));

describe('formatDual', () => {
  it('formats office time with the user time (summer, CDT)', () => {
    expect(formatDual(Date.parse('2027-07-15T14:00:00Z'), CT, KTM)).toBe('9:00 AM CT (7:45 PM your time)');
  });
  it('handles winter (CST) correctly', () => {
    expect(formatDual(Date.parse('2027-01-14T15:00:00Z'), CT, KTM)).toBe('9:00 AM CT (8:45 PM your time)');
  });
  it('drops the second time when zones match', () => {
    expect(formatDual(Date.parse('2027-07-15T14:00:00Z'), CT, CT)).toBe('9:00 AM CT');
  });
});

describe('office hours', () => {
  it('is open at 9:02 AM CT on a Wednesday', () => {
    expect(isOpen(weekdays, CT, Date.parse('2027-07-14T14:02:00Z'))).toBe(true);
  });
  it('is closed at 8:59 AM and at 5:00 PM', () => {
    expect(isOpen(weekdays, CT, Date.parse('2027-07-14T13:59:00Z'))).toBe(false);
    expect(isOpen(weekdays, CT, Date.parse('2027-07-14T22:00:00Z'))).toBe(false);
  });
  it('is closed on Saturday', () => {
    expect(isOpen(weekdays, CT, Date.parse('2027-07-17T15:00:00Z'))).toBe(false);
  });
  it('finds the next opening across a weekend', () => {
    const fri6pm = Date.parse('2027-07-16T23:00:00Z');
    expect(new Date(nextOpening(weekdays, CT, fri6pm)!).toISOString()).toBe('2027-07-19T14:00:00.000Z');
  });
  it('finds the next opening across the DST change (fall back, Nov 7 2027)', () => {
    const fri6pm = Date.parse('2027-11-05T23:00:00Z'); // CDT
    // Monday Nov 8 9:00 AM is CST (UTC-6) → 15:00Z
    expect(new Date(nextOpening(weekdays, CT, fri6pm)!).toISOString()).toBe('2027-11-08T15:00:00.000Z');
  });
  it('finds the next opening across spring forward (Mar 14 2027)', () => {
    const fri6pm = Date.parse('2027-03-13T00:00:00Z'); // Fri Mar 12 6 PM CST
    expect(new Date(nextOpening(weekdays, CT, fri6pm)!).toISOString()).toBe('2027-03-15T14:00:00.000Z');
  });
  it('returns null with no hours', () => {
    expect(nextOpening([], CT, Date.now())).toBeNull();
  });
  it('converts wall clock to UTC', () => {
    expect(zonedToUtc(2027, 7, 14, 9, 2, CT)).toBe(Date.parse('2027-07-14T14:02:00Z'));
  });
  it('describes hours', () => {
    expect(describeHours(weekdays)).toBe('Mon–Fri 9:00 AM–5:00 PM');
  });
});
