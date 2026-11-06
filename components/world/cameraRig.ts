/** Camera math for the world. Pure (no three.js) so it's unit-testable. */

export type Vec3 = [number, number, number];

export type CameraPose = {
  target: Vec3;
  azimuth: number; // degrees, around +y; 0 = looking from +z, 90 = from +x
  elevation: number; // degrees above the ground plane
  zoom: number; // multiplier of the base fit
};

export type Keyframe = CameraPose & { at: number };

/** Landing keyframes (BUILD_PROMPT §7.2). */
export const LANDING_KEYFRAMES: Keyframe[] = [
  { at: 0.0, target: [4, 0.9, 3], azimuth: 45, elevation: 52, zoom: 0.85 },
  { at: 0.12, target: [2, 0.9, 2], azimuth: 40, elevation: 44, zoom: 1.0 },
  { at: 0.22, target: [15, 0.6, 8], azimuth: 35, elevation: 34, zoom: 2.1 },
  { at: 0.38, target: [16.5, 1.0, 8.5], azimuth: 30, elevation: 30, zoom: 2.6 },
  { at: 0.5, target: [8, 0.6, 9], azimuth: 40, elevation: 38, zoom: 1.5 },
  { at: 0.64, target: [-6.5, 0.9, -3.5], azimuth: 45, elevation: 42, zoom: 2.2 },
  { at: 0.7, target: [-1, 0.9, 1], azimuth: 45, elevation: 42, zoom: 2.2 },
  { at: 0.76, target: [4, 0.9, -4.5], azimuth: 45, elevation: 42, zoom: 2.2 },
  { at: 0.82, target: [6, 0.9, 2.5], azimuth: 45, elevation: 40, zoom: 2.1 },
  { at: 0.9, target: [-1, 0.9, -5], azimuth: 45, elevation: 40, zoom: 2.0 },
  { at: 1.0, target: [4, 0.9, 3], azimuth: 45, elevation: 46, zoom: 1.0 },
];

export type FocusTarget = 'all' | 'leasing' | 'office' | 'kitchen' | 'living' | 'bedroom' | 'hall';

/** App camera presets for room chips and `focus()`. */
export const FOCUS_POSES: Record<FocusTarget, CameraPose> = {
  all: { target: [4.5, 0.5, 4], azimuth: 45, elevation: 38, zoom: 0.92 },
  office: { target: [-6.5, 0.9, -3.5], azimuth: 45, elevation: 42, zoom: 2.2 },
  bedroom: { target: [-6.5, 0.9, 3.5], azimuth: 45, elevation: 42, zoom: 2.2 },
  hall: { target: [-1, 0.9, 0], azimuth: 45, elevation: 42, zoom: 2.2 },
  kitchen: { target: [5.5, 0.9, -4], azimuth: 45, elevation: 42, zoom: 2.1 },
  living: { target: [5.5, 0.9, 3], azimuth: 45, elevation: 40, zoom: 2.1 },
  leasing: { target: [16.5, 1.0, 7.5], azimuth: 35, elevation: 34, zoom: 2.3 },
};

export const APP_LIMITS = { azimuth: [10, 80], elevation: [25, 60], zoom: [0.8, 3.5] } as const;

export const smoothstep = (t: number) => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function lerpPose(a: CameraPose, b: CameraPose, t: number): CameraPose {
  return {
    target: [lerp(a.target[0], b.target[0], t), lerp(a.target[1], b.target[1], t), lerp(a.target[2], b.target[2], t)],
    azimuth: lerp(a.azimuth, b.azimuth, t),
    elevation: lerp(a.elevation, b.elevation, t),
    zoom: lerp(a.zoom, b.zoom, t),
  };
}

/** Pose at scroll progress p (0..1), smoothstep-interpolated between keyframes. */
export function poseAt(p: number, keyframes: Keyframe[] = LANDING_KEYFRAMES): CameraPose {
  const first = keyframes[0]!;
  const last = keyframes[keyframes.length - 1]!;
  if (p <= first.at) return first;
  if (p >= last.at) return last;
  for (let i = 0; i < keyframes.length - 1; i++) {
    const a = keyframes[i]!;
    const b = keyframes[i + 1]!;
    if (p >= a.at && p <= b.at) return lerpPose(a, b, smoothstep((p - a.at) / (b.at - a.at)));
  }
  return last;
}

/** Nearest keyframe at or before p — used for reduced-motion "cuts". */
export function keyframeIndexAt(p: number, keyframes: Keyframe[] = LANDING_KEYFRAMES): number {
  let idx = 0;
  for (let i = 0; i < keyframes.length; i++) if (p >= keyframes[i]!.at - 1e-6) idx = i;
  return idx;
}

/** Camera position for a pose, `distance` meters from the target. */
export function cameraPosition(pose: CameraPose, distance = 60): Vec3 {
  const az = (pose.azimuth * Math.PI) / 180;
  const el = (pose.elevation * Math.PI) / 180;
  return [
    pose.target[0] + distance * Math.cos(el) * Math.sin(az),
    pose.target[1] + distance * Math.sin(el),
    pose.target[2] + distance * Math.cos(el) * Math.cos(az),
  ];
}

/** Pixels per meter at zoom 1, so the whole apartment fits the viewport. */
export function baseFit(width: number, height: number): number {
  return Math.min(width / 30, height / 21);
}

export const clamp = (v: number, [lo, hi]: readonly [number, number]) => Math.min(hi, Math.max(lo, v));
