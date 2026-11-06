'use client';

import { useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { useWorldStore, useWorldState } from './WorldContext';
import { CameraRig } from './CameraRig';
import { Outdoors } from './Outdoors';
import { Apartment } from './Apartment';
import { LeasingOffice } from './LeasingOffice';
import { WindowDriver } from './LitWindows';
import { detectQuality, hasWebGL, prefersReducedMotion } from './quality';
import type { BotId, PickHit, SceneName, WindowTarget, WorldMode } from './store';
import type { FocusTarget } from './cameraRig';

export type WorldHandle = {
  setScene(scene: SceneName): void;
  setScrollProgress(p: number): void;
  lightWindow(target: WindowTarget, on: boolean): void;
  focus(target: FocusTarget): void;
  onPick(cb: (hit: PickHit) => void): () => void;
  /** Bot APIs land in M3; until then they resolve immediately. */
  toss(from: BotId, to: BotId): Promise<void>;
  walkTo(bot: BotId, node: string): Promise<void>;
  playClip(bot: BotId, clip: string, opts?: { loop?: boolean }): void;
};

const SKY = '#2a2630';

export function World({
  mode,
  ref,
  className,
  fallback,
}: {
  mode: WorldMode;
  ref?: React.Ref<WorldHandle>;
  className?: string;
  /** Rendered instead of the canvas when WebGL is unavailable. */
  fallback?: React.ReactNode;
}) {
  const store = useWorldStore();
  const container = useRef<HTMLDivElement>(null);
  const [env, setEnv] = useState<{ quality: 'high' | 'low'; webgl: boolean } | null>(null);
  const scene = useWorldState((s) => s.scene);
  const paused = useWorldState((s) => s.paused);

  useEffect(() => {
    const quality = detectQuality();
    store.set({ mode, quality, reducedMotion: prefersReducedMotion() });
    // eslint-disable-next-line react-hooks/set-state-in-effect -- device detection only exists in the browser
    setEnv({ quality, webgl: hasWebGL() });
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onMq = () => store.set({ reducedMotion: mq.matches });
    mq.addEventListener('change', onMq);
    return () => mq.removeEventListener('change', onMq);
  }, [mode, store]);

  // Pause rendering when off-screen or when the tab is hidden.
  useEffect(() => {
    const el = container.current;
    if (!el) return;
    let visible = true;
    const update = () => store.set({ paused: !visible || document.hidden });
    const io = new IntersectionObserver(([entry]) => {
      visible = !!entry?.isIntersecting;
      update();
    });
    io.observe(el);
    document.addEventListener('visibilitychange', update);
    return () => {
      io.disconnect();
      document.removeEventListener('visibilitychange', update);
    };
  }, [store]);

  useImperativeHandle(
    ref,
    (): WorldHandle => ({
      setScene: (scene) => store.set({ scene }),
      setScrollProgress: (p) => store.set({ scrollProgress: Math.min(1, Math.max(0, p)) }),
      lightWindow: (target, on) => store.setWindow(target, on),
      focus: (target) => store.set({ focus: target }),
      onPick: (cb) => store.onPick(cb),
      toss: async () => {},
      walkTo: async () => {},
      playClip: () => {},
    }),
    [store],
  );

  return (
    <div ref={container} className={className} data-scene={scene} data-mode={mode} aria-hidden="true">
      {env && !env.webgl
        ? fallback
        : env && (
            <Canvas
              orthographic
              shadows={env.quality === 'high' ? 'percentage' : false}
              dpr={env.quality === 'high' ? [1, 2] : [1, 1.5]}
              frameloop={paused ? 'never' : 'always'}
              camera={{ position: [30, 30, 30], zoom: 20, near: 0.1, far: 400 }}
              gl={{
                antialias: true,
                toneMapping: THREE.ACESFilmicToneMapping,
                outputColorSpace: THREE.SRGBColorSpace,
              }}
              style={{ touchAction: mode === 'app' ? 'none' : 'auto' }}
            >
              <color attach="background" args={[SKY]} />
              <fog attach="fog" args={[SKY, 70, 150]} />
              <Lights quality={env.quality} />
              <CameraRig />
              <WindowDriver />
              <Outdoors quality={env.quality} />
              <Apartment quality={env.quality} />
              <LeasingOffice />
            </Canvas>
          )}
    </div>
  );
}

function Lights({ quality }: { quality: 'high' | 'low' }) {
  return (
    <>
      <hemisphereLight args={['#b9b2d6', '#3a3226', 1.6]} />
      <directionalLight
        color="#ffd9b0"
        intensity={2.4}
        position={[14, 22, 12]}
        castShadow={quality === 'high'}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
        shadow-camera-near={1}
        shadow-camera-far={80}
        shadow-bias={-0.0005}
        shadow-normalBias={0.03}
      />
      {/* Warm room lights */}
      <pointLight position={[-6.5, 2.6, -3.5]} color="#ffcf9a" intensity={8} distance={9} decay={1.4} />
      <pointLight position={[-6.5, 2.6, 3.5]} color="#ffcf9a" intensity={6} distance={8} decay={1.4} />
      <pointLight position={[5.5, 2.8, -3.5]} color="#ffd9a8" intensity={8} distance={10} decay={1.4} />
      <pointLight position={[6, 2.8, 3.5]} color="#ffcf9a" intensity={8} distance={10} decay={1.4} />
    </>
  );
}
