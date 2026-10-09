import {
  RESOURCES, TILE_NAMES, TILE_RESOURCE, addResources, advance, aiKingdomArmy, aiKingdomDefenses, aiRaidArmy, applyLosses,
  canAfford, canExplore, carryCapacity, createKingdom, defenses, distance, exploreCost, feed, garrison, generateWorld, hatch,
  initTile, lairArmy, lairLoot, maxExpeditions, ordersToGroups, protectedAmount, regrowWorld, reveal, simulate, startUpgrade,
  tileAt, train, travelTime, validateOrders,
  type ActionResult, type AttackOrders, type Bag, type BattleResult, type BuildingKey, type Kingdom, type KingdomEvent,
  type Resource, type UnitKey, type World,
} from "@empire/core";
import { BUILDINGS, UNITS } from "@empire/core";

export interface Expedition {
  x: number;
  y: number;
  start: number;
  end: number;
  loot: Bag;
}

export interface Report {
  at: number;
  kind: "attack" | "defense";
  /** Desde el punto de vista del jugador. */
  won: boolean;
  stars: number;
  title: string;
  loot: Bag;
  lost: { key: string; lost: number }[];
}

export interface SaveData {
  v: 2;
  kingdom: Kingdom;
  world: World;
  expeditions: Expedition[];
  reports: Report[];
  unread: number;
  nextRaid: number;
}

export type Tab = "reino" | "mapa" | "ejercito" | "informes";
export type Selection = { view: "kingdom"; key: BuildingKey } | { view: "world"; x: number; y: number } | null;

export interface Battle {
  title: string;
  result: BattleResult;
  loot: Bag;
}

const SAVE_KEY = "empire-save-v2";
const FIRST_RAID = 240;

export const now = () => Date.now() / 1000;

export const lootText = (bag: Bag) =>
  (Object.entries(bag) as [Resource, number][])
    .filter(([, v]) => v > 0)
    .map(([r, v]) => `${Math.round(v)} de ${({ gold: "oro", wood: "madera", stone: "piedra", food: "comida" } as const)[r]}`)
    .join(", ") || "nada";

/** Estado de la partida en este dispositivo. Más adelante se sincronizará con el servidor. */
class Game {
  data: SaveData;
  tab: Tab = "reino";
  selection: Selection = null;
  private listeners = new Set<() => void>();
  private toastListeners = new Set<(msg: string, bad: boolean) => void>();

  constructor() {
    this.data = this.load() ?? this.fresh();
  }

  fresh(): SaveData {
    const t = now();
    return {
      v: 2, kingdom: createKingdom("Tu reino", t), world: generateWorld(Math.floor(Math.random() * 1e9)),
      expeditions: [], reports: [], unread: 0, nextRaid: t + FIRST_RAID,
    };
  }

