import Phaser from 'phaser';
import { play, vibrate } from '../core/sfx';
import { gameState } from '../core/state';
import { garagesDistrict } from '../data/garages';
import { QUESTS } from '../data/quests';
import { applyCatchFail, catchDifficulty, catchReward, CatchDifficulty, isAggressive, isTrusting } from '../dogs/behaviour';
import { generateDistrictDogs } from '../dogs/generator';
import { g, type DogData } from '../dogs/types';
import { Pickup } from '../entities/Ambient';
import { DogActor } from '../entities/Dog';
import { FoodPile } from '../entities/FoodPile';
import { Npc } from '../entities/Npc';
import { ActionSpec, ContextInfo, WorldScene } from './WorldScene';

export interface CatchRequest {
  dog: DogData;
  difficulty: CatchDifficulty;
}

const THROW_RANGE = 110;
const CATCH_RANGE = 26;
const VAN_RANGE = 44;
const TALK_RANGE = 30;
const WAVE_DELAY = 90_000;
const ZINA_FOOD_COOLDOWN = 60_000;

const A = {
  feed: { id: 'feed', label: 'Кинуть корм', icon: 'food', tone: 'orange' },
  catch: { id: 'catch', label: 'Поймать', icon: 'hand', tone: 'green' },
  deposit: { id: 'deposit', label: 'В фургон', icon: 'van', tone: 'green' },
  talk: { id: 'talk', label: 'Поговорить', icon: 'talk', tone: 'blue' },
  pet: { id: 'pet', label: 'Погладить', icon: 'heart', tone: 'blue' },
} satisfies Record<string, ActionSpec>;

export class DistrictScene extends WorldScene {
  private dogs: DogActor[] = [];
  private foods: FoodPile[] = [];
  private npcs: Npc[] = [];
  private pickups: Pickup[] = [];
  private van!: Phaser.GameObjects.Image;
  private ctxTarget: DogActor | null = null;
  private ctxNpc: Npc | null = null;
  private lastThrow = 0;
  private catching: DogActor | null = null;
  private nearVanBefore = false;
  private greeted = new Set<string>();
  private waveCheck = 0;

  constructor() {
    super('District');
  }

  create(): void {
    gameState.data.location = 'garages';
    gameState.save();
    const def = garagesDistrict();
    this.dogs = [];
    this.foods = [];
    this.npcs = [];
    this.pickups = [];
    this.catching = null;
    this.greeted.clear();
    this.buildWorld(def);

    // the shelter van
    this.add.image(def.van.x, def.van.y - 1, 'shadow_xl').setDepth(def.van.y - 1);
    this.van = this.add.image(def.van.x, def.van.y, 'van').setOrigin(0.5, 1).setDepth(def.van.y);
    this.addWall(def.van.x, def.van.y - 7, 52, 12);
    // arriving from the shelter: start next to the van
    this.player.setPosition(def.playerStart.x, def.playerStart.y);

    for (const n of def.npcs) this.npcs.push(new Npc(this, n));
    this.spawnPickups();
    this.spawnDogs();

    this.events.on('dog-bite', this.onBite, this);
    this.events.on('dog-fed', this.onFed, this);
    this.game.events.on('catch-result', this.onCatchResult, this);
    this.events.once('shutdown', () => this.game.events.off('catch-result', this.onCatchResult, this));
  }

  // ---------------------------------------------------------------- spawning

  private spawnDogs(): void {
    const cfg = this.def.dogs!;
    const wave = gameState.wave(cfg.districtId);
    const count = wave === 1 ? cfg.count : 5 + (wave % 3);
    const wild = generateDistrictDogs({ ...cfg, count, hasLeader: wave === 1 }, wave).map((d) => ({ ...d, id: `${d.id}-w${wave}` }));
    for (const d of wild) {
      if (gameState.data.removed.includes(d.id)) continue;
      this.addDog(d);
    }
    // dogs that went through the shelter come back calm, clean and tagged
    for (const d of gameState.releasedDogs(cfg.districtId)) this.addDog(d);
  }

  private addDog(d: DogData): DogActor {
    const actor = new DogActor(this, d);
    this.physics.add.collider(actor.feet, this.walls);
    this.dogs.push(actor);
    return actor;
  }

