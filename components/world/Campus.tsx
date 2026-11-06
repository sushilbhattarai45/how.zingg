'use client';

/**
 * The campus behind the apartment: a domed hall with a columned porch, brick halls with lit
 * windows, a bell tower, a quad with a fountain, trees and lamps. An original, stylized take on a
 * Southern brick campus; no logos or copied artwork. Everything is static, so it costs one frame
 * of setup and nothing per frame.
 */
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Box, Cyl, GEO, mat, basic, PALETTE } from './parts';
import { CAMPUS, GROUND_Y } from './layout';
import { campusSignTexture, facadeTextures } from './canvasTextures';

const BRICK = '#9a5040';
const BRICK_2 = '#a8604a';
const STONE = '#efe8da';
const TRIM = '#e4dccb';
const ROOF = '#4b4548';
const LAWN = '#4b7045';

const HEMI = new THREE.SphereGeometry(1, 36, 14, 0, Math.PI * 2, 0, Math.PI / 2);
const PYRAMID = new THREE.ConeGeometry(1, 1, 4);

type V3 = [number, number, number];

export function Campus({ quality }: { quality: 'high' | 'low' }) {
  return (
    <group
      position={[CAMPUS.origin[0], GROUND_Y, CAMPUS.origin[1]]}
      rotation={[0, CAMPUS.rotation, 0]}
      scale={CAMPUS.scale}
    >
      <Quad />
      <DomeHall />
      {/* Flanking halls face the quad */}
      <Hall p={[-17, 0, 3]} size={[9, 8.4, 16]} rot={Math.PI / 2} brick={BRICK_2} seed={3} />
      <Hall p={[17, 0, 3]} size={[9, 8.4, 16]} rot={-Math.PI / 2} brick={BRICK_2} seed={7} />
      <BellTower p={[-12, 0, -9]} />
      {/* Back row for depth */}
      <Hall p={[-2, 0, -17]} size={[22, 10.5, 7]} rot={0} brick="#8a4a3c" seed={11} />
      <Hall p={[20, 0, -14]} size={[12, 12.6, 8]} rot={-0.35} brick="#86493b" seed={13} />
      {quality === 'high' && (
        <Hall p={[-24, 0, -13]} size={[12, 8.4, 8]} rot={0.4} brick="#8e4d3e" seed={17} />
      )}
      <CampusTrees quality={quality} />
      <Lamps />
      <Sign />
    </group>
  );
}

/* ───────────── Quad ───────────── */

function Quad() {
  const y = 0.02;
  return (
    <group>
      <mesh
        geometry={GEO.plane}
        material={mat(LAWN)}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, y, 6]}
        scale={[30, 16, 1]}
        receiveShadow
      />
      {/* Paths: center walk, cross walk, front edge */}
      <Box p={[0, y + 0.02, 7]} s={[2.4, 0.04, 14]} color={PALETTE.path} shadow={false} />
      <Box p={[0, y + 0.02, 7.5]} s={[30, 0.04, 1.6]} color={PALETTE.path} shadow={false} />
      <Box p={[0, y + 0.02, 14.2]} s={[34, 0.04, 1.4]} color={PALETTE.sidewalk} shadow={false} />
      {/* Fountain */}
      <group position={[0, 0, 7.5]}>
        <Cyl p={[0, 0.25, 0]} s={[2.2, 0.5, 2.2]} color={STONE} />
        <mesh
          geometry={GEO.cylinder}
          material={basic('#6f9fb0')}
          position={[0, 0.48, 0]}
          scale={[1.9, 0.04, 1.9]}
        />
        <Cyl p={[0, 0.9, 0]} s={[0.25, 1.0, 0.25]} color={STONE} />
        <Cyl p={[0, 1.4, 0]} s={[0.8, 0.12, 0.8]} color={STONE} />
      </group>
      {/* Hedge rows along the front edge */}
      <Box p={[-9, 0.4, 15.3]} s={[13, 0.8, 0.8]} color={PALETTE.leaf} />
      <Box p={[9, 0.4, 15.3]} s={[13, 0.8, 0.8]} color={PALETTE.leaf} />
    </group>
  );
}

/* ───────────── Domed hall ───────────── */

