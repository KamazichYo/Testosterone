import Phaser from 'phaser';
import { DOG_FRAME_H } from '../art/dogArt';
import type { DogData } from '../dogs/types';
import { dogTexture } from './Dog';

/**
 * A dog without physics — used in the shelter, where dogs are placed in pens, on stations and in kennels.
 * Moves smoothly toward a target, plays the right animation, can hop and squash.
 */
export class DogPuppet {
  readonly view: Phaser.GameObjects.Sprite;
  private readonly shadow: Phaser.GameObjects.Image;
  private readonly mood: Phaser.GameObjects.Image;
  private texKey: string;
  private anim = '';
  private tx: number;
  private ty: number;
  private speed = 40;
  private onArrive: (() => void) | null = null;
  private wanderRect: Phaser.Geom.Rectangle | null = null;
  private wanderTimer = 0;
  private restAnim = 'idle';
  hop = 0;
  sx = 1;
  sy = 1;
  facingLeft = false;
  x: number;
  y: number;

  constructor(
    private readonly scene: Phaser.Scene,
    readonly dog: DogData,
    x: number,
    y: number,
  ) {
    this.x = this.tx = x;
    this.y = this.ty = y;
    this.texKey = dogTexture(scene, dog);
    this.shadow = scene.add.image(x, y, dog.look.size === 'large' ? 'shadow_l' : 'shadow_m');
    this.view = scene.add.sprite(x, y, this.texKey, 0).setOrigin(0.5, 22 / DOG_FRAME_H);
    this.mood = scene.add.image(x, y, 'icon_heart').setVisible(false);
    this.play('idle');
  }

  refreshLook(): void {
    const key = dogTexture(this.scene, this.dog);
    if (key === this.texKey) return;
    this.texKey = key;
    this.view.setTexture(key, 0);
    const a = this.anim;
    this.anim = '';
    this.play(a);
  }

  play(name: string): void {
    if (name === this.anim) return;
    this.anim = name;
    this.view.anims.play(`${this.texKey}_${name}`);
  }

  /** Default animation when standing still. */
  rest(name: string): void {
    this.restAnim = name;
  }

  walkTo(x: number, y: number, speed = 40, onArrive?: () => void): void {
    this.tx = x;
    this.ty = y;
    this.speed = speed;
    this.onArrive = onArrive ?? null;
  }

  teleport(x: number, y: number): void {
    this.x = this.tx = x;
    this.y = this.ty = y;
  }

  wanderIn(rect: Phaser.Geom.Rectangle | null): void {
    this.wanderRect = rect;
    this.wanderTimer = Math.random() * 2000;
  }

  showMood(icon: string | null): void {
    if (!icon) {
      this.mood.setVisible(false);
      return;
    }
    if (this.mood.visible && this.mood.texture.key === `icon_${icon}`) return;
    this.mood.setTexture(`icon_${icon}`).setVisible(true).setScale(0.2);
    this.scene.tweens.add({ targets: this.mood, scale: 1, duration: 220, ease: 'Back.Out' });
  }

  jump(h = 5): void {
    this.scene.tweens.add({ targets: this, hop: h, duration: 130, yoyo: true, ease: 'Sine.Out' });
  }

  boing(a = 0.15): void {
    this.sx = 1 + a;
    this.sy = 1 - a;
    this.scene.tweens.add({ targets: this, sx: 1, sy: 1, duration: 200, ease: 'Back.Out' });
  }

  update(dt: number): void {
    const dx = this.tx - this.x;
    const dy = this.ty - this.y;
    const d = Math.hypot(dx, dy);
    if (d > 0.5) {
      const step = Math.min(d, this.speed * (dt / 1000) * Math.min(1, d / 6 + 0.3));
      this.x += (dx / d) * step;
      this.y += (dy / d) * step;
      if (Math.abs(dx) > 1) this.facingLeft = dx < 0;
      this.play(this.speed > 50 ? 'run' : 'walk');
    } else {
      if (this.onArrive) {
        const cb = this.onArrive;
        this.onArrive = null;
        cb();
      }
      if (this.anim === 'walk' || this.anim === 'run') this.play(this.restAnim);
      if (this.wanderRect) {
        this.wanderTimer -= dt;
        if (this.wanderTimer <= 0) {
          this.wanderTimer = 1500 + Math.random() * 3500;
          const p = this.wanderRect.getRandomPoint();
          this.walkTo(p.x, p.y, 22);
        }
      }
    }
    const top = this.dog.look.size === 'large' ? 22 : this.dog.look.size === 'medium' ? 20 : 17;
    this.view.setPosition(this.x, this.y - this.hop).setScale(this.sx, this.sy).setFlipX(this.facingLeft).setDepth(this.y);
    this.shadow.setPosition(this.x, this.y).setDepth(this.y - 0.5);
    this.mood.setPosition(this.x + (this.facingLeft ? -4 : 4), this.y - top - this.hop - Math.sin(this.scene.time.now / 220) * 1.5).setDepth(this.y + 1000);
  }

  destroy(): void {
    this.view.destroy();
    this.shadow.destroy();
    this.mood.destroy();
  }
}
