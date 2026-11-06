'use client';

/**
 * Directors decide where each bot should be. They write store.drive[id] every frame;
 * <Bot> eases toward it, so directors can be simple.
 *
 * Landing: the beat (where you are in the story) is a pure function of scroll progress, so
 * scrubbing works both ways. Inside a beat, small ambient loops (pacing, talking) run on the clock.
 * App: looping routines along the nav graph; Concierge follows you to the leasing office.
 */
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useWorldStore } from './WorldContext';
import { BOT_IDS, DRIVE_DEFAULTS, type BotDrive, type BotId } from './store';
import { LEASING_GREET, OUTDOOR } from './layout';
import {
  LINES,
  POKE_SECONDS,
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

type P = [number, number];

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Back-and-forth walk between a and b with a pause at each end. Pure function of time. */
export function pingPong(a: P, b: P, t: number, speed = 1.1, pause = 1.8) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const leg = len / speed;
  const period = 2 * (leg + pause);
  const u = ((t % period) + period) % period;
  let k: number;
  let dir: 1 | -1;
  let moving = true;
  if (u < leg) [k, dir] = [u / leg, 1];
  else if (u < leg + pause) [k, dir, moving] = [1, 1, false];
  else if (u < 2 * leg + pause) [k, dir] = [1 - (u - leg - pause) / leg, -1];
  else [k, dir, moving] = [0, -1, false];
  const heading = Math.atan2((b[0] - a[0]) * dir, (b[1] - a[1]) * dir);
  return { x: a[0] + (b[0] - a[0]) * k, z: a[1] + (b[1] - a[1]) * k, heading, moving };
}

function set(d: BotDrive, patch: Partial<BotDrive>) {
  Object.assign(d, DRIVE_DEFAULTS, patch);
}

/** Per-bot clock offset so ambient loops don't line up. */
const OFFSET: Record<BotId, number> = { concierge: 0, scout: 1.3, caller: 2.1, packet: 3.7, closer: 0.6 };

/** Hanging out on the block, each doing their own thing (hero, problem, team, ask). */
function outdoors(id: BotId, d: BotDrive, t: number) {
  const spot = OUTDOOR[id];
  const lines = LINES[id].out;
  switch (id) {
    case 'concierge':
      set(d, { x: spot.at[0], z: spot.at[1], clip: 'greet', faceCamera: true, say: lines });
      return;
    case 'caller':
      // Laid back on the bench, on the phone.
      set(d, { x: spot.at[0], z: spot.at[1], face: -0.1, clip: 'sit_call', seat: 'bench', say: lines });
      return;
    default: {
      const to = 'to' in spot ? spot.to : spot.at;
      const w = pingPong(spot.at, to, t + OFFSET[id]);
      const clip: ClipName = id === 'packet' ? 'carry' : 'talk';
      set(d, { x: w.x, z: w.z, face: w.heading, clip, say: lines });
    }
  }
}

/** At their station inside, working. */
function atStation(id: BotId, d: BotDrive, t: number) {
  const st = STATIONS[id];
  const [x, z] = NODES[st.node];
  if (st.paceTo) {
    const w = pingPong([x, z], NODES[st.paceTo], t + OFFSET[id], 0.9, 2.2);
    set(d, { x: w.x, z: w.z, face: w.moving ? w.heading : st.face, clip: st.clip, say: LINES[id].work });
    return;
  }
  set(d, { x, z, face: st.face, clip: st.clip, seat: st.seat ?? 'none', say: LINES[id].work });
}

const WALKERS: BotId[] = ['scout', 'caller', 'packet', 'closer'];
const ROUTES = Object.fromEntries(BOT_IDS.map((id) => [id, landingRoute(id)])) as Record<
  BotId,
  ReturnType<typeof landingRoute>
