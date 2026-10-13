import Phaser from 'phaser';
import { hex } from '../art/color';
import { drawIcon, drawJoystickBase, drawJoystickKnob, drawKibble, drawPanel, drawRoundButton, drawSparkle, ICON_NAMES } from '../art/icons';
import { PixelCanvas } from '../art/PixelCanvas';
import { drawPlayerSheet, PLAYER_FRAMES, PLAYER_H, PLAYER_W } from '../art/playerArt';
import { drawCarrier, drawFoodPile, drawShadow, drawVan } from '../art/props';
import {
  CAT_COLORS,
  drawBubble,
  drawButterfly,
  drawCat,
  drawDust,
  drawLeaf,
  drawPerson,
  drawPickup,
  drawPigeon,
  drawSplash,
  PersonLook,
} from '../art/props2';
import { ensureSheet, ensureTexture } from '../art/textures';
import { gameState } from '../core/state';
import { garagesDistrict } from '../data/garages';
import { VISITOR_LOOKS } from '../data/shelter';

const BUTTERFLY_COLORS = ['#ffe066', '#ff9ec4', '#bfe6ff', '#ffffff'];

function strip(frames: PixelCanvas[]): PixelCanvas {
  const fw = frames[0].w;
  const sheet = new PixelCanvas(fw * frames.length, frames[0].h);
  frames.forEach((f, i) => sheet.blit(f, i * fw, 0));
  return sheet;
}

/** Generates every shared texture procedurally, waits for the pixel font, then starts the game. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    ensureSheet(this, 'player', drawPlayerSheet, PLAYER_W, PLAYER_H);
    for (const dir of ['down', 'up', 'side'] as const) {
      const f = PLAYER_FRAMES(dir);
      const anim = (name: string, frames: number[], rate: number, repeat = -1) =>
        this.anims.create({ key: `player_${dir}_${name}`, frames: frames.map((frame) => ({ key: 'player', frame })), frameRate: rate, repeat });
      anim('idle', f.idle, 1.6);
      anim('walk', f.walk, 9);
      anim('throw', f.throw, 1);
      anim('carryIdle', f.carryIdle, 1);
      anim('carryWalk', f.carryWalk, 9);
    }

    for (const name of ICON_NAMES) ensureTexture(this, `icon_${name}`, () => drawIcon(name));
    ensureTexture(this, 'ui_panel', () => drawPanel());
    ensureTexture(this, 'ui_panel_dark', () => drawPanel(hex('#4a3d5c')));
    ensureTexture(this, 'ui_btn', () => drawRoundButton(hex('#f29a4a')));
    ensureTexture(this, 'ui_btn_orange', () => drawRoundButton(hex('#f29a4a')));
    ensureTexture(this, 'ui_btn_green', () => drawRoundButton(hex('#7cc576')));
    ensureTexture(this, 'ui_btn_blue', () => drawRoundButton(hex('#6fa8dc')));
    ensureTexture(this, 'ui_btn_off', () => drawRoundButton(hex('#9a90a8')));
    ensureTexture(this, 'ui_joy_base', drawJoystickBase);
    ensureTexture(this, 'ui_joy_knob', drawJoystickKnob);
    ensureTexture(this, 'fx_sparkle', drawSparkle);
    ensureTexture(this, 'fx_kibble', drawKibble);
    ensureTexture(this, 'fx_dust', drawDust);
    ensureTexture(this, 'fx_splash', drawSplash);
    ensureTexture(this, 'fx_bubble', drawBubble);
    ensureTexture(this, 'van', drawVan);
    ensureTexture(this, 'carrier', drawCarrier);
    for (let i = 0; i <= 3; i++) ensureTexture(this, `food_${i}`, () => drawFoodPile(i / 3));
    ensureTexture(this, 'shadow_s', () => drawShadow(12, 4));
    ensureTexture(this, 'shadow_m', () => drawShadow(18, 5));
    ensureTexture(this, 'shadow_l', () => drawShadow(24, 6));
    ensureTexture(this, 'shadow_xl', () => drawShadow(50, 8));
    for (const k of ['bone', 'coin', 'wrench', 'ball'] as const) ensureTexture(this, `pickup_${k}`, () => drawPickup(k));
    for (let i = 0; i < 3; i++) ensureTexture(this, `leaf_${i}`, () => drawLeaf(i));

    // critters
    ensureSheet(this, 'pigeon', () => strip([0, 1, 2, 3, 4].map((f) => drawPigeon(f))), 9, 8);
    this.anims.create({ key: 'pigeon_walk', frames: [0, 1].map((frame) => ({ key: 'pigeon', frame })), frameRate: 6, repeat: -1 });
    this.anims.create({ key: 'pigeon_peck', frames: [0, 2, 0, 2].map((frame) => ({ key: 'pigeon', frame })), frameRate: 6, repeat: -1 });
    this.anims.create({ key: 'pigeon_fly', frames: [3, 4].map((frame) => ({ key: 'pigeon', frame })), frameRate: 12, repeat: -1 });
    CAT_COLORS.forEach((_, v) => ensureSheet(this, `cat_${v}`, () => strip([0, 1, 2].map((f) => drawCat(v, f))), 11, 11));
    BUTTERFLY_COLORS.forEach((c, i) => {
      ensureSheet(this, `butterfly_${i}`, () => strip([drawButterfly(0, c), drawButterfly(1, c)]), 5, 4);
      this.anims.create({ key: `butterfly_${i}_flap`, frames: [0, 1].map((frame) => ({ key: `butterfly_${i}`, frame })), frameRate: 9, repeat: -1 });
    });

    // townsfolk: 4 poses each (idle, blink, action, sit)
    const people: [string, PersonLook][] = garagesDistrict().npcs.map((n) => [n.id, n.look]);
    VISITOR_LOOKS.forEach((l, i) => people.push([`visitor_${i}`, l]));
    for (const [id, look] of people) ensureSheet(this, `npc_${id}`, () => strip([0, 1, 2, 3].map((p) => drawPerson(look, p))), 16, 24);

    const start = () => {
      document.getElementById('loading')?.remove();
      this.scene.start(gameState.data.location === 'shelter' ? 'Shelter' : 'District');
      this.scene.launch('UI');
    };
    // make sure the pixel font is ready before any text is rendered
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    if (fonts?.load) {
      // the Cyrillic subset is a separate file (unicode-range), so ask for Cyrillic glyphs explicitly
      const sample = 'Собаки Dogs 0123';
      fonts
        .load('16px "Tiny5"', sample)
        .catch(() => undefined)
        .finally(start);
    } else start();
  }
}
