import { describe, expect, it } from "vitest";
import { createKingdom, resolvePvp, simulate, unitGroup, validateOrders, protectedAmount, RESOURCES } from "../src";

describe("combate", () => {
  it("es determinista con la misma semilla", () => {
    const a = [unitGroup("inf", 20), unitGroup("arc", 10)];
    const d = [unitGroup("cav", 12), unitGroup("arc", 8)];
    const r1 = simulate(a, d, { wall: 300, tower: 20 }, 42);
    const r2 = simulate(a, d, { wall: 300, tower: 20 }, 42);
    expect(r1).toEqual(r2);
  });

  it("la infantería gana a la caballería a igual vida total", () => {
    // 55 caballeros y 40 infantes tienen la misma vida por grupo: 11*40 = 8*55
    const r = simulate([unitGroup("inf", 11)], [unitGroup("cav", 8)], { wall: 0, tower: 0 }, 1);
    expect(r.attackerWon).toBe(true);
  });

  it("la muralla frena a la tropa de tierra pero no a los voladores", () => {
    const def = [unitGroup("arc", 2)];
    const ground = simulate([unitGroup("inf", 5)], def, { wall: 5000, tower: 0 }, 7);
    expect(ground.attackerWon).toBe(false);
    const air = simulate([unitGroup("griffin", 5)], def, { wall: 5000, tower: 0 }, 7);
    expect(air.attackerWon).toBe(true);
  });

  it("rechaza órdenes con más tropas de las que hay", () => {
    const k = createKingdom("A", 0);
    expect(validateOrders(k, { units: { inf: 99 }, dragon: false }, 0)).toBe("No tienes tantas tropas");
    expect(validateOrders(k, { units: { inf: 3 }, dragon: true }, 0)).toBe("Tu dragón no puede combatir");
    expect(validateOrders(k, { units: { inf: 3 }, dragon: false }, 0)).toBeNull();
  });

  it("en PvP el botín sale solo de lo no protegido y el defensor recibe escudo", () => {
    const att = createKingdom("A", 0);
    const def = createKingdom("B", 0);
    att.army.inf = 60;
    def.army.inf = 2;
    const before = { ...def.res };
    const { result, loot } = resolvePvp(att, def, { units: { inf: 60 }, dragon: false }, 99, 100);
    expect(result.attackerWon).toBe(true);
    for (const r of RESOURCES) {
      expect(loot[r]!).toBeLessThanOrEqual((before[r] - protectedAmount(def)) * 0.3);
      expect(def.res[r]).toBe(before[r] - loot[r]!);
    }
    expect(def.shieldUntil).toBe(100 + 240);
    expect(att.army.inf).toBeLessThanOrEqual(60);
  });
});
