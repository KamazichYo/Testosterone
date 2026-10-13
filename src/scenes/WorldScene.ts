import Phaser from 'phaser';
import { bakeGround, TILE } from '../art/ground';
import { PixelCanvas } from '../art/PixelCanvas';
import { PROPS, propCollider, propKey } from '../art/propFactory';
import { drawShadow } from '../art/props';
import { ensureSheet, ensureTexture } from '../art/textures';
import { play } from '../core/sfx';
import type { LocationId } from '../core/state';
import type { LocationDef } from '../data/location';
import type { DogData } from '../dogs/types';
import { Butterfly, Cat, LeafFall, Pigeon } from '../entities/Ambient';
import { Player } from '../entities/Player';
import { controls } from '../ui/controls';

export type Tone = 'orange' | 'green' | 'blue';

export interface ActionSpec {
  id: string;
  label: string;
  icon: string;
  tone: Tone;
}

export interface ContextInfo {
  location: LocationId;
  primary: ActionSpec | null;
  secondary: ActionSpec | null;
  hint: string;
  /** dog shown in the info card */
  dog: DogData | null;
  dogMode: string | null;
  /** direction (normalised) to something important that is off-screen */
  arrow: { x: number; y: number; icon: string } | null;
  progress: { icon: string; text: string };
}

const WORLD_VIEW = 200; // ~world pixels visible across the narrow side
const BUTTERFLY_COLORS = ['#ffe066', '#ff9ec4', '#bfe6ff', '#ffffff'];

/** Shared world plumbing for every location: map, props, player, camera, ambient life, fx and the context → UI bridge. */
export abstract class WorldScene extends Phaser.Scene {
  protected def!: LocationDef;
  protected player!: Player;
  protected walls: Phaser.GameObjects.Zone[] = [];
  protected puddles: Phaser.Geom.Ellipse[] = [];
  protected pigeons: Pigeon[] = [];
  protected cats: Cat[] = [];
  protected butterflies: Butterfly[] = [];
  protected leafFall: LeafFall | null = null;
  private swaying: { img: Phaser.GameObjects.Image; x: number; phase: number }[] = [];
  private lastCtxKey = '';
  protected ctxInfo: ContextInfo | null = null;
  private lookAhead = new Phaser.Math.Vector2();
  protected leaving = false;

  protected abstract buildContext(): ContextInfo;
  protected abstract onAction(id: string): void;
  protected abstract tickWorld(dt: number): void;

  /** Lets the UI ask for the latest context after it (re)starts. */
  get context(): ContextInfo | null {
    return this.ctxInfo;
  }

