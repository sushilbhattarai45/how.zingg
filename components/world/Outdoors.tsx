'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Box, Cyl, Ball, GEO, mat, basic, PALETTE } from './parts';
import { BENCH, GROUND_Y, PATH_POINTS, STREET, STREET_LAMPS, TREES, TREES_LOW } from './layout';

export function Outdoors({ quality }: { quality: 'high' | 'low' }) {
  return (
    <group>
      {/* Ground */}
      <mesh
        geometry={GEO.plane}
        material={mat(PALETTE.grass)}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[4, GROUND_Y, 3]}
        scale={[160, 160, 1]}
        receiveShadow
      />
      <Street />
      <Path />
      <Trees quality={quality} />
      {STREET_LAMPS.map(([x, z]) => (
        <StreetLamp key={`${x}-${z}`} x={x} z={z} />
      ))}
      <Bench />
      <Bushes />
    </group>
  );
}

function Street() {
  const dashes = useMemo(() => Array.from({ length: 26 }, (_, i) => -40 + i * 4), []);
  const y = GROUND_Y + 0.01;
  return (
    <group>
      <Box p={[4, y, STREET.z]} s={[120, 0.02, STREET.width]} color={PALETTE.asphalt} shadow={false} />
      <Box p={[4, y + 0.03, STREET.sidewalkZ]} s={[120, 0.08, 1.4]} color={PALETTE.sidewalk} shadow={false} />
      {dashes.map((x) => (
        <mesh
          key={x}
          geometry={GEO.box}
          material={basic(PALETTE.laneMark)}
          position={[x, y + 0.02, STREET.z]}
          scale={[1.8, 0.01, 0.16]}
        />
      ))}
    </group>
  );
}

function Path() {
  const segs = useMemo(() => {
    const out: { p: [number, number, number]; len: number; angle: number }[] = [];
    for (let i = 0; i < PATH_POINTS.length - 1; i++) {
      const [x1, z1] = PATH_POINTS[i]!;
      const [x2, z2] = PATH_POINTS[i + 1]!;
      const len = Math.hypot(x2 - x1, z2 - z1);
      out.push({ p: [(x1 + x2) / 2, GROUND_Y + 0.025, (z1 + z2) / 2], len, angle: Math.atan2(x2 - x1, z2 - z1) });
    }
    return out;
  }, []);
  return (
    <group>
      {segs.map((s, i) => (
        <Box key={i} p={s.p} s={[1.4, 0.05, s.len]} r={[0, s.angle, 0]} color={PALETTE.path} shadow={false} />
      ))}
      {PATH_POINTS.slice(1, -1).map(([x, z], i) => (
        <mesh
          key={`j${i}`}
          geometry={GEO.cylinder}
          material={mat(PALETTE.path)}
          position={[x, GROUND_Y + 0.025, z]}
          scale={[0.7, 0.05, 0.7]}
          receiveShadow
        />
      ))}
    </group>
  );
}

/** Instanced trees: one draw call for trunks, one for canopies. */
function Trees({ quality }: { quality: 'high' | 'low' }) {
  const list = quality === 'high' ? TREES : TREES_LOW;
  const trunks = useRef<THREE.InstancedMesh>(null);
  const canopy = useRef<THREE.InstancedMesh>(null);
  const canopyCount = list.length * 2;

  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    list.forEach(([x, z, sc], i) => {
      m.compose(new THREE.Vector3(x, GROUND_Y + 1.1 * sc, z), q, new THREE.Vector3(0.22 * sc, 2.2 * sc, 0.22 * sc));
      trunks.current?.setMatrixAt(i, m);
      m.compose(new THREE.Vector3(x, GROUND_Y + 2.9 * sc, z), q, new THREE.Vector3(1.5 * sc, 1.4 * sc, 1.5 * sc));
      canopy.current?.setMatrixAt(i * 2, m);
      m.compose(
        new THREE.Vector3(x + 0.6 * sc, GROUND_Y + 3.5 * sc, z - 0.3 * sc),
        q,
        new THREE.Vector3(0.95 * sc, 0.9 * sc, 0.95 * sc),
      );
      canopy.current?.setMatrixAt(i * 2 + 1, m);
    });
    if (trunks.current) trunks.current.instanceMatrix.needsUpdate = true;
    if (canopy.current) {
      canopy.current.instanceMatrix.needsUpdate = true;
      const light = new THREE.Color(PALETTE.leafLight);
      const dark = new THREE.Color(PALETTE.leaf);
      for (let i = 0; i < canopyCount; i++) canopy.current.setColorAt(i, i % 2 ? light : dark);
      if (canopy.current.instanceColor) canopy.current.instanceColor.needsUpdate = true;
    }
  }, [list, canopyCount]);

  return (
    <group>
      <instancedMesh
        ref={trunks}
        args={[GEO.cylinder, mat(PALETTE.trunk), list.length]}
        castShadow
        receiveShadow
        key={`t${list.length}`}
      />
      <instancedMesh
        ref={canopy}
        args={[GEO.sphere, mat('#ffffff'), canopyCount]}
        castShadow
        receiveShadow
        key={`c${list.length}`}
      />
    </group>
  );
}

function StreetLamp({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, GROUND_Y, z]}>
      <Cyl p={[0, 1.7, 0]} s={[0.06, 3.4, 0.06]} color={PALETTE.metal} />
      <mesh geometry={GEO.sphere} material={basic(PALETTE.lampWarm)} position={[0, 3.5, 0]} scale={0.22} />
      <pointLight position={[0, 3.3, 0]} color="#ffcf8a" intensity={6} distance={9} decay={1.6} />
    </group>
  );
}

function Bench() {
  const [x, , z] = BENCH;
  return (
    <group position={[x, GROUND_Y, z]} rotation={[0, -0.1, 0]}>
      <Box p={[0, 0.45, 0]} s={[1.6, 0.08, 0.5]} color={PALETTE.woodDark} />
      <Box p={[0, 0.75, -0.22]} s={[1.6, 0.4, 0.07]} color={PALETTE.woodDark} />
      <Box p={[-0.65, 0.22, 0]} s={[0.08, 0.45, 0.45]} color={PALETTE.metal} />
      <Box p={[0.65, 0.22, 0]} s={[0.08, 0.45, 0.45]} color={PALETTE.metal} />
    </group>
  );
}

function Bushes() {
  const spots: [number, number, number][] = [
    [-11, 8, 0.6],
    [2.5, 8.2, 0.5],
    [11.2, -1.5, 0.6],
    [11, 5.5, 0.55],
    [20.6, 7.6, 0.55],
    [14.6, 6.8, 0.5],
  ];
  return (
    <group>
      {spots.map(([x, z, r], i) => (
        <Ball key={i} p={[x, GROUND_Y + r * 0.6, z]} s={[r, r * 0.8, r]} color={i % 2 ? PALETTE.leaf : PALETTE.leafLight} />
      ))}
    </group>
  );
}
