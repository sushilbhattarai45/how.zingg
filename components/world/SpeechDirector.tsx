'use client';

/**
 * Speech bubbles take turns: one bot talks at a time, then a quiet pause, so bubbles never overlap
 * and the scene stays calm. Only bots that are on screen and have something to say get a turn.
 * A bot facing you (Concierge greeting) gets every other turn. A bot you click jumps the line
 * (store.speechQueue) and interrupts whoever is talking.
 */
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useWorldStore } from './WorldContext';
import { BOT_IDS, type BotId } from './store';

export const SPEECH = { show: 3.6, gap: 2.4 } as const;

type Queued = { id: BotId; line: string; dur: number };

export function SpeechDirector() {
  const store = useWorldStore();
  const st = useRef({
    next: 1.2,
    turn: 0,
    last: null as BotId | null,
    count: {} as Partial<Record<BotId, number>>,
    playing: null as Queued | null,
  });

  useFrame(({ clock }) => {
    const now = clock.elapsedTime;
    const sp = store.speech;
    const s = st.current;
    const say = (id: BotId, line: string, dur: number) =>
      Object.assign(sp, { id, line, start: now, until: now + dur });

    // ── Queued lines (clicked bots) first
    if (s.playing && now >= sp.until) s.playing = null;
    if (!s.playing && store.speechQueue.length) {
      const q = store.speechQueue.shift()!;
      s.playing = q;
      s.last = q.id;
      say(q.id, q.line, q.dur);
      s.next = now + q.dur + (store.speechQueue.length ? 0 : SPEECH.gap);
      return;
    }
    if (s.playing) return;

    // Cut a line short if its bot stopped talking (started walking, went off screen).
    if (
      sp.id &&
      now < sp.until &&
      (!store.drive[sp.id].say || !store.onScreen[sp.id] || store.moving[sp.id])
    ) {
      sp.until = now;
      s.next = Math.min(s.next, now + SPEECH.gap);
    }
    if (now < s.next) return;

    // ── Ambient turn-taking
    const ready = BOT_IDS.filter(
      (id) => store.onScreen[id] && !store.moving[id] && store.drive[id].say?.length,
    );
    if (!ready.length) {
      sp.id = null;
      s.next = now + 0.5;
      return;
    }
    const greeter = ready.find((id) => store.drive[id].faceCamera);
    let pick: BotId;
    if (greeter && s.last !== greeter) pick = greeter;
    else {
      const others = ready.filter((id) => id !== s.last);
      const pool = others.length ? others : ready;
      pick = pool[s.turn++ % pool.length]!;
    }
    const lines = store.drive[pick].say!;
    const n = s.count[pick] ?? 0;
    s.count[pick] = n + 1;
    s.last = pick;
    say(pick, lines[n % lines.length]!, SPEECH.show);
    s.next = now + SPEECH.show + SPEECH.gap;
  });
  return null;
}
