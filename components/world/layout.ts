/** World layout constants (meters, y up). BUILD_PROMPT §6.1 */
import type { Vec3 } from './cameraRig';

export const GROUND_Y = -0.42;
export const WALL_H = 3.3;
export const INNER_WALL_H = 1.5;

export const STREET = { z: 16.5, width: 5, sidewalkZ: 13.4 };

/** Paved path from the apartment's open front to the leasing office door. */
export const PATH_POINTS: [number, number][] = [
  [-1, 7.4],
  [-1, 10.2],
  [5, 11.2],
  [11, 10.6],
  [15.6, 9.4],
  [16.6, 8.2],
];

export const LEASING = { center: [17.5, 5.6] as [number, number], w: 5, d: 4, h: 2.6 };
export const LEASING_DOOR: [number, number] = [16.6, 7.6];

export const ROOMS = {
  office: { x: [-10, -3], z: [-7, 0] },
  bedroom: { x: [-10, -3], z: [0, 7] },
  hall: { x: [-3, 1], z: [-7, 7] },
  kitchen: { x: [1, 10], z: [-7, -1] },
  living: { x: [1, 10], z: [-1, 7] },
} as const;

/** Bot lineup in front of the leasing office (Beat 3). */
export const LINEUP: [number, number][] = [
  [14.6, 9.6],
  [15.6, 10.0],
  [16.6, 10.2],
  [17.6, 10.0],
  [18.6, 9.6],
];

export const TREES: [number, number, number][] = [
  // [x, z, scale]
  [-14, -9, 1.2],
  [-13.5, 4, 1.0],
  [-12.5, 11, 1.1],
  [-4, -11, 1.0],
  [8, -10.5, 1.3],
  [13.5, -6, 1.1],
  [13, 1.5, 0.9],
  [22.5, 2.5, 1.2],
  [23, 9.5, 1.0],
  [3, 13.2, 0.9],
  [-7.5, 12.6, 1.0],
  [14, 12.4, 0.8],
  [26, -4, 1.1],
  [-18, -2, 1.2],
];

export const TREES_LOW = TREES.filter((_, i) => i % 2 === 0);

export const STREET_LAMPS: [number, number][] = [
  [-4, 12.6],
  [9, 12.6],
];

export const BENCH: Vec3 = [8, 0, 12.3];
