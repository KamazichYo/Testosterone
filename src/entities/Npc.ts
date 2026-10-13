import Phaser from 'phaser';
import type { NpcDef } from '../data/location';
import { FONT } from '../ui/widgets';

/** A neighbour: idles, blinks, and shows a speech bubble when you come close. */
export class Npc {
  readonly sprite: Phaser.GameObjects.Sprite;
  private readonly shadow: Phaser.GameObjects.Image;
  private readonly bubble: Phaser.GameObjects.Container;
  private readonly bubbleText: Phaser.GameObjects.Text;
  private readonly bubbleBg: Phaser.GameObjects.Graphics;
  private readonly mark: Phaser.GameObjects.Image;
  private blinkTimer = 2000;
  private actionTimer = 4000;
  private shown = '';
  private hideTimer = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    readonly def: NpcDef,
  ) {
    const key = `npc_${def.id}`;
    this.shadow = scene.add.image(def.x, def.y, 'shadow_s').setDepth(def.y - 0.5);
    this.sprite = scene.add.sprite(def.x, def.y, key, def.sitting ? 3 : 0).setOrigin(0.5, 23 / 24).setDepth(def.y + (def.sitting ? 2 : 0));
    this.mark = scene.add.image(def.x, def.y - 30, 'icon_bang').setDepth(def.y + 2000).setVisible(false);
    this.bubbleBg = scene.add.graphics();
    // world text is drawn at a higher resolution, then scaled down to world units
    this.bubbleText = scene.add.text(0, 0, '', {
      fontFamily: FONT,
      fontSize: '40px',
      color: '#3b2a2a',
      align: 'center',
      wordWrap: { width: 560, useAdvancedWrap: true },
    });
    this.bubbleText.setScale(0.16).setOrigin(0.5, 1);
    this.bubble = scene.add.container(def.x, def.y - 30, [this.bubbleBg, this.bubbleText]).setDepth(100000).setVisible(false);
  }

  get x(): number {
    return this.def.x;
  }

  get y(): number {
    return this.def.y;
  }

  /** Move the NPC (visitors walk around). */
  place(x: number, y: number): void {
    this.def.x = x;
    this.def.y = y;
    this.sprite.setPosition(x, y).setDepth(y);
    this.shadow.setPosition(x, y).setDepth(y - 0.5);
    this.mark.setX(x);
    this.bubble.setX(x);
  }

  destroy(): void {
    this.sprite.destroy();
    this.shadow.destroy();
    this.mark.destroy();
    this.bubble.destroy();
  }

  /** "!" when the NPC has something for you (a quest to give or a reward). */
  setMark(on: boolean, ready = false): void {
    this.mark.setVisible(on).setTexture(ready ? 'icon_star' : 'icon_bang');
  }

  say(text: string, ms = 3600): void {
    this.hideTimer = ms;
    if (text === this.shown && this.bubble.visible) return;
    this.shown = text;
    this.bubbleText.setText(text);
    const w = this.bubbleText.displayWidth + 8;
    const h = this.bubbleText.displayHeight + 6;
    const g = this.bubbleBg;
    g.clear();
    g.fillStyle(0x3b2a2a, 1).fillRoundedRect(-w / 2 - 1, -h - 1, w + 2, h + 2, 4);
    g.fillStyle(0xfff6e0, 1).fillRoundedRect(-w / 2, -h, w, h, 3);
    g.fillStyle(0x3b2a2a, 1).fillTriangle(-3, 0, 3, 0, 0, 4);
    g.fillStyle(0xfff6e0, 1).fillTriangle(-2, -1, 2, -1, 0, 2.5);
    this.bubbleText.setPosition(0, -3);
    this.bubble.setVisible(true).setScale(0.6).setAlpha(0);
    this.scene.tweens.add({ targets: this.bubble, scale: 1, alpha: 1, duration: 220, ease: 'Back.Out' });
  }

  update(dt: number): void {
    const t = this.scene.time.now;
    const base = this.def.sitting ? 3 : 0;
    this.blinkTimer -= dt;
    this.actionTimer -= dt;
    if (this.blinkTimer <= 0) {
      this.blinkTimer = 2500 + Math.random() * 2500;
      if (!this.def.sitting) {
        this.sprite.setFrame(1);
        this.scene.time.delayedCall(140, () => this.sprite.setFrame(base));
      }
    }
    if (this.actionTimer <= 0) {
      this.actionTimer = 3000 + Math.random() * 3000;
      this.sprite.setFrame(this.def.sitting ? 3 : 2);
      this.scene.tweens.add({ targets: this.sprite, scaleY: 1.04, yoyo: true, duration: 180, repeat: 1 });
      if (!this.def.sitting) this.scene.time.delayedCall(800, () => this.sprite.setFrame(base));
    }
    this.mark.setY(this.def.y - 30 - Math.abs(Math.sin(t / 260)) * 3);
    if (this.bubble.visible) {
      this.hideTimer -= dt;
      this.bubble.setY(this.def.y - (this.def.sitting ? 25 : 28) - (this.mark.visible ? 6 : 0));
      if (this.hideTimer <= 0) {
        this.shown = '';
        this.scene.tweens.add({ targets: this.bubble, alpha: 0, scale: 0.8, duration: 180, onComplete: () => this.bubble.setVisible(false) });
        this.hideTimer = Infinity;
      }
    }
  }
}
