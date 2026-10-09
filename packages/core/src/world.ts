import { clamp, rng } from "./rng";
import type { Resource } from "./rules";
import type { Group } from "./combat";
import { unitGroup } from "./kingdom";

export type TileKind = "plain" | "forest" | "mountain" | "gold" | "water" | "lair" | "ruins" | "kingdom" | "home";

export interface Tile {
  kind: TileKind;
  seen: boolean;
  /** Dificultad o nivel según la distancia al centro. */
  level: number;
  amount?: number;
  max?: number;
  name?: string;
  /** Tesoro de un reino IA (de cada recurso). */
  treasure?: number;
  shieldUntil?: number;
}

export interface World {
  size: number;
  seed: number;
  tiles: Tile[];
}

export const TILE_RESOURCE: Partial<Record<TileKind, Resource>> = { plain: "food", forest: "wood", mountain: "stone", gold: "gold" };
export const TILE_NAMES: Record<TileKind, string> = {
  plain: "Pradera", forest: "Bosque", mountain: "Montaña", gold: "Mina de oro", water: "Lago",
  lair: "Guarida de monstruos", ruins: "Ruinas", kingdom: "Reino", home: "Tu reino",
};
const KINGDOM_NAMES = ["Valdoria", "Karn Dur", "Isenmar", "Rocaferro", "Brasaluz", "Hielonorte", "Ostmark", "Lunaria", "Velmora", "Torreval"];

export const center = (w: World) => Math.floor(w.size / 2);
export const distance = (w: World, x: number, y: number) => Math.max(Math.abs(x - center(w)), Math.abs(y - center(w)));
export const tileAt = (w: World, x: number, y: number): Tile | undefined =>
  x >= 0 && y >= 0 && x < w.size && y < w.size ? w.tiles[y * w.size + x] : undefined;

export function initTile(t: Tile, d: number) {
  t.level = clamp(Math.ceil(d / 2), 1, 8);
  const r = TILE_RESOURCE[t.kind];
  if (r) {
    t.max = Math.round((t.kind === "gold" ? 260 : 180) * (1 + d * 0.25));
    t.amount = t.max;
  } else {
    delete t.max;
    delete t.amount;
  }
  if (t.kind === "kingdom") {
    t.level = clamp(1 + Math.floor(d / 2), 1, 9);
    t.treasure = 300 * t.level;
    t.shieldUntil = 0;
  }
}

/** Genera el mapa del mundo a partir de una semilla (ruido suave + elementos repartidos). */
export function generateWorld(seed: number, size = 21): World {
  const r = rng(seed);
  const g = 7;
  const coarse = () => Array.from({ length: g * g }, () => r());
  const elevation = coarse();
  const moisture = coarse();
  const sample = (a: number[], x: number, y: number) => {
    const fx = (x / (size - 1)) * (g - 1), fy = (y / (size - 1)) * (g - 1);
    const ix = Math.min(g - 2, Math.floor(fx)), iy = Math.min(g - 2, Math.floor(fy));
    const tx = fx - ix, ty = fy - iy;
    const v = (i: number, j: number) => a[j * g + i];
    return (v(ix, iy) * (1 - tx) + v(ix + 1, iy) * tx) * (1 - ty) + (v(ix, iy + 1) * (1 - tx) + v(ix + 1, iy + 1) * tx) * ty;
  };
  const w: World = { size, seed, tiles: [] };
  const c = center(w);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const e = sample(elevation, x, y) + (r() - 0.5) * 0.18;
      const m = sample(moisture, x, y) + (r() - 0.5) * 0.2;
      const d = distance(w, x, y);
      let kind: TileKind = e < 0.22 && d > 2 ? "water" : e > 0.68 ? "mountain" : m > 0.55 ? "forest" : "plain";
      if (kind !== "water" && d > 1) {
        const q = r();
        if (q < 0.035) kind = "gold";
        else if (q < 0.11) kind = "lair";
        else if (q < 0.14) kind = "ruins";
      }
      w.tiles.push({ kind, seen: d <= 2, level: 1 });
    }
  tileAt(w, c, c)!.kind = "home";
  const names = [...KINGDOM_NAMES].sort(() => r() - 0.5);
  let placed = 0;
  for (let tries = 0; placed < 8 && tries < 500; tries++) {
    const x = Math.floor(r() * size), y = Math.floor(r() * size);
    if (distance(w, x, y) < 3) continue;
    let near = false;
    for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) if (tileAt(w, x + i, y + j)?.kind === "kingdom") near = true;
    if (near) continue;
    const t = tileAt(w, x, y)!;
    t.kind = "kingdom";
    t.name = names[placed++];
  }
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) initTile(tileAt(w, x, y)!, distance(w, x, y));
  return w;
}

