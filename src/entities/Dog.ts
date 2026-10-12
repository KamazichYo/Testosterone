import Phaser from 'phaser';
import { DOG_FRAME_H, DOG_FRAME_W, DOG_FRAMES, drawDogSheet } from '../art/dogArt';
import { ensureSheet } from '../art/textures';
import { play } from '../core/sfx';
import { applyMeal, isAggressive, reactToPlayer, SMELL_RADIUS, wantsFood } from '../dogs/behaviour';
import type { DogData } from '../dogs/types';
import type { FoodPile } from './FoodPile';
import type { Player } from './Player';

export type DogMode =
  | 'wander'
  | 'idle'
  | 'sleep'
  | 'alert'
  | 'charge'
  | 'retreat'
  | 'flee'
  | 'toFood'
  | 'eat'
  | 'content'
  | 'follow';

export interface DogWorld {
  player: Player;
  foods: FoodPile[];
}

const SPEED = { small: 52, medium: 48, large: 44 } as const;
const EAT_MS = 3200;

/** Builds (once) the sprite sheet + animations for a dog's current look. */
export function dogTexture(scene: Phaser.Scene, dog: DogData): string {
  const angry = isAggressive(dog.stats);
  const hungry = dog.stats.hunger >= 60;
  const dirt = Math.round((dog.stats.dirt / 100) * 4) / 4;
  const tagged = dog.state === 'tagged';
  const key = `dog_${dog.id}_${+angry}${+hungry}${+tagged}_${dirt}`;
  if (!scene.textures.exists(key)) {
    ensureSheet(scene, key, () => drawDogSheet(dog.look, { dirt, angry, hungry, tagged }), DOG_FRAME_W, DOG_FRAME_H);
    const anim = (name: string, frames: readonly number[], rate: number, repeat = -1) =>
      scene.anims.create({ key: `${key}_${name}`, frames: frames.map((frame) => ({ key, frame })), frameRate: rate, repeat });
    anim('idle', DOG_FRAMES.idle, 2.5);
    anim('walk', DOG_FRAMES.walk, 10);
    anim('run', DOG_FRAMES.walk, 15);
    anim('eat', DOG_FRAMES.eat, 4);
    anim('bark', [DOG_FRAMES.bark[0], DOG_FRAMES.idle[0]], 5);
    anim('sleep', DOG_FRAMES.sleep, 1);
    anim('happy', DOG_FRAMES.happy, 5);
  }
  return key;
}

export class DogActor extends Phaser.Physics.Arcade.Sprite {
  readonly dog: DogData;
  mode: DogMode = 'idle';
  private modeLeft = 0;
  private texKey: string;
  private target: Phaser.Math.Vector2 | null = null;
  private food: FoodPile | null = null;
  private eatProgress = 0;
  private attackCooldown = 0;
  private barkTimer = 0;
  private stuckMs = 0;
  private readonly speed: number;
  private readonly shadow: Phaser.GameObjects.Image;
  private readonly mood: Phaser.GameObjects.Image;
  private moodName = '';

  constructor(scene: Phaser.Scene, dog: DogData) {
    const key = dogTexture(scene, dog);
    super(scene, dog.home.x, dog.home.y, key, 0);
    this.dog = dog;
    this.texKey = key;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setOrigin(0.5, 22 / DOG_FRAME_H);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(14, 5).setOffset(9, 17);
    body.setCollideWorldBounds(true);
    this.speed = SPEED[dog.look.size] + (dog.traits.includes('fidget') ? 10 : 0);
    this.shadow = scene.add.image(this.x, this.y, dog.look.size === 'large' ? 'shadow_l' : 'shadow_m');
    this.mood = scene.add.image(this.x, this.y, 'icon_heart').setVisible(false);
    this.setFlipX(Math.random() < 0.5);
    this.enter(Math.random() < 0.3 ? 'sleep' : 'idle', 1000 + Math.random() * 3000);
  }

  get isCatchable(): boolean {
    return this.mode === 'eat' || this.mode === 'content' || this.mode === 'follow';
  }

  /** Re-generate the sprite when the dog's look changes (calmer, fed…). */
  refreshLook(): void {
    const key = dogTexture(this.scene, this.dog);
    if (key === this.texKey) return;
    this.texKey = key;
    this.setTexture(key, 0);
    this.playAnim(this.currentAnimName, true);
  }

  private currentAnimName = 'idle';
  private playAnim(name: string, force = false): void {
    if (!force && this.currentAnimName === name && this.anims.isPlaying) return;
    this.currentAnimName = name;
    this.anims.play(`${this.texKey}_${name}`, !force);
  }

  private enter(mode: DogMode, ms = 0): void {
    this.mode = mode;
    this.modeLeft = ms;
    this.stuckMs = 0;
    if (mode !== 'toFood' && mode !== 'eat' && this.food) {
      if (this.food.claimedBy === this) this.food.claimedBy = null;
      this.food = null;
    }
  }

