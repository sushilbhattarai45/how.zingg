import { describe, expect, it } from 'vitest';
import {
  realtyDocRequestBody,
  realtyDocRequestSubject,
  studentCallBody,
  studentCallSubject,
  studentDocReceivedBody,
  studentDocReceivedSubject,
} from '@/lib/notifyEmail';

describe('notifyEmail builders', () => {
  it('builds answered-call subject and bullet body without inventing rent', () => {
    const input = {
      placeTitle: 'Oak Hollow',
      status: 'done',
      facts: ['Rent is about $650/month.', 'They accept I-20 without SSN.'],
    };
    expect(studentCallSubject(input)).toBe(
      'how.zingg: Oak Hollow — rent & answers from the office',
    );
    const body = studentCallBody(input);
    expect(body).toMatch(/Oak Hollow/);
    expect(body).toMatch(/\$650/);
    expect(body).toMatch(/I-20/);
    expect(body).toMatch(/full transcript/i);
  });

  it('builds missed-call subject', () => {
    const input = { placeTitle: 'Pine Row', status: 'failed', missed: true, facts: [] };
    expect(studentCallSubject(input)).toMatch(/^Missed: no answer from Pine Row/);
    expect(studentCallBody(input)).toMatch(/couldn't reach Pine Row/i);
  });

  it('builds realty upload-request email with the unique link', () => {
    expect(realtyDocRequestSubject('Magnolia Court')).toMatch(/Magnolia Court/);
    const body = realtyDocRequestBody({
      placeTitle: 'Magnolia Court',
      studentLabel: 'a how.zingg student',
      uploadUrl: 'http://localhost:3000/office/upload/abc123',
    });
    expect(body).toContain('http://localhost:3000/office/upload/abc123');
    expect(body).toMatch(/upload/i);
  });

  it('builds student document-received email', () => {
    expect(studentDocReceivedSubject('Cedar Flats')).toBe(
      'how.zingg: new document received from Cedar Flats',
    );
    const body = studentDocReceivedBody({
      placeTitle: 'Cedar Flats',
      fileName: 'fees.pdf',
      summary: 'Fee sheet for 2027.',
      keypoints: ['Admin fee $50', 'Deposit due at lease'],
    });
    expect(body).toMatch(/fees\.pdf/);
    expect(body).toMatch(/Admin fee/);
  });
});
