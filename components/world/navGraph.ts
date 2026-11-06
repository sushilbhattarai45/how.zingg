/**
 * Waypoint graph the bots walk on (BUILD_PROMPT §6.4). Edges are straight segments that were
 * laid out to avoid furniture and walls; bots only ever move along them.
 */
import { GROUND_Y, LINEUP } from './layout';
import type { BotId } from './store';

export type NavNodeId = keyof typeof NODES;
type P = [number, number]; // [x, z]

export const NODES = {
  // Hall
  door: [-1, -5.9],
  hall_n: [-1, -3.0],
  hall_c: [-1, 0.0],
  hall_s: [-1, 5.0],
  front_in: [-1, 6.6],
  scout_easel: [-1.6, 1.2],
  scout_laptop: [-0.2, 3.4],
  // Office
  office_door: [-3, -2.7],
  office_c: [-5.5, -3.2],
  caller_desk: [-4.9, -5.5],
  office_pace: [-7.8, -2.2],
  office_bed_gap: [-5.6, 0],
  // Bedroom
  bed_door: [-3, 2.3],
  bedroom_c: [-5.8, 2.6],
  bedroom_drop: [-4.6, 5.0],
  // Kitchen
  kitchen_door: [1, -2.8],
  kitchen_c: [2.6, -2.4],
  k_lane_w: [2.4, -5.0],
  stove: [3.3, -5.5],
  printer: [7.4, -5.4],
  k_lane_s: [6.9, -2.2],
  stamp: [7.0, -3.9],
  // Living
  living_door: [1, 3.0],
  living_c: [3.4, 3.2],
  couch: [4.0, 2.1],
  // Outside, along the path
  front_out: [-1, 8.4],
  path_1: [-1, 10.2],
  path_2: [5, 11.2],
  path_3: [11, 10.6],
  path_4: [15.6, 9.4],
  leasing_out: [16.6, 8.6],
} satisfies Record<string, P>;

const EDGES: [NavNodeId, NavNodeId][] = [
  ['front_out', 'front_in'],
  ['front_in', 'hall_s'],
  ['hall_s', 'hall_c'],
  ['hall_c', 'hall_n'],
  ['hall_n', 'door'],
  ['hall_c', 'scout_easel'],
  ['hall_s', 'scout_laptop'],
  ['hall_n', 'office_door'],
  ['office_door', 'office_c'],
  ['office_c', 'caller_desk'],
  ['office_c', 'office_pace'],
  ['office_c', 'office_bed_gap'],
  ['office_bed_gap', 'bedroom_c'],
  ['hall_s', 'bed_door'],
  ['bed_door', 'bedroom_c'],
  ['bedroom_c', 'bedroom_drop'],
  ['hall_n', 'kitchen_door'],
  ['kitchen_door', 'kitchen_c'],
  ['kitchen_c', 'k_lane_w'],
  ['k_lane_w', 'stove'],
  ['stove', 'printer'],
  ['kitchen_c', 'k_lane_s'],
  ['k_lane_s', 'stamp'],
  ['hall_s', 'living_door'],
  ['living_door', 'living_c'],
  ['living_c', 'couch'],
  ['kitchen_c', 'living_c'],
  ['front_out', 'path_1'],
  ['path_1', 'path_2'],
  ['path_2', 'path_3'],
  ['path_3', 'path_4'],
  ['path_4', 'leasing_out'],
];

const ADJ: Record<string, { to: NavNodeId; d: number }[]> = {};
for (const [a, b] of EDGES) {
  const d = dist(NODES[a], NODES[b]);
  (ADJ[a] ??= []).push({ to: b, d });
  (ADJ[b] ??= []).push({ to: a, d });
}

export function dist(a: P, b: P) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

/** Shortest node path (Dijkstra). Returns [] if unreachable. */
export function shortestPath(from: NavNodeId, to: NavNodeId): NavNodeId[] {
  if (from === to) return [from];
  const best = new Map<NavNodeId, number>([[from, 0]]);
  const prev = new Map<NavNodeId, NavNodeId>();
  const open = new Set<NavNodeId>([from]);
  while (open.size) {
    let cur: NavNodeId | null = null;
    for (const n of open) if (cur === null || best.get(n)! < best.get(cur)!) cur = n;
    open.delete(cur!);
    if (cur === to) break;
    for (const { to: nb, d } of ADJ[cur!] ?? []) {
      const nd = best.get(cur!)! + d;
      if (nd < (best.get(nb) ?? Infinity)) {
        best.set(nb, nd);
        prev.set(nb, cur!);
        open.add(nb);
      }
    }
  }
  if (!prev.has(to)) return [];
  const path: NavNodeId[] = [to];
  while (path[0] !== from) path.unshift(prev.get(path[0]!)!);
  return path;
}