  private moveTo(x: number, y: number, speed: number): number {
    const dx = x - this.x;
    const dy = y - this.y;
    const d = Math.hypot(dx, dy);
    if (d < 1) {
      this.setVelocity(0, 0);
      return d;
    }
    this.setVelocity((dx / d) * speed, (dy / d) * speed);
    if (Math.abs(dx) > 0.5) this.setFlipX(dx < 0);
    return d;
  }

  private moveAway(fx: number, fy: number, speed: number): void {
    const a = Math.atan2(this.y - fy, this.x - fx);
    this.setVelocity(Math.cos(a) * speed, Math.sin(a) * speed);
    this.setFlipX(Math.cos(a) < 0);
  }

  private face(x: number): void {
    this.setFlipX(x < this.x);
  }

  private pickWanderTarget(): void {
    const h = this.dog.home;
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * h.radius;
    this.target = new Phaser.Math.Vector2(h.x + Math.cos(a) * r, h.y + Math.sin(a) * r * 0.8);
  }

  private findFood(foods: FoodPile[]): FoodPile | null {
    if (!wantsFood(this.dog.stats)) return null;
    let best: FoodPile | null = null;
    let bestD = SMELL_RADIUS;
    for (const f of foods) {
      if (f.eaten) continue;
      const d = Phaser.Math.Distance.Between(this.x, this.y, f.x, f.y);
      if (d >= bestD) continue;
      if (f.claimedBy && f.claimedBy !== this) {
        // take it over only if we are clearly closer
        const other = Phaser.Math.Distance.Between(f.claimedBy.x, f.claimedBy.y, f.x, f.y);
        if (f.claimedBy.mode === 'eat' || other < d * 1.5) continue;
      }
      best = f;
      bestD = d;
    }
    return best;
  }

  /** Called by the scene when a catch attempt fails. */
  startle(fromX: number, fromY: number): void {
    if (isAggressive(this.dog.stats)) {
      this.enter('retreat', 900);
      this.attackCooldown = 2500;
      play('bark', this.pitch);
    } else {
      this.enter('flee', 1500);
      this.moveAway(fromX, fromY, this.speed * 1.6);
    }
    this.refreshLook();
  }

  get pitch(): number {
    return this.dog.look.size === 'small' ? 1.35 : this.dog.look.size === 'large' ? 0.75 : 1;
  }

