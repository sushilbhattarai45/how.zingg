'use client';

/**
 * One of the five bots: chalk head with an ink face screen, glowing eyes and antenna in the agent
 * color, a colored body and round hands. Fully procedural; all animation is code-driven.
 * Reads its target from store.drive[id] and eases toward it, so directors can be simple.
 */
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { useWorldStore } from './WorldContext';
import { GEO, mat, PALETTE } from './parts';
import { floorY, type ClipName } from './navGraph';
import type { BotId } from './store';
import { isTap, setHoverCursor } from './pick';
import { nameTagTexture } from './canvasTextures';

type V3 = [number, number, number];
const TAU = Math.PI * 2;

const REST_L: V3 = [0.42, 0.5, 0.06];
const REST_R: V3 = [-0.42, 0.5, 0.06];

/** Stable 0..1 value per bot, so each one bobs and blinks out of step with the others. */
function seed(id: string) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 1000;
  return h / 1000;
}

function lerpAngle(a: number, b: number, t: number) {
  let d = ((b - a + Math.PI) % TAU) - Math.PI;
  if (d < -Math.PI) d += TAU;
  return a + d * t;
}

export function Bot({ id, name, color }: { id: BotId; name: string; color: string }) {
  const store = useWorldStore();
  const root = useRef<THREE.Group>(null);
  const bob = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const handL = useRef<THREE.Mesh>(null);
  const handR = useRef<THREE.Mesh>(null);
  const eyes = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const key = useRef<THREE.Group>(null);
  const paper = useRef<THREE.Mesh>(null);
  const phone = useRef<THREE.Mesh>(null);

  const glow = useMemo(() => new THREE.MeshBasicMaterial({ color, toneMapped: false }), [color]);
  const ringMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0,
        toneMapped: false,
        depthWrite: false,
      }),
    [color],
  );
  const body = mat(color, { roughness: 0.55 });
  const chalk = mat('#f7f5f0', { roughness: 0.45 });
  const ink = mat('#191719', { roughness: 0.3 });

  const s = useRef({
    init: false,
    x: 0,
    z: 0,
    face: 0,
    clip: 'idle' as ClipName,
    clipT: 0,
    nextBlink: 1 + seed(id) * 3,
    blinkT: -1,
    l: [...REST_L] as V3,
    r: [...REST_R] as V3,
    phase: seed(id) * 10,
  });

  const tag = useMemo(() => nameTagTexture(name, color), [name, color]);

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const st = s.current;
    const d = store.drive[id];
    const reduced = store.get().reducedMotion;
    if (!root.current || !bob.current || !head.current) return;

    // ── Position: ease toward the drive target (teleport on big jumps, e.g. a reset)
    let dx = d.x - st.x;
    let dz = d.z - st.z;
    if (!st.init || Math.hypot(dx, dz) > 8 || reduced) {
      st.x = d.x;
      st.z = d.z;
      st.face = d.face;
      st.init = true;
      dx = dz = 0;
    }
    const k = 1 - Math.exp(-dt * 6);
    st.x += dx * k;
    st.z += dz * k;
    const speed = (Math.hypot(dx, dz) * k) / Math.max(dt, 1e-3);
    const moving = speed > 0.4 && !reduced;

    const clip: ClipName = moving ? 'walk' : reduced ? 'idle' : d.clip;
    if (clip !== st.clip) {
      st.clip = clip;
      st.clipT = 0;
    }
    st.clipT += dt;

    const wantFace = moving ? Math.atan2(dx, dz) : d.face;
    st.face = lerpAngle(st.face, wantFace, 1 - Math.exp(-dt * 8));

    root.current.position.set(st.x, floorY(st.x, st.z), st.z);
    root.current.rotation.y = st.face;

    // ── Clip pose
    const g = state.clock.elapsedTime + st.phase;
    const t = st.clipT;
    let y = 0.05 * Math.sin(TAU * 0.35 * g);
    let roll = 0;
    let headTilt = 0;
    let squint = 1;
    const L: V3 = [...REST_L];
    const R: V3 = [...REST_R];
    let ringOn = false;
    let keyOn = false;
    let paperOn = false;
    let phoneOn = false;

    switch (clip) {
      case 'walk': {
        y = 0.08 * Math.abs(Math.sin(TAU * 1.4 * g));
        roll = 0.06 * Math.sin(TAU * 0.7 * g);
        const sw = 0.12 * Math.sin(TAU * 0.7 * g);
        L[2] += sw;
        R[2] -= sw;
        break;
      }
      case 'wave': {
        roll = 0.04 * Math.sin(TAU * 1.5 * t);
        R[0] = -0.5 + 0.12 * Math.sin(TAU * 3 * t);
        R[1] = 1.3;
        R[2] = 0.12;
        squint = Math.floor(t * 3) % 2 === 0 ? 0.6 : 1;
        break;
      }
      case 'work_desk': {
        L[0] = 0.22;
        R[0] = -0.22;
        L[1] = R[1] = 0.72;
        L[2] = R[2] = 0.4;
        L[1] += 0.05 * Math.max(0, Math.sin(TAU * 7 * t));
        R[1] += 0.05 * Math.max(0, Math.sin(TAU * 7 * t + Math.PI));
        headTilt = 0.15;
        break;
      }
      case 'phone': {
        R[0] = -0.5;
        R[1] = 1.18;
        R[2] = 0.05;
        ringOn = true;
        phoneOn = true;
        roll = 0.03 * Math.sin(TAU * 0.5 * t);
        break;
      }
      case 'pin': {
        const up = Math.max(0, Math.sin(TAU * 0.4 * t));
        R[0] = -0.25;
        R[1] = 0.6 + 0.75 * up;
        R[2] = 0.3 + 0.2 * up;
        headTilt = -0.1 * up;
        break;
      }
      case 'read': {
        L[0] = 0.2;
        R[0] = -0.2;
        L[1] = R[1] = 0.72;
        L[2] = R[2] = 0.38;
        headTilt = 0.18;
        roll = 0.05 * Math.sin(TAU * 0.25 * t);
        break;
      }
      case 'print':
      case 'stamp': {
        const v = 0.09 * Math.sin(TAU * 3 * t);
        L[0] = 0.2;
        R[0] = -0.2;
        L[1] = 0.78 + v;
        R[1] = 0.78 + (clip === 'stamp' ? v : -v);
        L[2] = R[2] = 0.38;
        paperOn = clip === 'print';
        break;
      }
      case 'carry': {
        L[0] = 0.26;
        R[0] = -0.26;
        L[1] = R[1] = 0.62;
        L[2] = R[2] = 0.42;
        break;
      }
      case 'key': {
        R[0] = -0.25;
        R[1] = 0.85;
        R[2] = 0.42;
        keyOn = true;
        break;
      }
      case 'chat': {
        R[0] = -0.46;
        R[1] = 0.82 + 0.12 * Math.sin(TAU * 1.2 * t);
        R[2] = 0.25;
        roll = 0.05 * Math.sin(TAU * 0.6 * t);
        headTilt = 0.06 * Math.sin(TAU * 0.4 * t);
        break;
      }
      case 'celebrate': {
        y = 0.25 * Math.abs(Math.sin(TAU * 1.1 * t));
        L[0] = 0.48;
        R[0] = -0.48;
        L[1] = R[1] = 1.35;
        L[2] = R[2] = 0;
        squint = 0.6;
        break;
      }
    }

    bob.current.position.y = y;
    bob.current.rotation.z = roll;
    head.current.rotation.x = headTilt;

    // Hands ease toward their pose
    const hk = 1 - Math.exp(-dt * 14);
    for (let i = 0; i < 3; i++) {
      st.l[i] = st.l[i]! + (L[i]! - st.l[i]!) * hk;
      st.r[i] = st.r[i]! + (R[i]! - st.r[i]!) * hk;
    }
    handL.current?.position.set(st.l[0], st.l[1], st.l[2]);
    handR.current?.position.set(st.r[0], st.r[1], st.r[2]);

    // Props follow the right hand
    if (key.current) {
      key.current.visible = keyOn;
      key.current.position.set(st.r[0], st.r[1] + 0.12, st.r[2] + 0.05);
      key.current.rotation.y = g * 1.5;
    }
    if (phone.current) {
      phone.current.visible = phoneOn;
      phone.current.position.set(st.r[0] + 0.06, st.r[1], st.r[2] + 0.05);
    }
    if (paper.current) {
      paper.current.visible = paperOn;
      paper.current.position.set(0, 0.84, 0.48 + 0.08 * Math.sin(TAU * 1.5 * t));
    }

    // Phone ring waves every 1.1 s
    if (ring.current) {
      const rk = (t % 1.1) / 1.1;
      ring.current.visible = ringOn;
      ring.current.scale.setScalar(0.12 + rk * 0.35);
      ringMat.opacity = ringOn ? 0.8 * (1 - rk) : 0;
    }

    // Blink every 2.5–5.5 s
    st.nextBlink -= dt;
    if (st.nextBlink <= 0) {
      st.blinkT = 0.13;
      st.nextBlink = 2.5 + Math.random() * 3;
    }
    let eyeY = squint;
    if (st.blinkT > 0) {
      st.blinkT -= dt;
      eyeY = 0.12;
    }
    if (eyes.current) eyes.current.scale.y = eyeY;
  });

  return (
    <group
      ref={root}
      onClick={(e) => {
        e.stopPropagation();
        if (isTap(e)) store.emitPick({ kind: 'bot', id });
      }}
      onPointerOver={() => setHoverCursor(true)}
      onPointerOut={() => setHoverCursor(false)}
    >
      {/* Soft round shadow */}
      <mesh geometry={GEO.circle} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]} scale={0.5}>
        <meshBasicMaterial color="#000000" transparent opacity={0.22} depthWrite={false} />
      </mesh>
      <group ref={bob}>
        {/* Body */}
        <RoundedBox
          args={[0.66, 0.58, 0.52]}
          radius={0.2}
          smoothness={4}
          position={[0, 0.6, 0]}
          material={body}
          castShadow
        />
        <mesh geometry={GEO.sphere} material={chalk} position={[0, 0.6, 0.265]} scale={[0.07, 0.07, 0.02]} />
        {/* Head */}
        <group ref={head} position={[0, 1.22, 0]}>
          <RoundedBox args={[0.88, 0.64, 0.72]} radius={0.2} smoothness={4} material={chalk} castShadow />
          <RoundedBox
            args={[0.66, 0.4, 0.06]}
            radius={0.12}
            smoothness={3}
            position={[0, 0, 0.345]}
            material={ink}
          />
          <group ref={eyes} position={[0, 0.02, 0.385]}>
            <mesh geometry={GEO.box} material={glow} position={[-0.13, 0, 0]} scale={[0.09, 0.15, 0.02]} />
            <mesh geometry={GEO.box} material={glow} position={[0.13, 0, 0]} scale={[0.09, 0.15, 0.02]} />
          </group>
          {/* Ear bolts */}
          <mesh
            geometry={GEO.cylinder}
            material={body}
            position={[0.46, 0, 0]}
            rotation={[0, 0, Math.PI / 2]}
            scale={[0.08, 0.06, 0.08]}
          />
          <mesh
            geometry={GEO.cylinder}
            material={body}
            position={[-0.46, 0, 0]}
            rotation={[0, 0, Math.PI / 2]}
            scale={[0.08, 0.06, 0.08]}
          />
          {/* Antenna */}
          <mesh geometry={GEO.cylinder} material={ink} position={[0, 0.42, 0]} scale={[0.02, 0.2, 0.02]} />
          <mesh geometry={GEO.sphere} material={glow} position={[0, 0.56, 0]} scale={0.075} />
          {/* Phone ring */}
          <mesh
            ref={ring}
            material={ringMat}
            position={[-0.62, 0.05, 0]}
            rotation={[0, Math.PI / 2, 0]}
            visible={false}
          >
            <torusGeometry args={[1, 0.08, 8, 32]} />
          </mesh>
        </group>
        {/* Hands */}
        <mesh ref={handL} geometry={GEO.sphere} material={body} position={REST_L} scale={0.11} castShadow />
        <mesh ref={handR} geometry={GEO.sphere} material={body} position={REST_R} scale={0.11} castShadow />
        {/* Props */}
        <group ref={key} visible={false}>
          <mesh
            geometry={GEO.cylinder}
            material={mat('#f2c230', { roughness: 0.3, metalness: 0.6 })}
            rotation={[Math.PI / 2, 0, 0]}
            scale={[0.07, 0.02, 0.07]}
          />
          <mesh
            geometry={GEO.box}
            material={mat('#f2c230', { roughness: 0.3, metalness: 0.6 })}
            position={[0, -0.12, 0]}
            scale={[0.03, 0.18, 0.02]}
          />
        </group>
        <mesh
          ref={phone}
          geometry={GEO.box}
          material={mat(PALETTE.ink)}
          scale={[0.06, 0.22, 0.05]}
          visible={false}
        />
        <mesh ref={paper} geometry={GEO.box} material={chalk} scale={[0.24, 0.01, 0.3]} visible={false} />
      </group>
      {/* Name tag: a camera-facing sprite (no DOM) */}
      <sprite position={[0, 2.05, 0]} scale={[0.3 * tag.aspect, 0.3, 1]} renderOrder={10}>
        <spriteMaterial map={tag.tex} depthTest={false} transparent toneMapped={false} />
      </sprite>
    </group>
  );
}
