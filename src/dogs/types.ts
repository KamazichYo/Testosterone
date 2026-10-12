export type Temperament = 'friendly' | 'shy' | 'grumpy';
export type EarType = 'up' | 'floppy' | 'half';
export type TailType = 'curl' | 'straight' | 'fluffy';
export type Pattern = 'none' | 'spots' | 'saddle' | 'socks' | 'mask';
export type DogSize = 'small' | 'medium' | 'large';
export type Trait = 'glutton' | 'coward' | 'cuddly' | 'grumbler' | 'sleepy' | 'fidget';
export type Sex = 'm' | 'f';
export type DogState = 'wild' | 'caught' | 'in_care' | 'tagged' | 'adopted';

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

export const TEMPERAMENT_LABEL: Record<Temperament, string> = {
  friendly: 'Дружелюбная',
  shy: 'Пугливая',
  grumpy: 'Злая',
};

/** Pick the word form that agrees with the dog's sex: g(dog, 'подобрел', 'подобрела'). */
export function g(dog: { sex: Sex }, male: string, female: string): string {
  return dog.sex === 'f' ? female : male;
}