export function nearestNode(x: number, z: number): NavNodeId {
  let best: NavNodeId = 'hall_c';
  let bd = Infinity;
  for (const [id, p] of Object.entries(NODES) as [NavNodeId, P][]) {
    const d = dist(p, [x, z]);
    if (d < bd) {
      bd = d;
      best = id;
    }
  }
  return best;
}

export function routePoints(from: NavNodeId, to: NavNodeId): P[] {
  return shortestPath(from, to).map((n) => NODES[n]);
}

/** Floor height: 0 inside the apartment, ground level outside, with a short ramp at the open front. */
export function floorY(x: number, z: number): number {
  if (x < -10.1 || x > 10.1 || z < -7.1) return GROUND_Y;
  if (z <= 7.1) return 0;
  const k = Math.min(1, (z - 7.1) / 0.8);
  return k * GROUND_Y;
}

/* ───────────── Polylines ───────────── */

export type Polyline = { pts: P[]; cum: number[]; length: number };

export function polyline(pts: P[]): Polyline {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1]! + dist(pts[i - 1]!, pts[i]!));
  return { pts, cum, length: cum[cum.length - 1] ?? 0 };
}

/** Point at distance s along the polyline, plus the segment heading (radians, 0 = +z). */
export function along(pl: Polyline, s: number): { x: number; z: number; heading: number } {
  const { pts, cum } = pl;
  if (pts.length === 1 || s <= 0) {
    const a = pts[0]!;
    const b = pts[1] ?? a;
    return { x: a[0], z: a[1], heading: Math.atan2(b[0] - a[0], b[1] - a[1]) };
  }
  for (let i = 1; i < pts.length; i++) {
    if (s <= cum[i]! || i === pts.length - 1) {
      const a = pts[i - 1]!;
      const b = pts[i]!;
      const seg = cum[i]! - cum[i - 1]!;
      const t = seg > 0 ? Math.min(1, (s - cum[i - 1]!) / seg) : 1;
      return {
        x: a[0] + (b[0] - a[0]) * t,
        z: a[1] + (b[1] - a[1]) * t,
        heading: Math.atan2(b[0] - a[0], b[1] - a[1]),
      };
    }
  }
  const last = pts[pts.length - 1]!;
  return { x: last[0], z: last[1], heading: 0 };
}

/* ───────────── Stations ───────────── */

export type ClipName =
  | 'idle'
  | 'walk'
  | 'wave'
  | 'work_desk'
  | 'phone'
  | 'pin'
  | 'read'
  | 'print'
  | 'stamp'
  | 'carry'
  | 'key'
  | 'chat'
  | 'celebrate';

/** Where each bot works, which way it faces there (radians, 0 = +z), and its work clip. */
export const STATIONS: Record<BotId, { node: NavNodeId; face: number; clip: ClipName }> = {
  concierge: { node: 'couch', face: Math.PI / 2, clip: 'chat' },
  scout: { node: 'scout_easel', face: -Math.PI / 2 + 0.3, clip: 'pin' },
  caller: { node: 'caller_desk', face: Math.PI, clip: 'phone' },
  packet: { node: 'printer', face: Math.PI, clip: 'print' },
  closer: { node: 'door', face: Math.PI, clip: 'key' },
};

export const BOT_ORDER: BotId[] = ['concierge', 'scout', 'caller', 'packet', 'closer'];

/** Landing walk: lineup spot → path → front door → station. */
export function landingRoute(bot: BotId): Polyline {
  const i = BOT_ORDER.indexOf(bot);
  const start = LINEUP[i]!;
  const outside: P[] = [start, NODES.path_4, NODES.path_3, NODES.path_2, NODES.path_1, NODES.front_out];
  const inside = routePoints('front_in', STATIONS[bot].node);
  // Spread the five bots sideways a little on the path so they don't overlap.
  const off = (i - 2) * 0.22;
  const spread = outside.slice(1).map(([x, z]) => [x + off * 0.3, z + off] as P);
  return polyline([start, ...spread, ...inside]);
}