>;
const TO_LEASING = polyline([OUTDOOR.concierge.at, [10, 10.4], LEASING_GREET]);
const CONCIERGE_HOME = polyline([LEASING_GREET, ...routePoints('leasing_out', 'couch')]);
/** Concierge strolls from the leasing office to the couch while the camera tours the rooms. */
const CONCIERGE_WALK: [number, number] = [BEATS.rooms[0], BEATS.couch[0] - 0.01];

export function LandingDirector() {
  const store = useWorldStore();

  useFrame(({ clock }) => {
    const p = store.get().scrollProgress;
    const t = clock.elapsedTime;
    const [ws, we] = BEATS['to-work'];
    const booked = p >= BEATS.booked[0];

    for (const id of BOT_IDS) {
      const d = store.drive[id];

      if (id === 'concierge') {
        const [as, ae] = BEATS.ask;
        if (p < as) outdoors(id, d, t);
        else if (p < CONCIERGE_WALK[0]) {
          // Walks over to the leasing office and waits for you there.
          const k = clamp01((p - as) / ((ae - as) * 0.4));
          const at = along(TO_LEASING, k * TO_LEASING.length);
          const there = k >= 1;
          set(d, {
            x: at.x,
            z: at.z,
            face: at.heading,
            clip: there ? 'greet' : 'walk',
            faceCamera: there,
            say: there ? ['What can I help you find?', 'Tap the office to ask me.'] : null,
          });
        } else if (p < CONCIERGE_WALK[1]) {
          const k = clamp01((p - CONCIERGE_WALK[0]) / (CONCIERGE_WALK[1] - CONCIERGE_WALK[0]));
          const at = along(CONCIERGE_HOME, k * CONCIERGE_HOME.length);
          set(d, { x: at.x, z: at.z, face: at.heading, clip: k >= 1 ? 'chat' : 'walk' });
        } else if (booked) {
          const [x, z] = NODES.couch;
          set(d, { x, z, face: STATIONS.concierge.face, clip: 'celebrate', say: ['Booked! Welcome home.'] });
        } else atStation(id, d, t);
        continue;
      }

      if (p < ws) outdoors(id, d, t);
      else if (p < we) {
        // Walk in, one after another, scrubbed by scroll.
        const j = WALKERS.indexOf(id);
        const k = (p - ws) / (we - ws);
        const local = clamp01((k - j * 0.08) / 0.62);
        if (local >= 1) atStation(id, d, t);
        else {
          const route = ROUTES[id];
          const at = along(route, local * route.length);
          set(d, {
            x: at.x,
            z: at.z,
            face: at.heading,
            clip: id === 'closer' ? 'talk' : id === 'packet' ? 'carry' : 'walk',
            say: id === 'closer' ? LINES.closer.out : null,
          });
        }
      } else if (booked) {
        const st = STATIONS[id];
        const [x, z] = NODES[st.node];
        set(d, { x, z, face: st.face, clip: id === 'closer' ? 'key' : 'celebrate' });
      } else atStation(id, d, t);
    }
  });
  return null;
}

/* ───────────── App routines ───────────── */

type Stop = {
  node: NavNodeId;
  wait: number;
  clip: ClipName;
  face: number;
  seat?: 'chair';
  /** Clip while walking to this stop (default 'walk'). */
  walk?: ClipName;
};

const S = (node: NavNodeId, wait: number, clip: ClipName, face: number, extra: Partial<Stop> = {}): Stop => ({
  node,
  wait,
  clip,
  face,
  ...extra,
});

