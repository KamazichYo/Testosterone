import type Phaser from 'phaser';
import type { PixelCanvas } from './PixelCanvas';

/** Upload a PixelCanvas once under `key` (no-op if it already exists). */
export function ensureTexture(scene: Phaser.Scene, key: string, draw: () => PixelCanvas): string {
  if (!scene.textures.exists(key)) scene.textures.addCanvas(key, draw().toCanvas());
  return key;
}

/** Upload a horizontal strip and register numbered frames 0..n-1. */
export function ensureSheet(scene: Phaser.Scene, key: string, draw: () => PixelCanvas, frameW: number, frameH: number): string {
  if (scene.textures.exists(key)) return key;
  const pc = draw();
  const tex = scene.textures.addCanvas(key, pc.toCanvas())!;
  const n = Math.floor(pc.w / frameW);
  for (let i = 0; i < n; i++) tex.add(i, 0, i * frameW, 0, frameW, frameH);
  return key;
}
