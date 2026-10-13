import '@fontsource/tiny5/400.css';
import Phaser from 'phaser';
import { gameState } from './core/state';
import { BootScene } from './scenes/BootScene';
import { DistrictScene } from './scenes/DistrictScene';
import { ShelterScene } from './scenes/ShelterScene';
import { UIScene } from './scenes/UIScene';
import { getDpr, updateMetrics } from './ui/metrics';

gameState.load();
updateMetrics();

const parent = document.getElementById('game')!;
const size = () => ({ w: Math.round(parent.clientWidth * getDpr()), h: Math.round(parent.clientHeight * getDpr()) });
const s0 = size();

// The canvas is rendered at device resolution (FIT into the parent) so pixel art and text stay crisp on phones.
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent,
  backgroundColor: '#2b2433',
  pixelArt: true,
  // no pixel snapping: sprites glide smoothly between pixels at high zoom
  roundPixels: false,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: s0.w,
    height: s0.h,
  },
  physics: {
    default: 'arcade',
    arcade: { debug: false },
  },
  input: { activePointers: 3 },
  scene: [BootScene, DistrictScene, ShelterScene, UIScene],
});

let resizeTimer = 0;
const onResize = () => {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    updateMetrics();
    const s = size();
    game.scale.setGameSize(s.w, s.h);
  }, 60);
};
window.addEventListener('resize', onResize);
window.addEventListener('orientationchange', onResize);

document.addEventListener('visibilitychange', () => {
  if (document.hidden) gameState.save();
});

// handy for debugging from the console
(window as unknown as { game: Phaser.Game }).game = game;
if (import.meta.env.DEV) (window as unknown as { gameState: typeof gameState }).gameState = gameState;
