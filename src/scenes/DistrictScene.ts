import Phaser from 'phaser';
import { bakeGround, TILE } from '../art/ground';
import { drawProp, PROP_COLLIDER, propKey } from '../art/propFactory';
import { ensureTexture } from '../art/textures';
import { play, vibrate } from '../core/sfx';
import { gameState } from '../core/state';
import { DistrictDef, garagesDistrict } from '../data/garages';
import { applyCatchFail, catchDifficulty, catchReward, CatchDifficulty, isAggressive, isTrusting } from '../dogs/behaviour';
import { generateDistrictDogs } from '../dogs/generator';
import { g, type DogData } from '../dogs/types';
import { DogActor } from '../entities/Dog';
import { FoodPile } from '../entities/FoodPile';
import { Player } from '../entities/Player';
import { controls } from '../ui/controls';

export type ActionKind = 'none' | 'feed' | 'catch' | 'deposit' | 'refill' | 'carrying' | 'nofood';

export interface ContextInfo {
  kind: ActionKind;
  hint: string;
  /** dog shown in the info card */
  dog: DogData | null;
  dogMode: string | null;
  /** direction (screen space, normalised) to the van when it is off-screen and needed */
  vanArrow: { x: number; y: number } | null;
  caught: number;
  total: number;
}

export interface CatchRequest {
  dog: DogData;
  difficulty: CatchDifficulty;
}

const THROW_RANGE = 110;
const CATCH_RANGE = 26;
const VAN_RANGE = 42;
const WORLD_VIEW = 200; // ~world pixels visible across the narrow side

export class DistrictScene extends Phaser.Scene {
  private def!: DistrictDef;
  private player!: Player;
  private dogs: DogActor[] = [];
  private foods: FoodPile[] = [];
  private walls: Phaser.GameObjects.Zone[] = [];
  private van!: Phaser.GameObjects.Image;
  private ctxInfo: ContextInfo | null = null;
  private ctxTarget: DogActor | null = null;
  private lastCtxKey = '';
  private lastThrow = 0;
  private catching: DogActor | null = null;
  private totalDogs = 0;

  constructor() {
    super('District');
  }

