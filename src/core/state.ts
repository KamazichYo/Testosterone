import Phaser from 'phaser';
import type { CareStep } from '../dogs/behaviour';
import type { DogData } from '../dogs/types';

const SAVE_KEY = 'street-dogs-tycoon/save';

export type LocationId = 'garages' | 'shelter';
export type StationId = 'wash' | 'feed' | 'vet' | 'tag';
export type UpgradeId = 'foodBag' | 'van' | 'kennels' | 'speed';
export type QuestState = 'active' | 'done' | 'claimed';

export interface StationSlot {
  dogId: string;
  /** Date.now() when processing finishes — keeps running while the player is in the district */
  endsAt: number;
}

export interface SaveData {
  v: 2;
  coins: number;
  food: number;
  muted: boolean;
  location: LocationId;
  /** generation of strays per district; each wave brings new dogs */
  wave: Record<string, number>;
  /** when the next wave arrives (Date.now()), 0 = none scheduled */
  nextWaveAt: Record<string, number>;
  /** ids of wild dogs of the current wave already taken off the street */
  removed: string[];
  /** every dog that left the street, by id */
  dogs: Record<string, DogData>;
  van: string[];
  /** dog in the player's arms at the shelter (so it isn't lost if the game is closed) */
  carrying: string | null;
  intake: string[];
  stations: Partial<Record<StationId, StationSlot>>;
  kennels: (string | null)[];
  totalCaught: number;
  adopted: number;
  released: number;
  upgrades: Record<UpgradeId, number>;
  quests: Record<string, QuestState>;
  questProgress: Record<string, number>;
  /** when бабушка Зина can share food again */
  zinaFoodAt: number;
  fedCount: number;
  /** pickups already collected this wave (ids) */
  picked: string[];
  seenIntro: boolean;
}

const DEFAULTS = (): SaveData => ({
  v: 2,
  coins: 0,
  food: 6,
  muted: false,
  location: 'garages',
  wave: { garages: 1 },
  nextWaveAt: {},
  removed: [],
  dogs: {},
  van: [],
  carrying: null,
  intake: [],
  stations: {},
  kennels: [null, null, null, null],
  totalCaught: 0,
  adopted: 0,
  released: 0,
  upgrades: { foodBag: 0, van: 0, kennels: 0, speed: 0 },
  quests: {},
  questProgress: {},
  zinaFoodAt: 0,
  fedCount: 0,
  picked: [],
  seenIntro: false,
});

export interface UpgradeDef {
  id: UpgradeId;
  title: string;
  desc: (level: number) => string;
  max: number;
  cost: (level: number) => number;
}

export const UPGRADES: UpgradeDef[] = [
  { id: 'foodBag', title: 'Большой мешок корма', desc: (l) => `Запас корма: ${6 + l * 2} → ${8 + l * 2}`, max: 4, cost: (l) => 40 + l * 40 },
  { id: 'van', title: 'Клетки в фургон', desc: (l) => `Мест в фургоне: ${3 + l} → ${4 + l}`, max: 3, cost: (l) => 60 + l * 60 },
  { id: 'kennels', title: 'Новый вольер', desc: (l) => `Вольеров: ${4 + l} → ${5 + l}`, max: 4, cost: (l) => 80 + l * 50 },
  { id: 'speed', title: 'Шампунь и инструменты', desc: (l) => `Станции работают на ${(l + 1) * 15}% быстрее`, max: 3, cost: (l) => 70 + l * 70 },
];

/** The single source of truth for persistent progress. Scenes read it and listen to its events. */
class GameState extends Phaser.Events.EventEmitter {
  data: SaveData = DEFAULTS();

