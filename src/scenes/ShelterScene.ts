import Phaser from 'phaser';
import { drawProp, propKey } from '../art/propFactory';
import { drawShadow } from '../art/props';
import { ensureTexture } from '../art/textures';
import { play } from '../core/sfx';
import { gameState, StationId, stationDuration } from '../core/state';
import type { NpcDef } from '../data/location';
import { shelterLocation, VISITOR_LOOKS } from '../data/shelter';
import { ADOPT_REWARD, applyCare, careBlocker, careDone, CareStep, RELEASE_REWARD } from '../dogs/behaviour';
import { g, type DogData } from '../dogs/types';
import { DogPuppet } from '../entities/DogPuppet';
import { Npc } from '../entities/Npc';
import type { ShelterDef } from '../data/location';
import { ActionSpec, ContextInfo, WorldScene } from './WorldScene';

const STATION_ACTION: Record<StationId, { verb: string; title: string; icon: string }> = {
  wash: { verb: 'Помыть', title: 'Мойка', icon: 'drop' },
  feed: { verb: 'Накормить', title: 'Кухня', icon: 'food' },
  vet: { verb: 'К ветеринару', title: 'Ветпункт', icon: 'cross' },
  tag: { verb: 'Поставить бирку', title: 'Бирка', icon: 'tag' },
};
const ORDER: StationId[] = ['wash', 'feed', 'vet', 'tag'];


interface Visitor {
  npc: Npc;
  dogId: string;
  state: 'arriving' | 'waiting' | 'leaving';
  waitLeft: number;
  tx: number;
  ty: number;
  t: number;
}

export class ShelterScene extends WorldScene {
  private sdef!: ShelterDef;
  private van!: Phaser.GameObjects.Image;
  private puppets = new Map<string, DogPuppet>();
  private rings!: Phaser.GameObjects.Graphics;
  private stationIcons: Phaser.GameObjects.Image[] = [];
  private kennelSprites: Phaser.GameObjects.Image[] = [];
  private visitor: Visitor | null = null;
  private visitorTimer = 15000;
  private ctxStation: StationId | null = null;
  private ctxKennel = -1;
  private fxTimer = 0;
  private penRect!: Phaser.Geom.Rectangle;

  constructor() {
    super('Shelter');
  }

  create(): void {
    gameState.data.location = 'shelter';
    gameState.save();
    this.sdef = shelterLocation();
    this.puppets.clear();
    this.stationIcons = [];
    this.kennelSprites = [];
    this.visitor = null;
    this.visitorTimer = 12000;
    this.buildWorld(this.sdef);
    const d = this.sdef;
    this.penRect = new Phaser.Geom.Rectangle(d.intake.x, d.intake.y, d.intake.w, d.intake.h);

    this.add.image(d.van.x, d.van.y - 1, 'shadow_xl').setDepth(d.van.y - 1);
    this.van = this.add.image(d.van.x, d.van.y, 'van').setOrigin(0.5, 1).setDepth(d.van.y);
    this.addWall(d.van.x, d.van.y - 7, 52, 12);

    for (const st of d.stations) {
      const icon = this.add.image(st.x, st.y - 40, `icon_${STATION_ACTION[st.id].icon}`).setDepth(st.y + 500);
      this.stationIcons.push(icon);
    }
    this.rings = this.add.graphics().setDepth(150000);
    this.addKennels();

    // a dog that was in your arms when the game was closed goes back to the pen
    if (gameState.data.carrying) {
      gameState.data.intake.push(gameState.data.carrying);
      gameState.data.carrying = null;
      gameState.commit();
    }
    // dogs already at the shelter
    for (const id of gameState.data.intake) this.spawnInPen(id);
    for (const [sid, slot] of Object.entries(gameState.data.stations)) if (slot) this.placeAtStation(slot.dogId, sid as StationId, true);
    gameState.data.kennels.forEach((id, i) => id && this.placeInKennel(id, i, true));

    // unload the van
    const arriving = gameState.unloadVan();
    arriving.forEach((id, i) => {
      const p = this.spawnPuppet(gameState.data.dogs[id], d.van.x - 10, d.van.y - 6);
      p.view.setAlpha(0);
      this.time.delayedCall(500 + i * 450, () => {
        p.view.setAlpha(1);
        p.jump(8);
        play('bark', 1.1);
        const target = this.penRect.getRandomPoint();
        p.walkTo(target.x, target.y, 55, () => p.wanderIn(this.penRect));
      });
    });
    if (arriving.length) this.time.delayedCall(700, () => this.toast(`Новенькие в загоне: ${arriving.length}`, 'paw'));

    this.game.events.on('upgraded', this.addKennels, this);
    this.events.once('shutdown', () => this.game.events.off('upgraded', this.addKennels, this));
  }

