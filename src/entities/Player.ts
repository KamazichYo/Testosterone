import Phaser from 'phaser';
import type { DogData } from '../dogs/types';
import { HUMAN_ORIGIN_Y } from '../art/humanArt';
import { Actor } from './Actor';

export type Facing = 'down' | 'up' | 'side';

const SPEED = 74;
const CARRY_SPEED = 62;

export class Player extends Actor {
  facing: Facing = 'down';
  carrying: DogData | null = null;
  private stunnedUntil = 0;
  private throwingUntil = 0;
  private crouchUntil = 0;
  private readonly carrier: Phaser.GameObjects.Image;
  private stepDist = 0;
  /** called every few steps while walking (dust puffs, splashes) */
  onStep: ((x: number, y: number) => void) | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 10, 5, 'player', HUMAN_ORIGIN_Y, 'shadow_s');
    this.carrier = scene.add.image(x, y, 'carrier').setOrigin(0.5, 1).setVisible(false);
  }

  get stunned(): boolean {
    return this.scene.time.now < this.stunnedUntil;
  }

  stun(ms: number, fromX: number, fromY: number): void {
    this.stunnedUntil = this.scene.time.now + ms;
    const a = Math.atan2(this.y - fromY, this.x - fromX);
    this.body.velocity.set(Math.cos(a) * 130, Math.sin(a) * 130);
    this.boing(0.25, 300);
    this.scene.tweens.add({ targets: this.view, alpha: 0.5, yoyo: true, repeat: 2, duration: 100, onComplete: () => this.view.setAlpha(1) });
  }

  /** Crouch for a moment (picking up, petting). */
  crouch(ms = 320): void {
    this.crouchUntil = this.scene.time.now + ms;
  }

  /** Arm-throw pose for a moment. */
  throwPose(): void {
    this.throwingUntil = this.scene.time.now + 260;
    this.boing(0.08, 160);
  }

  drive(ix: number, iy: number, dt: number): void {
    if (this.stunned) {
      this.steer(0, 0, dt, 4);
      return;
    }
    const len = Math.hypot(ix, iy);
    const speed = this.carrying ? CARRY_SPEED : SPEED;
    if (len > 0.12) {
      const k = Math.min(1, len);
      this.steer((ix / len) * speed * k, (iy / len) * speed * k, dt, 11);
      // facing with hysteresis so diagonals don't flicker between side/up/down
      const ax = Math.abs(ix);
      const ay = Math.abs(iy);
      if (this.facing === 'side') {
        if (ay > ax * 1.3) this.facing = iy < 0 ? 'up' : 'down';
      } else if (ax > ay * 1.3) this.facing = 'side';
      else this.facing = iy < 0 ? 'up' : 'down';
      if (this.facing === 'side') this.faceX(ix, 0.05);
    } else {
      this.steer(0, 0, dt, 9);
    }
    this.animate(dt);
  }

  private animate(dt: number): void {
    const sp = this.speed;
    const moving = sp > 8;
    const dir = this.facing;
    let name: string;
    if (this.scene.time.now < this.crouchUntil && !moving) name = 'crouch';
    else if (this.scene.time.now < this.throwingUntil) name = 'throw';
    else if (this.carrying) name = moving ? 'carryWalk' : 'carryIdle';
    else name = moving ? 'walk' : 'idle';
    const key = `player_${dir}_${name}`;
    if (this.view.anims.currentAnim?.key !== key) this.view.anims.play(key);
    if (moving) this.view.anims.msPerFrame = Phaser.Math.Clamp(9000 / sp, 85, 200);
    this.view.setFlipX(dir === 'side' && this.facingLeft);

    if (moving) {
      this.stepDist += (sp * dt) / 1000;
      if (this.stepDist > 14) {
        this.stepDist = 0;
        this.onStep?.(this.x, this.y);
      }
    }
  }

  pickUp(dog: DogData): void {
    this.crouch(280);
    this.carrying = dog;
    this.carrier.setVisible(true).setScale(0.2);
    this.scene.tweens.add({ targets: this.carrier, scale: 1, duration: 280, ease: 'Back.Out' });
    this.boing(0.12, 220);
  }

  drop(): DogData | null {
    const d = this.carrying;
    this.carrying = null;
    this.scene.tweens.add({ targets: this.carrier, scale: 0, duration: 160, onComplete: () => this.carrier.setVisible(false).setScale(1) });
    this.boing(0.1, 200);
    return d;
  }

  syncView(): void {
    super.syncView();
    const frame = Number(this.view.frame.name);
    const walkBob = this.carrying && this.speed > 8 && frame % 2 === 1 ? 1 : 0;
    this.carrier.setPosition(this.x, this.y - 30 - this.hop + walkBob).setDepth(this.y + 0.5);
  }

  destroy(): void {
    this.carrier.destroy();
    super.destroy();
  }
}
