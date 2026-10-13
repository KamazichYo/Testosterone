import Phaser from 'phaser';
import { play, unlockAudio } from '../core/sfx';
import { gameState, UPGRADES } from '../core/state';
import { careDone, CareStep } from '../dogs/behaviour';
import { temperamentLabel, TRAIT_LABEL, g, type DogData } from '../dogs/types';
import { dogTexture } from '../entities/Dog';
import { CatchMinigame } from '../ui/CatchMinigame';
import { controls } from '../ui/controls';
import { metrics, px } from '../ui/metrics';
import { CREAM, icon, INK, panel, text } from '../ui/widgets';
import type { CatchRequest } from './DistrictScene';
import type { ContextInfo, Tone } from './WorldScene';

const TONE_TEX: Record<Tone, string> = { orange: 'ui_btn_orange', green: 'ui_btn_green', blue: 'ui_btn_blue' };

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
  follow: (d) => (d.state === 'released' ? 'идёт рядом' : 'идёт за тобой'),
  carried: () => 'в переноске',
  station: () => 'на процедуре',
  done: () => 'процедура готова',
  kennel: () => 'в вольере',
};

const CARE_ICONS: [CareStep, string][] = [
  ['wash', 'drop'],
  ['feed', 'food'],
  ['vet', 'cross'],
  ['tag', 'tag'],
];

interface Toast {
  root: Phaser.GameObjects.Container;
}

interface RoundButton {
  bg: Phaser.GameObjects.Image;
  icon: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  center: Phaser.Math.Vector2;
  radius: number;
  scale: number;
  active: boolean;
  key: string;
}

export class UIScene extends Phaser.Scene {
  private ctx: ContextInfo | null = null;
  // HUD
  private coinText!: Phaser.GameObjects.Text;
  private foodText!: Phaser.GameObjects.Text;
  private progressText!: Phaser.GameObjects.Text;
  private progressIcon!: Phaser.GameObjects.Image;
  private muteIcon!: Phaser.GameObjects.Image;
  private muteZone!: Phaser.Geom.Rectangle;
  private hintBox!: Phaser.GameObjects.Container;
  private hintText!: Phaser.GameObjects.Text;
  private hintBg!: Phaser.GameObjects.NineSlice;
  private hintTargetY = 0;
  // dog card
  private card!: Phaser.GameObjects.Container;
  private cardPortrait!: Phaser.GameObjects.Sprite;
  private cardName!: Phaser.GameObjects.Text;
  private cardSub!: Phaser.GameObjects.Text;
  private cardBars!: Phaser.GameObjects.Graphics;
  private cardBarLabels: Phaser.GameObjects.Text[] = [];
  private cardCare: Phaser.GameObjects.Image[] = [];
  private cardChecks: Phaser.GameObjects.Image[] = [];
  private cardDogKey = '';
  private cardShown = false;
  private cardHomeY = 0;
  // buttons
  private btn!: RoundButton;
  private btn2!: RoundButton;
  // joystick
  private joyBase!: Phaser.GameObjects.Image;
  private joyKnob!: Phaser.GameObjects.Image;
  private joyPointer: number | null = null;
  private joyOrigin = new Phaser.Math.Vector2();
  private joyRadius = 0;
  private rawInput = new Phaser.Math.Vector2();
  // other
  private arrow!: Phaser.GameObjects.Container;
  private arrowIcon!: Phaser.GameObjects.Image;
  private arrowTarget = new Phaser.Math.Vector2();
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
    this.cardShown = false;
    this.build();
    const world = (this.scene.get('District').scene.isActive() ? this.scene.get('District') : this.scene.get('Shelter')) as unknown as { context: ContextInfo | null };
    if (world?.context) this.applyContext(world.context);

    this.input.on('pointerdown', this.onDown, this);
    this.input.on('pointermove', this.onMove, this);
    this.input.on('pointerup', this.onUp, this);
    this.input.on('pointerupoutside', this.onUp, this);

