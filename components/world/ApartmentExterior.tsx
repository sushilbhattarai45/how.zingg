'use client';

/**
 * Landing only: the apartment starts as a closed two-story building. As the bots arrive
 * (the "to-work" beat) the upper floor and roof lift off and the front and right walls sink to
 * the cutaway lip, revealing the rooms. Scroll-driven, so it reverses when you scroll back up.
 */
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Box, GEO, basic, PALETTE } from './parts';
import { WALL_H } from './layout';
import { facadeTextures } from './canvasTextures';
import { smoothstep } from './cameraRig';
import { useWorldStore } from './WorldContext';
import { BEATS } from '@/content/beats';

const SIDING = '#d8ccb6';
const T = 0.2;
const UPPER_H = 3.0;
const DOOR = { x: -1, w: 2.4 };

/** 0 = closed building, 1 = fully open cutaway, as a function of landing scroll progress. */
export function revealAt(p: number) {
  const [ws, we] = BEATS['to-work'];
  const len = we - ws;
  return smoothstep((p - (ws + len * 0.4)) / (len * 0.45));
}

function useFacade(w: number, h: number, seed: number) {
  return useMemo(() => {
    const { map, glow } = facadeTextures(
      Math.max(2, Math.round(w / 1.7)),
      Math.max(1, Math.round(h / 2.2)),
      SIDING,
      seed,
    );
    return new THREE.MeshStandardMaterial({
      map,
      emissiveMap: glow,
      emissive: '#ffffff',
      emissiveIntensity: 0.85,
      roughness: 0.9,
    });
  }, [w, h, seed]);
}

