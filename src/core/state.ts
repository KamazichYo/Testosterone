import Phaser from 'phaser';

const SAVE_KEY = 'street-dogs-tycoon/save';

export interface SaveData {
  v: 1;
  coins: number;
  food: number;
  foodMax: number;
  /** ids of dogs already caught and delivered to the van */
  caught: string[];
  totalCaught: number;
  muted: boolean;
}

const DEFAULTS: SaveData = {
  v: 1,
  coins: 0,
  food: 6,
  foodMax: 6,
  caught: [],
  totalCaught: 0,
  muted: false,
};

/** The single source of truth for persistent progress. Scenes read it and listen to its events. */
class GameState extends Phaser.Events.EventEmitter {
  data: SaveData = { ...DEFAULTS };

  load(): void {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) this.data = { ...DEFAULTS, ...(JSON.parse(raw) as Partial<SaveData>) };
    } catch {
      this.data = { ...DEFAULTS };
    }
  }

  save(): void {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
    } catch {
      // storage may be unavailable (private mode) — the game still works without saving
    }
  }

  addCoins(n: number): void {
    this.data.coins += n;
    this.emit('changed');
    this.save();
  }

  useFood(): boolean {
    if (this.data.food <= 0) return false;
    this.data.food--;
    this.emit('changed');
    this.save();
    return true;
  }

  refillFood(): void {
    this.data.food = this.data.foodMax;
    this.emit('changed');
    this.save();
  }

  markCaught(dogId: string): void {
    if (!this.data.caught.includes(dogId)) this.data.caught.push(dogId);
    this.data.totalCaught++;
    this.emit('changed');
    this.save();
  }

  resetDistrict(districtId: string): void {
    this.data.caught = this.data.caught.filter((id) => !id.startsWith(`${districtId}-`));
    this.emit('changed');
    this.save();
  }

  toggleMute(): boolean {
    this.data.muted = !this.data.muted;
    this.emit('changed');
    this.save();
    return this.data.muted;
  }
}

export const gameState = new GameState();