  private spawnPickups(): void {
    for (const p of this.def.pickups) {
      if (gameState.data.picked.includes(p.id)) continue;
      if (p.kind === 'wrench' && !(gameState.quest('misha') === 'active' && !gameState.data.questProgress.misha)) continue;
      if (p.kind === 'ball' && !(gameState.quest('kids') === 'active' && !gameState.data.questProgress.kids)) continue;
      if (this.pickups.some((x) => x.id === p.id)) continue;
      this.pickups.push(new Pickup(this, p.id, p.kind, p.x, p.y));
    }
  }

  private get wildDogs(): DogActor[] {
    return this.dogs.filter((d) => d.dog.state === 'wild');
  }

  protected threats(): { x: number; y: number }[] {
    return [this.player, ...this.dogs.filter((d) => d.speed > 30)];
  }

  protected dogPositions(): { x: number; y: number }[] {
    return this.dogs;
  }

  // ---------------------------------------------------------------- update

  protected tickWorld(dt: number): void {
    const world = { player: this.player, foods: this.foods };
    for (const d of this.dogs) {
      d.tick(dt, world);
      d.syncView();
    }
    this.foods = this.foods.filter((f) => !f.eaten || f.claimedBy?.mode === 'eat');
    for (const n of this.npcs) n.update(dt);
    for (const p of this.pickups) p.update(dt);
    this.collectPickups();
    this.greetNpcs();
    this.autoRefill();

    this.waveCheck -= dt;
    if (this.waveCheck <= 0) {
      this.waveCheck = 500;
      this.checkWave();
    }
  }

  private collectPickups(): void {
    for (const p of this.pickups) {
      if (p.collected || !this.near(p.x, p.y, 12)) continue;
      if (p.kind === 'bone') {
        if (gameState.data.food >= gameState.foodMax) continue;
        gameState.addFood(1);
        this.floatText(p.x, p.y - 10, '+1 корм', '#f6d9ad');
      } else if (p.kind === 'coin') {
        gameState.addCoins(5);
        this.floatText(p.x, p.y - 10, '+5');
        play('coin');
      } else {
        const q = p.kind === 'wrench' ? 'misha' : 'kids';
        gameState.data.questProgress[q] = 1;
        gameState.commit();
        this.toast(p.kind === 'wrench' ? 'Нашёлся гаечный ключ!' : 'Нашёлся мячик!', 'star');
        play('ding');
      }
      if (p.kind === 'bone') play('pop');
      p.collect(this.player.x, this.player.y);
      gameState.data.picked.push(p.id);
      gameState.save();
    }
    this.pickups = this.pickups.filter((p) => !p.collected);
  }

  private greetNpcs(): void {
    for (const n of this.npcs) {
      const st = this.questStatus(n);
      n.setMark(st === 'offer' || st === 'ready', st === 'ready');
      const close = this.near(n.x, n.y, 44);
      if (close && !this.greeted.has(n.def.id)) {
        this.greeted.add(n.def.id);
        if (st === 'none') n.say(Phaser.Utils.Array.GetRandom(n.def.lines));
      } else if (!close && this.greeted.has(n.def.id) && !this.near(n.x, n.y, 70)) this.greeted.delete(n.def.id);
    }
  }

  /** What the NPC can do for you right now. */
  private questStatus(n: Npc): 'offer' | 'active' | 'ready' | 'gift' | 'none' {
    const id = n.def.quest;
    if (!id) return 'none';
    const st = gameState.quest(id);
    if (!st) return 'offer';
    if (st === 'active') return this.questComplete(id) ? 'ready' : 'active';
    if (st === 'claimed' && QUESTS[id].reward.perk === 'zinaFood' && Date.now() >= gameState.data.zinaFoodAt && gameState.data.food < gameState.foodMax)
      return 'gift';
    return 'none';
  }

  private questComplete(id: string): boolean {
    const need = QUESTS[id].need;
    const prog = gameState.data.questProgress[id] ?? 0;
    return 'feed' in need ? prog >= need.feed : prog >= 1;
  }

  private autoRefill(): void {
    const nearVan = this.near(this.van.x, this.van.y, VAN_RANGE);
    if (nearVan && !this.nearVanBefore && gameState.refillFood()) {
      play('pop');
      this.toast('Корм пополнен', 'food');
      this.floatText(this.van.x, this.van.y - 34, `${gameState.data.food}/${gameState.foodMax}`, '#f6d9ad');
    }
    this.nearVanBefore = nearVan;
  }