  tick(dt: number, world: DogWorld): void {
    const p = world.player;
    const dist = Phaser.Math.Distance.Between(this.x, this.y, p.x, p.y);
    this.modeLeft -= dt;
    this.attackCooldown -= dt;
    const body = this.body as Phaser.Physics.Arcade.Body;

    // hunger beats almost everything: a hungry dog follows its nose
    if (this.mode !== 'eat' && this.mode !== 'charge' && this.mode !== 'toFood' && this.mode !== 'content') {
      const f = this.findFood(world.foods);
      if (f) {
        this.food = f;
        f.claimedBy = this;
        this.enter('toFood');
        this.food = f;
      }
    }

    switch (this.mode) {
      case 'idle': {
        this.setVelocity(0, 0);
        this.playAnim('idle');
        const r = reactToPlayer(this.dog, dist);
        if (r) this.react(r, p);
        else if (this.modeLeft <= 0) {
          const sleepy = this.dog.traits.includes('sleepy') ? 0.45 : 0.2;
          if (Math.random() < sleepy) this.enter('sleep', 4000 + Math.random() * 6000);
          else {
            this.pickWanderTarget();
            this.enter('wander', 6000);
          }
        }
        break;
      }
      case 'wander': {
        const r = reactToPlayer(this.dog, dist);
        if (r) {
          this.react(r, p);
          break;
        }
        if (!this.target) this.pickWanderTarget();
        const d = this.moveTo(this.target!.x, this.target!.y, this.speed * 0.55);
        this.playAnim('walk');
        if (body.speed < 5) this.stuckMs += dt;
        if (d < 4 || this.modeLeft <= 0 || this.stuckMs > 500) {
          this.target = null;
          this.enter('idle', 1200 + Math.random() * 2500);
        }
        break;
      }
      case 'sleep': {
        this.setVelocity(0, 0);
        this.playAnim('sleep');
        if (dist < 30) {
          this.enter('idle', 400);
          const r = reactToPlayer(this.dog, dist);
          if (r) this.react(r, p);
        } else if (this.modeLeft <= 0) this.enter('idle', 1000);
        break;
      }
      case 'alert': {
        this.setVelocity(0, 0);
        this.face(p.x);
        this.barkTimer -= dt;
        if (this.barkTimer <= 0) {
          this.barkTimer = 1100 + Math.random() * 600;
          this.anims.play(`${this.texKey}_bark`);
          this.currentAnimName = 'bark';
          if (dist < 110) play('bark', this.pitch);
        }
        if (!isAggressive(this.dog.stats) || dist > 96) this.enter('idle', 800);
        else if (dist < 30 && this.attackCooldown <= 0 && !p.stunned) {
          play('growl', this.pitch);
          this.enter('charge', 700);
        }
        break;
      }
      case 'charge': {
        this.moveTo(p.x, p.y, this.speed * 2);
        this.playAnim('run');
        if (dist < 9) {
          this.scene.events.emit('dog-bite', this);
          this.attackCooldown = 3500;
          this.enter('retreat', 800);
        } else if (this.modeLeft <= 0) this.enter('retreat', 600);
        break;
      }
      case 'retreat': {
        this.moveAway(p.x, p.y, this.speed);
        this.playAnim('walk');
        if (this.modeLeft <= 0) this.enter(isAggressive(this.dog.stats) ? 'alert' : 'idle', 600);
        break;
      }
      case 'flee': {
        if (dist < 90 || this.modeLeft > 0) {
          this.moveAway(p.x, p.y, this.speed * 1.5);
          this.playAnim('run');
          if (body.speed < 5) this.stuckMs += dt;
          if (this.stuckMs > 600) {
            // cornered: freeze and tremble
            this.setVelocity(0, 0);
            this.playAnim('idle');
          }
        }
        if (dist > 100 && this.modeLeft <= 0) this.enter('idle', 1000);
        else if (this.modeLeft <= 0) this.modeLeft = 300;
        break;
      }
      case 'toFood': {
        const f = this.food;
        if (!f || f.eaten || (f.claimedBy && f.claimedBy !== this)) {
          this.enter('idle', 500);
          break;
        }
        const side = this.x < f.x ? -10 : 10;
        const d = this.moveTo(f.x + side, f.y + 1, this.speed * 1.15);
        this.playAnim('run');
        if (d < 3) {
          this.setVelocity(0, 0);
          this.face(f.x);
          this.eatProgress = 0;
          this.enter('eat', EAT_MS);
          this.food = f;
        }
        break;
      }
      case 'eat': {
        this.setVelocity(0, 0);
        this.playAnim('eat');
        this.eatProgress += dt / EAT_MS;
        this.food?.setEaten(this.eatProgress);
        if (this.modeLeft <= 0) {
          this.food?.consume();
          this.food = null;
          applyMeal(this.dog);
          this.refreshLook();
          play('happy', this.pitch);
          this.scene.events.emit('dog-fed', this);
          this.enter('content', 5000);
        }
        break;
      }
      case 'content': {
        this.setVelocity(0, 0);
        this.playAnim('happy');
        if (this.modeLeft <= 0) this.enter('idle', 1500);
        break;
      }
      case 'follow': {
        if (dist > 120 || isAggressive(this.dog.stats)) {
          this.enter('idle', 1000);
          break;
        }
        if (dist > 20) {
          this.moveTo(p.x, p.y, this.speed * 0.9);
          this.playAnim('walk');
        } else {
          this.setVelocity(0, 0);
          this.face(p.x);
          this.playAnim('happy');
        }
        break;
      }
    }

    this.updateMood();
  }

  private react(r: 'alert' | 'flee' | 'follow', p: Player): void {
    if (r === 'alert') {
      this.barkTimer = 0;
      this.enter('alert');
    } else if (r === 'flee') {
      this.enter('flee', 1400);
      this.moveAway(p.x, p.y, this.speed * 1.5);
    } else this.enter('follow');
  }

  private updateMood(): void {
    let icon = '';
    switch (this.mode) {
      case 'alert':
      case 'charge':
        icon = 'angry';
        break;
      case 'flee':
        icon = 'sweat';
        break;
      case 'sleep':
        icon = 'zzz';
        break;
      case 'toFood':
        icon = 'bone';
        break;
      case 'content':
      case 'follow':
        icon = 'heart';
        break;
    }
    if (icon !== this.moodName) {
      this.moodName = icon;
      this.mood.setVisible(!!icon);
      if (icon) {
        this.mood.setTexture(`icon_${icon}`).setScale(0.3);
        this.scene.tweens.add({ targets: this.mood, scale: 1, duration: 220, ease: 'Back.Out' });
      }
    }
  }

  syncAttachments(time: number): void {
    this.setDepth(this.y);
    this.shadow.setPosition(this.x, this.y - 1).setDepth(this.y - 0.5);
    const top = this.dog.look.size === 'large' ? 22 : this.dog.look.size === 'medium' ? 20 : 17;
    this.mood.setPosition(this.x + (this.flipX ? -4 : 4), this.y - top - Math.sin(time / 200) * 1.5).setDepth(this.y + 1000);
  }

  destroy(fromScene?: boolean): void {
    if (this.food?.claimedBy === this) this.food.claimedBy = null;
    this.shadow.destroy();
    this.mood.destroy();
    super.destroy(fromScene);
  }
}
