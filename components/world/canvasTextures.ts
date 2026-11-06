'use client';

/** Canvas-drawn textures (signs, whiteboard, map, call screen). Created once and cached. */
import * as THREE from 'three';

const cache = new Map<string, THREE.CanvasTexture>();

function make(key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const hit = cache.get(key);
  if (hit) return hit;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  draw(ctx);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  cache.set(key, tex);
  return tex;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

const FONT = '"Nunito", ui-rounded, system-ui, sans-serif';

export function leasingSignTexture() {
  return make('leasing-sign', 512, 128, (ctx) => {
    ctx.fillStyle = '#191719';
    roundRect(ctx, 0, 0, 512, 128, 28);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = `800 64px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Leasing Office', 256, 68);
  });
}

export function whiteboardTexture() {
  return make('whiteboard', 512, 320, (ctx) => {
    ctx.fillStyle = '#f7f5f0';
    ctx.fillRect(0, 0, 512, 320);
    ctx.fillStyle = '#191719';
    ctx.font = `800 40px ${FONT}`;
    ctx.fillText('Calls today', 28, 58);
    const rows: [string, string][] = [
      ['#6dbd13', 'Oak Hollow'],
      ['#f2c46b', 'Pine Row · 9 AM'],
      ['#8b878c', 'Magnolia Ct'],
    ];
    rows.forEach(([c, t], i) => {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(44, 120 + i * 64, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#3a373b';
      ctx.font = `700 32px ${FONT}`;
      ctx.fillText(t, 72, 131 + i * 64);
    });
  });
}

export function mapTexture() {
  return make('campus-map', 512, 384, (ctx) => {
    ctx.fillStyle = '#efe9dc';
    ctx.fillRect(0, 0, 512, 384);
    ctx.strokeStyle = '#d7cdb8';
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    [
      [20, 120, 492, 160],
      [140, 10, 200, 374],
      [20, 300, 492, 250],
      [360, 10, 330, 374],
    ].forEach(([a, b, c, d]) => {
      ctx.beginPath();
      ctx.moveTo(a!, b!);
      ctx.lineTo(c!, d!);
      ctx.stroke();
    });
    ctx.fillStyle = '#cfe3b8';
    roundRect(ctx, 210, 170, 110, 70, 14);
    ctx.fill();
    ctx.fillStyle = '#3a373b';
    ctx.font = `800 26px ${FONT}`;
    ctx.fillText('USM', 238, 214);
  });
}

/** Animated call waveform: redraw on the returned texture via `drawWaveform`. */
export function waveformTexture() {
  return make('waveform', 256, 160, (ctx) => drawWave(ctx, 0));
}

function drawWave(ctx: CanvasRenderingContext2D, t: number) {
  ctx.fillStyle = '#191719';
  ctx.fillRect(0, 0, 256, 160);
  ctx.fillStyle = '#ff8a4c';
  for (let i = 0; i < 18; i++) {
    const h = 14 + Math.abs(Math.sin(t * 3 + i * 0.7)) * 70 * (0.5 + 0.5 * Math.sin(i * 1.3 + t));
    ctx.beginPath();
    ctx.roundRect(22 + i * 12, 80 - h / 2, 7, h, 4);
    ctx.fill();
  }
}

export function drawWaveform(tex: THREE.CanvasTexture, t: number) {
  const canvas = tex.image as HTMLCanvasElement;
  drawWave(canvas.getContext('2d')!, t);
  tex.needsUpdate = true;
}

export function luggageTagTexture(text = 'KTM→PIB') {
  return make(`tag-${text}`, 256, 96, (ctx) => {
    ctx.fillStyle = '#f2c230';
    roundRect(ctx, 0, 0, 256, 96, 20);
    ctx.fill();
    ctx.fillStyle = '#191719';
    ctx.font = `800 44px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(text, 128, 64);
  });
}

/** Chalk pill name tag with a colored dot. Returns the texture and its aspect (w/h). */
export function nameTagTexture(name: string, color: string) {
  const key = `tag:${name}:${color}`;
  const hit = cache.get(key);
  if (hit)
    return {
      tex: hit,
      aspect: (hit.image as HTMLCanvasElement).width / (hit.image as HTMLCanvasElement).height,
    };
  const scale = 4;
  const h = 26 * scale;
  const measure = document.createElement('canvas').getContext('2d')!;
  measure.font = `800 ${14 * scale}px ${FONT}`;
  const textW = measure.measureText(name).width;
  const w = Math.ceil(textW + 40 * scale);
  const tex = make(key, w, h, (ctx) => drawTag(ctx, w, h, scale, name, color));
  // Redraw once web fonts are ready so the tag uses Nunito.
  document.fonts?.ready.then(() => {
    const c = tex.image as HTMLCanvasElement;
    drawTag(c.getContext('2d')!, c.width, c.height, scale, name, color);
    tex.needsUpdate = true;
  });
  return { tex, aspect: w / h };
}

function drawTag(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  scale: number,
  name: string,
  color: string,
) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#f7f5f0';
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(13 * scale, h / 2, 4.5 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#191719';
  ctx.font = `800 ${14 * scale}px ${FONT}`;
  ctx.textBaseline = 'middle';
  ctx.fillText(name, 24 * scale, h / 2 + scale);
}

/** Speech bubble: chalk rounded box with a tail at the bottom center, ink text. Aspect is w/h. */
export function bubbleTexture(text: string) {
  const key = `bubble:${text}`;
  const hit = cache.get(key);
  const sizeOf = (t: THREE.CanvasTexture) => {
    const c = t.image as HTMLCanvasElement;
    return { tex: t, aspect: c.width / c.height };
  };
  if (hit) return sizeOf(hit);
  const scale = 4;
  const font = `800 ${15 * scale}px ${FONT}`;
  const measure = document.createElement('canvas').getContext('2d')!;
  measure.font = font;
  const w = Math.ceil(measure.measureText(text).width + 36 * scale);
  const h = 44 * scale;
  const tex = make(key, w, h, (ctx) => drawBubble(ctx, w, h, scale, text, font));
  document.fonts?.ready.then(() => {
    const c = tex.image as HTMLCanvasElement;
    drawBubble(c.getContext('2d')!, c.width, c.height, scale, text, font);
    tex.needsUpdate = true;
  });
  return sizeOf(tex);
}

function drawBubble(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  scale: number,
  text: string,
  font: string,
) {
  const body = h - 10 * scale;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(0, 0, w, body, body / 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(w / 2 - 8 * scale, body - 1);
  ctx.lineTo(w / 2, h);
  ctx.lineTo(w / 2 + 8 * scale, body - 1);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#191719';
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, body / 2 + scale);
}

/** Campus sign: stone panel, plain type. No logos (DESIGN.md §12). */
export function campusSignTexture() {
  return make('campus-sign', 1024, 192, (ctx) => {
    ctx.fillStyle = '#e9e3d6';
    ctx.fillRect(0, 0, 1024, 192);
    ctx.fillStyle = '#2c2a2d';
    ctx.font = `800 64px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('University of Southern', 512, 66);
    ctx.fillText('Mississippi', 512, 138);
  });
}

/**
 * Brick facade with a window grid. Returns a color map and an emissive map (only lit windows),
 * so lit windows glow warm in the evening without extra lights.
 */
export function facadeTextures(cols: number, rows: number, brick: string, seed: number) {
  const cw = 64;
  const ch = 80;
  const w = cols * cw;
  const h = rows * ch;
  let s = seed * 9301 + 49297;
  const rand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  const lit: boolean[] = Array.from({ length: cols * rows }, () => rand() < 0.45);
  const cell = (ctx: CanvasRenderingContext2D, i: number, fill: string) => {
    const c = i % cols;
    const r = Math.floor(i / cols);
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.roundRect(c * cw + 16, r * ch + 18, cw - 32, ch - 32, 6);
    ctx.fill();
  };
  const map = make(`facade:${cols}:${rows}:${brick}:${seed}`, w, h, (ctx) => {
    ctx.fillStyle = brick;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    for (let y = 0; y < h; y += 10) ctx.fillRect(0, y, w, 1.5);
    ctx.fillStyle = '#e9e3d6';
    for (let i = 0; i < cols * rows; i++) {
      const c = i % cols;
      const r = Math.floor(i / cols);
      ctx.fillRect(c * cw + 12, r * ch + 14, cw - 24, ch - 24);
    }
    for (let i = 0; i < cols * rows; i++) cell(ctx, i, lit[i] ? '#ffd9a0' : '#2b2a33');
  });
  const glow = make(`facade-glow:${cols}:${rows}:${seed}`, w, h, (ctx) => {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < cols * rows; i++) if (lit[i]) cell(ctx, i, '#ffc98a');
  });
  return { map, glow };
}
