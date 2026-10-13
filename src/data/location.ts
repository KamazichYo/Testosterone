import type { Decal, GroundGrid } from '../art/ground';
import type { PropPlacement } from '../art/propFactory';
import type { PersonLook } from '../art/props2';
import type { LocationId, StationId } from '../core/state';
import type { DistrictDogConfig } from '../dogs/generator';

export interface NpcDef {
  id: string;
  name: string;
  x: number;
  y: number;
  look: PersonLook;
  sitting?: boolean;
  /** quest this NPC gives (see data/quests.ts) */
  quest?: string;
  /** chatter when there is nothing to do */
  lines: string[];
}

export type PickupKind = 'bone' | 'coin' | 'wrench' | 'ball';

export interface PickupDef {
  id: string;
  kind: PickupKind;
  x: number;
  y: number;
}

export interface LocationDef {
  id: LocationId;
  name: string;
  cols: number;
  rows: number;
  ground: GroundGrid;
  decals: Decal[];
  props: PropPlacement[];
  van: { x: number; y: number };
  playerStart: { x: number; y: number };
  npcs: NpcDef[];
  pigeons: { x: number; y: number; r: number; count: number }[];
  cats: { x: number; y: number; variant: number }[];
  butterflies: { x: number; y: number }[];
  pickups: PickupDef[];
  dogs?: DistrictDogConfig;
}

export interface ShelterDef extends LocationDef {
  stations: { id: StationId; x: number; y: number }[];
  kennels: { x: number; y: number }[];
  intake: { x: number; y: number; w: number; h: number };
  board: { x: number; y: number };
  foodStore: { x: number; y: number };
  gate: { x: number; y: number };
}
