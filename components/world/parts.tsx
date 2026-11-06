'use client';

/**
 * Shared geometries and materials for the procedural world. One instance of each, reused
 * everywhere, keeps draw-call setup cheap and GPU memory flat.
 */
import * as THREE from 'three';
import type { ThreeElements } from '@react-three/fiber';

export const PALETTE = {
  grass: '#41603d',
  grassDark: '#3a5636',
  asphalt: '#3b393c',
  laneMark: '#e9e3d6',
  sidewalk: '#8c8680',
  path: '#8f877c',
  concrete: '#8a8580',
  wood: '#c08a5b',
  woodDark: '#8a5a36',
  woodPlank: '#b47e50',
  tile: '#e5dccb',
  wallWhite: '#ece6da',
  wallSage: '#a9b8a0',
  wallTrim: '#d9d1c2',
  brick: '#a65a43',
  counter: '#5f5b62',
  counterTop: '#7b777e',
  fridge: '#d8dade',
  sofa: '#e07a3c',
  sofaDark: '#c4652c',
  armchair: '#4d5b73',
  rugRed: '#c9545b',
  rugOchre: '#d9a441',
  bedFrame: '#7b4a2c',
  blanket: '#6b7db8',
  sheet: '#f1ede4',
  plantPot: '#c96b4a',
  leaf: '#4f8a46',
  leafLight: '#62a055',
  trunk: '#6b4a32',
  metal: '#3a373b',
  lampWarm: '#ffd9a0',
  officeWall: '#e7e1d4',
  officeRoof: '#4b4548',
  awning: '#4f8f84',
  door: '#4a6e66',
  ink: '#191719',
  chalk: '#ffffff',
  green: '#6dbd13',
  glassDark: '#2b3a33',
} as const;

type Color = (typeof PALETTE)[keyof typeof PALETTE] | string;

const materialCache = new Map<string, THREE.MeshStandardMaterial>();

/** Shared standard material per color (+ optional roughness/emissive variant key). */
export function mat(color: Color, opts: { roughness?: number; metalness?: number } = {}) {
  const key = `${color}|${opts.roughness ?? 0.85}|${opts.metalness ?? 0}`;
  let m = materialCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      roughness: opts.roughness ?? 0.85,
      metalness: opts.metalness ?? 0,
    });
    materialCache.set(key, m);
  }
  return m;
}

const basicCache = new Map<string, THREE.MeshBasicMaterial>();
/** Unlit material (for glowing bulbs, lane marks). */
export function basic(color: Color, opacity = 1) {
  const key = `${color}|${opacity}`;
  let m = basicCache.get(key);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color), transparent: opacity < 1, opacity });
    basicCache.set(key, m);
  }
  return m;
}

export const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cylinder: new THREE.CylinderGeometry(1, 1, 1, 20),
  cone: new THREE.ConeGeometry(1, 1, 20),
  sphere: new THREE.SphereGeometry(1, 20, 14),
  plane: new THREE.PlaneGeometry(1, 1),
  circle: new THREE.CircleGeometry(1, 28),
};

type V3 = [number, number, number];

type PrimProps = {
  p?: V3;
  s?: V3;
  r?: V3;
  color?: Color;
  material?: THREE.Material;
  shadow?: boolean;
} & Omit<ThreeElements['mesh'], 'position' | 'scale' | 'rotation' | 'geometry' | 'material'>;

function prim(geometry: THREE.BufferGeometry) {
  return function Prim({ p, s, r, color = '#ffffff', material, shadow = true, ...rest }: PrimProps) {
    return (
      <mesh
        geometry={geometry}
        material={material ?? mat(color)}
        position={p}
        scale={s}
        rotation={r}
        castShadow={shadow}
        receiveShadow
        {...rest}
      />
    );
  };
}

/** Box with its center at `p` and size `s`. */
export const Box = prim(GEO.box);
/** Cylinder: s = [radius, height, radius]. */
export const Cyl = prim(GEO.cylinder);
export const Cone = prim(GEO.cone);
/** Sphere: s = radii. */
export const Ball = prim(GEO.sphere);

/** Box sitting on the floor: `p` is [x, floorY, z], size `s`. */
export function Block({ p = [0, 0, 0], s = [1, 1, 1], ...rest }: PrimProps) {
  return <Box p={[p[0], p[1] + s[1] / 2, p[2]]} s={s} {...rest} />;
}