  private load(): SaveData | null {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      const d = raw ? (JSON.parse(raw) as SaveData) : null;
      return d && d.v === 2 ? d : null;
    } catch {
      return null;
    }
  }

  save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
    } catch {
      /* sin almacenamiento: la partida dura lo que la pestaña */
    }
  }

  reset() {
    this.data = this.fresh();
    this.selection = null;
    this.save();
    this.changed();
  }

  get kingdom() {
    return this.data.kingdom;
  }
  get world() {
    return this.data.world;
  }

  onChange(fn: () => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  onToast(fn: (msg: string, bad: boolean) => void) {
    this.toastListeners.add(fn);
  }
  changed() {
    this.listeners.forEach((fn) => fn());
  }
  toast(msg: string, bad = false) {
    this.toastListeners.forEach((fn) => fn(msg, bad));
  }

  setTab(tab: Tab) {
    this.tab = tab;
    if (tab === "informes") this.data.unread = 0;
    if (tab === "reino" && this.selection?.view === "world") this.selection = null;
    if (tab === "mapa" && this.selection?.view === "kingdom") this.selection = null;
    this.changed();
  }

  select(sel: Selection) {
    this.selection = sel;
    this.changed();
  }

  /** Avanza el tiempo. Devuelve true si cambió algo que haya que redibujar. */
  tick(): boolean {
    const t = now();
    const k = this.kingdom;
    const before = k.t;
    const events = advance(k, t);
    regrowWorld(this.world, Math.max(0, t - before));
    for (const e of events) if (e.type !== "trained") this.toast(eventText(e));
    let changed = events.length > 0;

    for (const e of [...this.data.expeditions]) {
      if (t < e.end) continue;
      this.data.expeditions.splice(this.data.expeditions.indexOf(e), 1);
      addResources(k, e.loot);
      k.xp += 4;
      this.toast(`Los recolectores vuelven con ${lootText(e.loot)}.`);
      changed = true;
    }
    if (t >= this.data.nextRaid) {
      this.data.nextRaid = t + 120 + Math.random() * 90;
      if (t >= k.shieldUntil) this.raid(t);
      changed = true;
    }
    if (changed) {
      this.save();
      this.changed();
    }
    return changed;
  }

  private act(r: ActionResult) {
    if (!r.ok) this.toast(r.reason, true);
    this.save();
    this.changed();
    return r.ok;
  }

  upgrade(key: BuildingKey) {
    return this.act(startUpgrade(this.kingdom, key, now()));
  }
  train(unit: UnitKey, count: number) {
    return this.act(train(this.kingdom, unit, count, now()));
  }
  hatch() {
    return this.act(hatch(this.kingdom, now()));
  }
  feed() {
    return this.act(feed(this.kingdom));
  }

  explore(x: number, y: number) {
    const t = tileAt(this.world, x, y);
    if (!t || t.seen || !canExplore(this.world, x, y)) return;
    const cost = exploreCost(this.world, x, y);
    if (!canAfford(this.kingdom, cost)) return this.toast("Te falta comida para pagar a los exploradores.", true);
    this.kingdom.res.food -= cost.food;
    reveal(this.world, x, y);
    this.kingdom.xp += 5;
    this.save();
    this.changed();
  }

  /** Envía recolectores a un yacimiento o a excavar unas ruinas. */
  gather(x: number, y: number) {
    const w = this.world;
    const t = tileAt(w, x, y)!;
    if (this.data.expeditions.length >= maxExpeditions(this.kingdom.buildings.castle))
      return this.toast("Todos tus recolectores están fuera.", true);
    const start = now();
    let loot: Bag;
    if (t.kind === "ruins") {
      loot = { gold: 60 * t.level, wood: 40 * t.level, stone: 40 * t.level };
      t.kind = "plain";
      initTile(t, distance(w, x, y));
    } else {
      const r = TILE_RESOURCE[t.kind];
      if (!r) return;
      const amount = Math.floor(Math.min(t.amount ?? 0, carryCapacity(this.kingdom.buildings.castle)));
      if (amount < 10) return this.toast("Este yacimiento está casi agotado. Vuelve más tarde.", true);
      t.amount! -= amount;
      loot = { [r]: amount };
    }
    this.data.expeditions.push({ x, y, start, end: start + travelTime(w, x, y), loot });
    this.save();
    this.changed();
  }

  /** Ataca una guarida o un reino IA del mapa. */
  attack(x: number, y: number, orders: AttackOrders): Battle | null {
    const k = this.kingdom;
    const w = this.world;
    const tile = tileAt(w, x, y)!;
    const t = now();
    const invalid = validateOrders(k, orders, t);
    if (invalid) {
      this.toast(invalid, true);
      return null;
    }
    const isLair = tile.kind === "lair";
    const title = isLair ? `Guarida (nivel ${tile.level})` : `${tile.name} (castillo ${tile.level})`;
    const result = simulate(
      ordersToGroups(k, orders),
      isLair ? lairArmy(tile.level) : aiKingdomArmy(tile.level),
      isLair ? { wall: 0, tower: 0 } : aiKingdomDefenses(tile.level),
      Math.floor(Math.random() * 2 ** 31),
    );
    applyLosses(k, result.attackerLosses, t);
    if (orders.dragon && k.dragon) k.dragon.xp += result.attackerWon ? 25 * tile.level : 8;

    let loot: Bag = {};
    if (result.attackerWon) {
      if (isLair) {
        loot = lairLoot(tile.level);
        k.xp += 20 * tile.level;
        tile.kind = (["plain", "forest", "mountain"] as const)[Math.floor(Math.random() * 3)];
        initTile(tile, distance(w, x, y));
        this.respawnLair();
      } else {
        const v = Math.round(tile.treasure! * (0.12 + 0.06 * result.stars));
        loot = { gold: v, wood: v, stone: v, food: v };
        tile.treasure! -= v;
        tile.shieldUntil = t + 180;
        k.xp += 30 * tile.level;
      }
      addResources(k, loot);
    }
    this.addReport({
      at: Date.now(), kind: "attack", won: result.attackerWon, stars: result.stars, title: `Ataque a ${title}`, loot,
      lost: result.attackerLosses.filter((l) => l.lost > 0 && l.key !== "dragon"),
    }, false);
    this.save();
    this.changed();
    return { title: `Ataque a ${title}`, result, loot };
  }

  private respawnLair() {
    const w = this.world;
    for (let i = 0; i < 60; i++) {
      const x = Math.floor(Math.random() * w.size), y = Math.floor(Math.random() * w.size);
      const t = tileAt(w, x, y)!;
      if (distance(w, x, y) > 2 && !t.seen && (t.kind === "plain" || t.kind === "forest" || t.kind === "mountain")) {
        t.kind = "lair";
        initTile(t, distance(w, x, y));
        return;
      }
    }
  }

  /** Un reino IA asalta al jugador. Defienden las tropas en casa, la muralla y las torres. */
  private raid(t: number) {
    const k = this.kingdom;
    const rivals = this.world.tiles.filter((x) => x.kind === "kingdom");
    rivals.sort((a, b) => Math.abs(a.level - k.buildings.castle) - Math.abs(b.level - k.buildings.castle));
    const from = rivals[Math.floor(Math.random() * Math.min(2, rivals.length))]?.name ?? "Bandidos";
    const result = simulate(aiRaidArmy(k.buildings.castle), garrison(k, t), defenses(k), Math.floor(Math.random() * 2 ** 31));
    applyLosses(k, result.defenderLosses, t);
    const lost: Bag = {};
    if (result.attackerWon) {
      const p = protectedAmount(k);
      for (const r of RESOURCES) {
        const v = Math.round(Math.max(0, k.res[r] - p) * 0.3);
        k.res[r] -= v;
        lost[r] = v;
      }
    } else k.xp += 15;
    k.shieldUntil = t + 240;
    this.addReport({
      at: Date.now(), kind: "defense", won: !result.attackerWon, stars: result.stars, title: `${from} atacó tu reino`, loot: lost,
      lost: result.defenderLosses.filter((l) => l.lost > 0 && l.key !== "dragon"),
    }, true);
    this.toast(result.attackerWon ? `${from} ha saqueado tu reino. Revisa Informes.` : `Has rechazado el ataque de ${from}.`, result.attackerWon);
  }

  private addReport(r: Report, notify: boolean) {
    this.data.reports.unshift(r);
    this.data.reports = this.data.reports.slice(0, 30);
    if (notify && this.tab !== "informes") this.data.unread++;
  }
}

function eventText(e: KingdomEvent) {
  switch (e.type) {
    case "upgraded":
      return `${BUILDINGS[e.key].name} sube a nivel ${e.level}.`;
    case "trained":
      return `${UNITS[e.unit].name}: una unidad lista.`;
    case "hatched":
      return `¡Tu huevo ha eclosionado! Ha nacido ${e.name}.`;
  }
}

export { TILE_NAMES };
export const game = new Game();
