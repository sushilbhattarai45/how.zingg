import { describe, expect, it } from 'vitest';
import {
  shortestPath,
  routePoints,
  landingRoute,
  along,
  polyline,
  floorY,
  STATIONS,
  NODES,
} from '@/components/world/navGraph';
import { GROUND_Y } from '@/components/world/layout';

describe('nav graph', () => {
  it('finds the shortest path from the front to the office desk', () => {
    expect(shortestPath('front_in', 'caller_desk')).toEqual([
      'front_in',
      'hall_s',
      'bed_door',
      'bedroom_c',
      'office_bed_gap',
      'office_c',
      'caller_desk',
    ]);
  });
  it('connects every station to the front door', () => {
    for (const s of Object.values(STATIONS))
      expect(shortestPath('front_in', s.node).length).toBeGreaterThan(1);
  });
  it('connects the leasing office to the apartment', () => {
    expect(routePoints('leasing_out', 'couch').length).toBeGreaterThan(5);
  });
  it('walks a landing route from the lineup to each station', () => {
    const r = landingRoute('packet');
    const end = along(r, r.length);
    expect(end.x).toBeCloseTo(NODES.printer[0]);
    expect(end.z).toBeCloseTo(NODES.printer[1]);
    expect(r.length).toBeGreaterThan(20);
  });
  it('interpolates along a polyline', () => {
    const pl = polyline([
      [0, 0],
      [0, 10],
      [10, 10],
    ]);
    expect(along(pl, 5)).toMatchObject({ x: 0, z: 5 });
    expect(along(pl, 15).x).toBeCloseTo(5);
  });
  it('steps down outside the apartment', () => {
    expect(floorY(0, 0)).toBe(0);
    expect(floorY(-1, 9)).toBeCloseTo(GROUND_Y);
    expect(floorY(20, 5)).toBe(GROUND_Y);
  });
});