export function ApartmentExterior() {
  const store = useWorldStore();
  const lid = useRef<THREE.Group>(null);
  const walls = useRef<THREE.Group>(null);
  const root = useRef<THREE.Group>(null);

  const upperFront = useFacade(20, UPPER_H, 21);
  const upperSide = useFacade(14, UPPER_H, 23);
  const lowerLeft = useFacade(8, WALL_H, 25);
  const lowerRight = useFacade(9, WALL_H, 27);
  const lowerSide = useFacade(14, WALL_H, 29);

  useFrame(() => {
    const { scrollProgress, mode } = store.get();
    const r = mode === 'app' ? 1 : revealAt(scrollProgress);
    if (!root.current || !lid.current || !walls.current) return;
    root.current.visible = r < 0.999;
    lid.current.position.y = r * r * 45;
    walls.current.scale.y = 1 - r * 0.9;
  });

  // Front wall pieces either side of the door gap.
  const leftW = DOOR.x - DOOR.w / 2 + 10.2;
  const rightW = 10.2 - (DOOR.x + DOOR.w / 2);
  const leftX = -10.2 + leftW / 2;
  const rightX = 10.2 - rightW / 2;

  return (
    <group ref={root}>
      {/* Front and right walls (sink on reveal) */}
      <group ref={walls}>
        <Box p={[leftX, WALL_H / 2, 7.1]} s={[leftW, WALL_H, T]} color={SIDING} />
        <Box p={[rightX, WALL_H / 2, 7.1]} s={[rightW, WALL_H, T]} color={SIDING} />
        <Box p={[DOOR.x, WALL_H - 0.35, 7.1]} s={[DOOR.w, 0.7, T]} color={SIDING} />
        <Box p={[10.1, WALL_H / 2, 0]} s={[T, WALL_H, 14.4]} color={SIDING} />
        <mesh
          geometry={GEO.plane}
          material={lowerLeft}
          position={[leftX, WALL_H / 2, 7.21]}
          scale={[leftW - 0.5, WALL_H - 0.5, 1]}
        />
        <mesh
          geometry={GEO.plane}
          material={lowerRight}
          position={[rightX, WALL_H / 2, 7.21]}
          scale={[rightW - 0.5, WALL_H - 0.5, 1]}
        />
        <mesh
          geometry={GEO.plane}
          material={lowerSide}
          position={[10.21, WALL_H / 2, 0]}
          rotation={[0, Math.PI / 2, 0]}
          scale={[13.8, WALL_H - 0.5, 1]}
        />
      </group>

      {/* Entrance canopy and porch light stay with the door */}
      <Box p={[DOOR.x, WALL_H - 0.6, 7.75]} s={[DOOR.w + 0.6, 0.12, 1.3]} color={PALETTE.awning} />
      <mesh
        geometry={GEO.sphere}
        material={basic(PALETTE.lampWarm)}
        position={[DOOR.x + 1.6, WALL_H - 0.9, 7.25]}
        scale={0.12}
      />

      {/* Upper floor and roof (lift off on reveal) */}
      <group ref={lid}>
        <Box p={[0, WALL_H + UPPER_H / 2, 0]} s={[20.4, UPPER_H, 14.4]} color={SIDING} />
        <Box p={[0, WALL_H + 0.06, 0]} s={[20.6, 0.12, 14.6]} color={PALETTE.wallTrim} />
        <mesh
          geometry={GEO.plane}
          material={upperFront}
          position={[0, WALL_H + UPPER_H / 2, 7.21]}
          scale={[19.6, UPPER_H - 0.4, 1]}
        />
        <mesh
          geometry={GEO.plane}
          material={upperSide}
          position={[10.21, WALL_H + UPPER_H / 2, 0]}
          rotation={[0, Math.PI / 2, 0]}
          scale={[13.6, UPPER_H - 0.4, 1]}
        />
        {/* Roof slab, parapet, rooftop units */}
        <Box p={[0, WALL_H + UPPER_H + 0.1, 0]} s={[20.8, 0.2, 14.8]} color="#6a6468" />
        <Box p={[0, WALL_H + UPPER_H + 0.4, 7.3]} s={[20.8, 0.4, 0.2]} color={PALETTE.wallTrim} />
        <Box p={[0, WALL_H + UPPER_H + 0.4, -7.3]} s={[20.8, 0.4, 0.2]} color={PALETTE.wallTrim} />
        <Box p={[10.3, WALL_H + UPPER_H + 0.4, 0]} s={[0.2, 0.4, 14.8]} color={PALETTE.wallTrim} />
        <Box p={[-10.3, WALL_H + UPPER_H + 0.4, 0]} s={[0.2, 0.4, 14.8]} color={PALETTE.wallTrim} />
        <Box p={[-5, WALL_H + UPPER_H + 0.6, -2]} s={[2, 0.8, 1.4]} color="#8b878c" />
        <Box p={[4, WALL_H + UPPER_H + 0.5, 1.5]} s={[1.4, 0.6, 1.4]} color="#8b878c" />
        {/* Rooftop terrace: deck, planters, string-light posts */}
        <Box p={[3, WALL_H + UPPER_H + 0.22, -3.5]} s={[8, 0.06, 5]} color={PALETTE.woodPlank} />
        {[-0.8, 6.8].map((x) => (
          <Box key={x} p={[x, WALL_H + UPPER_H + 0.55, -3.5]} s={[0.5, 0.6, 4.6]} color={PALETTE.leaf} />
        ))}
        {[-0.6, 3, 6.6].map((x) => (
          <group key={`l${x}`}>
            <Box p={[x, WALL_H + UPPER_H + 1.2, -1.2]} s={[0.08, 2, 0.08]} color={PALETTE.metal} />
            <mesh
              geometry={GEO.sphere}
              material={basic(PALETTE.lampWarm)}
              position={[x, WALL_H + UPPER_H + 2.2, -1.2]}
              scale={0.12}
            />
          </group>
        ))}
        <Box p={[-6.5, WALL_H + UPPER_H + 0.35, 3.5]} s={[3, 0.3, 2]} color="#3b4552" />
        <Box p={[-2.5, WALL_H + UPPER_H + 0.35, 3.5]} s={[3, 0.3, 2]} color="#3b4552" />
      </group>
    </group>
  );
}
