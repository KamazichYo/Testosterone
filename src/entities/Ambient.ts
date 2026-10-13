import Phaser from 'phaser';
import { play } from '../core/sfx';

interface Point {
  x: number;
  y: number;
}

/** Pigeons peck around and burst into the air when someone runs at them. */
export class Pigeon {
  private readonly sprite: Phaser.GameObjects.Sprite;
  private readonly shadow: Phaser.GameObjects.Image;
  private x: number;
  private y: number;
  private alt = 0;
  private vx = 0;
  private vy = 0;
  private state: 'walk' | 'peck' | 'idle' | 'fly' | 'gone' = 'idle';
  private timer = 0;
  private tx = 0;
  private ty = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly home: { x: number; y: number; r: number },
  ) {
    this.x = home.x + Phaser.Math.Between(-home.r, home.r);
    this.y = home.y + Phaser.Math.Between(-home.r, home.r) * 0.5;
    this.shadow = scene.add.image(this.x, this.y, 'shadow_s').setScale(0.6);
    this.sprite = scene.add.sprite(this.x, this.y, 'pigeon', 0).setOrigin(0.5, 1);
    this.timer = Math.random() * 2000;
  }

  update(dt: number, threats: Point[]): void {
    this.timer -= dt;
    if (this.state !== 'fly' && this.state !== 'gone') {
      for (const t of threats) {
        if (Phaser.Math.Distance.Between(t.x, t.y, this.x, this.y) < 30) {
          this.takeOff(t);
          break;
        }
      }
    }
    switch (this.state) {
      case 'idle':
        if (this.timer <= 0) this.next();
        break;
      case 'peck':
        if (this.timer <= 0) this.next();
        break;
      case 'walk': {
        const dx = this.tx - this.x;
        const dy = this.ty - this.y;
        const d = Math.hypot(dx, dy);
        if (d < 1 || this.timer <= 0) this.next();
        else {
          this.x += (dx / d) * 14 * (dt / 1000);
          this.y += (dy / d) * 14 * (dt / 1000);
          this.sprite.setFlipX(dx < 0);
        }
        break;
      }
      case 'fly':
        this.x += this.vx * (dt / 1000);
        this.y += this.vy * (dt / 1000);
        this.alt += 34 * (dt / 1000);
        if (this.timer <= 0) {
          this.state = 'gone';
          this.timer = 6000 + Math.random() * 6000;
          this.scene.tweens.add({ targets: [this.sprite, this.shadow], alpha: 0, duration: 300 });
        }
        break;
      case 'gone':
        if (this.timer <= 0) this.land();
        break;
    }
    this.sprite.setPosition(this.x, this.y - this.alt).setDepth(this.y + (this.alt > 2 ? 500 : 0));
    this.shadow.setPosition(this.x, this.y).setDepth(this.y - 0.5).setScale(0.6 * Math.max(0.3, 1 - this.alt / 40));
  }

  private next(): void {
    const r = Math.random();
    if (r < 0.4) {
      this.state = 'peck';
      this.timer = 600 + Math.random() * 800;
      this.sprite.anims.play('pigeon_peck');
    } else if (r < 0.75) {
      this.state = 'walk';
      this.timer = 2500;
      this.tx = this.home.x + Phaser.Math.Between(-this.home.r, this.home.r);
      this.ty = this.home.y + Phaser.Math.Between(-this.home.r, this.home.r) * 0.5;
      this.sprite.anims.play('pigeon_walk');
    } else {
      this.state = 'idle';
      this.timer = 800 + Math.random() * 1500;
      this.sprite.anims.stop();
      this.sprite.setFrame(0);
    }
  }

  private takeOff(from: Point): void {
    this.state = 'fly';
    this.timer = 1300;
    const a = Math.atan2(this.y - from.y, this.x - from.x) + Phaser.Math.FloatBetween(-0.6, 0.6);
    this.vx = Math.cos(a) * 70;
    this.vy = Math.sin(a) * 40 - 10;
    this.sprite.setFlipX(this.vx < 0);
    this.sprite.anims.play('pigeon_fly');
    if (Math.random() < 0.5) play('flutter');
  }

  private land(): void {
    this.alt = 0;
    this.x = this.home.x + Phaser.Math.Between(-this.home.r, this.home.r);
    this.y = this.home.y + Phaser.Math.Between(-this.home.r, this.home.r) * 0.5;
    this.state = 'idle';
    this.timer = 500;
    this.sprite.anims.stop();
    this.sprite.setFrame(0);
    this.scene.tweens.add({ targets: [this.sprite, this.shadow], alpha: 1, duration: 400 });
  }
}

/** A cat lounging on a container or roof; hisses at dogs that come too close. */
export class Cat {
  private readonly sprite: Phaser.GameObjects.Sprite;
  private flickTimer = 2000;
  private hissing = false;

  constructor(
    private readonly scene: Phaser.Scene,
    readonly x: number,
    readonly y: number,
    private readonly variant: number,
  ) {
    this.sprite = scene.add.sprite(x, y, `cat_${variant}`, 0).setOrigin(0.5, 1).setDepth(y + 40);
  }

