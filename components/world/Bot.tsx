'use client';

/**
 * One of the five bots: chalk head with an ink face screen, glowing eyes and antenna in the agent
 * color, a colored body, round hands and a mic headset. Fully procedural; all animation is
 * code-driven. Reads its target from store.drive[id] and eases toward it, so directors stay simple.
 */
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { useWorldStore } from './WorldContext';
import { GEO, mat, PALETTE } from './parts';
import { POKE_SECONDS, doingLine, floorY, type ClipName } from './navGraph';
import type { BotId } from './store';
import { isTap, setHoverCursor } from './pick';
import { bubbleTexture, nameTagTexture } from './canvasTextures';

type V3 = [number, number, number];
const TAU = Math.PI * 2;

const REST_L: V3 = [0.42, 0.5, 0.06];
const REST_R: V3 = [-0.42, 0.5, 0.06];

/** Clips that keep their arm pose while walking (talking on the headset, carrying papers). */
const WALKABLE = new Set<ClipName>(['talk', 'carry', 'walk']);

/** On-screen sizes in pixels, independent of camera zoom. */
const TAG_PX = 20;
const BUBBLE_PX = 34;

const PROJ = new THREE.Vector3();

const HEADSET_BAND = new THREE.TorusGeometry(0.47, 0.035, 8, 28, Math.PI);
/** Smile: the lower half of a thin ring. */
const SMILE = new THREE.TorusGeometry(0.12, 0.032, 8, 20, Math.PI);