  private checkWave(): void {
    const id = this.def.dogs!.districtId;
    const at = gameState.data.nextWaveAt[id] ?? 0;
    if (this.wildDogs.length === 0 && !this.player.carrying && at === 0) {
      gameState.data.nextWaveAt[id] = Date.now() + WAVE_DELAY;
      gameState.addCoins(50);
      this.game.events.emit('district-complete', { name: this.def.name, bonus: 50 });
    } else if (at > 0 && Date.now() >= at) {
      gameState.startNextWave(id);
      this.spawnDogs();
      this.dogs.forEach((d) => d.dog.state === 'wild' && d.jump(6));
      this.spawnPickups();
      this.toast(`В ${this.def.name} прибежали новые собаки!`, 'paw');
      play('bark', 1.2);
    }
  }

  // ---------------------------------------------------------------- context

  private nearestDog(maxDist: number, filter: (d: DogActor) => boolean): DogActor | null {
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

  protected buildContext(): ContextInfo {
    const p = this.player;
    const food = gameState.data.food;
    const nearVan = this.near(this.van.x, this.van.y, VAN_RANGE);
    let primary: ActionSpec | null = null;
    let target: DogActor | null = null;
    let npc: Npc | null = null;
    let hint = 'Ищи собак: у гаражей, теплотрассы и контейнеров';
    const vanCount = gameState.data.van.length;

    if (p.carrying) {
      if (nearVan && !gameState.vanFull) {
        primary = A.deposit;
        hint = 'Посади собаку в фургон';
      } else hint = gameState.vanFull ? 'Фургон полон — сначала отвези собак в приют' : 'Отнеси переноску к фургону';
    } else {
      const catchable = this.nearestDog(CATCH_RANGE, (d) => d.isCatchable);
      const talk = this.npcs.find((n) => this.near(n.x, n.y, TALK_RANGE) && ['offer', 'ready', 'gift', 'active'].includes(this.questStatus(n)));
      const friend = this.nearestDog(24, (d) => d.dog.state === 'released');
      const seen = this.nearestDog(THROW_RANGE, (d) => d.dog.state === 'wild');
      if (catchable) {
        if (gameState.vanFull) hint = 'Фургон полон — отвези собак в приют';
        else {
          primary = A.catch;
          target = catchable;
          hint = `${catchable.dog.name} ${g(catchable.dog, 'доволен', 'довольна')} — лови!`;
        }
        target = catchable;
      } else if (talk) {
        primary = A.talk;
        npc = talk;
        hint = talk.def.name;
      } else if (friend) {
        primary = A.pet;
        target = friend;
        hint = `${friend.dog.name} с биркой — ${g(friend.dog, 'свой', 'своя')}, ${g(friend.dog, 'домашний', 'домашняя')}`;
      } else if (seen) {
        target = seen;
        const name = seen.dog.name;
        const s = seen.dog.stats;
        if (seen.mode === 'eat' || seen.mode === 'toFood') {
          primary = food > 0 ? A.feed : null;
          hint = `${name} ест — подойди тихонько и лови!`;
        } else if (food <= 0) {
          hint = 'Корм кончился — он есть у фургона и у бабушки Зины';
        } else {
          primary = A.feed;
          if (isAggressive(s)) hint = `${name} злится. Кинь корм — подобреет`;
          else if (isTrusting(s)) hint = `${name} тебе доверяет — подойди ближе`;
          else hint = `${name} боится. Кинь корм и не спугни`;
        }
      } else if (food <= 0) {
        hint = 'Корм кончился — он есть у фургона и у бабушки Зины';
      } else if (gameState.vanFull) hint = 'Фургон полон — отвези собак в приют';
      else if (this.wildDogs.length === 0) hint = 'Все бездомные собаки района пойманы!';
    }

    const secondary: ActionSpec | null =
      nearVan && !p.carrying ? { id: 'travel', label: vanCount ? `В приют (${vanCount})` : 'В приют', icon: 'house', tone: 'blue' } : null;
    if (nearVan && !p.carrying && vanCount > 0 && !primary) hint = `В фургоне ${vanCount} из ${gameState.vanCapacity}. Можно ехать в приют`;

    let arrow: ContextInfo['arrow'] = null;
    if (p.carrying || food <= 0 || gameState.vanFull) arrow = this.arrowTo(this.van.x, this.van.y - 12, 'van');

    this.ctxTarget = target;
    this.ctxNpc = npc;
    const at = gameState.data.nextWaveAt[this.def.dogs!.districtId] ?? 0;
    const left = Math.max(0, Math.ceil((at - Date.now()) / 1000));
    const progress = at > 0 ? { icon: 'paw', text: `Новые ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` } : { icon: 'paw', text: `Дикие: ${this.wildDogs.length}` };
    return {
      location: 'garages',
      primary,
      secondary,
      hint,
      dog: target?.dog ?? p.carrying ?? null,
      dogMode: target?.mode ?? (p.carrying ? 'carried' : null),
      arrow,
      progress,
    };
  }

  // ---------------------------------------------------------------- actions

  protected onAction(id: string): void {
    if (this.catching || this.leaving) return;
    switch (id) {
      case 'feed':
        if (this.ctxTarget) this.throwFood(this.ctxTarget);
        break;
      case 'catch':
        if (this.ctxTarget?.isCatchable) this.startCatch(this.ctxTarget);
        break;
      case 'deposit':
        this.deposit();
        break;
      case 'talk':
        if (this.ctxNpc) this.talk(this.ctxNpc);
        break;
      case 'pet':
        if (this.ctxTarget) {
          this.ctxTarget.pet();
          this.burst(this.ctxTarget.x, this.ctxTarget.y - 14, 'icon_heart', 3);
        }
        break;
      case 'travel':
        if (!this.player.carrying) this.travel('Shelter');
        break;
    }
  }

  private talk(n: Npc): void {
    const id = n.def.quest!;
    const q = QUESTS[id];
    const st = this.questStatus(n);
    play('talk');
    if (st === 'offer') {
      gameState.setQuest(id, 'active');
      gameState.data.questProgress[id] = 0;
      gameState.commit();
      n.say(q.intro, 6000);
      this.toast(`Задание: ${q.giver}`, 'star');
      this.spawnPickups();
    } else if (st === 'ready') {
      gameState.setQuest(id, 'claimed');
      gameState.addCoins(q.reward.coins);
      n.say(q.thanks, 5000);
      this.floatText(n.x, n.y - 30, `+${q.reward.coins}`);
      this.burst(n.x, n.y - 20, 'icon_coin', 5);
      play('coin');
      if (q.reward.perk === 'zinaFood') gameState.data.zinaFoodAt = 0;
    } else if (st === 'gift') {
      gameState.refillFood();
      gameState.data.zinaFoodAt = Date.now() + ZINA_FOOD_COOLDOWN;
      gameState.save();
      n.say('Держи, милок, корма для собачек!');
      this.floatText(n.x, n.y - 30, 'корм!', '#f6d9ad');
      play('pop');
    } else if (st === 'active') {
      const need = q.need;
      const prog = gameState.data.questProgress[id] ?? 0;
      n.say('feed' in need ? `${q.reminder} (${prog}/${need.feed})` : q.reminder);
    }
  }

  private throwFood(dog: DogActor): void {
    if (this.time.now - this.lastThrow < 450) return;
    if (!gameState.useFood()) return;
    this.lastThrow = this.time.now;
    const p = this.player;
    p.throwPose();
    if (Math.abs(dog.x - p.x) > Math.abs(dog.y - p.y)) {
      p.facing = 'side';
      p.facingLeft = dog.x < p.x;
    } else p.facing = dog.y < p.y ? 'up' : 'down';
    const { x: lx, y: ly } = this.landingSpot(dog);
    const sx = p.x;
    const sy = p.y - 14;
    const kib = this.add.image(sx, sy, 'fx_kibble').setDepth(100000);
    const shadow = this.add.image(sx, p.y, 'shadow_s').setScale(0.4).setDepth(p.y);
    play('throw');
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 420,
      ease: 'Sine.InOut',
      onUpdate: (tw) => {
        const t = tw.getValue() ?? 0;
        kib.setPosition(sx + (lx - sx) * t, sy + (ly - sy) * t - Math.sin(Math.PI * t) * 26);
        kib.setAngle(t * 540);
        shadow.setPosition(sx + (lx - sx) * t, p.y + (ly - p.y) * t);
      },
      onComplete: () => {
        kib.destroy();
        shadow.destroy();
        const pile = new FoodPile(this, lx, ly);
        pile.sprite.setScale(1.4, 0.6);
        this.tweens.add({ targets: pile.sprite, scaleX: 1, scaleY: 1, duration: 260, ease: 'Back.Out' });
        this.foods.push(pile);
        play('pop');
      },
    });
  }

  private blocked(x: number, y: number): boolean {
    const b = this.physics.world.bounds;
    if (x < 6 || y < 6 || x > b.width - 6 || y > b.height - 6) return true;
    return this.walls.some((z) => Math.abs(z.x - x) < z.width / 2 + 5 && Math.abs(z.y - y) < z.height / 2 + 4);
  }

  private clearPath(ax: number, ay: number, bx: number, by: number): boolean {
    for (let i = 1; i <= 8; i++) {
      const t = i / 8;
      if (this.blocked(ax + (bx - ax) * t, ay + (by - ay) * t)) return false;
    }
    return true;
  }

  /**
   * Where thrown food lands: in front of the dog, preferably on the player's side,
   * but never inside or behind an obstacle — the dog must be able to walk straight to it.
   */
  private landingSpot(dog: DogActor): { x: number; y: number } {
    const p = this.player;
    const toPlayer = Math.atan2(p.y - dog.y, p.x - dog.x);
    let best: { x: number; y: number } | null = null;
    let bestScore = Infinity;
    for (let i = 0; i < 16; i++) {
      const a = toPlayer + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * (Math.PI / 8);
      for (const r of [16, 11]) {
        const x = dog.x + Math.cos(a) * r;
        const y = dog.y + Math.sin(a) * r * 0.7;
        if (this.blocked(x, y) || !this.clearPath(dog.x, dog.y, x, y)) continue;
        const score = Phaser.Math.Distance.Between(x, y, p.x, p.y);
        if (score < bestScore) {
          bestScore = score;
          best = { x, y };
        }
      }
      if (best && i >= 4) break;
    }
    return best ?? { x: dog.x, y: dog.y + 3 };
  }

  private startCatch(dog: DogActor): void {
    this.catching = dog;
    dog.body.velocity.set(0, 0);
    this.player.body.velocity.set(0, 0);
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
      const ghost = this.add
        .sprite(dog.x, dog.y, dog.view.texture.key, dog.view.frame.name)
        .setOrigin(0.5, 22 / 24)
        .setDepth(dog.y)
        .setFlipX(dog.facingLeft);
      dog.destroy();
      this.tweens.add({ targets: ghost, x: this.player.x, y: this.player.y - 20, scale: 0.3, duration: 300, ease: 'Cubic.In', onComplete: () => ghost.destroy() });
      this.player.pickUp(dog.dog);
      this.toast(`${dog.dog.name} в переноске!`, 'heart');
    } else {
      play('fail');
      applyCatchFail(dog.dog);
      dog.startle(this.player.x, this.player.y);
      this.toast(`${dog.dog.name} ${g(dog.dog, 'вырвался', 'вырвалась')}… Покорми ещё и попробуй снова`, 'sweat');
    }
  }

  private deposit(): void {
    const dog = this.player.drop();
    if (!dog) return;
    play('van');
    const reward = catchReward(dog.stats, dog.isLeader);
    gameState.putInVan(dog);
    gameState.addCoins(reward);
    this.time.delayedCall(250, () => play('coin'));
    this.tweens.add({ targets: this.van, scaleY: 0.93, scaleX: 1.04, yoyo: true, duration: 120, repeat: 1, ease: 'Sine.InOut' });
    this.burst(this.van.x, this.van.y - 30, 'icon_coin', 5);
    this.floatText(this.van.x, this.van.y - 36, `+${reward}`);
    this.toast(`${dog.name} в фургоне! ${gameState.data.van.length}/${gameState.vanCapacity}`, 'van');
  }

  // ---------------------------------------------------------------- dog events

  private onBite(dog: DogActor): void {
    const p = this.player;
    play('bite');
    vibrate([30, 40, 30]);
    p.stun(650, dog.x, dog.y);
    this.cameras.main.shake(160, 0.003);
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
    gameState.data.fedCount++;
    if (gameState.quest('zina') === 'active') gameState.data.questProgress.zina = (gameState.data.questProgress.zina ?? 0) + 1;
    gameState.save();
    if (isTrusting(dog.dog.stats)) this.toast(`${dog.dog.name} ${g(dog.dog, 'подобрел', 'подобрела')}!`, 'heart');
  }
}
