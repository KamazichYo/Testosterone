import Phaser from 'phaser';
import { play, vibrate } from '../core/sfx';
import { dogTexture } from '../entities/Dog';
import type { CatchRequest } from '../scenes/DistrictScene';
import { g } from '../dogs/types';
import { metrics, px } from './metrics';
import { panel, text } from './widgets';

/** the moving ring starts at START × the target radius */
const START = 1.9;

/**
 * "Поймай момент": a ring shrinks toward the green zone around the dog; tap when it is inside.
 * Calmer dogs need fewer rounds and give a wider green zone.
 */
export class CatchMinigame {
  private readonly root: Phaser.GameObjects.Container;
  private readonly rings: Phaser.GameObjects.Graphics;
  private readonly paws: Phaser.GameObjects.Image[] = [];
  private readonly status: Phaser.GameObjects.Text;
  private readonly portrait: Phaser.GameObjects.Sprite;
  private round = 0;
  private elapsed = 0;
  private done = false;
  private flash = 0;
  private flashColor = 0x7cc576;
  private readonly cx: number;
  private readonly cy: number;
  private readonly r0: number;
  private readonly band: number;
  private readonly duration: number;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly req: CatchRequest,
    private readonly onDone: (success: boolean) => void,
  ) {
    const { width: W, height: H } = scene.scale.gameSize;
    this.root = scene.add.container(0, 0).setDepth(1000);
    const dim = scene.add.rectangle(0, 0, W, H, 0x1d1622, 0.6).setOrigin(0);
    this.root.add(dim);

    const pw = Math.min(W - px(24), px(340));
    const ph = Math.min(H - px(80), px(440));
    const x0 = (W - pw) / 2;
    const y0 = (H - ph) / 2;
    this.root.add(panel(scene, x0, y0, pw, ph));

    const dog = req.dog;
    const title = text(scene, W / 2, y0 + px(16), `Лови: ${dog.name}`, 20, { align: 'center' }).setOrigin(0.5, 0);
    const sub = text(scene, W / 2, y0 + px(44), 'Тапни, когда кольцо в зелёной зоне', 12, { align: 'center', color: '#7a4a28', wrap: pw - px(30) }).setOrigin(0.5, 0);
    this.root.add([title, sub]);

    this.cx = W / 2;
    this.cy = y0 + ph * 0.5;
    this.r0 = Math.min(pw * 0.25, (ph - px(190)) / 3.6, px(80));
    this.band = Math.max(px(10), this.r0 * req.difficulty.window);
    this.duration = 1700 / req.difficulty.speed;

    this.rings = scene.add.graphics();
    this.root.add(this.rings);

    const key = dogTexture(scene, dog);
    const ps = Math.max(2, Math.round((this.r0 * 1.3) / 40));
    this.portrait = scene.add.sprite(this.cx, this.cy + px(6), key, 0).setScale(ps);
    this.portrait.anims.play(`${key}_idle_down`);
    this.root.add(this.portrait);

    const pawScale = Math.max(2, Math.round(metrics.art * 0.9));
    const n = req.difficulty.rounds;
    for (let i = 0; i < n; i++) {
      const p = scene.add.image(W / 2 + (i - (n - 1) / 2) * px(34), y0 + ph - px(46), 'icon_paw').setScale(pawScale).setAlpha(0.3);
      this.paws.push(p);
      this.root.add(p);
    }
    this.status = text(scene, W / 2, y0 + ph - px(26), '', 14, { align: 'center', color: '#7a4a28' }).setOrigin(0.5, 0);
    this.root.add(this.status);

    this.root.setAlpha(0);
    scene.tweens.add({ targets: this.root, alpha: 1, duration: 160 });
  }

  private get radius(): number {
    const t = this.elapsed / this.duration;
    return this.r0 * START * (1 - t);
  }

  update(rawDt: number): void {
    if (this.done) return;
    // clamp frame hitches so a stutter never counts as a miss
    const dt = Math.min(rawDt, 40);
    this.elapsed += dt;
    this.flash = Math.max(0, this.flash - dt);
    if (this.radius < this.r0 - this.band) this.fail('Слишком поздно!');
    this.draw();
  }

  tap(): void {
    if (this.done) return;
    const r = this.radius;
    if (Math.abs(r - this.r0) <= this.band / 2 + px(2)) {
      play('pop');
      vibrate(15);
      this.paws[this.round].setAlpha(1).setScale(this.paws[this.round].scale * 1.3);
      this.scene.tweens.add({ targets: this.paws[this.round], scale: this.paws[this.round].scale / 1.3, duration: 200 });
      this.round++;
      this.flash = 250;
      this.flashColor = 0x7cc576;
      if (this.round >= this.req.difficulty.rounds) {
        this.done = true;
        this.status.setText(`${this.req.dog.name} ${g(this.req.dog, 'попался', 'попалась')}!`);
        this.portrait.anims.play(`${this.portrait.texture.key}_sit_down`);
        this.draw();
        this.finish(true, 650);
      } else {
        this.elapsed = 0;
        this.status.setText('Ещё разок!');
      }
    } else {
      this.fail(r > this.r0 ? 'Рано!' : 'Поздно!');
    }
  }

  private fail(msg: string): void {
    if (this.done) return;
    this.done = true;
    this.flash = 400;
    this.flashColor = 0xff6b6b;
    this.status.setText(`${msg} ${this.req.dog.name} ${g(this.req.dog, 'вырвался', 'вырвалась')}`);
    this.portrait.anims.play(`${this.portrait.texture.key}_bark_down`);
    this.draw();
    this.finish(false, 800);
  }

  private finish(success: boolean, delay: number): void {
    this.scene.time.delayedCall(delay, () => {
      this.scene.tweens.add({
        targets: this.root,
        alpha: 0,
        duration: 150,
        onComplete: () => {
          this.root.destroy();
          this.onDone(success);
        },
      });
    });
  }

  private draw(): void {
    const gfx = this.rings;
    gfx.clear();
    // target zone
    gfx.lineStyle(this.band, this.flash > 0 ? this.flashColor : 0x7cc576, this.flash > 0 ? 0.8 : 0.45);
    gfx.strokeCircle(this.cx, this.cy, this.r0);
    gfx.lineStyle(px(2), 0x3b7a3a, 0.9);
    gfx.strokeCircle(this.cx, this.cy, this.r0 - this.band / 2);
    gfx.strokeCircle(this.cx, this.cy, this.r0 + this.band / 2);
    if (!this.done) {
      const r = Math.max(0, this.radius);
      const inside = Math.abs(r - this.r0) <= this.band / 2;
      gfx.lineStyle(px(7), 0x3b2a2a, 1);
      gfx.strokeCircle(this.cx, this.cy, r);
      gfx.lineStyle(px(4), inside ? 0xfff3b0 : 0xe8833a, 1);
      gfx.strokeCircle(this.cx, this.cy, r);
    }
  }
}