    if (this.input.keyboard) {
      this.keys = this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,E,ENTER,Q') as Record<string, Phaser.Input.Keyboard.Key>;
      this.input.keyboard.on('keydown-SPACE', () => this.press(this.btn));
      this.input.keyboard.on('keydown-E', () => this.press(this.btn));
      this.input.keyboard.on('keydown-ENTER', () => this.press(this.btn));
      this.input.keyboard.on('keydown-Q', () => this.press(this.btn2));
    }

    this.game.events.on('context', this.applyContext, this);
    this.game.events.on('toast', this.showToast, this);
    this.game.events.on('catch-start', this.startCatch, this);
    this.game.events.on('district-complete', this.showComplete, this);
    this.game.events.on('open-upgrades', this.showUpgrades, this);
    gameState.on('changed', this.refreshHud, this);
    this.scale.on('resize', this.onResize, this);
    this.events.once('shutdown', () => {
      this.game.events.off('context', this.applyContext, this);
      this.game.events.off('toast', this.showToast, this);
      this.game.events.off('catch-start', this.startCatch, this);
      this.game.events.off('district-complete', this.showComplete, this);
      this.game.events.off('open-upgrades', this.showUpgrades, this);
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
    this.coinText = text(this, s.left + pad + px(36), this.topY + pillH / 2, '0', 17).setOrigin(0, 0.55);
    // food
    const foodX = s.left + pad + coinW + px(6);
    panel(this, foodX, this.topY, px(84), pillH);
    icon(this, foodX + px(20), this.topY + pillH / 2 - px(1), 'food', S);
    this.foodText = text(this, foodX + px(36), this.topY + pillH / 2, '0/0', 17).setOrigin(0, 0.55);
    // mute
    const muteX = W - s.right - pad - pillH;
    panel(this, muteX, this.topY, pillH, pillH);
    this.muteIcon = icon(this, muteX + pillH / 2, this.topY + pillH / 2 - px(1), gameState.data.muted ? 'mute' : 'sound', S);
    this.muteZone = new Phaser.Geom.Rectangle(muteX - px(6), this.topY - px(6), pillH + px(12), pillH + px(12));
    // location progress
    const progW = px(124);
    const progX = muteX - progW - px(6);
    panel(this, progX, this.topY, progW, pillH);
    this.progressIcon = icon(this, progX + px(18), this.topY + pillH / 2 - px(1), 'paw', S);
    this.progressText = text(this, progX + px(32), this.topY + pillH / 2, '', 14).setOrigin(0, 0.55);

    this.buildCard(W);

    // primary + secondary action buttons
    const r1 = px(46);
    const c1 = new Phaser.Math.Vector2(W - s.right - px(20) - r1, H - s.bottom - px(42) - r1);
    this.btn = this.makeButton(c1, r1, 15);
    const r2 = px(32);
    const c2 = new Phaser.Math.Vector2(c1.x - r1 - px(22) - r2, c1.y + r1 - r2);
    this.btn2 = this.makeButton(c2, r2, 12);
    this.setButton(this.btn2, null, true);

    // hint
    const landscape = W > H * 1.1;
    const hintW = landscape ? Math.min(W - (r1 + px(28)) * 4, px(420)) : Math.min(W - px(32), px(360));
    this.hintBox = this.add.container(W / 2, c1.y - r1 - px(70));
    this.hintBg = panel(this, -hintW / 2, 0, hintW, px(40), 'ui_panel_dark');
    this.hintText = text(this, 0, px(10), '', 14, { color: CREAM, align: 'center', wrap: hintW - px(24) }).setOrigin(0.5, 0);
    this.hintBox.add([this.hintBg, this.hintText]);
    this.hintBox.setData('landscape', landscape);
    this.hintTargetY = this.hintBox.y;

    // joystick (fades in where you touch)
    const js = Math.max(2, Math.round(px(110) / 40));
    this.joyRadius = (40 * js) / 2 - px(6);
    this.joyBase = this.add.image(0, 0, 'ui_joy_base').setScale(js).setAlpha(0);
    this.joyKnob = this.add.image(0, 0, 'ui_joy_knob').setScale(js).setAlpha(0);

    // arrow to something important off-screen
    this.arrow = this.add.container(W / 2, H / 2).setAlpha(0);
    const arrowG = this.add.graphics();
    arrowG.fillStyle(0x3b2a2a, 1).fillCircle(0, 0, px(24));
    arrowG.fillStyle(0xf4e4c1, 1).fillCircle(0, 0, px(21));
    arrowG.fillStyle(0xe8833a, 1).fillTriangle(px(31), 0, px(19), -px(10), px(19), px(10));
    arrowG.setName('arrow');
    this.arrowIcon = icon(this, 0, 0, 'van', Math.max(2, S - 1));
    this.arrow.add([arrowG, this.arrowIcon]);
    this.arrowTarget.set(W / 2, H / 2);

    this.refreshHud();
  }

  private makeButton(center: Phaser.Math.Vector2, radius: number, labelSize: number): RoundButton {
    const scale = Math.max(2, Math.round((radius * 2) / 28));
    const bg = this.add.image(center.x, center.y, 'ui_btn_off').setScale(scale);
    const ic = this.add.image(center.x, center.y - px(2), 'icon_paw').setScale(Math.round(metrics.art * (radius > px(40) ? 1.4 : 1)));
    const label = text(this, center.x, center.y + radius + px(4), '', labelSize, { color: CREAM, stroke: true, align: 'center' }).setOrigin(0.5, 0);
    return { bg, icon: ic, label, center, radius: (28 * scale) / 2, scale, active: false, key: '' };
  }

  private setButton(b: RoundButton, spec: ContextInfo['primary'], hideWhenOff = false): void {
    const key = spec ? `${spec.id}|${spec.label}|${spec.tone}` : 'off';
    if (key === b.key) return;
    b.key = key;
    b.active = !!spec;
    const visible = !!spec || !hideWhenOff;
    b.bg.setTexture(spec ? TONE_TEX[spec.tone] : 'ui_btn_off');
    b.icon.setTexture(`icon_${spec ? spec.icon : 'paw'}`).setAlpha(spec ? 1 : 0.5);
    b.label.setText(spec ? spec.label : '');
    this.tweens.killTweensOf([b.bg, b.icon, b.label]);
    if (visible) {
      // little "pop" when the action changes
      b.bg.setVisible(true).setAlpha(1);
      b.icon.setVisible(true);
      b.label.setVisible(true).setAlpha(0);
      const s0 = b.scale;
      b.bg.setScale(s0 * 0.86);
      this.tweens.add({ targets: b.bg, scale: s0, duration: 260, ease: 'Back.Out' });
      this.tweens.add({ targets: b.label, alpha: 1, duration: 200 });
    } else {
      this.tweens.add({ targets: [b.bg, b.icon, b.label], alpha: 0, duration: 160, onComplete: () => [b.bg, b.icon, b.label].forEach((o) => o.setVisible(false)) });
    }
  }

  private buildCard(W: number): void {
    const s = metrics.safe;
    const cw = Math.min(W - s.left - s.right - px(16), px(330));
    const ch = px(84);
    this.cardHomeY = this.topY + px(44);
    this.card = this.add.container(s.left + px(8), this.cardHomeY).setAlpha(0).setVisible(false);
    this.card.add(panel(this, 0, 0, cw, ch));
    this.cardPortrait = this.add.sprite(px(40), ch / 2 + px(2), '__DEFAULT');
    this.cardName = text(this, px(80), px(9), '', 16);
    this.cardSub = text(this, px(80), px(29), '', 12, { color: '#7a4a28' });
    this.cardBars = this.add.graphics();
    this.card.add([this.cardPortrait, this.cardName, this.cardSub, this.cardBars]);
    this.cardBarLabels = ['Голод', 'Грязь', 'Злость', 'Доверие'].map((l) => {
      const t = text(this, 0, 0, l, 10, { color: '#7a4a28' });
      this.card.add(t);
      return t;
    });
    const isz = Math.max(2, Math.round(metrics.art * 0.8));
    this.cardCare = CARE_ICONS.map(([, ic], i) => {
      const img = this.add.image(px(92) + i * px(40), px(62), `icon_${ic}`).setScale(isz);
      this.card.add(img);
      return img;
    });
    this.cardChecks = CARE_ICONS.map((_, i) => {
      const img = this.add.image(px(106) + i * px(40), px(68), 'icon_check').setScale(Math.max(2, isz - 1));
      this.card.add(img);
      return img;
    });
    this.card.setData('w', cw);
  }

  // ------------------------------------------------------------------ state → view

  private refreshHud(): void {
    if (!this.coinText?.active) return;
    const d = gameState.data;
    this.coinText.setText(String(d.coins));
    this.foodText.setText(`${d.food}/${gameState.foodMax}`);
    this.foodText.setColor(d.food === 0 ? '#c0453f' : INK);
    this.muteIcon.setTexture(d.muted ? 'icon_mute' : 'icon_sound');
  }

  private applyContext(info: ContextInfo): void {
    this.ctx = info;
    if (!this.btn?.bg.active) return;
    this.progressText.setText(info.progress.text);
    this.progressIcon.setTexture(`icon_${info.progress.icon}`);
    this.setButton(this.btn, info.primary);
    this.setButton(this.btn2, info.secondary, true);

    if (this.hintText.text !== info.hint) {
      this.hintText.setText(info.hint);
      const bgH = this.hintText.getBounds().height + px(20);
      this.hintBg.setSize(this.hintBg.width, bgH / this.hintBg.scaleY);
      const { height: H } = this.scale.gameSize;
      this.hintTargetY = this.hintBox.getData('landscape')
        ? H - metrics.safe.bottom - px(12) - bgH
        : this.btn.center.y - this.btn.radius - px(18) - bgH - (this.btn2.active ? px(4) : 0);
      this.hintBox.setVisible(!!info.hint);
      this.hintText.setAlpha(0.2);
      this.tweens.add({ targets: this.hintText, alpha: 1, duration: 200 });
    }

    this.updateCard(info);
    this.arrowIcon.setTexture(`icon_${info.arrow?.icon ?? 'van'}`);
  }

  private updateCard(info: ContextInfo): void {
    const dog = info.dog;
    if (!!dog !== this.cardShown) {
      this.cardShown = !!dog;
      this.tweens.killTweensOf(this.card);
      if (dog) {
        this.card.setVisible(true).setY(this.cardHomeY - px(16));
        this.tweens.add({ targets: this.card, alpha: 1, y: this.cardHomeY, duration: 220, ease: 'Cubic.Out' });
      } else {
        this.tweens.add({ targets: this.card, alpha: 0, y: this.cardHomeY - px(10), duration: 180, onComplete: () => this.card.setVisible(false) });
      }
    }
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
    const temper = temperamentLabel(dog);
    const trait = dog.traits.map((t) => TRAIT_LABEL[t]).join(', ');
    const inShelter = dog.state === 'in_care' || dog.state === 'tagged' || dog.state === 'released' || (dog.state === 'caught' && info.location === 'shelter');
    this.cardSub.setText(inShelter && dog.tagId ? `${mode} · бирка ${dog.tagId}` : [mode, `${temper}, ${trait.toLowerCase()}`].filter(Boolean).join(' · '));

    const g2 = this.cardBars;
    g2.clear();
    this.cardBarLabels.forEach((l) => l.setVisible(!inShelter));
    this.cardCare.forEach((c, i) => c.setVisible(inShelter).setAlpha(careDone(dog, CARE_ICONS[i][0]) ? 1 : 0.35));
    this.cardChecks.forEach((c, i) => c.setVisible(inShelter && careDone(dog, CARE_ICONS[i][0])));
    if (inShelter) return;

    const cw = this.card.getData('w') as number;
    const bars: [number, number][] = [
      [dog.stats.hunger, 0xe8833a],
      [dog.stats.dirt, 0x8a6a4a],
      [dog.stats.aggression, 0xe0453f],
      [dog.stats.trust, 0x7cc576],
    ];
    const colW = (cw - px(92)) / 2;
    bars.forEach(([v, color], i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = px(80) + col * (colW + px(6));
      const y = px(50) + row * px(16);
      this.cardBarLabels[i].setPosition(x, y - px(1));
      const bx = x + px(46);
      const bw = colW - px(48);
      g2.fillStyle(0x3b2a2a, 1).fillRect(bx, y + px(2), bw, px(8));
      g2.fillStyle(0xe9d6ad, 1).fillRect(bx + px(1), y + px(3), bw - px(2), px(6));
      g2.fillStyle(color, 1).fillRect(bx + px(1), y + px(3), Math.round(((bw - px(2)) * v) / 100), px(6));
    });
  }

  // ------------------------------------------------------------------ toasts

  private showToast(t: { text: string; icon?: string }): void {
    const { width: W } = this.scale.gameSize;
    const maxW = W - px(40);
    const label = text(this, 0, 0, t.text, 14, { wrap: maxW - px(50) });
    const iw = t.icon ? px(26) : 0;
    const w = Math.min(maxW, label.width + iw + px(26));
    const h = Math.max(px(34), label.height + px(14));
    const root = this.add.container(W / 2, this.topY + px(176)).setDepth(500);
    root.add(panel(this, -w / 2, -h / 2, w, h));
    if (t.icon) root.add(icon(this, -w / 2 + px(20), -px(1), t.icon, metrics.art));
    label.setPosition(-w / 2 + px(13) + iw, 0).setOrigin(0, 0.5);
    root.add(label);
    root.setScale(0.7).setAlpha(0);
    this.tweens.add({ targets: root, scale: 1, alpha: 1, duration: 220, ease: 'Back.Out' });
    for (const old of this.toasts) this.tweens.add({ targets: old.root, y: old.root.y - h - px(6), duration: 200, ease: 'Cubic.Out' });
    while (this.toasts.length >= 3) {
      const oldest = this.toasts.shift()!;
      this.tweens.add({ targets: oldest.root, alpha: 0, duration: 140, onComplete: () => oldest.root.destroy() });
    }
    const toast = { root };
    this.toasts.push(toast);
    this.time.delayedCall(2200, () => {
      this.tweens.add({
        targets: root,
        alpha: 0,
        y: root.y - px(16),
        duration: 320,
        ease: 'Cubic.In',
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

  private openModal(build: (root: Phaser.GameObjects.Container, x0: number, y0: number, pw: number, ph: number) => void, ph: number, onTap?: (x: number, y: number) => void): void {
    const { width: W, height: H } = this.scale.gameSize;
    const root = this.add.container(0, 0).setDepth(2000);
    const dim = this.add.rectangle(0, 0, W, H, 0x2b2433, 0.75).setOrigin(0);
    root.add(dim);
    const pw = Math.min(W - px(32), px(340));
    const x0 = (W - pw) / 2;
    const y0 = (H - ph) / 2;
    const box = this.add.container(0, 0);
    box.add(panel(this, x0, y0, pw, ph));
    root.add(box);
    build(box, x0, y0, pw, ph);
    this.releaseJoystick();
    this.modal = root;
    root.setData('onTap', onTap ?? (() => this.closeModal()));
    dim.setAlpha(0);
    this.tweens.add({ targets: dim, alpha: 0.75, duration: 200 });
    box.setY(px(30)).setAlpha(0);
    this.tweens.add({ targets: box, y: 0, alpha: 1, duration: 280, ease: 'Back.Out' });
  }

  private showTitle(): void {
    this.openModal(
      (box, x0, y0, pw, ph) => {
        const W = x0 * 2 + pw;
        box.add(text(this, W / 2, y0 + px(22), 'Street Dogs', 30, { align: 'center' }).setOrigin(0.5, 0));
        box.add(text(this, W / 2, y0 + px(58), 'Tycoon', 20, { align: 'center', color: '#e8833a' }).setOrigin(0.5, 0));
        box.add(
          text(this, W / 2, y0 + px(96), 'Корми бездомных собак, лови их, вези в приют. Там их моют, кормят, лечат и ставят бирку — а потом им ищут семью.', 14, {
            align: 'center',
            wrap: pw - px(40),
          }).setOrigin(0.5, 0),
        );
        box.add(text(this, W / 2, y0 + px(196), 'Палец в любом месте экрана — ходить', 12, { align: 'center', color: '#7a4a28', wrap: pw - px(40) }).setOrigin(0.5, 0));
        const bs = Math.max(2, Math.round(px(64) / 28));
        const by = y0 + ph - px(52);
        const b = this.add.image(W / 2, by, 'ui_btn_green').setScale(bs);
        box.add(b);
        box.add(icon(this, W / 2 + px(2), by - px(2), 'paw', Math.round(metrics.art * 1.3)));
        this.tweens.add({ targets: b, scale: bs * 1.06, yoyo: true, repeat: -1, duration: 700, ease: 'Sine.InOut' });
      },
      px(320),
      () => {
        this.started = true;
        unlockAudio();
        play('happy');
        this.closeModal();
      },
    );
  }

  private showComplete(info: { name: string; bonus: number }): void {
    play('catch');
    this.openModal((box, x0, y0, pw, ph) => {
      const W = x0 * 2 + pw;
      const star = icon(this, W / 2, y0 + px(34), 'star', Math.round(metrics.art * 1.6));
      box.add(star);
      this.tweens.add({ targets: star, angle: { from: -8, to: 8 }, yoyo: true, repeat: -1, duration: 600, ease: 'Sine.InOut' });
      box.add(text(this, W / 2, y0 + px(62), `${info.name}: все собаки пойманы!`, 20, { align: 'center', wrap: pw - px(30) }).setOrigin(0.5, 0));
      box.add(
        text(this, W / 2, y0 + px(104), `Бонус от города: +${info.bonus}\n\nОтвези собак в приют и проведи через уход.\nСкоро в район прибегут новые.`, 14, {
          align: 'center',
          wrap: pw - px(36),
        }).setOrigin(0.5, 0),
      );
      box.add(text(this, W / 2, y0 + ph - px(36), 'Тапни, чтобы продолжить', 13, { align: 'center', color: '#7a4a28' }).setOrigin(0.5, 0));
    }, px(280));
  }

  private showUpgrades(): void {
    play('talk');
    const rowH = px(70);
    const ph = px(70) + UPGRADES.length * rowH + px(40);
    const rows: { y: number; id: string }[] = [];
    this.openModal(
      (box, x0, y0, pw) => {
        const W = x0 * 2 + pw;
        box.add(text(this, W / 2, y0 + px(18), 'Улучшения приюта', 20, { align: 'center' }).setOrigin(0.5, 0));
        UPGRADES.forEach((u, i) => {
          const lvl = gameState.data.upgrades[u.id];
          const y = y0 + px(56) + i * rowH;
          const max = lvl >= u.max;
          const cost = u.cost(lvl);
          const afford = gameState.data.coins >= cost;
          box.add(text(this, x0 + px(18), y, `${u.title} · ${lvl}/${u.max}`, 14));
          box.add(text(this, x0 + px(18), y + px(20), max ? 'Максимум' : u.desc(lvl), 12, { color: '#7a4a28', wrap: pw - px(130) }));
          if (!max) {
            const bx = x0 + pw - px(64);
            box.add(panel(this, bx - px(46), y + px(2), px(92), px(36), afford ? 'ui_panel' : 'ui_panel_dark'));
            box.add(icon(this, bx - px(26), y + px(19), 'coin', metrics.art));
            box.add(text(this, bx - px(12), y + px(20), String(cost), 15, { color: afford ? INK : '#9a90a8' }).setOrigin(0, 0.5));
            rows.push({ y, id: u.id });
          }
        });
        box.add(text(this, W / 2, y0 + ph - px(30), 'Тапни мимо, чтобы закрыть', 12, { align: 'center', color: '#7a4a28' }).setOrigin(0.5, 0));
      },
      ph,
      (x, y) => {
        const { width: W } = this.scale.gameSize;
        const pw = Math.min(W - px(32), px(340));
        const x0 = (W - pw) / 2;
        const hit = rows.find((r) => y > r.y && y < r.y + px(44) && x > x0 + pw - px(120));
        if (hit) {
          if (gameState.buyUpgrade(hit.id as (typeof UPGRADES)[number]['id'])) {
            play('buy');
            this.game.events.emit('upgraded');
            this.closeModal(false);
            this.time.delayedCall(10, () => this.showUpgrades());
          } else play('fail');
        } else this.closeModal();
      },
    );
  }

  private closeModal(fade = true): void {
    const m = this.modal;
    if (!m) return;
    this.modal = null;
    if (fade) this.tweens.add({ targets: m, alpha: 0, duration: 180, onComplete: () => m.destroy() });
    else m.destroy();
    if (this.needsRelayout) this.time.delayedCall(220, () => this.scene.restart());
  }

  // ------------------------------------------------------------------ input

  private press(b: RoundButton): void {
    if (this.modal) {
      (this.modal.getData('onTap') as (x: number, y: number) => void)(-1, -1);
      return;
    }
    if (this.minigame) {
      this.minigame.tap();
      return;
    }
    if (!b.active || !this.ctx) return;
    const spec = b === this.btn ? this.ctx.primary : this.ctx.secondary;
    if (!spec) return;
    this.tweens.add({ targets: b.bg, scale: b.scale * 0.88, yoyo: true, duration: 80, ease: 'Sine.Out' });
    this.game.events.emit('action', spec.id);
  }

  private hit(b: RoundButton, p: Phaser.Input.Pointer): boolean {
    return b.bg.visible && Phaser.Math.Distance.Between(p.x, p.y, b.center.x, b.center.y) < b.radius + px(12);
  }

  private onDown(p: Phaser.Input.Pointer): void {
    unlockAudio();
    if (this.modal) {
      (this.modal.getData('onTap') as (x: number, y: number) => void)(p.x, p.y);
      return;
    }
    if (this.minigame) {
      this.minigame.tap();
      return;
    }
    if (Phaser.Geom.Rectangle.Contains(this.muteZone, p.x, p.y)) {
      gameState.toggleMute();
      return;
    }
    if (this.hit(this.btn, p)) return this.press(this.btn);
    if (this.btn2.active && this.hit(this.btn2, p)) return this.press(this.btn2);
    if (this.joyPointer === null && p.y > this.topY + px(40)) {
      this.joyPointer = p.id;
      this.joyOrigin.set(p.x, p.y);
      this.joyBase.setPosition(p.x, p.y);
      this.joyKnob.setPosition(p.x, p.y);
      this.tweens.killTweensOf([this.joyBase, this.joyKnob]);
      this.tweens.add({ targets: [this.joyBase, this.joyKnob], alpha: 0.95, duration: 120 });
    }
  }

  private onMove(p: Phaser.Input.Pointer): void {
    if (p.id !== this.joyPointer) return;
    const dx = p.x - this.joyOrigin.x;
    const dy = p.y - this.joyOrigin.y;
    const d = Math.hypot(dx, dy);
    // the base follows the finger if you drag past the edge — no "stuck at the rim" feeling
    if (d > this.joyRadius * 1.3) {
      const k = (d - this.joyRadius * 1.3) / d;
      this.joyOrigin.x += dx * k;
      this.joyOrigin.y += dy * k;
      this.joyBase.setPosition(this.joyOrigin.x, this.joyOrigin.y);
    }
    const ddx = p.x - this.joyOrigin.x;
    const ddy = p.y - this.joyOrigin.y;
    const dd = Math.hypot(ddx, ddy);
    const dead = px(6);
    const mag = dd < dead ? 0 : Math.min(1, (dd - dead) / (this.joyRadius * 0.75));
    // ease-in curve: small drags walk slowly, full drag runs
    const curved = mag * mag * (3 - 2 * mag);
    this.rawInput.set(dd ? (ddx / dd) * curved : 0, dd ? (ddy / dd) * curved : 0);
  }

  private onUp(p: Phaser.Input.Pointer): void {
    if (p.id === this.joyPointer) this.releaseJoystick();
  }

  private releaseJoystick(): void {
    this.joyPointer = null;
    this.rawInput.set(0, 0);
    if (this.joyBase) {
      this.tweens.add({ targets: [this.joyBase, this.joyKnob], alpha: 0, duration: 180 });
    }
  }

  update(_time: number, delta: number): void {
    this.minigame?.update(delta);
    // keyboard movement (desktop)
    if (this.keys && this.joyPointer === null) {
      const k = this.keys;
      const x = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
      const y = (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0);
      const l = Math.hypot(x, y) || 1;
      this.rawInput.set(x / l, y / l);
    }
    // gentle input easing so starts and stops feel soft
    const k = 1 - Math.exp(-delta / 60);
    controls.x += (this.rawInput.x - controls.x) * k;
    controls.y += (this.rawInput.y - controls.y) * k;
    if (Math.abs(controls.x) < 0.01 && this.rawInput.x === 0) controls.x = 0;
    if (Math.abs(controls.y) < 0.01 && this.rawInput.y === 0) controls.y = 0;

    // knob glides toward the finger
    if (this.joyPointer !== null) {
      const tx = this.joyOrigin.x + this.rawInput.x * this.joyRadius;
      const ty = this.joyOrigin.y + this.rawInput.y * this.joyRadius;
      const kk = 1 - Math.exp(-delta / 30);
      this.joyKnob.x += (tx - this.joyKnob.x) * kk;
      this.joyKnob.y += (ty - this.joyKnob.y) * kk;
    } else if (this.joyKnob) {
      const kk = 1 - Math.exp(-delta / 50);
      this.joyKnob.x += (this.joyBase.x - this.joyKnob.x) * kk;
      this.joyKnob.y += (this.joyBase.y - this.joyKnob.y) * kk;
    }

    // hint box glides to its place
    if (this.hintBox) this.hintBox.y += (this.hintTargetY - this.hintBox.y) * (1 - Math.exp(-delta / 80));

    // arrow glides along the screen edge
    const a = this.ctx?.arrow;
    const { width: W, height: H } = this.scale.gameSize;
    if (a) {
      const m = px(56);
      const kx = Math.abs((W / 2 - m) / (a.x || 1e-6));
      const ky = Math.abs((H / 2 - m * 2.4) / (a.y || 1e-6));
      const kk = Math.min(kx, ky);
      this.arrowTarget.set(W / 2 + a.x * kk, H / 2 + a.y * kk);
      (this.arrow.getByName('arrow') as Phaser.GameObjects.Graphics).setRotation(Math.atan2(a.y, a.x));
    }
    const ak = 1 - Math.exp(-delta / 90);
    this.arrow.x += (this.arrowTarget.x - this.arrow.x) * ak;
    this.arrow.y += (this.arrowTarget.y - this.arrow.y) * ak;
    this.arrow.alpha += ((a ? 1 : 0) - this.arrow.alpha) * ak;
    this.arrow.setScale(1 + Math.sin(this.time.now / 180) * 0.06);
  }
}
