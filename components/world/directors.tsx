'use client';

/**
 * Directors decide where each bot should be. They write store.drive[id] every frame;
 * <Bot> eases toward it. Landing: everything is a pure function of scroll progress
 * (so scrubbing works both ways). App: looping routines along the nav graph.
 */
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useWorldStore } from './WorldContext';
import { BOT_IDS, type BotId } from './store';
import { LINEUP } from './layout';
import {
  BOT_ORDER,
  NODES,
  STATIONS,
  along,
  landingRoute,
  nearestNode,
  polyline,
  routePoints,
  type ClipName,
  type NavNodeId,
} from './navGraph';
import { BEATS } from '@/content/beats';

const FACE_CAMERA = (35 * Math.PI) / 180; // lineup faces the landing camera (azimuth ~35°)

export function LandingDirector() {
  const store = useWorldStore();
  const routes = useMemo(() => Object.fromEntries(BOT_IDS.map((id) => [id, landingRoute(id)])), []);

  useFrame(() => {
    const p = store.get().scrollProgress;
    const [ws, we] = BEATS['to-work'];
    for (const id of BOT_IDS) {
      const i = BOT_ORDER.indexOf(id);
      const d = store.drive[id];
      const route = routes[id]!;
      const station = STATIONS[id];

      if (p < ws) {
        // Lined up outside the leasing office.
        const [x, z] = LINEUP[i]!;
        d.x = x;
        d.z = z;
        d.face = FACE_CAMERA;
        const waving = p >= BEATS.team[0];
        d.clip = waving ? 'wave' : 'idle';
        // During "Ask", Concierge steps forward and gestures toward the door.
        if (id === 'concierge' && p >= BEATS.ask[0]) {
          d.x = x + 0.6;
          d.z = z - 0.6;
          d.face = Math.PI * 0.85;
          d.clip = 'chat';
        }
      } else if (p < we) {
        // Walk in line (Concierge leads), scrubbed by scroll.
        const k = (p - ws) / (we - ws);
        const local = Math.min(1, Math.max(0, (k - i * 0.07) / 0.72));
        const at = along(route, local * route.length);
        d.x = at.x;
        d.z = at.z;
        d.face = local >= 1 ? station.face : at.heading;
        d.clip = local >= 1 ? station.clip : 'idle';
      } else {
        const [x, z] = NODES[station.node];
        d.x = x;
        d.z = z;
        d.face = station.face;
        d.clip = station.clip;
        if (p >= BEATS.booked[0]) d.clip = id === 'closer' ? 'key' : 'celebrate';
      }
    }
  });
  return null;
}

/* ───────────── App routines ───────────── */

type Stop = { node: NavNodeId; wait: number; clip: ClipName; face: number };

const S = (node: NavNodeId, wait: number, clip: ClipName, face: number): Stop => ({ node, wait, clip, face });

const ROUTINES: Record<BotId, Stop[]> = {
  caller: [
    S('caller_desk', 4.5, 'work_desk', Math.PI),
    S('office_pace', 3, 'phone', Math.PI * 0.6),
    S('office_c', 3, 'phone', 0.4),
  ],
  scout: [S('scout_easel', 4, 'pin', -Math.PI / 2 + 0.3), S('scout_laptop', 4, 'read', Math.PI)],
  packet: [S('printer', 4, 'print', Math.PI), S('stamp', 4, 'stamp', -Math.PI / 2)],
  closer: [
    S('door', 4, 'key', Math.PI),
    S('bedroom_drop', 3, 'carry', Math.PI * 0.25),
    S('door', 3, 'key', Math.PI),
  ],
  concierge: [
    S('couch', 5, 'chat', Math.PI / 2),
    S('stove', 3, 'idle', Math.PI),
    S('hall_c', 3, 'chat', -Math.PI / 2),
    S('office_c', 3, 'chat', Math.PI),
  ],
};

const SPEED = 1.6; // m/s

type Ctl = { stop: number; waiting: number; route: ReturnType<typeof polyline> | null; s: number };

export function AppDirector() {
  const store = useWorldStore();
  const ctl = useRef<Record<BotId, Ctl> | null>(null);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    if (!ctl.current) {
      // Start everyone at their first stop.
      ctl.current = Object.fromEntries(
        BOT_IDS.map((id) => {
          const first = ROUTINES[id][0]!;
          const [x, z] = NODES[first.node];
          Object.assign(store.drive[id], { x, z, face: first.face, clip: first.clip });
          return [id, { stop: 0, waiting: first.wait * (0.5 + Math.random() * 0.5), route: null, s: 0 }];
        }),
      ) as Record<BotId, Ctl>;
    }
    for (const id of BOT_IDS) {
      const c = ctl.current[id];
      const d = store.drive[id];
      const stops = ROUTINES[id];
      if (c.route) {
        c.s += SPEED * dt;
        const at = along(c.route, c.s);
        d.x = at.x;
        d.z = at.z;
        d.face = at.heading;
        d.clip = 'walk';
        if (c.s >= c.route.length) {
          const stop = stops[c.stop]!;
          c.route = null;
          c.waiting = stop.wait;
          d.face = stop.face;
          d.clip = stop.clip;
        }
      } else {
        c.waiting -= dt;
        if (c.waiting <= 0) {
          c.stop = (c.stop + 1) % stops.length;
          const next = stops[c.stop]!;
          const from = nearestNode(d.x, d.z);
          const pts = routePoints(from, next.node);
          if (pts.length > 1) {
            c.route = polyline([[d.x, d.z], ...pts.slice(1)]);
            c.s = 0;
          } else {
            c.waiting = next.wait;
            d.clip = next.clip;
            d.face = next.face;
          }
        }
      }
    }
  });
  return null;
}