  create(): void {
    this.def = garagesDistrict();
    const def = this.def;
    const W = def.cols * TILE;
    const H = def.rows * TILE;
    this.dogs = [];
    this.foods = [];
    this.walls = [];
    this.catching = null;
    this.lastCtxKey = '';

    const groundKey = ensureTexture(this, `ground_${def.id}`, () => bakeGround(def.ground, def.decals, 1));
    this.add.image(0, 0, groundKey).setOrigin(0, 0).setDepth(-100000);
    this.physics.world.setBounds(0, 0, W, H);

    for (const p of def.props) {
      const key = ensureTexture(this, propKey(p), () => drawProp(p));
      if (p.kind === 'tree' || p.kind === 'treeAutumn' || p.kind === 'birch') {
        this.add.image(p.x, p.y - 1, 'shadow_l').setScale(1.3, 1.2).setDepth(p.y - 1);
      }
      this.add.image(p.x, p.y, key).setOrigin(0.5, 1).setDepth(p.y);
      const col = PROP_COLLIDER[p.kind];
      if (!col) continue;
      const h = p.kind === 'pipeV' ? (p.length ?? 0) - 6 : col.h;
      if (h > 0) this.addWall(p.x, p.y - h / 2, col.w, h);
    }

    // the shelter van
    this.add.image(def.van.x, def.van.y - 1, 'shadow_xl').setDepth(def.van.y - 1);
    this.van = this.add.image(def.van.x, def.van.y, 'van').setOrigin(0.5, 1).setDepth(def.van.y);
    this.addWall(def.van.x, def.van.y - 7, 52, 12);

    this.player = new Player(this, def.playerStart.x, def.playerStart.y);
    this.physics.add.collider(this.player, this.walls);

    this.spawnDogs();

    const cam = this.cameras.main;
    cam.setBounds(0, 0, W, H);
    cam.startFollow(this.player, true, 0.14, 0.14);
    cam.setFollowOffset(0, -20); // keep the hero above the bottom UI
    cam.setRoundPixels(true);
    this.layout();
    this.scale.on('resize', this.layout, this);

    this.events.on('dog-bite', this.onBite, this);
    this.events.on('dog-fed', this.onFed, this);
    this.game.events.on('action', this.onAction, this);
    this.game.events.on('catch-result', this.onCatchResult, this);
    this.game.events.on('district-restart', this.restartDistrict, this);
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.layout, this);
      this.game.events.off('action', this.onAction, this);
      this.game.events.off('catch-result', this.onCatchResult, this);
      this.game.events.off('district-restart', this.restartDistrict, this);
    });
  }

  private addWall(x: number, y: number, w: number, h: number): void {
    const z = this.add.zone(x, y, w, h);
    this.physics.add.existing(z, true);
    this.walls.push(z);
  }

  private spawnDogs(): void {
    const all = generateDistrictDogs(this.def.dogs, 1);
    this.totalDogs = all.length;
    for (const d of all) {
      if (gameState.data.caught.includes(d.id)) continue;
      const actor = new DogActor(this, d);
      this.physics.add.collider(actor, this.walls);
      this.dogs.push(actor);
    }
  }

  private layout(): void {
    const { width, height } = this.scale.gameSize;
    const mapW = this.def.cols * TILE;
    const mapH = this.def.rows * TILE;
    // never show more than the map itself (wide screens), otherwise ~WORLD_VIEW px across
    const minZoom = Math.ceil(Math.max(width / mapW, height / mapH));
    const zoom = Math.max(1, minZoom, Math.round(Math.min(width / WORLD_VIEW, height / (WORLD_VIEW * 1.7))));
    this.cameras.main.setSize(width, height).setZoom(zoom);
  }

  update(_time: number, rawDelta: number): void {
    const dt = Math.min(rawDelta, 50);
    this.player.drive(controls.x, controls.y);
    this.player.syncAttachments();
    const world = { player: this.player, foods: this.foods };
    for (const d of this.dogs) {
      d.tick(dt, world);
      d.syncAttachments(this.time.now);
    }
    this.foods = this.foods.filter((f) => !f.eaten || f.claimedBy?.mode === 'eat');
    this.updateContext();
  }

  // ---------------------------------------------------------------- context / hints

  private nearestDog(maxDist: number, filter: (d: DogActor) => boolean = () => true): DogActor | null {
    let best: DogActor | null = null;
    let bestD = maxDist;
    for (const d of this.dogs) {
      if (!filter(d)) continue;
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, d.x, d.y);
      if (dist < bestD) {
        best = d;
        bestD = dist;
      }
    }
    return best;
  }

  private updateContext(): void {
    const p = this.player;
    const food = gameState.data.food;
    const nearVan = Phaser.Math.Distance.Between(p.x, p.y, this.van.x, this.van.y) < VAN_RANGE;
    let kind: ActionKind = 'none';
    let target: DogActor | null = null;
    let hint = 'Ищи собак: они прячутся у гаражей, теплотрассы и контейнеров';

    if (p.carrying) {
      kind = nearVan ? 'deposit' : 'carrying';
      hint = nearVan ? 'Посади собаку в фургон' : 'Отнеси переноску к фургону';
    } else {
      const catchable = this.nearestDog(CATCH_RANGE, (d) => d.isCatchable);
      const seen = this.nearestDog(THROW_RANGE);
      if (catchable) {
        kind = 'catch';
        target = catchable;
        hint = `${catchable.dog.name} ${g(catchable.dog, 'доволен', 'довольна')} — лови!`;
      } else if (nearVan && food < gameState.data.foodMax) {
        kind = 'refill';
        hint = 'Пополни запас корма у фургона';
      } else if (seen) {
        target = seen;
        const name = seen.dog.name;
        const s = seen.dog.stats;
        if (seen.mode === 'eat' || seen.mode === 'toFood') {
          kind = food > 0 ? 'feed' : 'none';
          hint = `${name} ест — подойди тихонько и лови!`;
        } else if (food <= 0) {
          kind = 'nofood';
          hint = 'Корм кончился — вернись к фургону';
        } else {
          kind = 'feed';
          if (isAggressive(s)) hint = `${name} злится. Кинь корм — подобреет`;
          else if (isTrusting(s)) hint = `${name} тебе доверяет — подойди ближе`;
          else hint = `${name} боится. Кинь корм и не спугни`;
        }
      } else if (food <= 0) {
        kind = 'nofood';
        hint = 'Корм кончился — вернись к фургону';
      }
    }

    // arrow to the van when it matters and the van is off-screen
    let vanArrow: ContextInfo['vanArrow'] = null;
    if (p.carrying || food <= 0) {
      const view = this.cameras.main.worldView;
      if (!view.contains(this.van.x, this.van.y - 12)) {
        const dx = this.van.x - p.x;
        const dy = this.van.y - 12 - p.y;
        const l = Math.hypot(dx, dy) || 1;
        vanArrow = { x: dx / l, y: dy / l };
      }
    }

    this.ctxTarget = target;
    const card = target ?? null;
    const info: ContextInfo = {
      kind,
      hint,
      dog: card?.dog ?? p.carrying ?? null,
      dogMode: card?.mode ?? (p.carrying ? 'carried' : null),
      vanArrow,
      caught: this.totalDogs - this.dogs.length - (p.carrying ? 1 : 0),
      total: this.totalDogs,
    };
    const key = [
      kind,
      hint,
      info.dog?.id,
      info.dogMode,
      vanArrow ? `${vanArrow.x.toFixed(1)},${vanArrow.y.toFixed(1)}` : '',
      info.caught,
      card ? `${Math.round(card.dog.stats.aggression)}:${Math.round(card.dog.stats.trust)}` : '',
    ].join('|');
    if (key !== this.lastCtxKey) {
      this.lastCtxKey = key;
      this.ctxInfo = info;
      this.game.events.emit('context', info);
    }
  }

  /** Lets the UI ask for the latest context after it (re)starts. */
  get context(): ContextInfo | null {
    return this.ctxInfo;
  }

  // ---------------------------------------------------------------- actions

  private onAction(): void {
    if (this.catching || !this.ctxInfo) return;
    switch (this.ctxInfo.kind) {
      case 'feed':
        if (this.ctxTarget) this.throwFood(this.ctxTarget);
        break;
      case 'catch':
        if (this.ctxTarget) this.startCatch(this.ctxTarget);
        break;
      case 'deposit':
        this.deposit();
        break;
      case 'refill':
        gameState.refillFood();
        play('pop');
        this.toast('Корм пополнен', 'food');
        break;
    }
  }

  private throwFood(dog: DogActor): void {
    if (this.time.now - this.lastThrow < 500) return;
    if (!gameState.useFood()) return;
    this.lastThrow = this.time.now;
    const p = this.player;
    // land a bit in front of the dog, on the player's side so it doesn't run off
    const a = Math.atan2(p.y - dog.y, p.x - dog.x);
    const lx = Phaser.Math.Clamp(dog.x + Math.cos(a) * 16, 8, this.physics.world.bounds.width - 8);
    const ly = Phaser.Math.Clamp(dog.y + Math.sin(a) * 10, 8, this.physics.world.bounds.height - 8);
    const sx = p.x;
    const sy = p.y - 12;
    const kib = this.add.image(sx, sy, 'fx_kibble').setDepth(100000);
    play('throw');
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 380,
      onUpdate: (tw) => {
        const t = tw.getValue() ?? 0;
        kib.setPosition(sx + (lx - sx) * t, sy + (ly - sy) * t - Math.sin(Math.PI * t) * 24);
        kib.setAngle(t * 540);
      },
      onComplete: () => {
        kib.destroy();
        this.foods.push(new FoodPile(this, lx, ly));
        play('pop');
      },
    });
  }

  private startCatch(dog: DogActor): void {
    this.catching = dog;
    dog.setVelocity(0, 0);
    this.player.setVelocity(0, 0);
    const req: CatchRequest = { dog: dog.dog, difficulty: catchDifficulty(dog.dog.stats) };
    this.game.events.emit('catch-start', req);
    this.scene.pause();
  }

  private onCatchResult(success: boolean): void {
    const dog = this.catching;
    this.catching = null;
    this.scene.resume();
    if (!dog) return;
    if (success) {
      play('catch');
      vibrate(40);
      this.dogs = this.dogs.filter((d) => d !== dog);
      this.burst(dog.x, dog.y - 10, 'icon_heart', 6);
      const ghost = this.add.image(dog.x, dog.y, dog.texture.key, 0).setOrigin(0.5, 22 / 24).setDepth(dog.depth).setFlipX(dog.flipX);
      dog.destroy();
      this.tweens.add({
        targets: ghost,
        x: this.player.x,
        y: this.player.y - 18,
        scale: 0.3,
        duration: 280,
        ease: 'Quad.In',
        onComplete: () => ghost.destroy(),
      });
      this.player.pickUp(dog.dog);
      this.toast(`${dog.dog.name} в переноске!`, 'heart');
    } else {
      play('fail');
      applyCatchFail(dog.dog);
      dog.startle(this.player.x, this.player.y);
      this.toast(`${dog.dog.name} ${g(dog.dog, 'вырвался', 'вырвалась')}…`, 'sweat');
    }
  }

  private deposit(): void {
    const dog = this.player.drop();
    if (!dog) return;
    play('van');
    const reward = catchReward(dog.stats, dog.isLeader);
    gameState.markCaught(dog.id);
    gameState.addCoins(reward);
    this.time.delayedCall(250, () => play('coin'));
    this.tweens.add({ targets: this.van, scaleY: 0.94, scaleX: 1.03, yoyo: true, duration: 110, repeat: 1 });
    this.burst(this.van.x, this.van.y - 30, 'icon_coin', 5);
    this.toast(`${dog.name} в фургоне! +${reward}`, 'coin');
    if (this.dogs.length === 0) {
      gameState.addCoins(50);
      this.time.delayedCall(700, () => this.game.events.emit('district-complete', { name: this.def.name, bonus: 50 }));
    }
  }

  private restartDistrict(): void {
    gameState.resetDistrict(this.def.id);
    this.scene.restart();
  }

  // ---------------------------------------------------------------- dog events

  private onBite(dog: DogActor): void {
    const p = this.player;
    play('bite');
    vibrate([30, 40, 30]);
    p.stun(650, dog.x, dog.y);
    this.cameras.main.shake(160, 0.004);
    if (!p.carrying && gameState.useFood()) {
      // the dog snatches a portion — and that actually helps: it will eat and calm down
      this.foods.push(new FoodPile(this, p.x + (dog.x < p.x ? -6 : 6), p.y + 2));
      this.toast(`${dog.dog.name} ${g(dog.dog, 'стащил', 'стащила')} корм!`, 'angry');
    } else {
      this.toast(`${dog.dog.name} ${g(dog.dog, 'отогнал', 'отогнала')} тебя`, 'angry');
    }
  }

  private onFed(dog: DogActor): void {
    this.burst(dog.x, dog.y - 14, 'icon_heart', 3);
    if (isTrusting(dog.dog.stats)) this.toast(`${dog.dog.name} ${g(dog.dog, 'подобрел', 'подобрела')}!`, 'heart');
  }

  // ---------------------------------------------------------------- fx

  private burst(x: number, y: number, tex: string, n: number): void {
    for (let i = 0; i < n; i++) {
      const img = this.add.image(x, y, tex).setDepth(200000).setScale(0.6);
      this.tweens.add({
        targets: img,
        x: x + Phaser.Math.Between(-16, 16),
        y: y - Phaser.Math.Between(10, 26),
        alpha: 0,
        scale: 1,
        duration: 700 + i * 60,
        ease: 'Quad.Out',
        onComplete: () => img.destroy(),
      });
    }
  }

  private toast(text: string, icon?: string): void {
    this.game.events.emit('toast', { text, icon });
  }
}