const ROUTINES: Record<BotId, Stop[]> = {
  // Caller lives in the swivel chair.
  caller: [S('caller_desk', 60, 'sit_call', STATIONS.caller.face, { seat: 'chair' })],
  scout: [
    S('scout_easel', 5, 'pin', -Math.PI / 2 + 0.3),
    S('scout_laptop', 5, 'read', Math.PI),
    S('hall_c', 3, 'talk', Math.PI / 2, { walk: 'talk' }),
  ],
  packet: [
    S('packet_desk', 8, 'work_desk', 0, { seat: 'chair' }),
    S('printer', 3.5, 'print', Math.PI),
    S('stamp', 3, 'stamp', -Math.PI / 2, { walk: 'carry' }),
  ],
  closer: [
    S('door', 4, 'talk', Math.PI, { walk: 'talk' }),
    S('hall_n', 3, 'talk', Math.PI / 2, { walk: 'talk' }),
    S('door', 3, 'key', Math.PI, { walk: 'talk' }),
    S('living_c', 3, 'talk', 0.8, { walk: 'talk' }),
  ],
  concierge: [
    S('couch', 6, 'chat', Math.PI / 2),
    S('stove', 3, 'idle', Math.PI),
    S('hall_c', 3, 'chat', -Math.PI / 2),
    S('office_c', 3, 'chat', Math.PI),
  ],
};

const GREET_STOP: Stop = S('leasing_out', Infinity, 'greet', 0);

const SPEED = 1.6; // m/s

type Ctl = {
  stop: number;
  waiting: number;
  route: ReturnType<typeof polyline> | null;
  s: number;
  /** Stop being walked to or held (a routine stop, or the leasing greet). */
  target: Stop;
};

function headTo(c: Ctl, d: BotDrive, stop: Stop) {
  c.target = stop;
  const pts = routePoints(nearestNode(d.x, d.z), stop.node);
  if (pts.length > 1) {
    c.route = polyline([[d.x, d.z], ...pts.slice(1)]);
    c.s = 0;
  } else {
    c.route = null;
    c.waiting = stop.wait;
  }
}

export function AppDirector() {
  const store = useWorldStore();
  const ctl = useRef<Record<BotId, Ctl> | null>(null);
  const atLeasing = useRef(false);

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const now = clock.elapsedTime;
    if (!ctl.current) {
      ctl.current = Object.fromEntries(
        BOT_IDS.map((id) => {
          const first = ROUTINES[id][0]!;
          const [x, z] = NODES[first.node];
          set(store.drive[id], { x, z, face: first.face, clip: first.clip });
          return [
            id,
            { stop: 0, waiting: first.wait * (0.5 + Math.random() * 0.5), route: null, s: 0, target: first },
          ];
        }),
      ) as Record<BotId, Ctl>;
    }

    // Concierge follows you to the leasing office, and back.
    const wantLeasing = store.get().focus === 'leasing';
    if (wantLeasing !== atLeasing.current) {
      atLeasing.current = wantLeasing;
      const c = ctl.current.concierge;
      if (wantLeasing) headTo(c, store.drive.concierge, GREET_STOP);
      else {
        c.route = null;
        c.waiting = 0;
      }
    }

    for (const id of BOT_IDS) {
      // A bot you clicked holds still while it says hi.
      if (store.pokes[id] >= 0 && now - store.pokes[id] < POKE_SECONDS) continue;
      const c = ctl.current[id];
      const d = store.drive[id];
      const stops = ROUTINES[id];
      const lines =
        id === 'concierge' && c.target === GREET_STOP ? ['What can I help you find?'] : LINES[id].work;
      if (c.route) {
        c.s += SPEED * dt;
        const at = along(c.route, c.s);
        set(d, {
          x: at.x,
          z: at.z,
          face: at.heading,
          clip: c.target.walk ?? 'walk',
          say: c.target.walk ? lines : null,
        });
        if (c.s >= c.route.length) {
          c.route = null;
          c.waiting = c.target.wait;
        }
        continue;
      }
      const stop = c.target;
      set(d, {
        x: d.x,
        z: d.z,
        face: stop.face,
        clip: stop.clip,
        seat: stop.seat ?? 'none',
        faceCamera: stop === GREET_STOP,
        say: lines,
      });
      c.waiting -= dt;
      if (c.waiting <= 0) {
        c.stop = (c.stop + 1) % stops.length;
        headTo(c, d, stops[c.stop]!);
      }
    }
  });
  return null;
}
