'use client';

import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { OrthographicCamera } from 'three';
import { useWorldStore } from './WorldContext';
import {
  APP_LIMITS,
  FOCUS_POSES,
  LANDING_KEYFRAMES,
  baseFit,
  cameraPosition,
  clamp,
  keyframeIndexAt,
  lerpPose,
  poseAt,
  type CameraPose,
} from './cameraRig';

const DISTANCE = 40;

/**
 * Drives the orthographic camera. Desired pose comes from (in priority order):
 * a scripted pose, landing scroll progress, or the app focus preset + user orbit.
 * The current pose eases toward the desired pose every frame.
 */
export function CameraRig() {
  const store = useWorldStore();
  const camera = useThree((s) => s.camera) as OrthographicCamera;
  const size = useThree((s) => s.size);
  const gl = useThree((s) => s.gl);

  const current = useRef<CameraPose | null>(null);
  const orbit = useRef({ az: 0, el: 0, zoom: 1 });
  const lastFocus = useRef(store.get().focus);
  const offset = useRef(0);

  // App mode: drag to orbit, wheel/pinch to zoom.
  useEffect(() => {
    const el = gl.domElement;
    const pointers = new Map<number, { x: number; y: number }>();
    let pinchStart = 0;
    let zoomStart = 1;

    const onDown = (e: PointerEvent) => {
      if (store.get().mode !== 'app') return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinchStart = Math.hypot(a!.x - b!.x, a!.y - b!.y);
        zoomStart = orbit.current.zoom;
      }
    };
    const onMove = (e: PointerEvent) => {
      const prev = pointers.get(e.pointerId);
      if (!prev || store.get().mode !== 'app') return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a!.x - b!.x, a!.y - b!.y);
        if (pinchStart > 0) orbit.current.zoom = zoomStart * (d / pinchStart);
        return;
      }
      orbit.current.az -= (e.clientX - prev.x) * 0.25;
      orbit.current.el += (e.clientY - prev.y) * 0.2;
    };
    const onUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinchStart = 0;
    };
    const onWheel = (e: WheelEvent) => {
      if (store.get().mode !== 'app') return;
      e.preventDefault();
      orbit.current.zoom *= Math.exp(-e.deltaY * 0.0015);
    };
    el.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      el.removeEventListener('wheel', onWheel);
    };
  }, [gl, store]);

  useFrame((_, dt) => {
    const s = store.get();
    let desired: CameraPose;
    let instant = false;

    if (s.scriptedPose) {
      desired = s.scriptedPose;
    } else if (s.mode === 'landing') {
      if (s.reducedMotion) {
        desired = LANDING_KEYFRAMES[keyframeIndexAt(s.scrollProgress)]!;
        instant = true;
      } else {
        desired = poseAt(s.scrollProgress);
        instant = true; // scroll already smooths; follow exactly so scrubbing feels direct
      }
    } else {
      if (s.focus !== lastFocus.current) {
        orbit.current = { az: 0, el: 0, zoom: 1 };
        lastFocus.current = s.focus;
      }
      const base = FOCUS_POSES[s.focus];
      const az = clamp(base.azimuth + orbit.current.az, APP_LIMITS.azimuth);
      const el = clamp(base.elevation + orbit.current.el, APP_LIMITS.elevation);
      const zoom = clamp(base.zoom * orbit.current.zoom, APP_LIMITS.zoom);
      // Write the clamps back so dragging past a limit doesn't build up hidden offset.
      orbit.current.az = az - base.azimuth;
      orbit.current.el = el - base.elevation;
      orbit.current.zoom = zoom / base.zoom;
      desired = { target: base.target, azimuth: az, elevation: el, zoom };
    }

    if (!current.current || (instant && !s.scriptedPose)) {
      current.current = desired;
    } else {
      const k = s.reducedMotion ? 1 : 1 - Math.exp(-dt * 4);
      current.current = lerpPose(current.current, desired, k);
    }

    const pose = current.current;
    const [x, y, z] = cameraPosition(pose, DISTANCE);
    camera.position.set(x, y, z);
    camera.lookAt(pose.target[0], pose.target[1], pose.target[2]);
    // Landing on desktop: the beat panel sits on the left, so shift the world right.
    const shift = s.mode === 'landing' && size.width >= 768 ? Math.round(size.width * 0.16) : 0;
    if (shift !== offset.current) {
      if (shift) camera.setViewOffset(size.width, size.height, -shift, 0, size.width, size.height);
      else camera.clearViewOffset();
      offset.current = shift;
    }
    const zoom = baseFit(size.width, size.height) * pose.zoom;
    if (Math.abs(camera.zoom - zoom) > 1e-4) {
      camera.zoom = zoom;
      camera.updateProjectionMatrix();
    }
  });

  return null;
}