/** Stable 0..1 value per bot, so each one bobs, blinks and talks out of step with the others. */
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
  const handset = useRef<THREE.Group>(null);
  const chair = useRef<THREE.Group>(null);
  const tagRef = useRef<THREE.Sprite>(null);
  const mouth = useRef<THREE.Mesh>(null);
  const bubble = useRef<THREE.Sprite>(null);

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
  const bubbleMat = useMemo(
    () => new THREE.SpriteMaterial({ depthTest: false, transparent: true, toneMapped: false }),
    [],
  );
  const body = mat(color, { roughness: 0.55 });
  const chalk = mat('#f7f5f0', { roughness: 0.45 });
  const ink = mat('#191719', { roughness: 0.3 });
  const seatMat = mat(PALETTE.armchair, { roughness: 0.7 });

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
    lean: 0,
    seatY: 0,
    phase: seed(id) * 10,
    moving: false,
    line: '',
  });

  const tag = useMemo(() => nameTagTexture(name, color), [name, color]);

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const st = s.current;
    const d = store.drive[id];
    const reduced = store.get().reducedMotion;
    if (!root.current || !bob.current || !head.current) return;
    const now = state.clock.elapsedTime;

    // ── Clicked? Introduce myself and say what I'm doing (store.poke sets Infinity).
    if (store.pokes[id] === Infinity) {
      store.pokes[id] = now;
      const rest = store.speechQueue.filter((q) => q.id !== id);
      store.speechQueue.length = 0;
      store.speechQueue.push(
        { id, line: `Hi! I'm ${name}.`, dur: 1.7 },
        { id, line: doingLine(id, st.clip, st.moving), dur: 4.4 },
        ...rest,
      );
      store.speech.until = now; // interrupt whoever is talking
    }
    const pokeT = now - store.pokes[id];
    const poked = store.pokes[id] >= 0 && pokeT < POKE_SECONDS;

    // ── Position: ease toward the drive target (teleport on big jumps, e.g. a reset)
    let dx = d.x - st.x;
    let dz = d.z - st.z;
    if (poked) dx = dz = 0; // stop to say hi
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
    if (!poked) st.moving = moving;
    const seated = d.seat !== 'none' && !moving;

    let clip: ClipName = reduced ? 'idle' : moving ? (WALKABLE.has(d.clip) ? d.clip : 'walk') : d.clip;
    // Poked: wave hello, then chat while saying what I'm doing.
    if (poked && !reduced) clip = pokeT < 2.2 ? 'wave' : 'chat';
    if (clip !== st.clip) {
      st.clip = clip;
      st.clipT = 0;
    }
    st.clipT += dt;

    const g = state.clock.elapsedTime + st.phase;
    const t = st.clipT;

    // ── Facing: travel direction, the camera, or the director's angle (+ chair swivel)
    let wantFace = d.face;
    if (moving) wantFace = Math.atan2(dx, dz);
    else if (d.faceCamera || poked) {
      const cam = state.camera.position;
      wantFace = Math.atan2(cam.x - st.x, cam.z - st.z);
    } else if (d.seat === 'chair' && clip === 'sit_call') {
      wantFace += 0.55 * Math.sin(TAU * 0.06 * g) + 0.12 * Math.sin(TAU * 0.17 * g);
    }
    st.face = lerpAngle(st.face, wantFace, 1 - Math.exp(-dt * (seated ? 2.5 : 8)));

    root.current.position.set(st.x, floorY(st.x, st.z), st.z);
    root.current.rotation.y = st.face;

    // ── Clip pose
    let y = 0.012 * Math.sin(TAU * 0.25 * g); // barely-there breathing
    let roll = 0;
    let headTilt = 0;
    let headTurn = 0.12 * Math.sin(TAU * 0.07 * g);
    let squint = 1;
    let lean = 0;
    const L: V3 = [...REST_L];
    const R: V3 = [...REST_R];
    let keyOn = false;
    let paperOn = false;
    let handsetOn = false;

    if (moving) {
      y = 0.022 * Math.abs(Math.sin(TAU * 1.2 * g));
      roll = 0.02 * Math.sin(TAU * 0.6 * g);
    }

    switch (clip) {
      case 'walk': {
        const sw = 0.07 * Math.sin(TAU * 0.6 * g);
        L[2] += sw;
        R[2] -= sw;
        break;
      }
      case 'wave': {
        R[0] = -0.5 + 0.12 * Math.sin(TAU * 2.4 * t);
        R[1] = 1.3;
        R[2] = 0.12;
        break;
      }
      case 'greet': {
        // One wave hello, then talk with gestures.
        if (t < 1.8) {
          R[0] = -0.52 + 0.12 * Math.sin(TAU * 2.2 * t);
          R[1] = 1.32;
          R[2] = 0.14;
          headTilt = -0.06;
          squint = 0.7;
        } else {
          R[0] = -0.46;
          R[1] = 0.85 + 0.05 * Math.sin(TAU * 0.6 * t);
          R[2] = 0.3;
          L[1] = 0.6 + 0.06 * Math.sin(TAU * 0.6 * t + 1);
          headTilt = 0.05 * Math.sin(TAU * 0.4 * t);
        }
        headTurn = 0;
        break;
      }
      case 'talk': {
        // Hands gesture as it talks into the headset mic.
        const a = Math.sin(TAU * 0.45 * g);
        const b = Math.sin(TAU * 0.3 * g + 1.3);
        R[0] = -0.44;
        R[1] = 0.78 + 0.07 * Math.max(0, a);
        R[2] = 0.3 + 0.04 * a;
        L[0] = 0.44;
        L[1] = 0.6 + 0.05 * Math.max(0, b);
        L[2] = 0.2;
        headTilt = 0.03 * Math.sin(TAU * 0.3 * g);
        break;
      }
      case 'sit_call': {
        // Laid back, one hand behind the head, handset at the ear.
        lean = -0.32;
        L[0] = 0.32;
        L[1] = 1.42;
        L[2] = -0.18;
        R[0] = -0.48;
        R[1] = 1.22;
        R[2] = 0.1;
        handsetOn = true;
        headTilt = -0.08 + 0.04 * Math.sin(TAU * 0.3 * g);
        headTurn = 0;
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
        headTurn = 0;
        break;
      }
      case 'phone': {
        R[0] = -0.5;
        R[1] = 1.18;
        R[2] = 0.05;
        handsetOn = true;
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
        L[1] = R[1] = 0.68;
        L[2] = R[2] = 0.42;
        paperOn = true;
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
        R[1] = 0.82 + 0.06 * Math.sin(TAU * 0.6 * t);
        R[2] = 0.25;
        roll = 0.015 * Math.sin(TAU * 0.4 * t);
        headTilt = 0.03 * Math.sin(TAU * 0.3 * t);
        break;
      }
      case 'celebrate': {
        y = 0.12 * Math.abs(Math.sin(TAU * 0.9 * t));
        L[0] = 0.48;
        R[0] = -0.48;
        L[1] = R[1] = 1.35;
        L[2] = R[2] = 0;
        squint = 0.6;
        break;
      }
    }

    // Seat height and lean ease in, so sitting down isn't a pop.
    const wantSeat = seated ? (d.seat === 'bench' ? 0.2 : 0.12) : 0;
    const ek = 1 - Math.exp(-dt * 6);
    st.seatY += (wantSeat - st.seatY) * ek;
    st.lean += ((seated ? lean : 0) - st.lean) * ek;

    bob.current.position.y = y + st.seatY;
    bob.current.rotation.z = roll;
    bob.current.rotation.x = st.lean;
    head.current.rotation.x = headTilt;
    head.current.rotation.y = headTurn;
    if (chair.current) chair.current.visible = d.seat === 'chair' && seated;

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
    if (handset.current) {
      handset.current.visible = handsetOn;
      handset.current.position.set(st.r[0] + 0.02, st.r[1], st.r[2]);
    }
    if (paper.current) {
      paper.current.visible = paperOn;
      paper.current.position.set(
        0,
        clip === 'carry' ? 0.76 : 0.84,
        0.48 + (clip === 'carry' ? 0 : 0.08 * Math.sin(TAU * 1.5 * t)),
      );
    }

    // ── Speech: the SpeechDirector gives one bot the floor at a time
    const sp = store.speech;
    const talking = !reduced && sp.id === id && now < sp.until;
    const line = talking ? sp.line : '';
    const lineT = now - sp.start;
    const showFor = sp.until - sp.start;
    // Is my head on screen? (lets the director skip bots you can't see)
    PROJ.set(st.x, 2, st.z).project(state.camera);
    // On the landing page the story card covers the left of the screen.
    const minX = store.get().mode === 'landing' && state.size.width >= 768 ? -0.2 : -0.92;
    store.moving[id] = moving;
    store.onScreen[id] = PROJ.x > minX && PROJ.x < 0.92 && PROJ.y > -0.95 && PROJ.y < 0.8;
    const cam = state.camera as THREE.OrthographicCamera;
    const px = 1 / Math.max(cam.zoom, 1e-3); // world units per pixel
    const tagH = TAG_PX * px;
    if (tagRef.current) {
      tagRef.current.scale.set(tagH * tag.aspect, tagH, 1);
      tagRef.current.position.y = 1.95 + st.seatY + tagH / 2;
    }
    if (bubble.current) {
      if (line !== st.line) {
        st.line = line;
        if (line) {
          bubbleMat.map = bubbleTexture(line).tex;
          bubbleMat.needsUpdate = true;
        }
      }
      bubble.current.visible = !!line;
      if (line) {
        const pop = Math.max(0, Math.min(1, lineT / 0.25) * Math.min(1, (showFor - lineT) / 0.3));
        const bh = BUBBLE_PX * px * (0.85 + 0.15 * pop);
        const aspect = bubbleTexture(line).aspect;
        bubble.current.scale.set(bh * aspect, bh, 1);
        bubble.current.position.y = 1.95 + st.seatY + tagH + 4 * px;
        bubbleMat.opacity = pop;
      }
    }

    // Phone ring pulses only while the line is a ring.
    const ringing = handsetOn && line.startsWith('Ring');
    if (ring.current) {
      const rk = (t % 0.55) / 0.55;
      ring.current.visible = ringing;
      ring.current.scale.setScalar(0.12 + rk * 0.35);
      ringMat.opacity = ringing ? 0.85 * (1 - rk) : 0;
    }

    // Blink every 2.5–5.5 s (random per bot, never in sync)
    st.nextBlink -= dt;
    if (st.nextBlink <= 0) {
      st.blinkT = 0.13;
      st.nextBlink = 2.5 + Math.random() * 3;
    }
    // Smiling eyes and a smile while saying hi (and when celebrating).
    const smiling = poked || clip === 'celebrate';
    if (smiling) squint = 0.45;
    if (mouth.current) mouth.current.visible = smiling;
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
        if (!isTap(e)) return;
        store.poke(id);
        store.emitPick({ kind: 'bot', id });
      }}
      onPointerOver={() => setHoverCursor(true)}
      onPointerOut={() => setHoverCursor(false)}
    >
      {/* Invisible, generous hit area so small bots are easy to click */}
      <mesh geometry={GEO.box} position={[0, 1.1, 0]} scale={[1.3, 2.4, 1.3]}>
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {/* Soft round shadow */}
      <mesh geometry={GEO.circle} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]} scale={0.5}>
        <meshBasicMaterial color="#000000" transparent opacity={0.22} depthWrite={false} />
      </mesh>
      {/* Swivel chair (rotates with the bot) */}
      <group ref={chair} visible={false}>
        <mesh geometry={GEO.cylinder} material={ink} position={[0, 0.04, 0]} scale={[0.32, 0.05, 0.32]} />
        <mesh geometry={GEO.cylinder} material={ink} position={[0, 0.24, 0]} scale={[0.04, 0.36, 0.04]} />
        <RoundedBox
          args={[0.66, 0.1, 0.6]}
          radius={0.04}
          smoothness={2}
          position={[0, 0.44, 0]}
          material={seatMat}
          castShadow
        />
        <RoundedBox
          args={[0.62, 0.7, 0.1]}
          radius={0.05}
          smoothness={2}
          position={[0, 0.85, -0.36]}
          rotation={[-0.28, 0, 0]}
          material={seatMat}
          castShadow
        />
      </group>
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
          <mesh
            ref={mouth}
            geometry={SMILE}
            material={glow}
            position={[0, -0.05, 0.385]}
            rotation={[0, 0, Math.PI]}
            visible={false}
          />
          {/* Headset: band over the top, ear cups, mic boom on the left */}
          <mesh geometry={HEADSET_BAND} material={ink} position={[0, 0.02, -0.04]} />
          <mesh
            geometry={GEO.cylinder}
            material={ink}
            position={[0.47, 0, -0.04]}
            rotation={[0, 0, Math.PI / 2]}
            scale={[0.15, 0.08, 0.15]}
          />
          <mesh
            geometry={GEO.cylinder}
            material={ink}
            position={[-0.47, 0, -0.04]}
            rotation={[0, 0, Math.PI / 2]}
            scale={[0.15, 0.08, 0.15]}
          />
          <mesh
            geometry={GEO.cylinder}
            material={body}
            position={[0.52, 0, -0.04]}
            rotation={[0, 0, Math.PI / 2]}
            scale={[0.09, 0.02, 0.09]}
          />
          <mesh
            geometry={GEO.cylinder}
            material={body}
            position={[-0.52, 0, -0.04]}
            rotation={[0, 0, Math.PI / 2]}
            scale={[0.09, 0.02, 0.09]}
          />
          <mesh
            geometry={GEO.cylinder}
            material={ink}
            position={[0.5, -0.14, 0.2]}
            rotation={[Math.PI / 2 - 0.5, 0, 0.35]}
            scale={[0.02, 0.5, 0.02]}
          />
          <mesh geometry={GEO.sphere} material={glow} position={[0.42, -0.25, 0.42]} scale={0.05} />
          {/* Antenna */}
          <mesh geometry={GEO.cylinder} material={ink} position={[0, 0.42, 0]} scale={[0.02, 0.2, 0.02]} />
          <mesh geometry={GEO.sphere} material={glow} position={[0, 0.56, 0]} scale={0.075} />
          {/* Phone ring */}
          <mesh
            ref={ring}
            material={ringMat}
            position={[-0.66, 0.05, 0]}
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
        {/* Desk phone handset: grip with an ear and mouth piece */}
        <group ref={handset} visible={false}>
          <mesh geometry={GEO.box} material={ink} scale={[0.07, 0.32, 0.07]} />
          <mesh geometry={GEO.box} material={ink} position={[0.04, 0.15, 0.02]} scale={[0.1, 0.08, 0.1]} />
          <mesh geometry={GEO.box} material={ink} position={[0.04, -0.15, 0.02]} scale={[0.1, 0.08, 0.1]} />
        </group>
        <mesh ref={paper} geometry={GEO.box} material={chalk} scale={[0.24, 0.04, 0.3]} visible={false} />
      </group>
      {/* Name tag and speech bubble: camera-facing sprites (no DOM), constant size on screen */}
      <sprite ref={tagRef} position={[0, 2.05, 0]} scale={[0.3 * tag.aspect, 0.3, 1]} renderOrder={10}>
        <spriteMaterial map={tag.tex} depthTest={false} transparent toneMapped={false} />
      </sprite>
      <sprite ref={bubble} material={bubbleMat} center={[0.5, 0]} renderOrder={11} visible={false} />
    </group>
  );
}
