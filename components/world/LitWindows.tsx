'use client';

/**
 * Lit windows (brand motif). Each target has its own emissive material; panes glow green when
 * an agent works in that room or an offer is ready. Intensity eases toward the target each frame.
 */
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useWorldStore } from './WorldContext';
import { WINDOW_TARGETS, type WindowTarget } from './store';
import { Box, GEO, PALETTE } from './parts';

const OFF = new THREE.Color('#2b3a33');
const GLOW = new THREE.Color(PALETTE.green);
const LIT_BASE = new THREE.Color(PALETTE.green);

const windowMats: Record<WindowTarget, THREE.MeshStandardMaterial> = Object.fromEntries(
  WINDOW_TARGETS.map((t) => [
    t,
    new THREE.MeshStandardMaterial({
      color: OFF.clone(),
      emissive: GLOW,
      emissiveIntensity: 0,
      roughness: 0.4,
      toneMapped: false,
    }),
  ]),
) as Record<WindowTarget, THREE.MeshStandardMaterial>;

const level: Record<WindowTarget, number> = Object.fromEntries(WINDOW_TARGETS.map((t) => [t, 0])) as Record<
  WindowTarget,
  number
>;

export function windowMaterial(target: WindowTarget) {
  return windowMats[target];
}

/** Drives every window material from the store. Mount once inside the Canvas. */
export function WindowDriver() {
  const store = useWorldStore();
  useFrame((_, dt) => {
    const { windows, reducedMotion } = store.get();
    for (const t of WINDOW_TARGETS) {
      const want = windows[t] ? 1 : 0;
      const speed = reducedMotion ? 1 : Math.min(1, dt * 5);
      level[t] += (want - level[t]) * speed;
      const m = windowMats[t];
      m.emissiveIntensity = level[t] * 0.55;
      m.color.copy(OFF).lerp(LIT_BASE, level[t]);
    }
  });
  return null;
}

/**
 * A 2×2 window on a wall. `normal` is the direction the window faces (out of the wall);
 * the window is centered at `p` and sized w×h.
 */
export function WallWindow({
  p,
  w = 1.6,
  h = 1.2,
  facing,
  target,
}: {
  p: [number, number, number];
  w?: number;
  h?: number;
  facing: '+x' | '-x' | '+z' | '-z';
  target: WindowTarget;
}) {
  const rotY = facing === '+z' ? 0 : facing === '-z' ? Math.PI : facing === '+x' ? Math.PI / 2 : -Math.PI / 2;
  const frame = 0.08;
  const gap = 0.06;
  const pw = (w - frame * 2 - gap) / 2;
  const ph = (h - frame * 2 - gap) / 2;
  const m = windowMats[target];
  return (
    <group position={p} rotation={[0, rotY, 0]}>
      <Box p={[0, 0, 0]} s={[w, h, 0.06]} color={PALETTE.chalk} shadow={false} />
      {[
        [-1, 1],
        [1, 1],
        [-1, -1],
        [1, -1],
      ].map(([sx, sy], i) => (
        <mesh
          key={i}
          geometry={GEO.box}
          material={m}
          position={[(sx! * (pw + gap)) / 2, (sy! * (ph + gap)) / 2, 0.035]}
          scale={[pw, ph, 0.02]}
        />
      ))}
    </group>
  );
}