function DomeHall() {
  const W = 20;
  const H = 7;
  const D = 9;
  const front = D / 2;
  const cols = [-4, -2.4, -0.8, 0.8, 2.4, 4];
  const pediment = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-5.2, 0);
    s.lineTo(5.2, 0);
    s.lineTo(0, 1.7);
    s.closePath();
    return new THREE.ExtrudeGeometry(s, { depth: 3, bevelEnabled: false });
  }, []);
  const drumCols = useMemo(() => Array.from({ length: 14 }, (_, i) => (i / 14) * Math.PI * 2), []);
  return (
    <group position={[0, 0, -2]}>
      <Hall p={[0, 0, 0]} size={[W, H, D]} rot={0} brick={BRICK} seed={1} plain />
      {/* Cornice */}
      <Box p={[0, H + 0.15, 0]} s={[W + 0.4, 0.3, D + 0.4]} color={TRIM} />
      {/* Porch: steps, columns, beam, pediment */}
      {[0, 1, 2].map((i) => (
        <Box
          key={i}
          p={[0, 0.15 + i * 0.3, front + 2.6 - i * 0.4]}
          s={[11.5 - i * 0.6, 0.3, 1.4]}
          color={STONE}
        />
      ))}
      <Box p={[0, 0.5, front + 1.2]} s={[10.8, 1, 2.6]} color={STONE} />
      {cols.map((x) => (
        <Cyl key={x} p={[x, 3.6, front + 1.6]} s={[0.32, 5.2, 0.32]} color={STONE} />
      ))}
      <Box p={[0, 6.45, front + 1.3]} s={[10.6, 0.6, 3]} color={STONE} />
      <mesh geometry={pediment} material={mat(STONE)} position={[0, 6.75, front - 0.2]} castShadow />
      {/* Door and porch windows */}
      <Box p={[0, 1.9, front + 0.03]} s={[1.8, 2.8, 0.06]} color={PALETTE.door} shadow={false} />
      {/* Drum with a ring of columns, then the dome and lantern */}
      <group position={[0, H + 0.3, 0]}>
        <Cyl p={[0, 0.6, 0]} s={[4.4, 1.2, 4.4]} color={TRIM} />
        <Cyl p={[0, 2.2, 0]} s={[3.5, 2.0, 3.5]} color={STONE} />
        {drumCols.map((a) => (
          <Cyl
            key={a}
            p={[Math.sin(a) * 3.75, 2.2, Math.cos(a) * 3.75]}
            s={[0.16, 2.0, 0.16]}
            color={STONE}
            shadow={false}
          />
        ))}
        <Cyl p={[0, 3.3, 0]} s={[4.0, 0.25, 4.0]} color={TRIM} />
        <mesh
          geometry={HEMI}
          material={mat('#f4efe4', { roughness: 0.55 })}
          position={[0, 3.4, 0]}
          scale={[3.7, 3.3, 3.7]}
          castShadow
        />
        <Cyl p={[0, 7.1, 0]} s={[0.55, 0.9, 0.55]} color={STONE} />
        <mesh geometry={HEMI} material={mat(STONE)} position={[0, 7.55, 0]} scale={[0.6, 0.5, 0.6]} />
        <Cyl p={[0, 8.4, 0]} s={[0.05, 1.2, 0.05]} color={PALETTE.metal} shadow={false} />
        <mesh geometry={GEO.sphere} material={basic(PALETTE.lampWarm)} position={[0, 7.1, 0]} scale={0.3} />
      </group>
    </group>
  );
}

/* ───────────── Halls and tower ───────────── */

function Hall({
  p,
  size: [w, h, d],
  rot,
  brick,
  seed,
  plain,
}: {
  p: V3;
  size: V3;
  rot: number;
  brick: string;
  seed: number;
  plain?: boolean;
}) {
  const colsF = Math.max(2, Math.round(w / 1.6));
  const colsS = Math.max(2, Math.round(d / 1.6));
  const rows = Math.max(1, Math.round(h / 2.1));
  const front = useMemo(() => facadeTextures(colsF, rows, brick, seed), [colsF, rows, brick, seed]);
  const side = useMemo(() => facadeTextures(colsS, rows, brick, seed + 1), [colsS, rows, brick, seed]);
  const frontMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: front.map,
        emissiveMap: front.glow,
        emissive: '#ffffff',
        emissiveIntensity: 0.9,
        roughness: 0.9,
      }),
    [front],
  );
  const sideMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: side.map,
        emissiveMap: side.glow,
        emissive: '#ffffff',
        emissiveIntensity: 0.9,
        roughness: 0.9,
      }),
    [side],
  );
  return (
    <group position={p} rotation={[0, rot, 0]}>
      <Box p={[0, h / 2, 0]} s={[w, h, d]} color={brick} />
      {!plain && <Box p={[0, h + 0.15, 0]} s={[w + 0.3, 0.3, d + 0.3]} color={TRIM} />}
      {!plain && (
        <mesh
          geometry={PYRAMID}
          material={mat(ROOF)}
          position={[0, h + 1.1, 0]}
          rotation={[0, Math.PI / 4, 0]}
          scale={[w * 0.66, 1.6, d * 0.66]}
          castShadow
        />
      )}
      <mesh
        geometry={GEO.plane}
        material={frontMat}
        position={[0, h / 2 - 0.1, d / 2 + 0.02]}
        scale={[w - 0.4, h - 0.6, 1]}
      />
      <mesh
        geometry={GEO.plane}
        material={sideMat}
        position={[w / 2 + 0.02, h / 2 - 0.1, 0]}
        rotation={[0, Math.PI / 2, 0]}
        scale={[d - 0.4, h - 0.6, 1]}
      />
      <mesh
        geometry={GEO.plane}
        material={sideMat}
        position={[-w / 2 - 0.02, h / 2 - 0.1, 0]}
        rotation={[0, -Math.PI / 2, 0]}
        scale={[d - 0.4, h - 0.6, 1]}
      />
    </group>
  );
}