  load(): void {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<SaveData> & { v?: number };
      if (parsed.v === 2) {
        const d = DEFAULTS();
        this.data = { ...d, ...parsed, upgrades: { ...d.upgrades, ...parsed.upgrades } } as SaveData;
      } else {
        // v1 prototype save: keep the coins, start the new systems fresh
        this.data = { ...DEFAULTS(), coins: parsed.coins ?? 0, muted: !!parsed.muted };
      }
      this.syncKennels();
    } catch {
      this.data = DEFAULTS();
    }
  }

  save(): void {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
    } catch {
      // storage may be unavailable (private mode) — the game still works without saving
    }
  }

  /** Persist and notify listeners (HUD etc.). */
  commit(): void {
    this.emit('changed');
    this.save();
  }

  // ---------------------------------------------------------------- derived values

  get foodMax(): number {
    return 6 + this.data.upgrades.foodBag * 2;
  }

  get vanCapacity(): number {
    return 3 + this.data.upgrades.van;
  }

  get kennelCount(): number {
    return 4 + this.data.upgrades.kennels;
  }

  get stationSpeed(): number {
    return 1 + this.data.upgrades.speed * 0.15;
  }

  private syncKennels(): void {
    const k = this.data.kennels;
    while (k.length < this.kennelCount) k.push(null);
  }

  // ---------------------------------------------------------------- economy

  addCoins(n: number): void {
    this.data.coins += n;
    this.commit();
  }

  useFood(): boolean {
    if (this.data.food <= 0) return false;
    this.data.food--;
    this.commit();
    return true;
  }

  addFood(n: number): void {
    this.data.food = Math.min(this.foodMax, this.data.food + n);
    this.commit();
  }

  refillFood(): boolean {
    if (this.data.food >= this.foodMax) return false;
    this.data.food = this.foodMax;
    this.commit();
    return true;
  }

  buyUpgrade(id: UpgradeId): boolean {
    const def = UPGRADES.find((u) => u.id === id)!;
    const lvl = this.data.upgrades[id];
    if (lvl >= def.max) return false;
    const cost = def.cost(lvl);
    if (this.data.coins < cost) return false;
    this.data.coins -= cost;
    this.data.upgrades[id] = lvl + 1;
    if (id === 'foodBag') this.data.food = this.foodMax;
    this.syncKennels();
    this.commit();
    return true;
  }

  toggleMute(): boolean {
    this.data.muted = !this.data.muted;
    this.commit();
    return this.data.muted;
  }

  // ---------------------------------------------------------------- dogs

  wave(district: string): number {
    return this.data.wave[district] ?? 1;
  }

  /** A wild dog was caught and put into the van. */
  putInVan(dog: DogData): void {
    dog.state = 'caught';
    this.data.dogs[dog.id] = dog;
    if (!this.data.removed.includes(dog.id)) this.data.removed.push(dog.id);
    this.data.van.push(dog.id);
    this.data.totalCaught++;
    this.commit();
  }

  get vanFull(): boolean {
    return this.data.van.length >= this.vanCapacity;
  }

  /** Arriving at the shelter: everyone in the van goes to the intake pen. */
  unloadVan(): string[] {
    const ids = [...this.data.van];
    for (const id of ids) this.data.dogs[id].state = 'in_care';
    this.data.intake.push(...ids);
    this.data.van = [];
    this.commit();
    return ids;
  }

  startNextWave(district: string): void {
    this.data.wave[district] = this.wave(district) + 1;
    this.data.nextWaveAt[district] = 0;
    this.data.removed = this.data.removed.filter((id) => !id.startsWith(`${district}-`));
    this.data.picked = [];
    this.commit();
  }

  releasedDogs(district: string): DogData[] {
    return Object.values(this.data.dogs).filter((d) => d.district === district && d.state === 'released');
  }

  // ---------------------------------------------------------------- quests

  quest(id: string): QuestState | undefined {
    return this.data.quests[id];
  }

  setQuest(id: string, st: QuestState): void {
    this.data.quests[id] = st;
    this.commit();
  }
}

export const gameState = new GameState();

export function stationDuration(step: CareStep): number {
  const base = { wash: 6000, feed: 4500, vet: 8000, tag: 3500 }[step];
  return base / gameState.stationSpeed;
}
