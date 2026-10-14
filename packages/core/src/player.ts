import { simulate, type BattleResult } from "./combat";
import { applyLosses, type AttackOrders, ordersToGroups, validateOrders } from "./attack";
import { addResources, advance, canAfford, createKingdom, defenses, garrison, protectedAmount, type Kingdom, type KingdomEvent } from "./kingdom";
import { rng } from "./rng";
import { RESOURCES, type Bag } from "./rules";
import {
  aiKingdomArmy, aiKingdomDefenses, aiRaidArmy, canExplore, carryCapacity, distance, exploreCost, generateWorld, initTile,
  lairArmy, lairLoot, maxExpeditions, regrowWorld, reveal, tileAt, travelTime, TILE_RESOURCE, type World,
} from "./world";

export interface Expedition {
  x: number;
  y: number;
  start: number;
  end: number;
  loot: Bag;
}

export interface Report {
  /** Segundos. */
  at: number;
  kind: "attack" | "defense";
  /** Desde el punto de vista del dueño del informe. */
  won: boolean;
  stars: number;
  title: string;
  loot: Bag;
  lost: { key: string; lost: number }[];
}

/** Todo lo que pertenece a un jugador: su reino, su mapa y su historial. */
export interface Player {
  kingdom: Kingdom;
  world: World;
  expeditions: Expedition[];
  reports: Report[];
  nextRaid: number;
  /** Semilla que avanza con cada decisión aleatoria del servidor (asaltos, guaridas nuevas…). */
  seed: number;
}

export interface Battle {
  title: string;
  seed: number;
  result: BattleResult;
  loot: Bag;
}

export type PlayerEvent =
  | KingdomEvent
  | { type: "expedition"; loot: Bag }
  | { type: "raid"; from: string; lost: boolean; report: Report };

export type Outcome<T = void> = { ok: true; value: T } | { ok: false; reason: string };
const fail = <T>(reason: string): Outcome<T> => ({ ok: false, reason });
const ok = <T>(value: T): Outcome<T> => ({ ok: true, value });

export const FIRST_RAID = 240;
export const MAX_REPORTS = 30;

/** Partida nueva. Sin `world`, el mapa se genera a partir de la semilla. */
export function createPlayer(name: string, seed: number, now: number, world?: World): Player {
  return { kingdom: createKingdom(name, now), world: world ? (JSON.parse(JSON.stringify(world)) as World) : generateWorld(seed), expeditions: [], reports: [], nextRaid: now + FIRST_RAID, seed };
}

/** Siguiente número aleatorio de la partida, guardado en el propio estado. */
function nextRandom(p: Player): number {
  const r = rng(p.seed)();
  p.seed = Math.floor(r * 2 ** 31);
  return r;
}

export function addReport(p: Player, r: Report) {
  p.reports.unshift(r);
  p.reports = p.reports.slice(0, MAX_REPORTS);
}

/**
 * Avanza la partida hasta `now`: producción, obras, vuelta de recolectores y asaltos de la IA.
 * `raids: false` sirve para avanzar una copia solo para mostrarla (el servidor decide los asaltos).
 */
export function tickPlayer(p: Player, now: number, opts: { raids?: boolean } = {}): PlayerEvent[] {
  const k = p.kingdom;
  const before = k.t;
  const events: PlayerEvent[] = advance(k, now);
  regrowWorld(p.world, Math.max(0, now - before));
  for (const e of [...p.expeditions]) {
    if (now < e.end) continue;
    p.expeditions.splice(p.expeditions.indexOf(e), 1);
    addResources(k, e.loot);
    k.xp += 4;
    events.push({ type: "expedition", loot: e.loot });
  }
  if (opts.raids !== false && now >= p.nextRaid) {
    p.nextRaid = now + 120 + nextRandom(p) * 90;
    if (now >= k.shieldUntil) events.push(aiRaid(p, now));
  }
  return events;
}

/** Un reino IA asalta al jugador. Defienden las tropas en casa, la muralla y las torres. */
function aiRaid(p: Player, now: number): PlayerEvent {
  const k = p.kingdom;
  const rivals = p.world.tiles.filter((t) => t.kind === "kingdom");
  rivals.sort((a, b) => Math.abs(a.level - k.buildings.castle) - Math.abs(b.level - k.buildings.castle));
  const from = rivals[Math.floor(nextRandom(p) * Math.min(2, rivals.length))]?.name ?? "Bandidos";
  const result = simulate(aiRaidArmy(k.buildings.castle), garrison(k, now), defenses(k), Math.floor(nextRandom(p) * 2 ** 31));
  applyLosses(k, result.defenderLosses, now);
  const lost: Bag = {};
  if (result.attackerWon) {
    const prot = protectedAmount(k);
    for (const r of RESOURCES) {
      const v = Math.round(Math.max(0, k.res[r] - prot) * 0.3);
      k.res[r] -= v;
      lost[r] = v;
    }
  } else k.xp += 15;
  k.shieldUntil = now + 240;
  const report: Report = {
    at: now, kind: "defense", won: !result.attackerWon, stars: result.stars, title: `${from} atacó tu reino`, loot: lost,
    lost: result.defenderLosses.filter((l) => l.lost > 0 && l.key !== "dragon"),
  };
  addReport(p, report);
  return { type: "raid", from, lost: result.attackerWon, report };
}

