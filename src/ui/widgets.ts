import Phaser from 'phaser';
import { metrics, px } from './metrics';

export const FONT = '"Tiny5", "Trebuchet MS", sans-serif';
export const INK = '#3b2a2a';
export const CREAM = '#f4e4c1';

export function text(
  scene: Phaser.Scene,
  x: number,
  y: number,
  str: string,
  sizeCss: number,
  opts: { color?: string; bold?: boolean; stroke?: boolean; wrap?: number; align?: 'left' | 'center' | 'right' } = {},
): Phaser.GameObjects.Text {
  const t = scene.add.text(x, y, str, {
    fontFamily: FONT,
    fontSize: `${px(Math.round(sizeCss * 1.15))}px`,
    color: opts.color ?? INK,
    align: opts.align ?? 'left',
    stroke: opts.stroke ? INK : undefined,
    strokeThickness: opts.stroke ? px(4) : 0,
    wordWrap: opts.wrap ? { width: opts.wrap, useAdvancedWrap: true } : undefined,
  });
  return t;
}

/** Cream 9-slice panel sized in canvas pixels (texture pixels are scaled by an integer factor). */
export function panel(scene: Phaser.Scene, x: number, y: number, w: number, h: number, key = 'ui_panel'): Phaser.GameObjects.NineSlice {
  const s = Math.max(1, Math.round(metrics.art / 1.5));
  const ns = scene.add.nineslice(x, y, key, undefined, Math.max(12, w / s), Math.max(12, h / s), 4, 4, 4, 4);
  ns.setScale(s).setOrigin(0, 0);
  return ns;
}

export function icon(scene: Phaser.Scene, x: number, y: number, name: string, scale = metrics.art): Phaser.GameObjects.Image {
  return scene.add.image(x, y, `icon_${name}`).setScale(scale);
}
