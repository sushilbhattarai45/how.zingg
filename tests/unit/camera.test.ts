import { describe, expect, it } from 'vitest';
import {
  LANDING_KEYFRAMES,
  poseAt,
  smoothstep,
  cameraPosition,
  keyframeIndexAt,
} from '@/components/world/cameraRig';

describe('camera keyframes', () => {
  it('returns exact keyframes at their progress', () => {
    for (const k of LANDING_KEYFRAMES) {
      const p = poseAt(k.at);
      expect(p.zoom).toBeCloseTo(k.zoom);
      expect(p.target[0]).toBeCloseTo(k.target[0]);
    }
  });
  it('clamps outside 0..1', () => {
    expect(poseAt(-1).zoom).toBe(LANDING_KEYFRAMES[0]!.zoom);
    expect(poseAt(2).zoom).toBe(LANDING_KEYFRAMES.at(-1)!.zoom);
  });
  it('interpolates with smoothstep between keyframes', () => {
    const mid = poseAt(0.08); // halfway between 0 and 0.16
    expect(smoothstep(0.5)).toBe(0.5);
    const [a, b] = [LANDING_KEYFRAMES[0]!.zoom, LANDING_KEYFRAMES[1]!.zoom];
    expect(mid.zoom).toBeCloseTo((a + b) / 2);
    const early = poseAt(0.04); // quarter → smoothstep(0.25) = 0.15625
    expect(early.zoom).toBeCloseTo(a + (b - a) * 0.15625);
  });
  it('is monotonic in keyframe order', () => {
    for (let i = 1; i < LANDING_KEYFRAMES.length; i++) {
      expect(LANDING_KEYFRAMES[i]!.at).toBeGreaterThan(LANDING_KEYFRAMES[i - 1]!.at);
    }
  });
  it('finds the keyframe for reduced-motion cuts', () => {
    expect(keyframeIndexAt(0)).toBe(0);
    expect(keyframeIndexAt(0.3)).toBe(1);
    expect(keyframeIndexAt(1)).toBe(LANDING_KEYFRAMES.length - 1);
  });
  it('places the camera above and in front of the target at azimuth 45°', () => {
    const [x, y, z] = cameraPosition({ target: [0, 0, 0], azimuth: 45, elevation: 30, zoom: 1 }, 10);
    expect(y).toBeCloseTo(5);
    expect(x).toBeCloseTo(z);
    expect(x).toBeGreaterThan(0);
  });
});
