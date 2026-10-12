import Phaser from 'phaser';
import { play, unlockAudio } from '../core/sfx';
import { gameState } from '../core/state';
import { TEMPERAMENT_LABEL, TRAIT_LABEL, g, type DogData } from '../dogs/types';
import { dogTexture } from '../entities/Dog';
import { CatchMinigame } from '../ui/CatchMinigame';
import { controls } from '../ui/controls';
import { metrics, px } from '../ui/metrics';
import { CREAM, icon, INK, panel, text } from '../ui/widgets';
import type { ActionKind, CatchRequest, ContextInfo, DistrictScene } from './DistrictScene';

const ACTION_LOOK: Partial<Record<ActionKind, { icon: string; label: string; tex: string }>> = {
  feed: { icon: 'food', label: 'Кинуть корм', tex: 'ui_btn' },
  catch: { icon: 'hand', label: 'Поймать', tex: 'ui_btn_green' },
  deposit: { icon: 'van', label: 'В фургон', tex: 'ui_btn_green' },
  refill: { icon: 'food', label: 'Взять корм', tex: 'ui_btn' },
};

const MODE_LABEL: Record<string, (d: DogData) => string> = {
  wander: () => 'гуляет',
  idle: () => 'осматривается',
  sleep: () => 'спит',
  alert: () => 'рычит',
  charge: () => 'бросается!',
  retreat: () => 'отходит',
  flee: () => 'убегает',
  toFood: () => 'бежит к корму',
  eat: () => 'ест',
  content: (d) => g(d, 'доволен', 'довольна'),
  follow: () => 'идёт за тобой',
  carried: () => 'в переноске',
};

interface Toast {
  root: Phaser.GameObjects.Container;
  born: number;
}

export class UIScene extends Phaser.Scene {
  private ctx: ContextInfo | null = null;
  // HUD
  private coinText!: Phaser.GameObjects.Text;
  private foodText!: Phaser.GameObjects.Text;
  private progressText!: Phaser.GameObjects.Text;
  private muteIcon!: Phaser.GameObjects.Image;
  private muteZone!: Phaser.Geom.Rectangle;
  private hintBox!: Phaser.GameObjects.Container;
  private hintText!: Phaser.GameObjects.Text;
  private hintBg!: Phaser.GameObjects.NineSlice;
  // dog card
  private card!: Phaser.GameObjects.Container;
  private cardPortrait!: Phaser.GameObjects.Sprite;
  private cardName!: Phaser.GameObjects.Text;
  private cardSub!: Phaser.GameObjects.Text;
  private cardBars!: Phaser.GameObjects.Graphics;
  private cardBarLabels: Phaser.GameObjects.Text[] = [];
  private cardDogKey = '';
  // action button
  private btn!: Phaser.GameObjects.Image;
  private btnIcon!: Phaser.GameObjects.Image;
  private btnLabel!: Phaser.GameObjects.Text;
  private btnCenter = new Phaser.Math.Vector2();
  private btnRadius = 0;
  // joystick
  private joyBase!: Phaser.GameObjects.Image;
  private joyKnob!: Phaser.GameObjects.Image;
  private joyPointer: number | null = null;
  private joyOrigin = new Phaser.Math.Vector2();
  private joyRadius = 0;
  // other
  private vanArrow!: Phaser.GameObjects.Container;
  private toasts: Toast[] = [];
  private minigame: CatchMinigame | null = null;
  private modal: Phaser.GameObjects.Container | null = null;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private topY = 0;
  private needsRelayout = false;
  private started = false;

  constructor() {
    super('UI');
  }

