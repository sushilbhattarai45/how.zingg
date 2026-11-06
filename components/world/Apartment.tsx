'use client';

/** The cutaway apartment: no ceiling, low inner walls, five rooms. All procedural. */
import { useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { Block, Box, Cyl, Ball, GEO, mat, basic, PALETTE } from './parts';
import { WallWindow } from './LitWindows';
import { useWorldStore } from './WorldContext';
import { isTap } from './pick';
import { INNER_WALL_H, WALL_H } from './layout';
import {
  mapTexture,
  whiteboardTexture,
  waveformTexture,
  drawWaveform,
  luggageTagTexture,
} from './canvasTextures';

const T = 0.2; // wall thickness

export function Apartment({ quality }: { quality: 'high' | 'low' }) {
  return (
    <group>
      <Shell />
      <Office quality={quality} />
      <Bedroom quality={quality} />
      <Hall />
      <Kitchen quality={quality} />
      <Living quality={quality} />
    </group>
  );
}

/* ───────────── Structure ───────────── */

function Shell() {
  return (
    <group>
      {/* Concrete base and floors */}
      <Box p={[0, -0.21, 0]} s={[20.6, 0.42, 14.6]} color={PALETTE.concrete} />
      <Floor x={[-10, 1]} z={[-7, 7]} color={PALETTE.wood} />
      <Floor x={[1, 10]} z={[-1, 7]} color={PALETTE.woodPlank} />
      <Floor x={[1, 10]} z={[-7, -1]} color={PALETTE.tile} />
      <PlankLines />

      {/* Full-height back and left walls */}
      <Block p={[0, 0, -7.1]} s={[20.4, WALL_H, T]} color={PALETTE.wallWhite} />
      <Block p={[-10.1, 0, 0]} s={[T, WALL_H, 14.4]} color={PALETTE.wallSage} />
      {/* Brick inner face behind the kitchen */}
      <Block p={[5.55, 0, -6.98]} s={[8.9, WALL_H, 0.04]} color={PALETTE.brick} shadow={false} />
      <BrickLines />
      {/* Right edge: low lip (cutaway) */}
      <Block p={[10.1, 0, 0]} s={[T, 0.3, 14.4]} color={PALETTE.wallTrim} />
      {/* Front lip with the entrance gap at x = -1 */}
      <Block p={[-5.95, 0, 7.1]} s={[8.5, 0.3, T]} color={PALETTE.wallTrim} />
      <Block p={[5.0, 0, 7.1]} s={[10.2, 0.3, T]} color={PALETTE.wallTrim} />

      {/* Inner walls (1.5 m) with doorways */}
      {/* x = -3: office/bedroom ↔ hall */}
      <Block p={[-3, 0, -5.25]} s={[T, INNER_WALL_H, 3.5]} color={PALETTE.wallWhite} />
      <Block p={[-3, 0, -0.45]} s={[T, INNER_WALL_H, 2.9]} color={PALETTE.wallWhite} />
      <Block p={[-3, 0, 5.3]} s={[T, INNER_WALL_H, 3.4]} color={PALETTE.wallWhite} />
      {/* z = 0: office ↔ bedroom */}
      <Block p={[-8.3, 0, 0]} s={[3.4, INNER_WALL_H, T]} color={PALETTE.wallWhite} />
      <Block p={[-3.8, 0, 0]} s={[1.6, INNER_WALL_H, T]} color={PALETTE.wallWhite} />
      {/* x = 1: hall ↔ kitchen/living */}
      <Block p={[1, 0, -5.6]} s={[T, INNER_WALL_H, 2.8]} color={PALETTE.wallWhite} />
      <Block p={[1, 0, 0]} s={[T, INNER_WALL_H, 3]} color={PALETTE.wallWhite} />
      <Block p={[1, 0, 5.8]} s={[T, WALL_H, 2.4]} color={PALETTE.wallSage} />
    </group>
  );
}

function Floor({ x, z, color }: { x: [number, number]; z: [number, number]; color: string }) {
  return (
    <Box
      p={[(x[0] + x[1]) / 2, 0.005, (z[0] + z[1]) / 2]}
      s={[x[1] - x[0], 0.01, z[1] - z[0]]}
      color={color}
      shadow={false}
    />
  );
}

/** Thin darker lines for wood planks (one merged geometry). */
function PlankLines() {
  const geo = useMemo(() => {
    const pts: number[] = [];
    for (let z = -6.5; z <= 7; z += 0.55) pts.push(-10, 0.012, z, 1, 0.012, z);
    for (let z = -0.5; z <= 7; z += 0.55) pts.push(1, 0.012, z, 10, 0.012, z);
    for (let x = 1.6; x < 10; x += 0.6) pts.push(x, 0.012, -7, x, 0.012, -1);
    for (let z = -6.4; z < -1; z += 0.6) pts.push(1, 0.012, z, 10, 0.012, z);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, []);
  return (
    <lineSegments geometry={geo}>
      <lineBasicMaterial color="#000000" transparent opacity={0.12} />
    </lineSegments>
  );
}

function BrickLines() {
  const geo = useMemo(() => {
    const pts: number[] = [];
    for (let y = 0.25; y < WALL_H; y += 0.25) pts.push(1.1, y, -6.955, 10, y, -6.955);
    for (let y = 0; y < WALL_H; y += 0.25) {
      const off = Math.round(y / 0.25) % 2 ? 0.3 : 0;
      for (let x = 1.1 + off; x < 10; x += 0.6) pts.push(x, y, -6.955, x, y + 0.25, -6.955);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, []);
  return (
    <lineSegments geometry={geo}>
      <lineBasicMaterial color="#5e2f22" transparent opacity={0.35} />
    </lineSegments>
  );
}

function Plant({ p, scale = 1 }: { p: [number, number, number]; scale?: number }) {
  return (
    <group position={p} scale={scale}>
      <Cyl p={[0, 0.25, 0]} s={[0.25, 0.5, 0.25]} color={PALETTE.plantPot} />
      <Ball p={[0, 0.75, 0]} s={[0.42, 0.45, 0.42]} color={PALETTE.leaf} />
      <Ball p={[0.15, 1.05, 0.05]} s={[0.28, 0.3, 0.28]} color={PALETTE.leafLight} />
    </group>
  );
}

function Lamp({
  p,
  height = 0.5,
  glow = '#ffd9a0',
}: {
  p: [number, number, number];
  height?: number;
  glow?: string;
}) {
  return (
    <group position={p}>
      <Cyl p={[0, height / 2, 0]} s={[0.03, height, 0.03]} color={PALETTE.metal} />
      <mesh
        geometry={GEO.cone}
        material={basic(glow)}
        position={[0, height + 0.1, 0]}
        scale={[0.18, 0.22, 0.18]}
      />
    </group>
  );
}

function hoverCursor(on: boolean) {
  if (typeof document !== 'undefined') document.body.style.cursor = on ? 'pointer' : '';
}

/* ───────────── Rooms ───────────── */

function Office({ quality }: { quality: 'high' | 'low' }) {
  const wave = useMemo(() => waveformTexture(), []);
  const board = useMemo(() => whiteboardTexture(), []);
  const t = useRef(0);
  useFrame((_, dt) => {
    t.current += dt;
    if (Math.floor(t.current * 12) !== Math.floor((t.current - dt) * 12)) drawWaveform(wave, t.current);
  });
  return (
    <group>
      <WallWindow p={[-8.4, 1.75, -6.98]} facing="+z" target="office" />
      <WallWindow p={[-9.98, 1.75, -3.6]} facing="+x" target="office" />
      {/* Desk against the back wall */}
      <Block p={[-5.8, 0.72, -6.45]} s={[2.2, 0.06, 0.9]} color={PALETTE.woodDark} />
      <Block p={[-6.8, 0, -6.45]} s={[0.08, 0.72, 0.8]} color={PALETTE.woodDark} />
      <Block p={[-4.8, 0, -6.45]} s={[0.08, 0.72, 0.8]} color={PALETTE.woodDark} />
      {/* Laptop with live call waveform */}
      <Block p={[-5.6, 0.78, -6.35]} s={[0.6, 0.03, 0.42]} color="#3a373b" />
      <group position={[-5.6, 0.97, -6.56]} rotation={[-0.25, 0, 0]}>
        <Box p={[0, 0, 0]} s={[0.6, 0.4, 0.03]} color="#3a373b" />
        <mesh geometry={GEO.plane} position={[0, 0, 0.017]} scale={[0.54, 0.34, 1]}>
          <meshBasicMaterial map={wave} toneMapped={false} />
        </mesh>
      </group>
      <Lamp p={[-6.6, 0.75, -6.6]} height={0.4} />
      {/* Desk phone (Caller's handset lives in its hand; the swivel chair comes with the bot) */}
      <Block p={[-4.95, 0.75, -6.3]} s={[0.34, 0.1, 0.26]} color={PALETTE.ink} />
      <Box p={[-4.95, 0.86, -6.3]} s={[0.2, 0.02, 0.12]} color="#ff8a4c" shadow={false} />
      {/* Whiteboard "Calls today" */}
      <group position={[-4.5, 2.0, -6.98]}>
        <Box p={[0, 0, 0]} s={[1.5, 0.95, 0.04]} color="#d9d1c2" shadow={false} />
        <mesh geometry={GEO.plane} position={[0, 0, 0.025]} scale={[1.42, 0.87, 1]}>
          <meshStandardMaterial map={board} roughness={0.6} />
        </mesh>
      </group>
      {/* Bookshelf on the left wall */}
      <group position={[-9.72, 0, -1.6]}>
        <Block p={[0, 0, 0]} s={[0.5, 1.9, 1.4]} color={PALETTE.woodDark} />
        {quality === 'high' &&
          [0.35, 0.8, 1.25, 1.65].map((y, row) =>
            [-0.45, -0.2, 0.05, 0.3].map((z, i) => (
              <Block
                key={`${row}-${i}`}
                p={[0.08, y, z + (row % 2) * 0.08]}
                s={[0.3, 0.32, 0.14]}
                color={['#3db8c9', '#f2c230', '#f25c8a', '#6b7db8'][(i + row) % 4]!}
              />
            )),
          )}
      </group>
      <Plant p={[-9.4, 0, -6.4]} />
    </group>
  );
}

function Bedroom({ quality }: { quality: 'high' | 'low' }) {
  const tag = useMemo(() => luggageTagTexture(), []);
  return (
    <group>
      <WallWindow p={[-9.98, 1.8, 4.6]} facing="+x" target="bedroom" w={1.4} h={1.3} />
      {/* Bed against the left wall */}
      <Block p={[-8.75, 0, 3.6]} s={[2.4, 0.35, 1.7]} color={PALETTE.bedFrame} />
      <Block p={[-8.7, 0.35, 3.6]} s={[2.2, 0.2, 1.6]} color={PALETTE.sheet} />
      <Block p={[-8.3, 0.55, 3.6]} s={[1.5, 0.06, 1.62]} color={PALETTE.blanket} />
      <Block p={[-9.55, 0.55, 3.6]} s={[0.45, 0.14, 1.1]} color={PALETTE.sheet} />
      <Block p={[-9.92, 0, 3.6]} s={[0.12, 1.0, 1.7]} color={PALETTE.bedFrame} />
      {/* Nightstand + lamp */}
      <Block p={[-9.55, 0, 2.2]} s={[0.6, 0.55, 0.6]} color={PALETTE.woodDark} />
      <Lamp p={[-9.55, 0.55, 2.2]} height={0.35} />
      {/* Wardrobe */}
      <Block p={[-5.4, 0, 0.45]} s={[1.5, 2.0, 0.6]} color="#e4dccb" />
      <Box p={[-5.4, 1.0, 0.76]} s={[0.02, 1.9, 0.02]} color="#b9b0a0" shadow={false} />
      {/* Rug */}
      <mesh
        geometry={GEO.circle}
        material={mat(PALETTE.rugOchre)}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[-6.6, 0.02, 4.4]}
        scale={[1.3, 1.0, 1]}
        receiveShadow
      />
      {/* Suitcase with luggage tag (Closer carries it) */}
      <group position={[-4.2, 0, 5.8]}>
        <RoundedBox
          args={[0.5, 0.7, 0.28]}
          radius={0.06}
          position={[0, 0.37, 0]}
          material={mat('#f25c8a')}
          castShadow
        />
        <mesh geometry={GEO.plane} position={[0, 0.5, 0.15]} scale={[0.3, 0.11, 1]}>
          <meshStandardMaterial map={tag} />
        </mesh>
      </group>
      {quality === 'high' && <Plant p={[-3.6, 0, 6.5]} scale={0.8} />}
    </group>
  );
}

function Hall() {
  const map = useMemo(() => mapTexture(), []);
  const store = useWorldStore();
  const lightRef = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(() => {
    const on = store.get().doorLight;
    lightRef.current?.color.set(on ? PALETTE.green : '#f2c46b');
  });
  const pickDoor = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (!isTap(e)) return;
    store.emitPick({ kind: 'door' });
  };
  return (
    <group>
      {/* Front door on the back wall at x = -1 */}
      <group
        position={[-1, 0, -6.97]}
        onClick={pickDoor}
        onPointerOver={() => hoverCursor(true)}
        onPointerOut={() => hoverCursor(false)}
      >
        <Block p={[0, 0, 0]} s={[1.25, 2.3, 0.06]} color={PALETTE.chalk} />
        <Block p={[0, 0, 0.04]} s={[1.05, 2.2, 0.05]} color={PALETTE.door} />
        <Ball p={[0.38, 1.1, 0.1]} s={[0.05, 0.05, 0.05]} color="#f2c230" />
        <mesh position={[0, 2.55, 0.06]} geometry={GEO.sphere} scale={0.1}>
          <meshBasicMaterial ref={lightRef} color="#f2c46b" toneMapped={false} />
        </mesh>
      </group>
      {/* Door mat, coat rack */}
      <Box p={[-1, 0.015, -6.35]} s={[1.1, 0.02, 0.6]} color="#5e5a5f" shadow={false} />
      <group position={[-2.5, 0, -6.5]}>
        <Cyl p={[0, 0.9, 0]} s={[0.04, 1.8, 0.04]} color={PALETTE.woodDark} />
        <Ball p={[0.1, 1.55, 0]} s={[0.16, 0.3, 0.14]} color="#3db8c9" />
        <Cyl p={[0, 0.02, 0]} s={[0.25, 0.04, 0.25]} color={PALETTE.woodDark} />
      </group>
      {/* Scout's map easel */}
      <group position={[-2.3, 0, 1.6]} rotation={[0, Math.PI / 2 - 0.3, 0]}>
        <Box p={[-0.35, 0.8, 0]} s={[0.05, 1.6, 0.05]} r={[0, 0, 0.12]} color={PALETTE.woodDark} />
        <Box p={[0.35, 0.8, 0]} s={[0.05, 1.6, 0.05]} r={[0, 0, -0.12]} color={PALETTE.woodDark} />
        <Box p={[0, 1.15, 0.03]} s={[0.9, 0.7, 0.03]} color="#ffffff" />
        <mesh geometry={GEO.plane} position={[0, 1.15, 0.05]} scale={[0.84, 0.64, 1]}>
          <meshStandardMaterial map={map} roughness={0.7} />
        </mesh>
      </group>
      {/* Small laptop table */}
      <Block p={[-0.2, 0, 2.6]} s={[1.0, 0.72, 0.6]} color={PALETTE.woodDark} />
      <Block p={[-0.2, 0.72, 2.6]} s={[0.45, 0.03, 0.32]} color="#3a373b" />
    </group>
  );
}

function Kitchen({ quality }: { quality: 'high' | 'low' }) {
  const steam = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!steam.current) return;
    steam.current.children.forEach((c, i) => {
      const k = (clock.elapsedTime * 0.5 + i / 3) % 1;
      c.position.y = 1.2 + k * 0.6;
      c.scale.setScalar(0.08 + k * 0.08);
      ((c as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.5 * (1 - k);
    });
  });
  return (
    <group>
      <WallWindow p={[6.2, 1.85, -6.94]} facing="+z" target="kitchen" w={1.5} h={1.0} />
      {/* Counters along the back wall */}
      <Block p={[4.9, 0, -6.55]} s={[6.2, 0.9, 0.7]} color={PALETTE.counter} />
      <Block p={[4.9, 0.9, -6.55]} s={[6.3, 0.05, 0.76]} color={PALETTE.counterTop} />
      {/* Stove with steaming pot */}
      <Block p={[3.3, 0.95, -6.55]} s={[0.8, 0.02, 0.6]} color="#2a282b" />
      <Cyl p={[3.3, 1.08, -6.55]} s={[0.2, 0.24, 0.2]} color="#9a9da3" />
      <group ref={steam}>
        {[0, 1, 2].map((i) => (
          <mesh key={i} geometry={GEO.sphere} position={[3.3, 1.2, -6.55]}>
            <meshBasicMaterial color="#ffffff" transparent opacity={0.4} depthWrite={false} />
          </mesh>
        ))}
      </group>
      {/* Printer */}
      <Block p={[7.4, 0.93, -6.55]} s={[0.6, 0.3, 0.45]} color="#d8dade" />
      <Box p={[7.4, 1.1, -6.38]} s={[0.4, 0.01, 0.2]} color="#ffffff" shadow={false} />
      {/* Fridge */}
      <Block p={[9.35, 0, -6.45]} s={[0.85, 1.95, 0.8]} color={PALETTE.fridge} />
      <Box p={[9.35, 1.3, -6.04]} s={[0.04, 0.4, 0.03]} color="#8b878c" shadow={false} />
      {/* Island with stools */}
      <Block p={[5, 0, -3.9]} s={[3.0, 0.92, 1.0]} color={PALETTE.counter} />
      <Block p={[5, 0.92, -3.9]} s={[3.1, 0.05, 1.1]} color={PALETTE.counterTop} />
      {[4, 5, 6].map((x) => (
        <group key={x} position={[x, 0, -2.95]}>
          <Cyl p={[0, 0.35, 0]} s={[0.04, 0.7, 0.04]} color={PALETTE.metal} />
          <Cyl p={[0, 0.72, 0]} s={[0.2, 0.06, 0.2]} color={PALETTE.woodDark} />
        </group>
      ))}
      {/* Packet's desk: laptop facing the bot, a stack of documents */}
      <group position={[8.4, 0, -2.5]}>
        <Block p={[0, 0.72, 0]} s={[1.5, 0.05, 0.7]} color={PALETTE.wood} />
        <Block p={[-0.68, 0, 0]} s={[0.07, 0.72, 0.6]} color={PALETTE.woodDark} />
        <Block p={[0.68, 0, 0]} s={[0.07, 0.72, 0.6]} color={PALETTE.woodDark} />
        <Block p={[0, 0.77, -0.15]} s={[0.55, 0.03, 0.36]} color="#3a373b" />
        <group position={[0, 0.98, 0.04]} rotation={[0.25, 0, 0]}>
          <Box s={[0.55, 0.38, 0.03]} color="#3a373b" />
          <mesh
            geometry={GEO.plane}
            position={[0, 0, -0.017]}
            rotation={[0, Math.PI, 0]}
            scale={[0.49, 0.32, 1]}
          >
            <meshBasicMaterial color="#f2c230" toneMapped={false} />
          </mesh>
        </group>
        <Block p={[0.5, 0.77, 0.05]} s={[0.3, 0.08, 0.38]} color="#f7f5f0" />
        <Block p={[-0.52, 0.77, 0.08]} s={[0.24, 0.05, 0.32]} color="#e5dccb" />
      </group>
      {quality === 'high' && <Plant p={[1.6, 0, -6.5]} scale={0.7} />}
    </group>
  );
}

function Living({ quality }: { quality: 'high' | 'low' }) {
  const store = useWorldStore();
  const pickCouch = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (!isTap(e)) return;
    store.emitPick({ kind: 'couch' });
  };
  return (
    <group>
      <WallWindow p={[1.12, 1.85, 5.8]} facing="+x" target="living" w={1.5} h={1.2} />
      {/* Rug */}
      <mesh
        geometry={GEO.circle}
        material={mat(PALETTE.rugRed)}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[6, 0.02, 2.6]}
        scale={[2.2, 1.6, 1]}
        receiveShadow
      />
      {/* The couch (orange sofa), facing +z toward the viewer */}
      <group
        position={[6, 0, 1.2]}
        onClick={pickCouch}
        onPointerOver={() => hoverCursor(true)}
        onPointerOut={() => hoverCursor(false)}
      >
        <RoundedBox
          args={[2.8, 0.45, 1.0]}
          radius={0.12}
          position={[0, 0.3, 0]}
          material={mat(PALETTE.sofa)}
          castShadow
          receiveShadow
        />
        <RoundedBox
          args={[2.8, 0.6, 0.3]}
          radius={0.12}
          position={[0, 0.75, -0.4]}
          material={mat(PALETTE.sofaDark)}
          castShadow
        />
        <RoundedBox
          args={[0.28, 0.35, 1.0]}
          radius={0.1}
          position={[-1.3, 0.65, 0]}
          material={mat(PALETTE.sofaDark)}
          castShadow
        />
        <RoundedBox
          args={[0.28, 0.35, 1.0]}
          radius={0.1}
          position={[1.3, 0.65, 0]}
          material={mat(PALETTE.sofaDark)}
          castShadow
        />
      </group>
      {/* Coffee table */}
      <Block p={[6, 0.38, 2.9]} s={[1.3, 0.06, 0.8]} color={PALETTE.wood} />
      <Block p={[6, 0, 2.9]} s={[1.1, 0.38, 0.6]} color={PALETTE.woodDark} />
      {/* Armchair */}
      <group position={[8.6, 0, 3.4]} rotation={[0, -1.2, 0]}>
        <RoundedBox
          args={[0.9, 0.45, 0.9]}
          radius={0.1}
          position={[0, 0.3, 0]}
          material={mat(PALETTE.armchair)}
          castShadow
        />
        <RoundedBox
          args={[0.9, 0.55, 0.22]}
          radius={0.08}
          position={[0, 0.7, -0.35]}
          material={mat(PALETTE.armchair)}
          castShadow
        />
      </group>
      {/* Floor lamp, big plant */}
      <group position={[8.1, 0, 0.6]}>
        <Cyl p={[0, 0.85, 0]} s={[0.03, 1.7, 0.03]} color={PALETTE.metal} />
        <mesh
          geometry={GEO.cone}
          material={basic('#ffd9a0')}
          position={[0, 1.8, 0]}
          scale={[0.28, 0.3, 0.28]}
        />
      </group>
      <Plant p={[9.4, 0, 6.4]} scale={1.4} />
      {quality === 'high' && <Plant p={[3.6, 0, 0.4]} scale={0.8} />}
    </group>
  );
}