  // ---------------------------------------------------------------- building blocks

  private addKennels(): void {
    const n = Math.min(gameState.kennelCount, this.sdef.kennels.length);
    for (let i = this.kennelSprites.length; i < n; i++) {
      const k = this.sdef.kennels[i];
      const p = { kind: 'kennel' as const, x: k.x, y: k.y, variant: i };
      ensureTexture(this, 'shadow_26x6', () => drawShadow(26, 6));
      this.add.image(k.x, k.y - 1, 'shadow_26x6').setDepth(k.y - 1);
      const img = this.add.image(k.x, k.y, ensureTexture(this, propKey(p), () => drawProp(p))).setOrigin(0.5, 1).setDepth(k.y);
      this.kennelSprites.push(img);
      this.addWall(k.x, k.y - 5, 22, 10);
      if (i >= 4) {
        img.setScale(0.2);
        this.tweens.add({ targets: img, scale: 1, duration: 400, ease: 'Back.Out' });
      }
    }
    while (gameState.data.kennels.length < gameState.kennelCount) gameState.data.kennels.push(null);
  }

  private spawnPuppet(dog: DogData, x: number, y: number): DogPuppet {
    const p = new DogPuppet(this, dog, x, y);
    this.puppets.set(dog.id, p);
    return p;
  }

  private spawnInPen(id: string): void {
    const pt = this.penRect.getRandomPoint();
    const p = this.spawnPuppet(gameState.data.dogs[id], pt.x, pt.y);
    p.wanderIn(this.penRect);
  }

  private stationPos(id: StationId): { x: number; y: number } {
    return this.sdef.stations.find((s) => s.id === id)!;
  }

  private placeAtStation(dogId: string, sid: StationId, instant: boolean): void {
    const st = this.stationPos(sid);
    const dog = gameState.data.dogs[dogId];
    const p = this.puppets.get(dogId) ?? this.spawnPuppet(dog, this.player.x, this.player.y - 20);
    p.wanderIn(null);
    p.rest(sid === 'feed' ? 'eat' : 'sit');
    const x = st.x - 2;
    const y = st.y + 9;
    if (instant) p.teleport(x, y);
    else {
      p.teleport(this.player.x, this.player.y - 2);
      p.jump(7);
      p.walkTo(x, y, 60);
    }
    p.facingLeft = false;
    p.play(sid === 'feed' ? 'eat' : 'sit');
  }

  private placeInKennel(dogId: string, i: number, instant: boolean): void {
    const k = this.sdef.kennels[i];
    const dog = gameState.data.dogs[dogId];
    const p = this.puppets.get(dogId) ?? this.spawnPuppet(dog, this.player.x, this.player.y - 2);
    p.wanderIn(null);
    p.rest(Math.random() < 0.5 ? 'sit' : 'sleep');
    const x = k.x + 3;
    const y = k.y + 10;
    if (instant) p.teleport(x, y);
    else {
      p.teleport(this.player.x, this.player.y - 2);
      p.jump(7);
      p.walkTo(x, y, 60, () => p.play('happy'));
    }
    p.facingLeft = true;
  }

  // ---------------------------------------------------------------- update

  protected threats(): { x: number; y: number }[] {
    return [this.player];
  }

