import Phaser from 'phaser';

/**
 * Something that walks around: an invisible physics "feet" box plus a separate sprite for the visuals.
 * Keeping them apart lets the sprite hop, squash and stretch without disturbing collisions,
 * and lets movement be smoothed (acceleration / braking) instead of snapping.
 */
export class Actor {
  readonly feet: Phaser.GameObjects.Zone;
  readonly body: Phaser.Physics.Arcade.Body;
  readonly view: Phaser.GameObjects.Sprite;
  protected readonly shadow: Phaser.GameObjects.Image;

  /** extra height above the ground (px), for hops */
  hop = 0;
  /** multiplicative squash applied on top of the base scale */
  squashX = 1;
  squashY = 1;
  facingLeft = false;

  constructor(
    protected readonly scene: Phaser.Scene,
    x: number,
    y: number,
    feetW: number,
    feetH: number,
    texture: string,
    originY: number,
    shadowKey: string,
  ) {
    this.feet = scene.add.zone(x, y, feetW, feetH);
    scene.physics.add.existing(this.feet);
    this.body = this.feet.body as Phaser.Physics.Arcade.Body;
    this.body.setCollideWorldBounds(true);
    this.shadow = scene.add.image(x, y, shadowKey);
    this.view = scene.add.sprite(x, y, texture, 0).setOrigin(0.5, originY);
  }

  get x(): number {
    return this.feet.x;
  }

  get y(): number {
    return this.feet.y;
  }

  setPosition(x: number, y: number): void {
    this.feet.setPosition(x, y);
    this.body.reset(x, y);
  }

  /** Ease the current velocity toward the desired one. `response` ≈ how many times per second it catches up. */
  steer(vx: number, vy: number, dt: number, response = 10): void {
    const k = 1 - Math.exp((-response * dt) / 1000);
    const v = this.body.velocity;
    v.x += (vx - v.x) * k;
    v.y += (vy - v.y) * k;
    if (Math.abs(v.x) < 0.5 && vx === 0) v.x = 0;
    if (Math.abs(v.y) < 0.5 && vy === 0) v.y = 0;
  }

  get speed(): number {
    return this.body.velocity.length();
  }

  /** Turn to face a direction, with a little hysteresis so it doesn't flicker. */
  faceX(dx: number, threshold = 4): void {
    if (dx < -threshold) this.facingLeft = true;
    else if (dx > threshold) this.facingLeft = false;
  }

  /** Quick squash-and-stretch "boing". */
  boing(amount = 0.15, duration = 160): void {
    this.squashX = 1 + amount;
    this.squashY = 1 - amount;
    this.scene.tweens.add({ targets: this, squashX: 1, squashY: 1, duration, ease: 'Back.Out' });
  }

  jump(height = 5, duration = 260): void {
    this.scene.tweens.add({ targets: this, hop: height, duration: duration / 2, yoyo: true, ease: 'Sine.Out' });
  }

  syncView(): void {
    const x = this.feet.x;
    const y = this.feet.y;
    this.view.setPosition(x, y - this.hop);
    this.view.setScale(this.squashX, this.squashY);
    this.view.setDepth(y);
    const s = 1 - Math.min(0.4, this.hop / 20);
    this.shadow.setPosition(x, y).setDepth(y - 0.5).setScale(s);
  }

  destroy(): void {
    this.feet.destroy();
    this.view.destroy();
    this.shadow.destroy();
  }
}
