import { simulate, type BattleResult, type Group } from "./combat";
import { defenses, dragonGroup, dragonReady, garrison, protectedAmount, unitGroup, addResources, type Kingdom } from "./kingdom";
import { RESOURCES, UNIT_KEYS, type Bag, type UnitKey } from "./rules";

/** Lo que el atacante decide enviar. Es lo único que manda el cliente. */
export interface AttackOrders {
  units: Partial<Record<UnitKey, number>>;
  dragon: boolean;
}

export interface AttackReport {
  result: BattleResult;
  loot: Bag;
}

export const LOOT_SHARE = 0.3;
export const SHIELD_SECONDS = 240;

export function validateOrders(k: Kingdom, orders: AttackOrders, now: number): string | null {
  let total = 0;
  for (const [u, n] of Object.entries(orders.units) as [UnitKey, number][]) {
    if (!UNIT_KEYS.includes(u)) return `Unidad desconocida: ${u}`;
    if (!Number.isInteger(n) || n < 0) return "Cantidad no válida";
    if (n > k.army[u]) return "No tienes tantas tropas";
    total += n;
  }
  if (orders.dragon && !dragonReady(k, now)) return "Tu dragón no puede combatir";
  if (!total && !orders.dragon) return "Elige al menos una unidad";
  return null;
}

export function ordersToGroups(k: Kingdom, orders: AttackOrders): Group[] {
  const groups = (Object.entries(orders.units) as [UnitKey, number][]).filter(([, n]) => n > 0).map(([u, n]) => unitGroup(u, n));
  if (orders.dragon && k.dragon) groups.push(dragonGroup(k.dragon));
  return groups;
}

/** Aplica las bajas de un bando a su reino. El dragón no muere: queda herido. */
export function applyLosses(k: Kingdom, losses: BattleResult["attackerLosses"], now: number) {
  for (const l of losses) {
    if (l.key === "dragon") {
      if (k.dragon && l.left === 0) k.dragon.woundedUntil = now + 90;
      continue;
    }
    k.army[l.key as UnitKey] -= l.lost;
  }
}

/**
 * Ataque entre dos reinos (PvP asíncrono). El servidor llama a esto con su propia semilla;
 * el defensor no necesita estar conectado.
 */
export function resolvePvp(attacker: Kingdom, defender: Kingdom, orders: AttackOrders, seed: number, now: number): AttackReport {
  const result = simulate(ordersToGroups(attacker, orders), garrison(defender, now), defenses(defender), seed);
  applyLosses(attacker, result.attackerLosses, now);
  applyLosses(defender, result.defenderLosses, now);
  const loot: Bag = {};
  if (result.attackerWon) {
    const p = protectedAmount(defender);
    for (const r of RESOURCES) {
      const v = Math.floor(Math.max(0, defender.res[r] - p) * LOOT_SHARE * (result.stars / 3));
      defender.res[r] -= v;
      loot[r] = v;
    }
    addResources(attacker, loot);
    attacker.xp += 30;
  } else {
    defender.xp += 15;
  }
  defender.shieldUntil = now + SHIELD_SECONDS;
  return { result, loot };
}