export function explore(p: Player, x: number, y: number): Outcome {
  const w = p.world;
  const t = tileAt(w, x, y);
  if (!t) return fail("Casilla fuera del mapa");
  if (t.seen) return fail("Ya está explorada");
  if (!canExplore(w, x, y)) return fail("Explora primero una casilla vecina");
  const cost = exploreCost(w, x, y);
  if (!canAfford(p.kingdom, cost)) return fail("Te falta comida para pagar a los exploradores");
  p.kingdom.res.food -= cost.food;
  reveal(w, x, y);
  p.kingdom.xp += 5;
  return ok(undefined);
}

/** Envía recolectores a un yacimiento o a excavar unas ruinas. */
export function gather(p: Player, x: number, y: number, now: number): Outcome<Expedition> {
  const w = p.world;
  const t = tileAt(w, x, y);
  if (!t || !t.seen) return fail("No conoces esa casilla");
  if (p.expeditions.length >= maxExpeditions(p.kingdom.buildings.castle)) return fail("Todos tus recolectores están fuera");
  let loot: Bag;
  if (t.kind === "ruins") {
    loot = { gold: 60 * t.level, wood: 40 * t.level, stone: 40 * t.level };
    t.kind = t.base ?? "plain";
    initTile(t, distance(w, x, y));
  } else {
    const r = TILE_RESOURCE[t.kind];
    if (!r) return fail("Aquí no hay nada que recoger");
    const amount = Math.floor(Math.min(t.amount ?? 0, carryCapacity(p.kingdom.buildings.castle)));
    if (amount < 10) return fail("Este yacimiento está casi agotado. Vuelve más tarde");
    t.amount! -= amount;
    loot = { [r]: amount };
  }
  const e: Expedition = { x, y, start: now, end: now + travelTime(w, x, y), loot };
  p.expeditions.push(e);
  return ok(e);
}

/** Ataca una guarida o un reino IA del mapa. */
export function attackTile(p: Player, x: number, y: number, orders: AttackOrders, now: number): Outcome<Battle> {
  const k = p.kingdom, w = p.world;
  const tile = tileAt(w, x, y);
  if (!tile || !tile.seen || (tile.kind !== "lair" && tile.kind !== "kingdom")) return fail("No hay nada que atacar ahí");
  if (tile.kind === "kingdom" && (tile.shieldUntil ?? 0) > now) return fail("El reino tiene escudo");
  const invalid = validateOrders(k, orders, now);
  if (invalid) return fail(invalid);
  const isLair = tile.kind === "lair";
  const title = isLair ? `Ataque a la guarida (nivel ${tile.level})` : `Ataque a ${tile.name} (castillo ${tile.level})`;
  const seed = Math.floor(nextRandom(p) * 2 ** 31);
  const result = simulate(
    ordersToGroups(k, orders),
    isLair ? lairArmy(tile.level) : aiKingdomArmy(tile.level),
    isLair ? { wall: 0, tower: 0 } : aiKingdomDefenses(tile.level),
    seed,
  );
  applyLosses(k, result.attackerLosses, now);
  if (orders.dragon && k.dragon) k.dragon.xp += result.attackerWon ? 25 * tile.level : 8;

  let loot: Bag = {};
  if (result.attackerWon) {
    if (isLair) {
      loot = lairLoot(tile.level);
      k.xp += 20 * tile.level;
      const pick = (["plain", "forest", "mountain"] as const)[Math.floor(nextRandom(p) * 3)];
      tile.kind = tile.base ?? pick;
      initTile(tile, distance(w, x, y));
      respawnLair(p);
    } else {
      const v = Math.round(tile.treasure! * (0.12 + 0.06 * result.stars));
      loot = { gold: v, wood: v, stone: v, food: v };
      tile.treasure! -= v;
      tile.shieldUntil = now + 180;
      k.xp += 30 * tile.level;
    }
    addResources(k, loot);
  }
  addReport(p, {
    at: now, kind: "attack", won: result.attackerWon, stars: result.stars, title, loot,
    lost: result.attackerLosses.filter((l) => l.lost > 0 && l.key !== "dragon"),
  });
  return ok({ title, seed, result, loot });
}

function respawnLair(p: Player) {
  const w = p.world;
  for (let i = 0; i < 60; i++) {
    const x = Math.floor(nextRandom(p) * w.size), y = Math.floor(nextRandom(p) * w.size);
    const t = tileAt(w, x, y)!;
    if (distance(w, x, y) > 2 && !t.seen && (t.kind === "plain" || t.kind === "forest" || t.kind === "mountain")) {
      t.base ??= t.kind;
      t.kind = "lair";
      initTile(t, distance(w, x, y));
      return;
    }
  }
}
