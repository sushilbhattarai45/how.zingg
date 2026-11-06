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
export type BotDrive = {
  x: number;
  z: number;
  face: number;
  clip: ClipName;
  showRole: boolean;
  /** Lines the bot says in a speech bubble, cycling with gaps. null = quiet. */
  say: readonly string[] | null;
  /** Sitting: an office chair (rendered with the bot) or the street bench. */
  seat: 'none' | 'chair' | 'bench';
  /** Turn toward the camera instead of `face`. */
  faceCamera: boolean;
};

export const DRIVE_DEFAULTS = { showRole: false, say: null, seat: 'none', faceCamera: false } as const;

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
    BOT_IDS.map((id, i) => [id, { x: 14.6 + i, z: 9.8, face: 0.6, clip: 'idle', ...DRIVE_DEFAULTS }]),
  ) as Record<BotId, BotDrive>;
  /** One bot talks at a time (see SpeechDirector). Mutable, read per frame. */
  const speech = { id: null as BotId | null, line: '', start: 0, until: 0 };
  /** Lines that jump the speech queue (a bot you clicked introducing itself). */
  const speechQueue: { id: BotId; line: string; dur: number }[] = [];
  /**
   * Clicked bots: when the poke started (world clock seconds). While poked a bot stops, turns to
   * you, smiles and waves. -1 = not poked; Infinity start = "poke on the next frame".
   */
  const pokes = Object.fromEntries(BOT_IDS.map((id) => [id, -1])) as Record<BotId, number>;
  /** Whether each bot's head is on screen this frame (written by <Bot>). */
  const onScreen = Object.fromEntries(BOT_IDS.map((id) => [id, false])) as Record<BotId, boolean>;
  /** Whether each bot is walking this frame (written by <Bot>); walking bots don't chat. */
  const moving = Object.fromEntries(BOT_IDS.map((id) => [id, false])) as Record<BotId, boolean>;
  const listeners = new Set<Listener>();
  const pickListeners = new Set<(hit: PickHit) => void>();

  return {
    drive,
    speech,
    speechQueue,
    pokes,
    onScreen,
    moving,
    /** Ask a bot to say hi: it smiles, waves and says what it's doing. */
    poke(id: BotId) {
      pokes[id] = Infinity;
    },
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