  protected tickWorld(dt: number): void {
    const now = Date.now();
    this.rings.clear();
    this.fxTimer -= dt;
    const fx = this.fxTimer <= 0;
    if (fx) this.fxTimer = 260;

    for (const sid of ORDER) {
      const slot = gameState.data.stations[sid];
      const st = this.stationPos(sid);
      const icon = this.stationIcons[ORDER.indexOf(sid)];
      icon.y = st.y - 40 - Math.abs(Math.sin(this.time.now / 300 + ORDER.indexOf(sid))) * 2;
      if (!slot) {
        icon.setAlpha(0.85);
        continue;
      }
      const dog = gameState.data.dogs[slot.dogId];
      const dur = stationDuration(sid);
      const t = Phaser.Math.Clamp(1 - (slot.endsAt - now) / dur, 0, 1);
      const done = careDone(dog, sid);
      if (t >= 1 && !done) this.finishStation(sid, dog);
      // progress ring above the station
      const cx = st.x;
      const cy = st.y - 40;
      this.rings.fillStyle(0x3b2a2a, 0.8).fillCircle(cx, cy, 8.5);
      this.rings.lineStyle(2.5, done ? 0x7cc576 : 0xffd23f, 1);
      this.rings.beginPath();
      this.rings.arc(cx, cy, 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (done ? 1 : t), false);
      this.rings.strokePath();
      icon.setAlpha(1).setDepth(150001);
      if (!done && fx) this.stationFx(sid, st.x, st.y);
    }

    for (const p of this.puppets.values()) p.update(dt);
    this.updateVisitor(dt);
  }

  private stationFx(sid: StationId, x: number, y: number): void {
    if (sid === 'wash') {
      const b = this.add.image(x + Phaser.Math.Between(-10, 8), y + 2, 'fx_bubble').setDepth(y + 20).setScale(0.5);
      this.tweens.add({ targets: b, y: y - 14, scale: 1, alpha: 0, duration: 900, onComplete: () => b.destroy() });
      if (Math.random() < 0.3) play('scrub');
    } else if (sid === 'vet' && Math.random() < 0.4) {
      const h = this.add.image(x + Phaser.Math.Between(-8, 8), y - 4, 'icon_heart').setDepth(y + 20).setScale(0.4);
      this.tweens.add({ targets: h, y: y - 18, alpha: 0, duration: 800, onComplete: () => h.destroy() });
    } else if (sid === 'tag' && Math.random() < 0.5) {
      const s = this.add.image(x + Phaser.Math.Between(-8, 8), y - 2, 'fx_sparkle').setDepth(y + 20).setScale(0.3);
      this.tweens.add({ targets: s, scale: 0.9, alpha: 0, duration: 500, onComplete: () => s.destroy() });
    }
  }

  private finishStation(sid: StationId, dog: DogData): void {
    applyCare(dog, sid);
    gameState.commit();
    const p = this.puppets.get(dog.id);
    play('ding');
    if (p) {
      p.refreshLook();
      p.jump(6);
      p.boing(0.2);
      if (sid === 'wash') {
        p.play('shake');
        this.time.delayedCall(900, () => p.play('happy'));
      } else p.play('happy');
      p.rest('happy');
      this.burst(p.x, p.y - 12, sid === 'tag' ? 'fx_sparkle' : 'icon_heart', 4);
    }
    if (sid === 'tag') this.toast(`${dog.name}: бирка ${dog.tagId}`, 'tag');
  }

  // ---------------------------------------------------------------- visitors (adoption)

  private updateVisitor(dt: number): void {
    const kennelDogs = gameState.data.kennels.filter((x): x is string => !!x);
    if (!this.visitor) {
      if (!kennelDogs.length) return;
      this.visitorTimer -= dt;
      if (this.visitorTimer > 0) return;
      this.visitorTimer = 30000 + Math.random() * 20000;
      const dogId = Phaser.Utils.Array.GetRandom(kennelDogs);
      const i = gameState.data.kennels.indexOf(dogId);
      const k = this.sdef.kennels[i];
      const look = Phaser.Utils.Array.GetRandom(VISITOR_LOOKS);
      const lookIdx = VISITOR_LOOKS.indexOf(look);
      const def: NpcDef = { id: `visitor_${lookIdx}`, name: 'Посетитель', x: this.sdef.gate.x, y: this.sdef.gate.y, look, lines: [] };
      const npc = new Npc(this, def);
      this.visitor = { npc, dogId, state: 'arriving', waitLeft: 60000, tx: k.x + 2, ty: k.y + 20, t: 0 };
      play('ding');
      return;
    }
    const v = this.visitor;
    v.t += dt;
    v.npc.update(dt);
    if (v.state === 'arriving' || v.state === 'leaving') {
      const dx = v.tx - v.npc.x;
      const dy = v.ty - v.npc.y;
      const d = Math.hypot(dx, dy);
      if (d > 1) {
        const step = Math.min(d, 34 * (dt / 1000));
        v.npc.place(v.npc.x + (dx / d) * step, v.npc.y + (dy / d) * step);
        v.npc.sprite.y -= Math.abs(Math.sin(v.t / 110)) * 1.5;
        v.npc.sprite.setFlipX(dx < 0);
      } else if (v.state === 'arriving') {
        v.state = 'waiting';
        const dog = gameState.data.dogs[v.dogId];
        v.npc.say(`${dog.name} — просто прелесть! Заберу домой!`, 60000);
        v.npc.setMark(true, true);
      } else {
        v.npc.destroy();
        this.visitor = null;
      }
    } else {
      v.waitLeft -= dt;
      if (v.waitLeft <= 0 || !gameState.data.kennels.includes(v.dogId)) this.visitorLeave('Ну ничего, приду в другой раз…');
    }
  }

