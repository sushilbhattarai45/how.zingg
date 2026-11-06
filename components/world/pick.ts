import type { ThreeEvent } from '@react-three/fiber';

/** True when the pointer barely moved between down and up (a tap, not an orbit drag). */
export function isTap(e: ThreeEvent<MouseEvent>): boolean {
  return e.delta < 6;
}

export function setHoverCursor(on: boolean) {
  if (typeof document !== 'undefined') document.body.style.cursor = on ? 'pointer' : '';
}
