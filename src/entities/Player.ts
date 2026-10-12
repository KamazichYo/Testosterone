import Phaser from 'phaser';
import type { DogData } from '../dogs/types';

export type Facing = 'down' | 'up' | 'side';

const SPEED = 72;
const CARRY_SPEED = 60;

export class Player extends Phaser.Physics.Arcade.Sprite {
  facing: Facing = 'down';
  carrying: DogData | null = null;
  private stunnedUntil = 0;
  private readonly shadow: Phaser.GameObjects.Image;
  private readonly carrier: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'player', 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setOrigin(0.5, 1);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(10, 5).setOffset(3, 18);
    body.setCollideWorldBounds(true);
    this.shadow = scene.add.image(x, y, 'shadow_s').setOrigin(0.5, 0.5);
    this.carrier = scene.add.image(x, y, 'carrier').setOrigin(0.5, 1).setVisible(false);
  }

  get stunned(): boolean {
    return this.scene.time.now < this.stunnedUntil;
  }

  stun(ms: number, fromX: number, fromY: number): void {
    this.stunnedUntil = this.scene.time.now + ms;
    const a = Math.atan2(this.y - fromY, this.x - fromX);
    this.setVelocity(Math.cos(a) * 140, Math.sin(a) * 140);
    this.scene.tweens.add({ targets: this, alpha: 0.4, yoyo: true, repeat: 3, duration: 90, onComplete: () => this.setAlpha(1) });
  }

  drive(ix: number, iy: number): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (this.stunned) {
      body.velocity.scale(0.86);
      return;
    }
    const len = Math.hypot(ix, iy);
    const speed = this.carrying ? CARRY_SPEED : SPEED;
    if (len > 0.15) {
      const k = Math.min(1, len);
      this.setVelocity((ix / len) * speed * k, (iy / len) * speed * k);
      if (Math.abs(ix) > Math.abs(iy) * 0.9) {
        this.facing = 'side';
        this.setFlipX(ix < 0);
      } else {
        this.facing = iy < 0 ? 'up' : 'down';
        this.setFlipX(false);
      }
      this.anims.play(`player_${this.facing}_walk`, true);
      this.anims.msPerFrame = 1000 / (6 + 5 * k);
    } else {
      this.setVelocity(0, 0);
      this.anims.play(`player_${this.facing}_idle`, true);
    }
  }

  pickUp(dog: DogData): void {
    this.carrying = dog;
    this.carrier.setVisible(true).setScale(0.2);
    this.scene.tweens.add({ targets: this.carrier, scale: 1, duration: 260, ease: 'Back.Out' });
  }

  drop(): DogData | null {
    const d = this.carrying;
    this.carrying = null;
    this.carrier.setVisible(false);
    return d;
  }

  syncAttachments(): void {
    this.setDepth(this.y);
    this.shadow.setPosition(this.x, this.y - 1).setDepth(this.y - 0.5);
    const bob = this.anims.currentFrame && this.anims.currentAnim?.key.endsWith('walk') ? (this.anims.currentFrame.index % 2) : 0;
    this.carrier.setPosition(this.x, this.y - 23 + bob).setDepth(this.y + 0.5);
  }

  destroy(fromScene?: boolean): void {
    this.shadow.destroy();
    this.carrier.destroy();
    super.destroy(fromScene);
  }
}