  protected buildWorld(def: LocationDef): void {
    this.def = def;
    this.walls = [];
    this.puddles = [];
    this.pigeons = [];
    this.cats = [];
    this.butterflies = [];
    this.swaying = [];
    this.lastCtxKey = '';
    this.leaving = false;
    const W = def.cols * TILE;
    const H = def.rows * TILE;

    const groundKey = ensureTexture(this, `ground_${def.id}`, () => bakeGround(def.ground, def.decals, 1));
    this.add.image(0, 0, groundKey).setOrigin(0, 0).setDepth(-100000);
    this.physics.world.setBounds(0, 0, W, H);
    for (const d of def.decals) if (d.kind === 'puddle') this.puddles.push(new Phaser.Geom.Ellipse(d.x, d.y, (d.w ?? 12) + 2, (d.h ?? 6) + 2));

    const leafSources: { x: number; y: number; top: number }[] = [];
    for (const p of def.props) {
      const spec = PROPS[p.kind];
      if (spec.shadow) {
        const sk = ensureTexture(this, `shadow_${spec.shadow.w}x${spec.shadow.h}`, () => drawShadow(spec.shadow!.w, spec.shadow!.h));
        this.add.image(p.x, p.y - 1, sk).setDepth(p.y - 1);
      }
      const key = propKey(p);
      if (spec.frames) {
        const frames = spec.frames(p);
        const fw = frames[0].w;
        const fh = frames[0].h;
        ensureSheet(
          this,
          key,
          () => {
            const sheet = new PixelCanvas(fw * frames.length, fh);
            frames.forEach((f, i) => sheet.blit(f, i * fw, 0));
            return sheet;
          },
          fw,
          fh,
        );
        if (!this.anims.exists(`${key}_loop`)) {
          this.anims.create({ key: `${key}_loop`, frames: frames.map((_, i) => ({ key, frame: i })), frameRate: spec.frameRate ?? 2, repeat: -1 });
        }
        const spr = this.add.sprite(p.x, p.y, key, 0).setOrigin(0.5, 1).setDepth(p.y);
        spr.anims.play({ key: `${key}_loop`, startFrame: Phaser.Math.Between(0, frames.length - 1) });
      } else if (spec.sway) {
        // split the crown from the trunk so the crown can sway in the wind
        const art = spec.draw!(p);
        const cut = spec.sway;
        const topKey = ensureTexture(this, `${key}_crown`, () => {
          const c = new PixelCanvas(art.w, cut);
          for (let y = 0; y < cut; y++) for (let x = 0; x < art.w; x++) c.set(x, y, art.get(x, y));
          return c;
        });
        const botKey = ensureTexture(this, `${key}_trunk`, () => {
          const c = new PixelCanvas(art.w, art.h - cut);
          for (let y = cut; y < art.h; y++) for (let x = 0; x < art.w; x++) c.set(x, y - cut, art.get(x, y));
          return c;
        });
        this.add.image(p.x, p.y, botKey).setOrigin(0.5, 1).setDepth(p.y);
        const crown = this.add.image(p.x, p.y - (art.h - cut), topKey).setOrigin(0.5, 1).setDepth(p.y + 0.1);
        this.swaying.push({ img: crown, x: p.x, phase: Math.random() * Math.PI * 2 });
        if (p.kind === 'treeAutumn') leafSources.push({ x: p.x, y: p.y, top: p.y - art.h });
      } else {
        ensureTexture(this, key, () => spec.draw!(p));
        this.add.image(p.x, p.y, key).setOrigin(0.5, 1).setDepth(p.y).setFlipX(!!p.flip);
      }
      const col = propCollider(p);
      if (col && col.h > 0) this.addWall(p.x, p.y - col.h / 2, col.w, col.h);
    }

    this.player = new Player(this, def.playerStart.x, def.playerStart.y);
    this.physics.add.collider(this.player.feet, this.walls);
    this.player.onStep = (x, y) => this.footstep(x, y);

    for (const pg of def.pigeons) for (let i = 0; i < pg.count; i++) this.pigeons.push(new Pigeon(this, pg));
    for (const c of def.cats) this.cats.push(new Cat(this, c.x, c.y, c.variant));
    def.butterflies.forEach((b, i) => this.butterflies.push(new Butterfly(this, b.x, b.y, i % BUTTERFLY_COLORS.length)));
    this.leafFall = new LeafFall(this, leafSources);

    const cam = this.cameras.main;
    cam.setBounds(0, 0, W, H);
    cam.startFollow(this.player.feet, false, 0.09, 0.09);
    cam.setFollowOffset(0, -20);
    this.lookAhead.set(0, 0);
    this.layout();
    this.scale.on('resize', this.layout, this);
    cam.fadeIn(450, 43, 36, 51);
    // soft vignette for a cosy, framed look (WebGL only)
    if (this.renderer.type === Phaser.WEBGL) cam.postFX?.addVignette(0.5, 0.5, 0.95, 0.18);

    this.game.events.on('action', this.onAction, this);
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.layout, this);
      this.game.events.off('action', this.onAction, this);
      this.player.destroy();
    });
  }

  protected addWall(x: number, y: number, w: number, h: number): void {
    const z = this.add.zone(x, y, w, h);
    this.physics.add.existing(z, true);
    this.walls.push(z);
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

  update(time: number, rawDelta: number): void {
    const dt = Math.min(rawDelta, 50);
    if (!this.leaving) this.player.drive(controls.x, controls.y, dt);
    else this.player.drive(0, 0, dt);
    this.player.syncView();

    // camera looks a little ahead of where you are walking
    const v = this.player.body.velocity;
    const k = 1 - Math.exp(-dt / 400);
    this.lookAhead.x += (Phaser.Math.Clamp(v.x * 0.45, -36, 36) - this.lookAhead.x) * k;
    this.lookAhead.y += (Phaser.Math.Clamp(v.y * 0.35, -28, 28) - this.lookAhead.y) * k;
    this.cameras.main.setFollowOffset(-this.lookAhead.x, -20 - this.lookAhead.y);

    for (const s of this.swaying) s.img.x = s.x + Math.sin(time / 900 + s.phase) * 0.55 + Math.sin(time / 370 + s.phase) * 0.15;
    const threats = this.threats();
    for (const p of this.pigeons) p.update(dt, threats);
    for (const c of this.cats) c.update(dt, this.dogPositions());
    for (const b of this.butterflies) b.update(dt);
    this.leafFall?.update(dt, this.cameras.main.worldView);

    this.tickWorld(dt);
    this.updateContext();
  }

  /** Things that scare pigeons. */
  protected threats(): { x: number; y: number }[] {
    return [this.player];
  }

  protected dogPositions(): { x: number; y: number }[] {
    return [];
  }

  // ---------------------------------------------------------------- context

  private updateContext(): void {
    const info = this.buildContext();
    const key = JSON.stringify([
      info.primary?.id,
      info.primary?.label,
      info.secondary?.label,
      info.hint,
      info.dog?.id,
      info.dog ? [Math.round(info.dog.stats.aggression), Math.round(info.dog.stats.trust), info.dog.stats.dirt, info.dog.stats.hunger, info.dog.tagId] : 0,
      info.dogMode,
      info.arrow ? [info.arrow.x.toFixed(1), info.arrow.y.toFixed(1), info.arrow.icon] : 0,
      info.progress.text,
    ]);
    if (key !== this.lastCtxKey) {
      this.lastCtxKey = key;
      this.ctxInfo = info;
      this.game.events.emit('context', info);
    }
  }

  /** Direction to a world point if it is off-screen. */
  protected arrowTo(x: number, y: number, icon: string): ContextInfo['arrow'] {
    const view = this.cameras.main.worldView;
    if (view.contains(x, y)) return null;
    const dx = x - this.player.x;
    const dy = y - this.player.y;
    const l = Math.hypot(dx, dy) || 1;
    return { x: dx / l, y: dy / l, icon };
  }

  protected near(x: number, y: number, r: number): boolean {
    return Phaser.Math.Distance.Between(this.player.x, this.player.y, x, y) < r;
  }

  // ---------------------------------------------------------------- fx

  private footstep(x: number, y: number): void {
    if (this.puddles.some((p) => p.contains(x, y))) {
      const s = this.add.image(x, y, 'fx_splash').setDepth(y + 1).setScale(0.6);
      this.tweens.add({ targets: s, scale: 1.3, alpha: 0, y: y - 2, duration: 380, onComplete: () => s.destroy() });
      play('splash');
      return;
    }
    const d = this.add.image(x + Phaser.Math.Between(-2, 2), y, 'fx_dust').setDepth(y - 1).setAlpha(0.8).setScale(0.6);
    this.tweens.add({ targets: d, y: y - 3, scale: 1.2, alpha: 0, duration: 420, ease: 'Quad.Out', onComplete: () => d.destroy() });
  }

  burst(x: number, y: number, tex: string, n: number): void {
    for (let i = 0; i < n; i++) {
      const img = this.add.image(x, y, tex).setDepth(200000).setScale(0.4);
      this.tweens.add({
        targets: img,
        x: x + Phaser.Math.Between(-18, 18),
        y: y - Phaser.Math.Between(12, 28),
        alpha: 0,
        scale: 1,
        duration: 650 + i * 70,
        ease: 'Cubic.Out',
        onComplete: () => img.destroy(),
      });
    }
  }

  /** Small floating text like "+15" in world space. */
  floatText(x: number, y: number, text: string, color = '#ffd23f'): void {
    const t = this.add
      .text(x, y, text, { fontFamily: '"Tiny5", sans-serif', fontSize: '48px', color, stroke: '#3b2a2a', strokeThickness: 10 })
      .setOrigin(0.5, 1)
      .setScale(0.14)
      .setDepth(300000);
    this.tweens.add({ targets: t, y: y - 18, duration: 900, ease: 'Cubic.Out' });
    this.tweens.add({ targets: t, alpha: 0, delay: 600, duration: 300, onComplete: () => t.destroy() });
  }

  protected toast(text: string, icon?: string): void {
    this.game.events.emit('toast', { text, icon });
  }

  /** Fade out and switch to another location. */
  protected travel(to: 'District' | 'Shelter'): void {
    if (this.leaving) return;
    this.leaving = true;
    play('van');
    this.cameras.main.fadeOut(420, 43, 36, 51);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(to));
  }
}