  create(): void {
    this.toasts = [];
    this.build();
    const district = this.scene.get('District') as DistrictScene;
    if (district.context) this.applyContext(district.context);

    this.input.on('pointerdown', this.onDown, this);
    this.input.on('pointermove', this.onMove, this);
    this.input.on('pointerup', this.onUp, this);
    this.input.on('pointerupoutside', this.onUp, this);

    if (this.input.keyboard) {
      this.keys = this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,E,ENTER') as Record<string, Phaser.Input.Keyboard.Key>;
      this.input.keyboard.on('keydown-SPACE', () => this.pressAction());
      this.input.keyboard.on('keydown-E', () => this.pressAction());
      this.input.keyboard.on('keydown-ENTER', () => this.pressAction());
    }

    this.game.events.on('context', this.applyContext, this);
    this.game.events.on('toast', this.showToast, this);
    this.game.events.on('catch-start', this.startCatch, this);
    this.game.events.on('district-complete', this.showComplete, this);
    gameState.on('changed', this.refreshHud, this);
    this.scale.on('resize', this.onResize, this);
    this.events.once('shutdown', () => {
      this.game.events.off('context', this.applyContext, this);
      this.game.events.off('toast', this.showToast, this);
      this.game.events.off('catch-start', this.startCatch, this);
      this.game.events.off('district-complete', this.showComplete, this);
      gameState.off('changed', this.refreshHud, this);
      this.scale.off('resize', this.onResize, this);
    });

    if (!this.started) this.showTitle();
  }

  private onResize(): void {
    // rebuilding mid-minigame would lose it; wait until it ends
    if (this.minigame || this.modal) this.needsRelayout = true;
    else this.scene.restart();
  }

  // ------------------------------------------------------------------ layout

  private build(): void {
    const { width: W, height: H } = this.scale.gameSize;
    const s = metrics.safe;
    const S = metrics.art;
    const pad = px(8);
    this.topY = s.top + pad;
    const pillH = px(36);

    // coins
    const coinW = px(92);
    panel(this, s.left + pad, this.topY, coinW, pillH);
    icon(this, s.left + pad + px(20), this.topY + pillH / 2 - px(1), 'coin', S);
    this.coinText = text(this, s.left + pad + px(36), this.topY + pillH / 2, '0', 17, { bold: true }).setOrigin(0, 0.55);
    // food
    const foodX = s.left + pad + coinW + px(6);
    panel(this, foodX, this.topY, px(84), pillH);
    icon(this, foodX + px(20), this.topY + pillH / 2 - px(1), 'food', S);
    this.foodText = text(this, foodX + px(36), this.topY + pillH / 2, '0/0', 17, { bold: true }).setOrigin(0, 0.55);
    // mute
    const muteX = W - s.right - pad - pillH;
    panel(this, muteX, this.topY, pillH, pillH);
    this.muteIcon = icon(this, muteX + pillH / 2, this.topY + pillH / 2 - px(1), gameState.data.muted ? 'mute' : 'sound', S);
    this.muteZone = new Phaser.Geom.Rectangle(muteX - px(6), this.topY - px(6), pillH + px(12), pillH + px(12));
    // district progress
    const progW = px(118);
    const progX = muteX - progW - px(6);
    panel(this, progX, this.topY, progW, pillH);
    icon(this, progX + px(18), this.topY + pillH / 2 - px(1), 'paw', S);
    this.progressText = text(this, progX + px(32), this.topY + pillH / 2, 'Гаражи', 14, { bold: true }).setOrigin(0, 0.55);

    // dog card
    this.buildCard(W);

    // action button
    const bd = px(92);
    const bs = Math.max(2, Math.round(bd / 28));
    this.btnRadius = (28 * bs) / 2;
    this.btnCenter.set(W - s.right - px(20) - this.btnRadius, H - s.bottom - px(40) - this.btnRadius);
    this.btn = this.add.image(this.btnCenter.x, this.btnCenter.y, 'ui_btn_off').setScale(bs);
    this.btnIcon = this.add.image(this.btnCenter.x, this.btnCenter.y - px(2), 'icon_paw').setScale(Math.round(S * 1.4));
    this.btnLabel = text(this, this.btnCenter.x, this.btnCenter.y + this.btnRadius + px(4), '', 14, {
      bold: true,
      color: CREAM,
      stroke: true,
      align: 'center',
    }).setOrigin(0.5, 0);

    // hint
    const landscape = W > H * 1.1;
    const hintW = landscape ? Math.min(W - (this.btnRadius + px(28)) * 4, px(420)) : Math.min(W - px(32), px(360));
    this.hintBox = this.add.container(W / 2, this.btnCenter.y - this.btnRadius - px(30));
    this.hintBg = panel(this, -hintW / 2, 0, hintW, px(40), 'ui_panel_dark');
    this.hintText = text(this, 0, px(10), '', 14, { color: CREAM, align: 'center', wrap: hintW - px(24) }).setOrigin(0.5, 0);
    this.hintBox.add([this.hintBg, this.hintText]);
    this.hintBox.setData('landscape', landscape);

    // joystick (hidden until touched)
    const js = Math.max(2, Math.round(px(110) / 40));
    this.joyRadius = (40 * js) / 2 - px(6);
    this.joyBase = this.add.image(0, 0, 'ui_joy_base').setScale(js).setVisible(false).setAlpha(0.9);
    this.joyKnob = this.add.image(0, 0, 'ui_joy_knob').setScale(js).setVisible(false);

    // van arrow
    this.vanArrow = this.add.container(0, 0).setVisible(false);
    const arrowG = this.add.graphics();
    arrowG.fillStyle(0x3b2a2a, 1).fillCircle(0, 0, px(24));
    arrowG.fillStyle(0xf4e4c1, 1).fillCircle(0, 0, px(21));
    arrowG.fillStyle(0xe8833a, 1).fillTriangle(px(30), 0, px(18), -px(9), px(18), px(9));
    arrowG.setName('arrow');
    this.vanArrow.add([arrowG, icon(this, 0, 0, 'van', Math.max(2, S - 1))]);

    this.refreshHud();
  }

