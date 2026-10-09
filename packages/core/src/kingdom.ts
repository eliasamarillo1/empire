import { clamp } from "./rng";
import type { Group } from "./combat";
import {
  BUILDINGS, BUILDING_KEYS, DRAGON_NAMES, FEED_COST, FEED_XP, HATCH_COST, HATCH_TIME, MAX_CASTLE, RESOURCES, UNITS, UNIT_KEYS,
  buildingCost, buildingTime, type Bag, type BuildingKey, type Resource, type UnitKey,
} from "./rules";

export interface Dragon {
  name: string;
  xp: number;
  hatchesAt: number;
  /** Hasta cuándo está herido y no puede combatir. */
  woundedUntil: number;
}

export interface Kingdom {
  name: string;
  /** Última vez (segundos) que se aplicó la producción. */
  t: number;
  res: Record<Resource, number>;
  buildings: Record<BuildingKey, number>;
  upgrade: { key: BuildingKey; endsAt: number; duration: number } | null;
  army: Record<UnitKey, number>;
  queue: UnitKey[];
  queueEndsAt: number;
  dragon: Dragon | null;
  xp: number;
  shieldUntil: number;
}

export type KingdomEvent =
  | { type: "upgraded"; key: BuildingKey; level: number }
  | { type: "trained"; unit: UnitKey }
  | { type: "hatched"; name: string };

export type ActionResult = { ok: true } | { ok: false; reason: string };
const fail = (reason: string): ActionResult => ({ ok: false, reason });
const OK: ActionResult = { ok: true };

/** Tope de producción acumulada mientras el jugador está fuera. */
export const MAX_OFFLINE_SECONDS = 8 * 3600;

export function createKingdom(name: string, now: number): Kingdom {
  const buildings = Object.fromEntries(BUILDING_KEYS.map((k) => [k, BUILDINGS[k].start])) as Record<BuildingKey, number>;
  const army = Object.fromEntries(UNIT_KEYS.map((u) => [u, 0])) as Record<UnitKey, number>;
  army.inf = 8;
  return {
    name, t: now, res: { gold: 400, wood: 400, stone: 300, food: 400 }, buildings, upgrade: null, army,
    queue: [], queueEndsAt: 0, dragon: null, xp: 0, shieldUntil: 0,
  };
}

export const capacity = (k: Kingdom) => 600 + 600 * k.buildings.storage + 200 * k.buildings.castle;
export const protectedAmount = (k: Kingdom) => 150 * k.buildings.storage;

export function productionRate(k: Kingdom, r: Resource): number {
  let v = 0;
  for (const key of BUILDING_KEYS) {
    const d = BUILDINGS[key];
    if (d.produces === r) v += (d.rate ?? 0) * k.buildings[key];
  }
  return v;
}

export function canAfford(k: Kingdom, cost: Bag): boolean {
  return (Object.entries(cost) as [Resource, number][]).every(([r, v]) => k.res[r] >= v);
}
function pay(k: Kingdom, cost: Bag) {
  for (const [r, v] of Object.entries(cost) as [Resource, number][]) k.res[r] -= v;
}
export function addResources(k: Kingdom, bag: Bag) {
  const cap = capacity(k);
  for (const [r, v] of Object.entries(bag) as [Resource, number][]) k.res[r] = Math.min(cap, k.res[r] + v);
}

export const playerLevel = (k: Kingdom) => 1 + Math.floor(Math.sqrt(k.xp / 40));

export function trainTime(k: Kingdom, u: UnitKey): number {
  const d = UNITS[u];
  return d.time * Math.max(0.4, 1 - 0.07 * (k.buildings[d.building] - 1));
}

/** Avanza el reino hasta `now`: produce recursos y termina obras, entrenamientos y eclosiones. */
export function advance(k: Kingdom, now: number): KingdomEvent[] {
  const events: KingdomEvent[] = [];
  const dt = clamp(now - k.t, 0, MAX_OFFLINE_SECONDS);
  k.t = now;
  const cap = capacity(k);
  for (const r of RESOURCES) if (k.res[r] < cap) k.res[r] = Math.min(cap, k.res[r] + productionRate(k, r) * dt);

  if (k.upgrade && now >= k.upgrade.endsAt) {
    const key = k.upgrade.key;
    k.buildings[key]++;
    k.upgrade = null;
    k.xp += 10 * k.buildings[key];
    events.push({ type: "upgraded", key, level: k.buildings[key] });
  }
  while (k.queue.length && now >= k.queueEndsAt) {
    const u = k.queue.shift()!;
    k.army[u]++;
    events.push({ type: "trained", unit: u });
    k.queueEndsAt = k.queue.length ? k.queueEndsAt + trainTime(k, k.queue[0]) : 0;
  }
  if (k.dragon && k.dragon.hatchesAt > 0 && now >= k.dragon.hatchesAt) {
    k.dragon.hatchesAt = 0;
    k.xp += 40;
    events.push({ type: "hatched", name: k.dragon.name });
  }
  return events;
}

