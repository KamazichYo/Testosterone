import Phaser from 'phaser';
import { DOG_FRAME_H, DOG_FRAME_W, DOG_FRAMES, drawDogSheet } from '../art/dogArt';
import { ensureSheet } from '../art/textures';
import { play } from '../core/sfx';
import { applyMeal, isAggressive, reactToPlayer, SMELL_RADIUS, wantsFood } from '../dogs/behaviour';
import type { DogData } from '../dogs/types';
import { Actor } from './Actor';
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
const EAT_MS = 3000;

/** Builds (once) the sprite sheet + animations for a dog's current look. */
export function dogTexture(scene: Phaser.Scene, dog: DogData): string {
  const angry = isAggressive(dog.stats) && dog.state === 'wild';
  const hungry = dog.stats.hunger >= 60;
  const dirt = Math.round((dog.stats.dirt / 100) * 4) / 4;
  const tagged = !!dog.tagId;
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
    anim('sleep', DOG_FRAMES.sleepBreath, 1.2);
    anim('happy', DOG_FRAMES.happy, 5);
    anim('sit', DOG_FRAMES.sit, 4);
    anim('shake', DOG_FRAMES.shake, 12);
  }
  return key;
}

export class DogActor extends Actor {
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
  private ignoreFoodMs = 0;
  private readonly baseSpeed: number;
  private readonly mood: Phaser.GameObjects.Image;
  private moodName = '';
  private animName = '';
  private desired = new Phaser.Math.Vector2();
  private response = 8;

  constructor(scene: Phaser.Scene, dog: DogData, x = dog.home.x, y = dog.home.y) {
    const key = dogTexture(scene, dog);
    super(scene, x, y, 14, 5, key, 22 / DOG_FRAME_H, dog.look.size === 'large' ? 'shadow_l' : 'shadow_m');
    this.dog = dog;
    this.texKey = key;
    this.baseSpeed = SPEED[dog.look.size] + (dog.traits.includes('fidget') ? 10 : 0);
    this.mood = scene.add.image(x, y, 'icon_heart').setVisible(false);
    this.facingLeft = Math.random() < 0.5;
    this.enter(Math.random() < 0.3 ? 'sleep' : 'idle', 1000 + Math.random() * 3000);
  }

  get isCatchable(): boolean {
    if (this.dog.state !== 'wild') return false;
    return this.mode === 'eat' || this.mode === 'content' || this.mode === 'follow';
  }

  get pitch(): number {
    return this.dog.look.size === 'small' ? 1.35 : this.dog.look.size === 'large' ? 0.75 : 1;
  }

  /** Re-generate the sprite when the dog's look changes (calmer, fed…). */
  refreshLook(): void {
    const key = dogTexture(this.scene, this.dog);
    if (key === this.texKey) return;
    this.texKey = key;
    this.view.setTexture(key, 0);
    const name = this.animName;
    this.animName = '';
    this.playAnim(name || 'idle');
  }