  private buildCard(W: number): void {
    const s = metrics.safe;
    const cw = Math.min(W - s.left - s.right - px(16), px(330));
    const ch = px(84);
    this.card = this.add.container(s.left + px(8), this.topY + px(44)).setVisible(false);
    this.card.add(panel(this, 0, 0, cw, ch));
    this.cardPortrait = this.add.sprite(px(40), ch / 2 + px(2), '__DEFAULT');
    this.cardName = text(this, px(80), px(9), '', 16, { bold: true });
    this.cardSub = text(this, px(80), px(29), '', 12, { color: '#7a4a28' });
    this.cardBars = this.add.graphics();
    this.card.add([this.cardPortrait, this.cardName, this.cardSub, this.cardBars]);
    this.cardBarLabels = ['Голод', 'Грязь', 'Злость', 'Доверие'].map((l) => {
      const t = text(this, 0, 0, l, 10, { color: '#7a4a28' });
      this.card.add(t);
      return t;
    });
    this.card.setData('w', cw);
  }

  // ------------------------------------------------------------------ state → view

  private refreshHud(): void {
    if (!this.coinText?.active) return;
    const d = gameState.data;
    this.coinText.setText(String(d.coins));
    this.foodText.setText(`${d.food}/${d.foodMax}`);
    this.foodText.setColor(d.food === 0 ? '#c0453f' : INK);
    this.muteIcon.setTexture(d.muted ? 'icon_mute' : 'icon_sound');
  }

  private applyContext(info: ContextInfo): void {
    this.ctx = info;
    if (!this.btn?.active) return;
    this.progressText.setText(`${info.caught}/${info.total}`);

    const look = ACTION_LOOK[info.kind];
    this.btn.setTexture(look ? look.tex : 'ui_btn_off');
    this.btnIcon.setTexture(`icon_${look ? look.icon : info.kind === 'carrying' ? 'van' : 'paw'}`).setAlpha(look ? 1 : 0.6);
    this.btnLabel.setText(look ? look.label : '');

    this.hintText.setText(info.hint);
    const hb = this.hintText.getBounds();
    const bgH = hb.height + px(20);
    this.hintBg.setSize(this.hintBg.width, bgH / this.hintBg.scaleY);
    const { height: H } = this.scale.gameSize;
    this.hintBox.y = this.hintBox.getData('landscape')
      ? H - metrics.safe.bottom - px(12) - bgH
      : this.btnCenter.y - this.btnRadius - px(18) - bgH;

    this.updateCard(info);
    this.updateVanArrow(info);
  }