export function upgradeBlocker(k: Kingdom, key: BuildingKey): string | null {
  const level = k.buildings[key];
  if (k.buildings.castle < BUILDINGS[key].unlock) return `Se desbloquea con Castillo ${BUILDINGS[key].unlock}`;
  if (key === "castle" && level >= MAX_CASTLE) return "Nivel máximo";
  if (key !== "castle" && level >= k.buildings.castle) return "Sube el Castillo para mejorar más";
  if (k.upgrade) return "El constructor está ocupado";
  if (!canAfford(k, buildingCost(key, level))) return "Faltan recursos";
  return null;
}

export function startUpgrade(k: Kingdom, key: BuildingKey, now: number): ActionResult {
  const blocker = upgradeBlocker(k, key);
  if (blocker) return fail(blocker);
  const level = k.buildings[key];
  pay(k, buildingCost(key, level));
  const duration = buildingTime(key, level);
  k.upgrade = { key, endsAt: now + duration, duration };
  return OK;
}

export function train(k: Kingdom, u: UnitKey, count: number, now: number): ActionResult {
  const d = UNITS[u];
  if (k.buildings[d.building] < d.buildingLevel) return fail(`Requiere ${BUILDINGS[d.building].name} nv ${d.buildingLevel}`);
  let done = 0;
  for (let i = 0; i < count; i++) {
    if (!canAfford(k, d.cost)) break;
    pay(k, d.cost);
    if (!k.queue.length) k.queueEndsAt = now + trainTime(k, u);
    k.queue.push(u);
    done++;
  }
  return done ? OK : fail("Faltan recursos");
}

// ---------- Dragón ----------
export const dragonLevel = (d: Dragon) => 1 + Math.floor(Math.sqrt(d.xp / 30));
export const dragonMaxLevel = (k: Kingdom) => 3 * k.buildings.nest + 1;
export const dragonStage = (level: number) => (level >= 11 ? 3 : level >= 7 ? 2 : level >= 4 ? 1 : 0);
export const isHatched = (d: Dragon | null): d is Dragon => !!d && d.hatchesAt === 0;
export const dragonReady = (k: Kingdom, now: number) => isHatched(k.dragon) && now >= k.dragon.woundedUntil;

export function dragonStats(d: Dragon) {
  const l = dragonLevel(d);
  const s = dragonStage(l);
  return { atk: Math.round((30 + 12 * l) * (1 + 0.25 * s)), hp: Math.round((150 + 60 * l) * (1 + 0.25 * s)) };
}

export function hatch(k: Kingdom, now: number, pick: number = Math.random()): ActionResult {
  if (!k.buildings.nest) return fail("Construye el Nido de dragón");
  if (k.dragon) return fail("Ya tienes un dragón");
  if (!canAfford(k, HATCH_COST)) return fail("Faltan recursos");
  pay(k, HATCH_COST);
  k.dragon = { name: DRAGON_NAMES[Math.floor(pick * DRAGON_NAMES.length)], xp: 0, hatchesAt: now + HATCH_TIME, woundedUntil: 0 };
  return OK;
}

export function feed(k: Kingdom): ActionResult {
  if (!isHatched(k.dragon)) return fail("No tienes un dragón nacido");
  if (dragonLevel(k.dragon) >= dragonMaxLevel(k)) return fail("Mejora el Nido para que siga creciendo");
  if (!canAfford(k, FEED_COST)) return fail("Faltan recursos");
  pay(k, FEED_COST);
  k.dragon.xp += FEED_XP;
  k.xp += 2;
  return OK;
}

export function dragonGroup(d: Dragon): Group {
  const s = dragonStats(d);
  return { key: "dragon", name: d.name, cls: "dragon", fly: true, atk: s.atk, hp: s.hp, count: 1 };
}

// ---------- Combate ----------
export function unitGroup(u: UnitKey, count: number): Group {
  const d = UNITS[u];
  return { key: u, name: d.name, cls: d.cls, fly: d.fly, atk: d.atk, hp: d.hp, count };
}

/** Tropas en casa más el dragón si está disponible: lo que defiende el reino. */
export function garrison(k: Kingdom, now: number): Group[] {
  const groups = UNIT_KEYS.filter((u) => k.army[u] > 0).map((u) => unitGroup(u, k.army[u]));
  if (dragonReady(k, now)) groups.push(dragonGroup(k.dragon!));
  return groups;
}

export const defenses = (k: Kingdom) => ({ wall: k.buildings.wall * 250, tower: k.buildings.tower * 25 });

export function power(k: Kingdom): number {
  let p = k.buildings.castle * 100;
  for (const key of BUILDING_KEYS) p += k.buildings[key] * 15;
  for (const u of UNIT_KEYS) p += k.army[u] * (UNITS[u].atk + UNITS[u].hp / 4);
  if (isHatched(k.dragon)) {
    const s = dragonStats(k.dragon);
    p += s.atk + s.hp / 4;
  }
  return Math.round(p);
}