  private playAnim(name: string): void {
    if (this.animName === name && this.view.anims.isPlaying) return;
    this.animName = name;
    this.view.anims.play(`${this.texKey}_${name}`);
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

  private want(vx: number, vy: number, response = 8): void {
    this.desired.set(vx, vy);
    this.response = response;
  }

  private moveTo(x: number, y: number, speed: number, response = 8): number {
    const dx = x - this.x;
    const dy = y - this.y;
    const d = Math.hypot(dx, dy);
    // slow down on arrival instead of stopping dead
    const s = speed * Math.min(1, d / 10);
    if (d < 1) this.want(0, 0);
    else this.want((dx / d) * s, (dy / d) * s, response);
    return d;
  }

  private moveAway(fx: number, fy: number, speed: number): void {
    const a = Math.atan2(this.y - fy, this.x - fx);
    this.want(Math.cos(a) * speed, Math.sin(a) * speed, 9);
  }

  private pickWanderTarget(): void {
    const h = this.dog.home;
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * h.radius;
    this.target = new Phaser.Math.Vector2(h.x + Math.cos(a) * r, h.y + Math.sin(a) * r * 0.8);
  }

  private findFood(foods: FoodPile[]): FoodPile | null {
    if (this.ignoreFoodMs > 0 || !wantsFood(this.dog.stats)) return null;
    let best: FoodPile | null = null;
    let bestD = SMELL_RADIUS;
    for (const f of foods) {
      if (f.eaten) continue;
      const d = Phaser.Math.Distance.Between(this.x, this.y, f.x, f.y);
      if (d >= bestD) continue;
      if (f.claimedBy && f.claimedBy !== this) {
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
    this.ignoreFoodMs = 1400;
    this.boing(0.2, 250);
    this.jump(4, 220);
    if (isAggressive(this.dog.stats)) {
      this.enter('retreat', 900);
      this.attackCooldown = 2500;
      play('bark', this.pitch);
    } else {
      this.enter('flee', 1300);
      this.moveAway(fromX, fromY, this.baseSpeed * 1.6);
    }
    this.refreshLook();
  }

  /** Petting a friendly released dog. */
  pet(): void {
    this.enter('content', 2500);
    this.jump(4, 240);
    play('happy', this.pitch);
  }

  tick(dt: number, world: DogWorld): void {
    const p = world.player;
    const dist = Phaser.Math.Distance.Between(this.x, this.y, p.x, p.y);
    this.modeLeft -= dt;
    this.attackCooldown -= dt;
    this.ignoreFoodMs -= dt;

    // hunger beats almost everything: the dog follows its nose
    if (this.mode !== 'eat' && this.mode !== 'charge' && this.mode !== 'toFood' && this.mode !== 'content') {
      const f = this.findFood(world.foods);
      if (f) {
        f.claimedBy = this;
        this.enter('toFood');
        this.food = f;
        this.boing(0.12, 180);
      }
    }

    switch (this.mode) {
      case 'idle': {
        this.want(0, 0);
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
        const d = this.moveTo(this.target!.x, this.target!.y, this.baseSpeed * 0.55, 5);
        this.playAnim('walk');
        if (this.speed < 5 && this.desired.length() > 5) this.stuckMs += dt;
        if (d < 4 || this.modeLeft <= 0 || this.stuckMs > 600) {
          this.target = null;
          this.enter('idle', 1200 + Math.random() * 2500);
        }
        break;
      }
      case 'sleep': {
        this.want(0, 0);
        this.playAnim('sleep');
        if (dist < 30) {
          this.jump(3, 200);
          this.enter('idle', 400);
          const r = reactToPlayer(this.dog, dist);
          if (r) this.react(r, p);
        } else if (this.modeLeft <= 0) this.enter('idle', 1000);
        break;
      }
      case 'alert': {
        this.want(0, 0);
        this.faceX(p.x - this.x, 1);
        this.barkTimer -= dt;
        if (this.barkTimer <= 0) {
          this.barkTimer = 1100 + Math.random() * 600;
          this.animName = 'bark';
          this.view.anims.play(`${this.texKey}_bark`);
          this.boing(0.14, 200);
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
        this.moveTo(p.x, p.y, this.baseSpeed * 2, 14);
        this.playAnim('run');
        if (dist < 9) {
          this.scene.events.emit('dog-bite', this);
          this.attackCooldown = 3500;
          this.enter('retreat', 800);
        } else if (this.modeLeft <= 0) this.enter('retreat', 600);
        break;
      }
      case 'retreat': {
        this.moveAway(p.x, p.y, this.baseSpeed);
        this.playAnim('walk');
        if (this.modeLeft <= 0) this.enter(isAggressive(this.dog.stats) ? 'alert' : 'idle', 600);
        break;
      }
      case 'flee': {
        if (dist < 90 || this.modeLeft > 0) {
          this.moveAway(p.x, p.y, this.baseSpeed * 1.5);
          this.playAnim('run');
          if (this.speed < 8) this.stuckMs += dt;
          if (this.stuckMs > 600) {
            // cornered: freeze and tremble
            this.want(0, 0);
            this.playAnim('idle');
          }
        } else this.want(0, 0);
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
        const d = this.moveTo(f.x + side, f.y + 1, this.baseSpeed * 1.15, 9);
        this.playAnim('run');
        // can't get there (an obstacle in the way)? give up instead of pushing forever
        if (this.speed < 6 && d > 4) this.stuckMs += dt;
        else this.stuckMs = Math.max(0, this.stuckMs - dt);
        if (this.stuckMs > 900) {
          if (f.claimedBy === this) f.claimedBy = null;
          this.ignoreFoodMs = 3500;
          this.pickWanderTarget();
          this.enter('wander', 2500);
          break;
        }
        if (d < 3) {
          this.want(0, 0);
          this.facingLeft = f.x < this.x;
          this.eatProgress = 0;
          this.enter('eat', EAT_MS);
          this.food = f;
        }
        break;
      }
      case 'eat': {
        this.want(0, 0);
        this.playAnim('eat');
        this.eatProgress += dt / EAT_MS;
        this.food?.setEaten(this.eatProgress);
        if (this.modeLeft <= 0) {
          this.food?.consume();
          this.food = null;
          applyMeal(this.dog);
          this.refreshLook();
          play('happy', this.pitch);
          this.jump(5, 260);
          this.boing(0.12, 240);
          this.scene.events.emit('dog-fed', this);
          this.enter('content', 4500);
        }
        break;
      }
      case 'content': {
        this.want(0, 0);
        this.playAnim(this.modeLeft > 2500 ? 'happy' : 'sit');
        if (this.modeLeft <= 0) this.enter('idle', 1500);
        break;
      }
      case 'follow': {
        if (dist > 120 || (isAggressive(this.dog.stats) && this.dog.state === 'wild')) {
          this.enter('idle', 1000);
          break;
        }
        if (dist > 22) {
          this.moveTo(p.x, p.y, this.baseSpeed * 0.95, 6);
          this.playAnim('walk');
        } else {
          this.want(0, 0);
          this.faceX(p.x - this.x, 1);
          this.playAnim('sit');
        }
        break;
      }
    }

    this.steer(this.desired.x, this.desired.y, dt, this.response);
    const v = this.body.velocity;
    if (this.mode !== 'alert' && this.mode !== 'eat' && Math.abs(v.x) > 6) this.faceX(v.x, 6);
    // animation speed follows actual speed so feet don't skate
    if (this.animName === 'walk' || this.animName === 'run') {
      this.view.anims.msPerFrame = Phaser.Math.Clamp(3200 / Math.max(10, this.speed), 55, 160);
    }
    this.updateMood();
  }

  private react(r: 'alert' | 'flee' | 'follow', p: Player): void {
    if (r === 'alert') {
      this.barkTimer = 0;
      this.enter('alert');
    } else if (r === 'flee') {
      this.jump(3, 180);
      this.enter('flee', 1300);
      this.moveAway(p.x, p.y, this.baseSpeed * 1.5);
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
        icon = 'heart';
        break;
      case 'follow':
        icon = this.dog.state === 'wild' ? 'heart' : '';
        break;
    }
    if (icon !== this.moodName) {
      this.moodName = icon;
      if (icon) {
        this.mood.setVisible(true).setTexture(`icon_${icon}`).setScale(0.2).setAlpha(1);
        this.scene.tweens.add({ targets: this.mood, scale: 1, duration: 240, ease: 'Back.Out' });
      } else {
        this.scene.tweens.add({ targets: this.mood, scale: 0, alpha: 0, duration: 150, onComplete: () => this.mood.setVisible(false) });
      }
    }
  }

  syncView(): void {
    super.syncView();
    this.view.setFlipX(this.facingLeft);
    const top = this.dog.look.size === 'large' ? 22 : this.dog.look.size === 'medium' ? 20 : 17;
    const t = this.scene.time.now;
    this.mood.setPosition(this.x + (this.facingLeft ? -4 : 4), this.y - top - this.hop - Math.sin(t / 220) * 1.5).setDepth(this.y + 1000);
  }

  destroy(): void {
    if (this.food?.claimedBy === this) this.food.claimedBy = null;
    this.mood.destroy();
    super.destroy();
  }
}