  private updateCard(info: ContextInfo): void {
    const dog = info.dog;
    this.card.setVisible(!!dog);
    if (!dog) return;
    const key = dogTexture(this, dog);
    if (key !== this.cardDogKey) {
      this.cardDogKey = key;
      const ps = Math.max(2, Math.round(px(60) / 32));
      this.cardPortrait.setTexture(key, 0).setScale(ps);
      this.cardPortrait.anims.play(`${key}_idle`);
    }
    const leader = dog.isLeader ? ' · вожак' : '';
    this.cardName.setText(`${dog.name}${leader}`);
    const mode = info.dogMode ? MODE_LABEL[info.dogMode]?.(dog) ?? '' : '';
    const temper = TEMPERAMENT_LABEL[dog.temperament];
    const trait = dog.traits.map((t) => TRAIT_LABEL[t]).join(', ');
    this.cardSub.setText([mode, `${temper}, ${trait.toLowerCase()}`].filter(Boolean).join(' · '));

    const cw = this.card.getData('w') as number;
    const bars: [number, number][] = [
      [dog.stats.hunger, 0xe8833a],
      [dog.stats.dirt, 0x8a6a4a],
      [dog.stats.aggression, 0xe0453f],
      [dog.stats.trust, 0x7cc576],
    ];
    const g2 = this.cardBars;
    g2.clear();
    const colW = (cw - px(92)) / 2;
    bars.forEach(([v, color], i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = px(80) + col * (colW + px(6));
      const y = px(50) + row * px(16);
      const lbl = this.cardBarLabels[i];
      lbl.setPosition(x, y - px(1));
      const bx = x + px(46);
      const bw = colW - px(48);
      g2.fillStyle(0x3b2a2a, 1).fillRect(bx, y + px(2), bw, px(8));
      g2.fillStyle(0xe9d6ad, 1).fillRect(bx + px(1), y + px(3), bw - px(2), px(6));
      g2.fillStyle(color, 1).fillRect(bx + px(1), y + px(3), Math.round(((bw - px(2)) * v) / 100), px(6));
    });
  }

  private updateVanArrow(info: ContextInfo): void {
    const a = info.vanArrow;
    this.vanArrow.setVisible(!!a);
    if (!a) return;
    const { width: W, height: H } = this.scale.gameSize;
    const cx = W / 2;
    const cy = H / 2;
    const m = px(56);
    const k = Math.min(Math.abs((W / 2 - m) / (a.x || 1e-6)), Math.abs((H / 2 - m * 2.2) / (a.y || 1e-6)));
    this.vanArrow.setPosition(cx + a.x * k, cy + a.y * k);
    (this.vanArrow.getByName('arrow') as Phaser.GameObjects.Graphics).setRotation(Math.atan2(a.y, a.x));
  }

  // ------------------------------------------------------------------ toasts