  private visitorLeave(text: string): void {
    const v = this.visitor;
    if (!v) return;
    v.state = 'leaving';
    v.tx = this.sdef.gate.x;
    v.ty = this.sdef.gate.y + 20;
    v.npc.setMark(false);
    v.npc.say(text, 2500);
  }

  // ---------------------------------------------------------------- context

  private nextStep(dog: DogData): StationId | null {
    return ORDER.find((s) => !careDone(dog, s)) ?? null;
  }

  private nearPen(): boolean {
    const r = Phaser.Geom.Rectangle.Clone(this.penRect);
    Phaser.Geom.Rectangle.Inflate(r, 26, 26);
    return r.contains(this.player.x, this.player.y);
  }

  protected buildContext(): ContextInfo {
    const p = this.player;
    const d = this.sdef;
    let primary: ActionSpec | null = null;
    let hint = '';
    let dog: DogData | null = null;
    let dogMode: string | null = null;
    let arrow: ContextInfo['arrow'] = null;
    this.ctxStation = null;
    this.ctxKennel = -1;

    const station = d.stations.find((s) => this.near(s.x, s.y + 10, 26));
    const kennelIdx = gameState.data.kennels.findIndex((_, i) => i < this.kennelSprites.length && this.near(d.kennels[i].x + 6, d.kennels[i].y + 8, 24));
    const nearVan = this.near(this.van.x, this.van.y, 44);

    if (p.carrying) {
      dog = p.carrying;
      dogMode = 'carried';
      const next = this.nextStep(dog);
      if (station) {
        const slot = gameState.data.stations[station.id];
        const blocker = careBlocker(dog, station.id as CareStep);
        if (slot) hint = `${STATION_ACTION[station.id].title} занята — подожди или выбери другую`;
        else if (blocker) hint = `${STATION_ACTION[station.id].title}: ${blocker}`;
        else {
          primary = { id: 'station', label: STATION_ACTION[station.id].verb, icon: STATION_ACTION[station.id].icon, tone: 'green' };
          this.ctxStation = station.id;
          hint = `${STATION_ACTION[station.id].title}: ${dog.name}`;
        }
      } else if (kennelIdx >= 0 && !next) {
        const free = gameState.data.kennels.findIndex((x, i) => !x && i < this.kennelSprites.length);
        if (free >= 0) {
          primary = { id: 'kennel', label: 'В вольер', icon: 'house', tone: 'green' };
          hint = `${dog.name} готов${g(dog, '', 'а')} к новой жизни`;
        } else hint = 'Все вольеры заняты — выпусти кого-нибудь или купи вольер на доске';
      } else if (this.nearPen()) {
        primary = { id: 'pen', label: 'В загон', icon: 'paw', tone: 'orange' };
        hint = 'Вернуть собаку в загон';
      } else if (next) {
        hint = `Дальше: ${STATION_ACTION[next].title.toLowerCase()}`;
        const st = this.stationPos(next);
        arrow = this.arrowTo(st.x, st.y, STATION_ACTION[next].icon);
      } else {
        hint = 'Уход закончен — отнеси в вольер';
        const k = d.kennels[0];
        arrow = this.arrowTo(k.x, k.y, 'house');
      }
    } else {
      const slot = station ? gameState.data.stations[station.id] : undefined;
      const slotDog = slot ? gameState.data.dogs[slot.dogId] : null;
      const kennelDog = kennelIdx >= 0 && gameState.data.kennels[kennelIdx] ? gameState.data.dogs[gameState.data.kennels[kennelIdx]!] : null;
      if (station && slotDog && careDone(slotDog, station.id as CareStep)) {
        primary = { id: 'take-station', label: `Забрать`, icon: 'hand', tone: 'green' };
        this.ctxStation = station.id;
        dog = slotDog;
        dogMode = 'done';
        hint = `${slotDog.name}: ${STATION_ACTION[station.id].title.toLowerCase()} — готово!`;
      } else if (station && slotDog) {
        dog = slotDog;
        dogMode = 'station';
        const left = Math.max(0, Math.ceil((slot!.endsAt - Date.now()) / 1000));
        hint = `${STATION_ACTION[station.id].title}: ещё ${left} с`;
      } else if (kennelDog) {
        dog = kennelDog;
        dogMode = 'kennel';
        this.ctxKennel = kennelIdx;
        if (this.visitor?.state === 'waiting' && this.visitor.dogId === kennelDog.id) {
          primary = { id: 'adopt', label: 'Отдать в семью', icon: 'heart', tone: 'green' };
          hint = `${kennelDog.name}: семья хочет забрать домой! +${ADOPT_REWARD}`;
        } else {
          primary = { id: 'release', label: 'Выпустить', icon: 'paw', tone: 'blue' };
          hint = `${kennelDog.name} может вернуться в район (+${RELEASE_REWARD}) — или дождись семью (+${ADOPT_REWARD})`;
        }
      } else if (this.near(d.board.x, d.board.y + 8, 24)) {
        primary = { id: 'upgrades', label: 'Улучшения', icon: 'star', tone: 'orange' };
        hint = 'Доска улучшений приюта';
      } else if (this.near(d.foodStore.x, d.foodStore.y + 10, 28) && gameState.data.food < gameState.foodMax) {
        primary = { id: 'refill', label: 'Взять корм', icon: 'food', tone: 'orange' };
        hint = 'Наполнить мешок корма';
      } else if (this.nearPen() && gameState.data.intake.length) {
        primary = { id: 'take-pen', label: 'Взять собаку', icon: 'hand', tone: 'green' };
        hint = `В загоне: ${gameState.data.intake.length}`;
      } else if (gameState.data.intake.length) {
        hint = 'Возьми собаку из загона: мойка → кухня → ветпункт → бирка';
        arrow = this.arrowTo(this.penRect.centerX, this.penRect.centerY, 'paw');
      } else if (this.visitor?.state === 'waiting') {
        hint = 'Посетитель ждёт у вольера!';
        arrow = this.arrowTo(this.visitor.npc.x, this.visitor.npc.y, 'heart');
      } else if (gameState.data.kennels.some(Boolean)) hint = 'Скоро придут посетители — или выпусти собак в район';
      else hint = 'Приют ждёт новых собак. Поезжай в Гаражи';
    }

    const secondary: ActionSpec | null = nearVan && !p.carrying ? { id: 'travel', label: 'В Гаражи', icon: 'van', tone: 'blue' } : null;
    const used = gameState.data.kennels.filter(Boolean).length;
    return {
      location: 'shelter',
      primary,
      secondary,
      hint,
      dog,
      dogMode,
      arrow,
      progress: { icon: 'house', text: `Вольеры ${used}/${this.kennelSprites.length}` },
    };
  }

