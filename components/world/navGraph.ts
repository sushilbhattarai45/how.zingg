/**
 * Waypoint graph the bots walk on (BUILD_PROMPT §6.4). Edges are straight segments that were
 * laid out to avoid furniture and walls; bots only ever move along them.
 */
import { GROUND_Y, OUTDOOR } from './layout';
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
  caller_desk: [-5.8, -5.45],
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
  packet_desk: [8.4, -3.25],
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
  ['stamp', 'packet_desk'],
  ['k_lane_s', 'packet_desk'],
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
  | 'celebrate'
  /** Talking on the headset, hands gesturing (works while walking). */
  | 'talk'
  /** Leaning back in the chair with a desk phone handset. */
  | 'sit_call'
  /** One friendly wave, then talking with us. */
  | 'greet';

/** Where each bot works, which way it faces there (radians, 0 = +z), and its work clip. */
export type Station = { node: NavNodeId; face: number; clip: ClipName; seat?: 'chair'; paceTo?: NavNodeId };

export const STATIONS: Record<BotId, Station> = {
  concierge: { node: 'couch', face: Math.PI / 2, clip: 'chat' },
  scout: { node: 'scout_easel', face: -Math.PI / 2 + 0.3, clip: 'pin' },
  caller: { node: 'caller_desk', face: Math.PI * 0.55, clip: 'sit_call', seat: 'chair' },
  packet: { node: 'packet_desk', face: 0, clip: 'work_desk', seat: 'chair' },
  closer: { node: 'hall_n', face: Math.PI / 2, clip: 'talk', paceTo: 'door' },
};

/** What each bot says (speech bubbles). Short, honest, no live facts presented as real. */
export const LINES: Record<BotId, { out: readonly string[]; work: readonly string[] }> = {
  concierge: {
    out: ["Hi! I'm Concierge.", 'What can we help you find?'],
    work: ['Scout found 9 places.', 'Caller is on with Oak Hollow.', 'Packet is 3 of 4 done.'],
  },
  scout: {
    out: ['Mapping groceries near USM…', 'Checking the bus to campus…', 'Hid 1 scam listing.'],
    work: [
      'Pinning Walmart on the map.',
      'Walk time to campus: checking…',
      'That listing wants a wire. Hidden.',
    ],
  },
  caller: {
    out: ['Ring… ring…', "Hi, I'm an AI assistant calling for a student.", 'Can I schedule a call at 9 AM?'],
    work: [
      'Ring… ring…',
      "Hi, I'm an AI assistant calling for a student.",
      'Is the 1 bed free Aug 14?',
      'Do you accept an I-20 instead of SSN?',
    ],
  },
  packet: {
    out: ['I-20 read.', 'Funding letter checked.'],
    work: ['Packet 3 of 4…', 'Need a bank statement.', 'Renter packet ready soon.'],
  },
  closer: {
    out: ['Can you waive the app fee?', 'Two offers so far.'],
    work: ['Can you hold it until Aug 14?', 'Any move-in specials?', 'Lease draft on the way.'],
  },
};

export const BOT_ORDER: BotId[] = ['concierge', 'scout', 'caller', 'packet', 'closer'];

/** Landing walk: outdoor hangout spot → front walk → in the door → station. */
export function landingRoute(bot: BotId, from: P = OUTDOOR[bot].at): Polyline {
  const i = BOT_ORDER.indexOf(bot);
  const off = (i - 2) * 0.18;
  const inside = routePoints('front_in', STATIONS[bot].node);
  // Approach the door from the street side, a little spread out so bots don't overlap.
  const approach: P = [NODES.path_1[0] + off, NODES.path_1[1]];
  const outside: P[] = [from, approach, [NODES.front_out[0] + off * 0.5, NODES.front_out[1]]];
  return polyline([...outside, ...inside]);
}

/** Poke duration (seconds) and what each bot says when you click it, based on what it's doing. */
export const POKE_SECONDS = 6.4;

export function doingLine(bot: BotId, clip: ClipName, moving: boolean): string {
  if (clip === 'celebrate') return 'We did it. Your lease is confirmed!';
  if (moving && clip !== 'talk' && clip !== 'carry') {
    return bot === 'concierge' ? "I'm walking with you, ask me anything." : 'On my way to my desk!';
  }
  switch (bot) {
    case 'concierge':
      return clip === 'greet'
        ? 'I run the plan. What can I help you find?'
        : 'I keep the team on track and talk with you.';
    case 'scout':
      return clip === 'pin' || clip === 'read'
        ? "I'm mapping places near USM and hiding scams."
        : "I'm checking groceries, banks and the bus near campus.";
    case 'caller':
      return clip === 'sit_call' || clip === 'phone'
        ? "I'm calling leasing offices to ask about your unit."
        : 'I call offices during their hours. Always as an AI.';
    case 'packet':
      return clip === 'work_desk' || clip === 'print' || clip === 'stamp'
        ? "I'm building your renter packet. No SSN needed."
        : "I'm carrying your documents to the desk.";
    case 'closer':
      return clip === 'key'
        ? "I'm tracking your lease to the keys."
        : "I'm asking for specials and comparing offers.";
  }
}