  private showToast(t: { text: string; icon?: string }): void {
    const { width: W } = this.scale.gameSize;
    const label = text(this, 0, 0, t.text, 14, { bold: true });
    const iw = t.icon ? px(26) : 0;
    const w = label.width + iw + px(26);
    const h = px(34);
    const root = this.add.container(W / 2, this.topY + px(176)).setDepth(500);
    root.add(panel(this, -w / 2, -h / 2, w, h));
    if (t.icon) root.add(icon(this, -w / 2 + px(20), -px(1), t.icon, metrics.art));
    label.setPosition(-w / 2 + px(13) + iw, 0).setOrigin(0, 0.55);
    root.add(label);
    root.setScale(0.6).setAlpha(0);
    this.tweens.add({ targets: root, scale: 1, alpha: 1, duration: 180, ease: 'Back.Out' });
    for (const old of this.toasts) this.tweens.add({ targets: old.root, y: old.root.y - h - px(6), duration: 150 });
    // keep at most 3 on screen so they never cover the HUD
    while (this.toasts.length >= 3) {
      const oldest = this.toasts.shift()!;
      this.tweens.add({ targets: oldest.root, alpha: 0, duration: 120, onComplete: () => oldest.root.destroy() });
    }
    const toast = { root, born: this.time.now };
    this.toasts.push(toast);
    this.time.delayedCall(1900, () => {
      this.tweens.add({
        targets: root,
        alpha: 0,
        y: root.y - px(20),
        duration: 300,
        onComplete: () => {
          root.destroy();
          this.toasts = this.toasts.filter((x) => x !== toast);
        },
      });
    });
  }

  // ------------------------------------------------------------------ overlays

  private startCatch(req: CatchRequest): void {
    this.releaseJoystick();
    this.minigame = new CatchMinigame(this, req, (ok) => {
      this.minigame = null;
      this.game.events.emit('catch-result', ok);
      if (this.needsRelayout) this.scene.restart();
    });
  }

  private showTitle(): void {
    const { width: W, height: H } = this.scale.gameSize;
    const root = this.add.container(0, 0).setDepth(2000);
    root.add(this.add.rectangle(0, 0, W, H, 0x2b2433, 0.82).setOrigin(0));
    const pw = Math.min(W - px(32), px(340));
    const ph = px(300);
    const x0 = (W - pw) / 2;
    const y0 = (H - ph) / 2;
    root.add(panel(this, x0, y0, pw, ph));
    root.add(text(this, W / 2, y0 + px(22), 'Street Dogs', 30, { bold: true, align: 'center' }).setOrigin(0.5, 0));
    root.add(text(this, W / 2, y0 + px(58), 'Tycoon', 20, { bold: true, align: 'center', color: '#e8833a' }).setOrigin(0.5, 0));
    root.add(
      text(
        this,
        W / 2,
        y0 + px(96),
        'Район Гаражи.\nКорми бездомных собак, чтобы подобрели, лови их и вези в фургон приюта.',
        14,
        { align: 'center', wrap: pw - px(40) },
      ).setOrigin(0.5, 0),
    );
    root.add(
      text(this, W / 2, y0 + px(178), 'Джойстик — палец в любом месте экрана', 12, {
        align: 'center',
        color: '#7a4a28',
        wrap: pw - px(40),
      }).setOrigin(0.5, 0),
    );
    const bs = Math.max(2, Math.round(px(64) / 28));
    const by = y0 + ph - px(58);
    root.add(this.add.image(W / 2, by, 'ui_btn_green').setScale(bs));
    root.add(icon(this, W / 2 + px(2), by - px(2), 'paw', Math.round(metrics.art * 1.3)));
    this.modal = root;
    root.setData('onTap', () => {
      this.started = true;
      unlockAudio();
      play('happy');
      this.closeModal();
    });
  }