  update(dt: number, dogs: Point[]): void {
    const near = dogs.some((d) => Phaser.Math.Distance.Between(d.x, d.y, this.x, this.y + 20) < 44);
    if (near !== this.hissing) {
      this.hissing = near;
      this.sprite.setFrame(near ? 2 : 0);
      if (near) {
        play('hiss');
        this.scene.tweens.add({ targets: this.sprite, scaleY: 1.12, yoyo: true, duration: 120 });
      }
    }
    if (!this.hissing) {
      this.flickTimer -= dt;
      if (this.flickTimer <= 0) {
        this.flickTimer = 1800 + Math.random() * 2500;
        this.sprite.setFrame(1);
        this.scene.time.delayedCall(350, () => !this.hissing && this.sprite.setFrame(0));
      }
    }
  }

  get key(): number {
    return this.variant;
  }
}

/** Butterflies flutter in loops over flowerbeds. */
export class Butterfly {
  private readonly sprite: Phaser.GameObjects.Sprite;
  private t = Math.random() * 100;

  constructor(
    scene: Phaser.Scene,
    private readonly cx: number,
    private readonly cy: number,
    color: number,
  ) {
    this.sprite = scene.add.sprite(cx, cy, `butterfly_${color}`, 0).setDepth(cy + 600);
    this.sprite.anims.play(`butterfly_${color}_flap`);
  }

  update(dt: number): void {
    this.t += dt / 1000;
    const x = this.cx + Math.sin(this.t * 0.9) * 18 + Math.sin(this.t * 2.3) * 4;
    const y = this.cy - 10 + Math.sin(this.t * 1.4) * 8 + Math.cos(this.t * 3.1) * 2;
    this.sprite.setFlipX(Math.cos(this.t * 0.9) < 0).setPosition(x, y);
  }
}

/** Collectable lying on the ground: bobs and sparkles. */
export class Pickup {
  readonly sprite: Phaser.GameObjects.Image;
  private readonly shadow: Phaser.GameObjects.Image;
  private t = Math.random() * 10;
  collected = false;

  constructor(
    private readonly scene: Phaser.Scene,
    readonly id: string,
    readonly kind: string,
    readonly x: number,
    readonly y: number,
  ) {
    this.shadow = scene.add.image(x, y, 'shadow_s').setScale(0.7).setDepth(y - 1);
    this.sprite = scene.add.image(x, y, `pickup_${kind}`).setOrigin(0.5, 1).setDepth(y);
  }

  update(dt: number): void {
    if (this.collected) return;
    this.t += dt / 1000;
    this.sprite.y = this.y - 2 - Math.abs(Math.sin(this.t * 2.4)) * 3;
    if (Math.random() < dt / 1800) {
      const s = this.scene.add.image(this.x + Phaser.Math.Between(-5, 5), this.sprite.y - Phaser.Math.Between(4, 10), 'fx_sparkle').setDepth(this.y + 1).setScale(0.2);
      this.scene.tweens.add({ targets: s, scale: 0.7, alpha: 0, duration: 500, onComplete: () => s.destroy() });
    }
  }

  collect(toX: number, toY: number): void {
    this.collected = true;
    this.shadow.destroy();
    this.scene.tweens.add({
      targets: this.sprite,
      x: toX,
      y: toY - 26,
      scale: 1.4,
      duration: 220,
      ease: 'Quad.Out',
      onComplete: () => this.scene.tweens.add({ targets: this.sprite, alpha: 0, scale: 0.4, y: toY - 34, duration: 220, onComplete: () => this.sprite.destroy() }),
    });
  }

  destroy(): void {
    this.sprite.destroy();
    this.shadow.destroy();
  }
}

/** Autumn leaves drifting down from tree crowns. */
export class LeafFall {
  private readonly leaves: { img: Phaser.GameObjects.Image; vx: number; vy: number; t: number; groundY: number; life: number }[] = [];
  private spawnTimer = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly sources: { x: number; y: number; top: number }[],
  ) {}

  update(dt: number, view: Phaser.Geom.Rectangle): void {
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.sources.length) {
      this.spawnTimer = 350 + Math.random() * 500;
      const visible = this.sources.filter((s) => view.contains(s.x, s.y) || view.contains(s.x, s.top));
      if (visible.length) {
        const s = Phaser.Utils.Array.GetRandom(visible);
        const img = this.scene.add.image(s.x + Phaser.Math.Between(-12, 12), s.top + Phaser.Math.Between(4, 16), `leaf_${Phaser.Math.Between(0, 2)}`);
        this.leaves.push({ img, vx: Phaser.Math.FloatBetween(-6, 6), vy: Phaser.Math.FloatBetween(9, 14), t: Math.random() * 6, groundY: s.y + Phaser.Math.Between(-4, 10), life: 0 });
      }
    }
    for (let i = this.leaves.length - 1; i >= 0; i--) {
      const l = this.leaves[i];
      l.t += dt / 1000;
      if (l.img.y < l.groundY) {
        l.img.x += (l.vx + Math.sin(l.t * 3) * 10) * (dt / 1000);
        l.img.y += l.vy * (dt / 1000);
        l.img.setFlipX(Math.sin(l.t * 3) > 0);
        l.img.setDepth(l.groundY + 400);
      } else {
        l.life += dt;
        l.img.setDepth(l.groundY - 5);
        if (l.life > 2500) {
          l.img.setAlpha(1 - (l.life - 2500) / 800);
          if (l.life > 3300) {
            l.img.destroy();
            this.leaves.splice(i, 1);
          }
        }
      }
    }
  }
}
