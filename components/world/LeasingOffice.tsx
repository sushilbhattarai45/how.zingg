'use client';

import { useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { Block, Box, GEO, mat, PALETTE } from './parts';
import { WallWindow } from './LitWindows';
import { LEASING, GROUND_Y } from './layout';
import { leasingSignTexture } from './canvasTextures';
import { useWorldStore } from './WorldContext';
import { isTap } from './pick';

/** Small leasing office at (17.5, 5.6), door facing +z. Click → open the search / housing sheet. */
export function LeasingOffice() {
  const store = useWorldStore();
  const sign = useMemo(() => leasingSignTexture(), []);
  const glowRef = useRef<THREE.MeshBasicMaterial>(null);
  const glow = useRef(0);
  const doorMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({ color: PALETTE.door, emissive: PALETTE.green, emissiveIntensity: 0 }),
    [],
  );
  const [cx, cz] = LEASING.center;
  const front = cz + LEASING.d / 2;

  useFrame((_, delta) => {
    const { officeGlow, reducedMotion } = store.get();
    // Steady glow (no pulsing): eases on and off over ~0.5 s.
    const k = reducedMotion ? 1 : 1 - Math.exp(-delta * 5);
    glow.current += ((officeGlow ? 1 : 0) - glow.current) * k;
    doorMat.emissiveIntensity = 0.55 * glow.current;
    if (glowRef.current) glowRef.current.opacity = 0.22 * glow.current;
  });

  const pick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (!isTap(e)) return;
    store.emitPick({ kind: 'leasing' });
  };
  const hover = (on: boolean) => () => {
    document.body.style.cursor = on ? 'pointer' : '';
  };

  // Pitched roof: two slabs meeting at a ridge along x.
  const roofPitch = 0.5;
  const halfD = LEASING.d / 2 + 0.35;
  const slab = halfD / Math.cos(roofPitch);
  const gable = useMemo(() => {
    const hw = LEASING.d / 2;
    const shape = new THREE.Shape();
    shape.moveTo(-hw, 0);
    shape.lineTo(hw, 0);
    shape.lineTo(0, Math.tan(roofPitch) * hw);
    shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, { depth: LEASING.w - 0.02, bevelEnabled: false });
    g.rotateY(Math.PI / 2); // extrude along +x; triangle spans z
    return g;
  }, []);

  return (
    <group onClick={pick} onPointerOver={hover(true)} onPointerOut={hover(false)}>
      <group position={[cx, GROUND_Y, cz]}>
        <Block p={[0, 0, 0]} s={[LEASING.w, 0.25, LEASING.d]} color={PALETTE.concrete} />
        <Block p={[0, 0.25, 0]} s={[LEASING.w, LEASING.h, LEASING.d]} color={PALETTE.officeWall} />
        {/* Gables: triangular prism along x */}
        <mesh
          geometry={gable}
          material={mat(PALETTE.officeWall)}
          position={[-(LEASING.w - 0.02) / 2, 0.25 + LEASING.h, 0]}
          castShadow
        />
        <group position={[0, 0.25 + LEASING.h + Math.tan(roofPitch) * halfD * 0.5, 0]}>
          <Box
            p={[0, 0, -halfD / 2]}
            s={[LEASING.w + 0.5, 0.14, slab]}
            r={[-roofPitch, 0, 0]}
            color={PALETTE.officeRoof}
          />
          <Box
            p={[0, 0, halfD / 2]}
            s={[LEASING.w + 0.5, 0.14, slab]}
            r={[roofPitch, 0, 0]}
            color={PALETTE.officeRoof}
          />
        </group>
      </group>

      {/* Door (glows green when the team is ready for you) */}
      <mesh
        geometry={GEO.box}
        material={doorMat}
        position={[cx - 0.9, GROUND_Y + 0.25 + 1.05, front + 0.03]}
        scale={[1.0, 2.1, 0.06]}
        castShadow
      />
      <mesh
        geometry={GEO.circle}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[cx - 0.9, GROUND_Y + 0.06, front + 0.9]}
        scale={[1.3, 1.0, 1]}
      >
        <meshBasicMaterial ref={glowRef} color={PALETTE.green} transparent opacity={0} depthWrite={false} />
      </mesh>
      {/* Awning over the door */}
      <Box
        p={[cx - 0.9, GROUND_Y + 2.55, front + 0.4]}
        s={[1.6, 0.08, 0.8]}
        r={[0.25, 0, 0]}
        color={PALETTE.awning}
      />
      {/* Front window (lit = the office has news for you) */}
      <WallWindow p={[cx + 1.1, GROUND_Y + 1.5, front + 0.04]} facing="+z" target="leasing" w={1.6} h={1.1} />
      {/* Sign */}
      <mesh geometry={GEO.plane} position={[cx + 1.1, GROUND_Y + 2.38, front + 0.06]} scale={[2.0, 0.5, 1]}>
        <meshBasicMaterial map={sign} toneMapped={false} />
      </mesh>
    </group>
  );
}