  private showComplete(info: { name: string; bonus: number }): void {
    const { width: W, height: H } = this.scale.gameSize;
    const root = this.add.container(0, 0).setDepth(2000);
    root.add(this.add.rectangle(0, 0, W, H, 0x2b2433, 0.7).setOrigin(0));
    const pw = Math.min(W - px(32), px(340));
    const ph = px(290);
    const x0 = (W - pw) / 2;
    const y0 = (H - ph) / 2;
    root.add(panel(this, x0, y0, pw, ph));
    root.add(icon(this, W / 2, y0 + px(34), 'star', Math.round(metrics.art * 1.6)));
    root.add(text(this, W / 2, y0 + px(62), `${info.name}: все собаки спасены!`, 20, { bold: true, align: 'center', wrap: pw - px(30) }).setOrigin(0.5, 0));
    root.add(
      text(
        this,
        W / 2,
        y0 + px(100),
        `Все собаки района едут в приют.\nБонус от города: +${info.bonus}\n\nСкоро: приют, мойка, ветпункт и бирки.`,
        14,
        { align: 'center', wrap: pw - px(36) },
      ).setOrigin(0.5, 0),
    );
    root.add(text(this, W / 2, y0 + ph - px(40), 'Тапни, чтобы начать заново', 13, { align: 'center', color: '#7a4a28' }).setOrigin(0.5, 0));
    play('catch');
    this.modal = root;
    root.setData('onTap', () => {
      this.closeModal();
      this.game.events.emit('district-restart');
    });
  }

  private closeModal(): void {
    const m = this.modal;
    if (!m) return;
    this.modal = null;
    this.tweens.add({ targets: m, alpha: 0, duration: 200, onComplete: () => m.destroy() });
    if (this.needsRelayout) this.time.delayedCall(220, () => this.scene.restart());
  }

  // ------------------------------------------------------------------ input

  private pressAction(): void {
    if (this.modal) {
      (this.modal.getData('onTap') as () => void)();
      return;
    }
    if (this.minigame) {
      this.minigame.tap();
      return;
    }
    if (!this.ctx || !ACTION_LOOK[this.ctx.kind]) return;
    this.tweens.add({ targets: [this.btn, this.btnIcon], scale: '*=0.9', yoyo: true, duration: 70 });
    this.game.events.emit('action');
  }

  private onDown(p: Phaser.Input.Pointer): void {
    unlockAudio();
    if (this.modal || this.minigame) {
      this.pressAction();
      return;
    }
    if (Phaser.Geom.Rectangle.Contains(this.muteZone, p.x, p.y)) {
      gameState.toggleMute();
      return;
    }
    if (Phaser.Math.Distance.Between(p.x, p.y, this.btnCenter.x, this.btnCenter.y) < this.btnRadius + px(14)) {
      this.pressAction();
      return;
    }
    if (this.joyPointer === null && p.y > this.topY + px(40)) {
      this.joyPointer = p.id;
      this.joyOrigin.set(p.x, p.y);
      this.joyBase.setPosition(p.x, p.y).setVisible(true);
      this.joyKnob.setPosition(p.x, p.y).setVisible(true);
    }
  }

  private onMove(p: Phaser.Input.Pointer): void {
    if (p.id !== this.joyPointer) return;
    const dx = p.x - this.joyOrigin.x;
    const dy = p.y - this.joyOrigin.y;
    const d = Math.hypot(dx, dy);
    const k = d > this.joyRadius ? this.joyRadius / d : 1;
    this.joyKnob.setPosition(this.joyOrigin.x + dx * k, this.joyOrigin.y + dy * k);
    const dead = px(6);
    const mag = d < dead ? 0 : Math.min(1, (d - dead) / (this.joyRadius * 0.7));
    controls.x = d ? (dx / d) * mag : 0;
    controls.y = d ? (dy / d) * mag : 0;
  }

  private onUp(p: Phaser.Input.Pointer): void {
    if (p.id === this.joyPointer) this.releaseJoystick();
  }

  private releaseJoystick(): void {
    this.joyPointer = null;
    controls.x = 0;
    controls.y = 0;
    this.joyBase?.setVisible(false);
    this.joyKnob?.setVisible(false);
  }

  update(_time: number, delta: number): void {
    this.minigame?.update(delta);
    // keyboard movement (desktop)
    if (this.keys && this.joyPointer === null) {
      const k = this.keys;
      const x = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
      const y = (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0);
      const l = Math.hypot(x, y) || 1;
      controls.x = x / l;
      controls.y = y / l;
    }
    if (this.vanArrow.visible) this.vanArrow.setScale(1 + Math.sin(this.time.now / 180) * 0.06);
  }
}
