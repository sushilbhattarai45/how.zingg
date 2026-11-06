/**
 * Mutable world state shared between React (UI) and the render loop.
 * Per-frame values are read in useFrame without re-rendering; UI subscribes for coarse changes.
 */
import type { CameraPose, FocusTarget } from './cameraRig';
import type { ClipName } from './navGraph';

export type BotId = 'concierge' | 'scout' | 'caller' | 'packet' | 'closer';
export const BOT_IDS: BotId[] = ['concierge', 'scout', 'caller', 'packet', 'closer'];

export type WindowTarget = 'office' | 'kitchen' | 'hall' | 'living' | 'bedroom' | 'leasing';
export const WINDOW_TARGETS: WindowTarget[] = ['office', 'kitchen', 'hall', 'living', 'bedroom', 'leasing'];

export type SceneName =
  'hero' | 'office-lineup' | 'walk-to-apartment' | 'apartment-working' | 'rooms-tour' | 'couch' | 'booked';

export type PickHit = { kind: 'bot'; id: BotId } | { kind: 'leasing' } | { kind: 'couch' } | { kind: 'door' };

export type WorldMode = 'landing' | 'app';

export type WorldState = {
  mode: WorldMode;
  scene: SceneName;
  scrollProgress: number;
  focus: FocusTarget;
  /** Scripted camera pose (overrides scroll/focus while set). */
  scriptedPose: CameraPose | null;
  windows: Record<WindowTarget, boolean>;
  /** Pulsing highlight on the leasing office door ("Tap to ask the team"). */
  officeGlow: boolean;
  doorLight: boolean;
  reducedMotion: boolean;
  quality: 'high' | 'low';
  paused: boolean;
};

/** Where a bot should be and what it should do. Written by a director every frame, read by <Bot>. */
export type BotDrive = { x: number; z: number; face: number; clip: ClipName; showRole: boolean };

type Listener = () => void;

export function createWorldStore(initial: Partial<WorldState> = {}) {
  let state: WorldState = {
    mode: 'app',
    scene: 'apartment-working',
    scrollProgress: 0,
    focus: 'all',
    scriptedPose: null,
    windows: { office: false, kitchen: false, hall: false, living: false, bedroom: false, leasing: false },
    officeGlow: false,
    doorLight: false,
    reducedMotion: false,
    quality: 'high',
    paused: false,
    ...initial,
  };
  const drive = Object.fromEntries(
    BOT_IDS.map((id, i) => [id, { x: 14.6 + i, z: 9.8, face: 0.6, clip: 'idle', showRole: false }]),
  ) as Record<BotId, BotDrive>;
  const listeners = new Set<Listener>();
  const pickListeners = new Set<(hit: PickHit) => void>();

  return {
    drive,
    get: () => state,
    set(patch: Partial<WorldState>) {
      state = { ...state, ...patch };
      listeners.forEach((l) => l());
    },
    setWindow(target: WindowTarget, on: boolean) {
      if (state.windows[target] === on) return;
      state = { ...state, windows: { ...state.windows, [target]: on } };
      listeners.forEach((l) => l());
    },
    subscribe(l: Listener) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    onPick(cb: (hit: PickHit) => void) {
      pickListeners.add(cb);
      return () => {
        pickListeners.delete(cb);
      };
    },
    emitPick(hit: PickHit) {
      pickListeners.forEach((cb) => cb(hit));
    },
  };
}

export type WorldStore = ReturnType<typeof createWorldStore>;
