import Phaser from 'phaser';
import { hex } from '../art/color';
import { drawIcon, drawJoystickBase, drawJoystickKnob, drawKibble, drawPanel, drawRoundButton, drawSparkle, ICON_NAMES } from '../art/icons';
import { drawPlayerSheet, PLAYER_FRAMES, PLAYER_H, PLAYER_W } from '../art/playerArt';
import { drawCarrier, drawFoodPile, drawShadow, drawVan } from '../art/props';
import { ensureSheet, ensureTexture } from '../art/textures';

/** Generates every shared texture procedurally, waits for the pixel font, then starts the game. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    ensureSheet(this, 'player', drawPlayerSheet, PLAYER_W, PLAYER_H);
    for (const dir of ['down', 'up', 'side'] as const) {
      const f = PLAYER_FRAMES[dir];
      this.anims.create({
        key: `player_${dir}_walk`,
        frames: f.walk.map((frame) => ({ key: 'player', frame })),
        frameRate: 9,
        repeat: -1,
      });
      this.anims.create({ key: `player_${dir}_idle`, frames: [{ key: 'player', frame: f.idle }] });
    }

    for (const name of ICON_NAMES) ensureTexture(this, `icon_${name}`, () => drawIcon(name));
    ensureTexture(this, 'ui_panel', () => drawPanel());
    ensureTexture(this, 'ui_panel_dark', () => drawPanel(hex('#4a3d5c')));
    ensureTexture(this, 'ui_btn', () => drawRoundButton(hex('#f29a4a')));
    ensureTexture(this, 'ui_btn_green', () => drawRoundButton(hex('#7cc576')));
    ensureTexture(this, 'ui_btn_off', () => drawRoundButton(hex('#9a90a8')));
    ensureTexture(this, 'ui_joy_base', drawJoystickBase);
    ensureTexture(this, 'ui_joy_knob', drawJoystickKnob);
    ensureTexture(this, 'fx_sparkle', drawSparkle);
    ensureTexture(this, 'fx_kibble', drawKibble);
    ensureTexture(this, 'van', drawVan);
    ensureTexture(this, 'carrier', drawCarrier);
    for (let i = 0; i <= 3; i++) ensureTexture(this, `food_${i}`, () => drawFoodPile(i / 3));
    ensureTexture(this, 'shadow_s', () => drawShadow(12, 4));
    ensureTexture(this, 'shadow_m', () => drawShadow(18, 5));
    ensureTexture(this, 'shadow_l', () => drawShadow(24, 6));
    ensureTexture(this, 'shadow_xl', () => drawShadow(50, 8));

    const start = () => {
      document.getElementById('loading')?.remove();
      this.scene.start('District');
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