function BellTower({ p }: { p: V3 }) {
  return (
    <group position={p}>
      <Box p={[0, 6, 0]} s={[2.8, 12, 2.8]} color={BRICK} />
      <Box p={[0, 12.2, 0]} s={[3.2, 0.4, 3.2]} color={TRIM} />
      {/* Open belfry: four posts */}
      {[
        [-1.2, -1.2],
        [1.2, -1.2],
        [-1.2, 1.2],
        [1.2, 1.2],
      ].map(([x, z]) => (
        <Box key={`${x}${z}`} p={[x!, 13.5, z!]} s={[0.4, 2.2, 0.4]} color={STONE} />
      ))}
      <Box p={[0, 14.75, 0]} s={[3.2, 0.3, 3.2]} color={TRIM} />
      <mesh
        geometry={PYRAMID}
        material={mat(ROOF)}
        position={[0, 16.1, 0]}
        rotation={[0, Math.PI / 4, 0]}
        scale={[2.3, 2.4, 2.3]}
        castShadow
      />
      {/* Clock faces */}
      {[0, Math.PI / 2, Math.PI, -Math.PI / 2].map((a) => (
        <group key={a} rotation={[0, a, 0]}>
          <mesh geometry={GEO.circle} material={basic('#f7f0de')} position={[0, 10.4, 1.42]} scale={0.8} />
          <Box p={[0, 10.6, 1.45]} s={[0.07, 0.5, 0.02]} color={PALETTE.ink} shadow={false} />
          <Box p={[0.15, 10.4, 1.45]} s={[0.35, 0.07, 0.02]} color={PALETTE.ink} shadow={false} />
        </group>
      ))}
    </group>
  );
}

/* ───────────── Trees, lamps, sign ───────────── */

function CampusTrees({ quality }: { quality: 'high' | 'low' }) {
  const list = useMemo(() => {
    const all = CAMPUS.trees;
    return quality === 'high' ? all : all.filter((_, i) => i % 2 === 0);
  }, [quality]);
  const trunks = useRef<THREE.InstancedMesh>(null);
  const canopy = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const dark = new THREE.Color(PALETTE.leaf);
    const light = new THREE.Color(PALETTE.leafLight);
    list.forEach(([x, z, sc], i) => {
      m.compose(new THREE.Vector3(x, 1.2 * sc, z), q, new THREE.Vector3(0.25 * sc, 2.4 * sc, 0.25 * sc));
      trunks.current?.setMatrixAt(i, m);
      m.compose(new THREE.Vector3(x, 3.2 * sc, z), q, new THREE.Vector3(1.7 * sc, 1.6 * sc, 1.7 * sc));
      canopy.current?.setMatrixAt(i, m);
      canopy.current?.setColorAt(i, i % 3 ? dark : light);
    });
    if (trunks.current) trunks.current.instanceMatrix.needsUpdate = true;
    if (canopy.current) {
      canopy.current.instanceMatrix.needsUpdate = true;
      if (canopy.current.instanceColor) canopy.current.instanceColor.needsUpdate = true;
    }
  }, [list]);
  return (
    <group>
      <instancedMesh
        key={`t${list.length}`}
        ref={trunks}
        args={[GEO.cylinder, mat(PALETTE.trunk), list.length]}
        castShadow
      />
      <instancedMesh
        key={`c${list.length}`}
        ref={canopy}
        args={[GEO.sphere, mat('#ffffff'), list.length]}
        castShadow
      />
    </group>
  );
}

function Lamps() {
  return (
    <group>
      {CAMPUS.lamps.map(([x, z]) => (
        <group key={`${x}${z}`} position={[x, 0, z]}>
          <Cyl p={[0, 1.4, 0]} s={[0.06, 2.8, 0.06]} color={PALETTE.metal} shadow={false} />
          <mesh
            geometry={GEO.sphere}
            material={basic(PALETTE.lampWarm)}
            position={[0, 2.95, 0]}
            scale={0.2}
          />
        </group>
      ))}
    </group>
  );
}

function Sign() {
  const tex = useMemo(() => campusSignTexture(), []);
  return (
    <group position={[6.5, 0, 15.6]}>
      <Box p={[0, 0.55, 0]} s={[5.6, 1.1, 0.5]} color="#8f877c" />
      <mesh geometry={GEO.plane} position={[0, 0.6, 0.26]} scale={[5.2, 0.98, 1]}>
        <meshStandardMaterial map={tex} roughness={0.8} />
      </mesh>
    </group>
  );
}
