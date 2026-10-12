import Phaser from 'phaser';
import type { DogActor } from './Dog';

export class FoodPile {
  readonly sprite: Phaser.GameObjects.Image;
  claimedBy: DogActor | null = null;
  eaten = false;

  constructor(
    scene: Phaser.Scene,
    readonly x: number,
    readonly y: number,
  ) {
    this.sprite = scene.add.image(x, y, 'food_3').setOrigin(0.5, 0.8).setDepth(y - 2);
  }

  /** progress 0..1 of eating */
  setEaten(progress: number): void {
    const left = Math.max(0, 3 - Math.floor(progress * 4));
    this.sprite.setTexture(`food_${left}`);
  }

  consume(): void {
    this.eaten = true;
    this.sprite.scene.tweens.add({
      targets: this.sprite,
      alpha: 0,
      duration: 500,
      delay: 600,
      onComplete: () => this.sprite.destroy(),
    });
  }
}
