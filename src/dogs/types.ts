export type Temperament = 'friendly' | 'shy' | 'grumpy';
export type EarType = 'up' | 'floppy' | 'half';
export type TailType = 'curl' | 'straight' | 'fluffy';
export type Pattern = 'none' | 'spots' | 'saddle' | 'socks' | 'mask';
export type DogSize = 'small' | 'medium' | 'large';
export type Trait = 'glutton' | 'coward' | 'cuddly' | 'grumbler' | 'sleepy' | 'fidget';
export type Sex = 'm' | 'f';
/**
 * wild     — lives on the street, not caught yet
 * caught   — in the carrier or the van
 * in_care  — at the shelter, going through the stations
 * tagged   — full care cycle done (washed, fed, vet, ear tag), waits in a kennel
 * released — tagged and returned to its district: calm and friendly
 * adopted  — went home with a family
 */
export type DogState = 'wild' | 'caught' | 'in_care' | 'tagged' | 'released' | 'adopted';

export interface DogLook {
  size: DogSize;
  base: string;
  accent: string;
  patch: string;
  pattern: Pattern;
  ears: EarType;
  tail: TailType;
  eye: string;
  /** seed for the little details (spot positions etc.) */
  seed: number;
}

export interface DogStats {
  /** 0..100 */
  hunger: number;
  dirt: number;
  health: number;
  aggression: number;
  trust: number;
}

export interface DogData {
  id: string;
  name: string;
  sex: Sex;
  district: string;
  look: DogLook;
  temperament: Temperament;
  traits: Trait[];
  isLeader: boolean;
  stats: DogStats;
  state: DogState;
  /** home point in world pixels; the dog wanders around it */
  home: { x: number; y: number; radius: number };
  vaccinated: boolean;
  sterilized: boolean;
  tagId?: string;
}

export const TRAIT_LABEL: Record<Trait, string> = {
  glutton: 'Обжора',
  coward: 'Трусишка',
  cuddly: 'Ласковый',
  grumbler: 'Ворчун',
  sleepy: 'Соня',
  fidget: 'Непоседа',
};

export const TEMPERAMENT_LABEL: Record<Temperament, [string, string]> = {
  friendly: ['Дружелюбный', 'Дружелюбная'],
  shy: ['Пугливый', 'Пугливая'],
  grumpy: ['Злой', 'Злая'],
};

export function temperamentLabel(dog: { temperament: Temperament; sex: Sex }): string {
  const [m, f] = TEMPERAMENT_LABEL[dog.temperament];
  return dog.sex === 'f' ? f : m;
}

/** Pick the word form that agrees with the dog's sex: g(dog, 'подобрел', 'подобрела'). */
export function g(dog: { sex: Sex }, male: string, female: string): string {
  return dog.sex === 'f' ? female : male;
}