/** Hay una casilla vista al lado (incluidas diagonales). */
export function canExplore(w: World, x: number, y: number): boolean {
  for (let j = -1; j <= 1; j++)
    for (let i = -1; i <= 1; i++) if ((i || j) && tileAt(w, x + i, y + j)?.seen) return true;
  return false;
}

export function reveal(w: World, x: number, y: number) {
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const t = tileAt(w, x + i, y + j);
    if (t) t.seen = true;
  }
}

/** Regenera yacimientos y tesoros de reinos IA. */
export function regrowWorld(w: World, dt: number) {
  for (const t of w.tiles) {
    if (t.max !== undefined && t.amount! < t.max) t.amount = Math.min(t.max, t.amount! + t.max * 0.004 * dt);
    if (t.kind === "kingdom" && t.treasure! < 300 * t.level) t.treasure = Math.min(300 * t.level, t.treasure! + t.level * 0.8 * dt);
  }
}

export const exploreCost = (w: World, x: number, y: number) => ({ food: 10 + 3 * distance(w, x, y) });

export function lairArmy(level: number): Group[] {
  const a: Group[] = [{ key: "gob", name: "Goblins", cls: "inf", atk: 6, hp: 30, count: 4 * level + 2 }];
  if (level >= 2) a.push({ key: "orc", name: "Orcos jinetes", cls: "cav", atk: 12, hp: 50, count: 2 * (level - 1) });
  if (level >= 3) a.push({ key: "troll", name: "Trolls", cls: "tank", atk: 14, hp: 150, count: Math.floor(level / 2) });
  if (level >= 4) a.push({ key: "wyv", name: "Guivernos", cls: "fly", fly: true, atk: 20, hp: 70, count: level - 3 });
  return a;
}
export const lairLoot = (level: number) => ({ gold: 60 * level, food: 50 * level, wood: 40 * level });

/** Guarnición de un reino IA según su nivel de castillo. */
export function aiKingdomArmy(level: number): Group[] {
  const a = [unitGroup("inf", 5 * level), unitGroup("arc", 3 * level)];
  if (level >= 3) a.push(unitGroup("cav", 2 * (level - 2)));
  if (level >= 5) a.push(unitGroup("griffin", level - 4));
  if (level >= 7) a.push(unitGroup("golem", level - 6));
  return a;
}
export const aiKingdomDefenses = (level: number) => ({ wall: Math.max(0, level - 1) * 220, tower: Math.max(0, level - 2) * 22 });

/** Ejército de un reino IA que asalta al jugador, escalado con su castillo. */
export function aiRaidArmy(castle: number): Group[] {
  const a = [unitGroup("inf", 2 + 4 * castle), unitGroup("arc", 3 * castle - 1)];
  if (castle >= 3) a.push(unitGroup("cav", 2 * (castle - 2)));
  if (castle >= 5) a.push(unitGroup("griffin", castle - 4));
  return a;
}

export const carryCapacity = (castle: number) => 80 + 40 * castle;
export const travelTime = (w: World, x: number, y: number) => 6 + 2 * distance(w, x, y);
export const maxExpeditions = (castle: number) => 1 + Math.floor(castle / 2);
