export const RESOURCES = ["gold", "wood", "stone", "food"] as const;
export type Resource = (typeof RESOURCES)[number];
export type Bag = Partial<Record<Resource, number>>;

export const RESOURCE_NAMES: Record<Resource, string> = {
  gold: "Oro",
  wood: "Madera",
  stone: "Piedra",
  food: "Comida",
};

export type BuildingKey =
  | "castle" | "house" | "farm" | "sawmill" | "quarry" | "storage"
  | "barracks" | "wall" | "tower" | "nest" | "stable" | "den";

export interface BuildingDef {
  name: string;
  description: string;
  cost: Bag;
  /** Nivel de castillo necesario para construirlo. */
  unlock: number;
  /** Nivel inicial en un reino nuevo. */
  start: number;
  produces?: Resource;
  /** Producción por segundo y nivel. */
  rate?: number;
  /** Multiplicador del tiempo de obra. */
  slow?: number;
}

export const BUILDINGS: Record<BuildingKey, BuildingDef> = {
  castle: { name: "Castillo", description: "Nivel del reino. Ningún edificio puede superar su nivel.", cost: { gold: 120, wood: 150, stone: 150 }, unlock: 1, start: 1, slow: 2 },
  house: { name: "Casas", description: "Los aldeanos pagan impuestos en oro.", cost: { wood: 60, stone: 20 }, unlock: 1, start: 1, produces: "gold", rate: 0.5 },
  farm: { name: "Granja", description: "Produce comida para tropas y criaturas.", cost: { gold: 30, wood: 50 }, unlock: 1, start: 1, produces: "food", rate: 0.6 },
  sawmill: { name: "Aserradero", description: "Produce madera.", cost: { gold: 40, wood: 20, stone: 20 }, unlock: 1, start: 1, produces: "wood", rate: 0.5 },
  quarry: { name: "Cantera", description: "Produce piedra.", cost: { gold: 40, wood: 40 }, unlock: 1, start: 1, produces: "stone", rate: 0.4 },
  storage: { name: "Almacén", description: "Más capacidad y protege parte de tus recursos del saqueo.", cost: { wood: 80, stone: 60 }, unlock: 1, start: 1 },
  barracks: { name: "Cuartel", description: "Entrena infantería (nv 1) y arqueros (nv 2). Cada nivel entrena más rápido.", cost: { gold: 60, wood: 80 }, unlock: 1, start: 1 },
  wall: { name: "Muralla", description: "Absorbe el daño de los atacantes de tierra. Los voladores pasan por encima.", cost: { stone: 100, wood: 30 }, unlock: 2, start: 0 },
  tower: { name: "Torres", description: "Disparan a los atacantes en cada ronda.", cost: { stone: 80, gold: 40 }, unlock: 2, start: 0 },
  nest: { name: "Nido de dragón", description: "Eclosiona tu dragón. Su nivel limita cuánto puede crecer.", cost: { gold: 120, stone: 120 }, unlock: 2, start: 0 },
  stable: { name: "Establo", description: "Entrena caballería.", cost: { gold: 90, wood: 120 }, unlock: 3, start: 0 },
  den: { name: "Guarida de bestias", description: "Lobos (nv 1), grifos (nv 2) y gólems (nv 3).", cost: { gold: 100, stone: 100, food: 80 }, unlock: 3, start: 0 },
};
export const BUILDING_KEYS = Object.keys(BUILDINGS) as BuildingKey[];
export const MAX_CASTLE = 10;

export type UnitClass = "inf" | "arc" | "cav" | "beast" | "fly" | "tank" | "dragon";
export type UnitKey = "inf" | "arc" | "cav" | "wolf" | "griffin" | "golem";

export interface UnitDef {
  name: string;
  cls: UnitClass;
  fly?: boolean;
  atk: number;
  hp: number;
  cost: Bag;
  /** Segundos de entrenamiento con el edificio a nivel 1. */
  time: number;
  building: BuildingKey;
  buildingLevel: number;
  tip: string;
}

export const UNITS: Record<UnitKey, UnitDef> = {
  inf: { name: "Infantería", cls: "inf", atk: 8, hp: 40, cost: { gold: 15, food: 10 }, time: 2, building: "barracks", buildingLevel: 1, tip: "Gana a caballería" },
  arc: { name: "Arqueros", cls: "arc", atk: 10, hp: 24, cost: { gold: 18, wood: 12 }, time: 2, building: "barracks", buildingLevel: 2, tip: "Gana a infantería y voladores" },
  cav: { name: "Caballería", cls: "cav", atk: 14, hp: 55, cost: { gold: 35, food: 20 }, time: 3, building: "stable", buildingLevel: 1, tip: "Gana a arqueros" },
  wolf: { name: "Lobos", cls: "beast", atk: 12, hp: 30, cost: { food: 30 }, time: 2, building: "den", buildingLevel: 1, tip: "Baratos y rápidos" },
  griffin: { name: "Grifos", cls: "fly", fly: true, atk: 22, hp: 60, cost: { gold: 60, food: 40 }, time: 5, building: "den", buildingLevel: 2, tip: "Voladores, cazan arqueros" },
  golem: { name: "Gólems", cls: "tank", atk: 10, hp: 160, cost: { stone: 90, gold: 30 }, time: 6, building: "den", buildingLevel: 3, tip: "Aguantan mucho daño" },
};
export const UNIT_KEYS = Object.keys(UNITS) as UnitKey[];

export const DRAGON_STAGES = ["Cría", "Joven", "Adulto", "Anciano"] as const;
export const DRAGON_NAMES = ["Ignis", "Brasa", "Escarcha", "Tormenta", "Ceniza", "Obsidiana"];
export const HATCH_COST: Bag = { gold: 150, food: 150 };
export const HATCH_TIME = 25;
export const FEED_COST: Bag = { food: 60 };
export const FEED_XP = 30;

/** Coste de subir un edificio desde el nivel `level` al siguiente. */
export function buildingCost(key: BuildingKey, level: number): Bag {
  const scale = Math.pow(1.55, level);
  const out: Bag = {};
  for (const [r, v] of Object.entries(BUILDINGS[key].cost) as [Resource, number][]) out[r] = Math.round(v * scale);
  return out;
}

/** Segundos de obra para subir desde `level`. Tiempo acelerado para el prototipo. */
export function buildingTime(key: BuildingKey, level: number): number {
  return Math.round(4 * Math.pow(level + 1, 1.6) * (BUILDINGS[key].slow ?? 1));
}

export function scaleBag(bag: Bag, n: number): Bag {
  const out: Bag = {};
  for (const [r, v] of Object.entries(bag) as [Resource, number][]) out[r] = v * n;
  return out;
}