  // ---------------------------------------------------------------- actions

  protected onAction(id: string): void {
    if (this.leaving) return;
    const s = gameState.data;
    switch (id) {
      case 'take-pen': {
        if (!s.intake.length) return;
        // the dog closest to the player
        let best = s.intake[0];
        let bestD = Infinity;
        for (const dogId of s.intake) {
          const p = this.puppets.get(dogId);
          const dd = p ? Phaser.Math.Distance.Between(p.x, p.y, this.player.x, this.player.y) : 1e9;
          if (dd < bestD) {
            bestD = dd;
            best = dogId;
          }
        }
        s.intake = s.intake.filter((x) => x !== best);
        this.pickUpPuppet(best);
        break;
      }
      case 'pen': {
        const dog = this.player.drop();
        if (!dog) return;
        s.carrying = null;
        s.intake.push(dog.id);
        gameState.commit();
        const p = this.spawnPuppet(dog, this.player.x, this.player.y - 2);
        p.jump(7);
        const pt = this.penRect.getRandomPoint();
        p.walkTo(pt.x, pt.y, 55, () => p.wanderIn(this.penRect));
        break;
      }
      case 'station': {
        const sid = this.ctxStation;
        const dog = this.player.carrying;
        if (!sid || !dog || s.stations[sid]) return;
        this.player.drop();
        s.carrying = null;
        s.stations[sid] = { dogId: dog.id, endsAt: Date.now() + stationDuration(sid) };
        gameState.commit();
        this.placeAtStation(dog.id, sid, false);
        play('pop');
        break;
      }
      case 'take-station': {
        const sid = this.ctxStation;
        const slot = sid ? s.stations[sid] : undefined;
        if (!sid || !slot) return;
        delete s.stations[sid];
        this.pickUpPuppet(slot.dogId);
        break;
      }
      case 'kennel': {
        const dog = this.player.carrying;
        const free = s.kennels.findIndex((x, i) => !x && i < this.kennelSprites.length);
        if (!dog || free < 0) return;
        this.player.drop();
        s.carrying = null;
        s.kennels[free] = dog.id;
        gameState.commit();
        this.placeInKennel(dog.id, free, false);
        this.toast(`${dog.name} в вольере. Ждём семью!`, 'heart');
        play('happy');
        break;
      }
      case 'release': {
        const i = this.ctxKennel;
        const dogId = i >= 0 ? s.kennels[i] : null;
        if (!dogId) return;
        const dog = s.dogs[dogId];
        dog.state = 'released';
        s.kennels[i] = null;
        s.released++;
        gameState.addCoins(RELEASE_REWARD);
        this.floatText(this.player.x, this.player.y - 26, `+${RELEASE_REWARD}`);
        const p = this.puppets.get(dogId);
        if (p) {
          p.jump(6);
          p.walkTo(this.sdef.gate.x, this.sdef.gate.y + 30, 60, () => {
            p.destroy();
            this.puppets.delete(dogId);
          });
        }
        this.toast(`${dog.name} отправляется в Гаражи — с биркой и ${g(dog, 'спокойный', 'спокойная')}`, 'paw');
        play('happy');
        break;
      }
      case 'adopt': {
        const v = this.visitor;
        if (!v || v.state !== 'waiting') return;
        const i = s.kennels.indexOf(v.dogId);
        if (i < 0) return;
        const dog = s.dogs[v.dogId];
        dog.state = 'adopted';
        s.kennels[i] = null;
        s.adopted++;
        gameState.addCoins(ADOPT_REWARD);
        this.floatText(this.player.x, this.player.y - 26, `+${ADOPT_REWARD}`);
        this.burst(v.npc.x, v.npc.y - 20, 'icon_heart', 8);
        play('catch');
        this.visitorLeave('Спасибо! Будем очень любить!');
        const p = this.puppets.get(v.dogId);
        if (p) {
          p.jump(8);
          p.walkTo(this.sdef.gate.x + 10, this.sdef.gate.y + 24, 34, () => {
            p.destroy();
            this.puppets.delete(dog.id);
          });
        }
        this.toast(`${dog.name} ${g(dog, 'нашёл', 'нашла')} семью!`, 'heart');
        break;
      }
      case 'upgrades':
        this.game.events.emit('open-upgrades');
        break;
      case 'refill':
        if (gameState.refillFood()) {
          play('pop');
          this.toast('Корм пополнен', 'food');
        }
        break;
      case 'travel':
        if (!this.player.carrying) this.travel('District');
        break;
    }
  }

  private pickUpPuppet(dogId: string): void {
    const dog = gameState.data.dogs[dogId];
    const p = this.puppets.get(dogId);
    if (p) {
      const ghost = this.add.sprite(p.x, p.y, p.view.texture.key, p.view.frame.name).setOrigin(0.5, 22 / 24).setDepth(p.y).setFlipX(p.facingLeft);
      this.tweens.add({ targets: ghost, x: this.player.x, y: this.player.y - 20, scale: 0.3, duration: 260, ease: 'Cubic.In', onComplete: () => ghost.destroy() });
      p.destroy();
      this.puppets.delete(dogId);
    }
    this.player.pickUp(dog);
    gameState.data.carrying = dogId;
    gameState.commit();
    play('pop');
  }
}
